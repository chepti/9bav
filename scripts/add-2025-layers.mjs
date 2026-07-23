import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createHash as hash } from 'crypto'
import { join } from 'path'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const ENDPOINT = env.VITE_DRIVE_ENDPOINT
const PROJECT = env.VITE_FB_PROJECT_ID

// Caption message id in Makles thread (album = msg / msg+1). Photo #2 = 2025.
const TARGETS = [
  { name: 'ניסנית', preferIds: ['nisanit'], msg: 5614 },
  { name: 'אלי סיני', preferIds: ['elei-sinai'], msg: 5616 },
  { name: 'דוגית', preferIds: ['dugit'], msg: 5618 },
  { name: 'כפר דרום', preferIds: ['kfar-darom'], msg: 5622 },
  { name: 'תל קטיפא', preferIds: ['tel-katifa'], msg: 5624 },
  { name: 'נצר חזני', preferIds: ['netzer-hazani'], msg: 5626 },
  { name: 'קטיף', preferIds: ['katif'], msg: 5628 },
  { name: 'גני טל', preferIds: ['ganei-tal'], msg: 5630 },
  { name: 'נווה דקלים', preferIds: ['neve-dekalim'], msg: 5632 },
  { name: 'גן אור', preferIds: ['gan-or'], msg: 5636 },
  { name: 'שירת הים', preferIds: ['shirat-hayam'], msg: 5638, reuseFrom: 'kfar-yam' },
  { name: 'בדולח', preferIds: ['bedolah'], msg: 5640 },
  { name: 'מורג', preferIds: ['morag'], msg: 5646 },
  { name: 'פאת שדה', preferIds: ['peat-sadeh'], msg: 5648 },
  { name: 'שליו', preferIds: ['shalev'], msg: 5650 },
  { name: 'רפיח ים', preferIds: ['rafiah-yam'], msg: 5652 },
]

async function fetchPostPhotos(id) {
  for (const url of [`https://t.me/BenTzionM/${id}?embed=1&mode=tme`, `https://t.me/s/BenTzionM/${id}`]) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) continue
    const html = await r.text()
    const photos = [...html.matchAll(/background-image:url\('(https:\/\/cdn[^']+)'\)/g)].map((m) => m[1])
    if (photos.length) return [...new Set(photos)]
  }
  return []
}

async function downloadUniquePair(msg) {
  const urls = [...new Set([...(await fetchPostPhotos(msg)), ...(await fetchPostPhotos(msg + 1))])]
  const files = []
  const seen = new Set()
  for (const url of urls) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) continue
    const buf = Buffer.from(await r.arrayBuffer())
    const h = hash('sha1').update(buf).digest('hex').slice(0, 10)
    if (seen.has(h)) continue
    seen.add(h)
    files.push({ buf, hash: h, url })
  }
  if (files.length < 2) throw new Error(`expected 2 unique photos for msg ${msg}, got ${files.length}`)
  return { before: files[0], after: files[1] }
}

async function uploadBuf(buf, name) {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ name, mimeType: 'image/jpeg', dataBase64: buf.toString('base64') }),
    redirect: 'follow',
  })
  if (!resp.ok) throw new Error(`Drive upload failed ${resp.status} ${name}`)
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return data
}

// --- Firebase OAuth (CLI tokens) ---
const toolsPath = join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json')
async function getAccessToken() {
  const tools = JSON.parse(readFileSync(toolsPath, 'utf8'))
  const tok = tools.tokens || {}
  if (tok.access_token && tok.expires_at && Date.now() < tok.expires_at - 60_000) return tok.access_token
  const body = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    grant_type: 'refresh_token',
    refresh_token: tok.refresh_token,
  })
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) throw new Error(`token refresh failed ${r.status} ${await r.text()}`)
  const data = await r.json()
  tools.tokens = { ...tok, access_token: data.access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 }
  writeFileSync(toolsPath, JSON.stringify(tools, null, 2))
  return data.access_token
}

function fromFs(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs)
  if ('mapValue' in v) {
    const o = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) o[k] = fromFs(val)
    return o
  }
  return null
}

function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined) continue
      fields[k] = toFs(val)
    }
    return { mapValue: { fields } }
  }
  throw new Error(`unsupported ${typeof v}`)
}

async function listSettlements(token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/settlements?pageSize=100`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`list failed ${r.status} ${await r.text()}`)
  const data = await r.json()
  return (data.documents || []).map((d) => {
    const id = d.name.split('/').pop()
    const fields = {}
    for (const [k, v] of Object.entries(d.fields || {})) fields[k] = fromFs(v)
    return { id, ...fields }
  })
}

async function patchSettlement(token, docId, patch) {
  const paths = Object.keys(patch)
  const qs = paths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&')
  const name = `projects/${PROJECT}/databases/(default)/documents/settlements/${docId}`
  const fields = {}
  for (const [k, v] of Object.entries(patch)) fields[k] = toFs(v)
  const r = await fetch(`https://firestore.googleapis.com/v1/${name}?${qs}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`patch ${docId} failed ${r.status}: ${await r.text()}`)
}

function resolveDoc(settlements, t) {
  for (const id of t.preferIds) {
    const hit = settlements.find((s) => s.id === id)
    if (hit) return hit
  }
  return settlements.find((s) => s.name === t.name)
}

function existing2005(s) {
  const layers = Array.isArray(s.imageLayers) ? s.imageLayers : []
  const fromLayer = layers.find((l) => String(l.year) === '2005' && (l.driveId || l.url))
  if (fromLayer) return { year: '2005', driveId: fromLayer.driveId || undefined, url: fromLayer.url || undefined }
  if (s.historical && (s.historical.driveId || s.historical.url)) {
    return {
      year: s.historical.year || '2005',
      driveId: s.historical.driveId || undefined,
      url: s.historical.url || undefined,
    }
  }
  // any existing layer as fallback
  const any = layers.find((l) => l.driveId || l.url)
  if (any) return { year: String(any.year || '2005'), driveId: any.driveId || undefined, url: any.url || undefined }
  return null
}

const outDir = join('scripts', 'tmp', 'photos2025')
mkdirSync(outDir, { recursive: true })

const token = await getAccessToken()
const settlements = await listSettlements(token)
console.log(`Loaded ${settlements.length} settlements`)

// Find kfar-yam 2025 for reuse on shirat-hayam
const kfarYam = settlements.find((s) => s.name === 'כפר ים' || s.id === 'stl-mrxen0p0-1-fmxp')
const kfar2025 = (kfarYam?.imageLayers || []).find((l) => String(l.year) === '2025' && l.driveId)

const report = []
for (const t of TARGETS) {
  const doc = resolveDoc(settlements, t)
  if (!doc) {
    console.warn(`⚠ skip ${t.name}: doc not found`)
    continue
  }
  const layersNow = doc.imageLayers || []
  if (layersNow.some((l) => String(l.year) === '2025' && (l.driveId || l.url))) {
    console.log(`· ${t.name}: already has 2025`)
    continue
  }

  const before = existing2005(doc)
  if (!before) {
    console.warn(`⚠ skip ${t.name}: no existing 2005 to keep`)
    continue
  }

  let drive2025
  if (t.reuseFrom === 'kfar-yam' && kfar2025?.driveId) {
    drive2025 = { id: kfar2025.driveId }
    console.log(`${t.name}: reusing כפר ים 2025 (${drive2025.id})`)
  } else {
    console.log(`${t.name}: downloading from Telegram ${t.msg}…`)
    const pair = await downloadUniquePair(t.msg)
    writeFileSync(join(outDir, `${doc.id}-2025.jpg`), pair.after.buf)
    console.log(`${t.name}: uploading…`)
    drive2025 = await uploadBuf(pair.after.buf, `${doc.id}-2025-makles.jpg`)
    console.log(`  -> ${drive2025.id}`)
  }

  const imageLayers = [
    { year: '2005', ...(before.driveId ? { driveId: before.driveId } : {}), ...(before.url ? { url: before.url } : {}) },
    { year: '2025', driveId: drive2025.id },
  ]

  await patchSettlement(token, doc.id, { imageLayers, historical: null })
  console.log(`✓ ${t.name} (${doc.id})`)
  report.push({ name: t.name, docId: doc.id, imageLayers })
}

writeFileSync(join('scripts', 'tmp', 'add-2025-report.json'), JSON.stringify(report, null, 2), 'utf8')
console.log(`\nDone. Updated ${report.length} settlements.`)
