import { readFileSync, writeFileSync } from 'fs'
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
const PROJECT = env.VITE_FB_PROJECT_ID
const toolsPath = join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json')
const DOC = `projects/${PROJECT}/databases/(default)/documents/settlements/shirat-hayam`
const API = 'https://he.wikipedia.org/w/api.php'

async function getToken() {
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
  if (!r.ok) throw new Error('token ' + r.status)
  const data = await r.json()
  tools.tokens = { ...tok, access_token: data.access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 }
  writeFileSync(toolsPath, JSON.stringify(tools, null, 2))
  return data.access_token
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
  throw new Error('bad type')
}

function fromFs(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
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

async function wiki(params, attempt = 0) {
  const r = await fetch(`${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`, {
    headers: { 'Api-User-Agent': '9bav-memorial/1.0 (chepti@gmail.com)' },
  })
  if (r.status === 429 && attempt < 5) {
    await new Promise((res) => setTimeout(res, 9000 * (attempt + 1)))
    return wiki(params, attempt + 1)
  }
  if (!r.ok) throw new Error('wiki ' + r.status)
  return r.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const token = await getToken()
const title = 'שירת הים (יישוב)'

const q1 = await wiki({
  action: 'query',
  titles: title,
  redirects: '1',
  prop: 'extracts|info',
  exintro: '1',
  explaintext: '1',
  inprop: 'url',
})
const page = Object.values(q1.query.pages)[0]
if (!page || page.missing != null) throw new Error('missing wiki page')
const intro = (page.extract || '').trim()
const pageUrl = page.fullurl || `https://he.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
console.log('Wiki:', page.title)
console.log('Intro:', intro)

await sleep(1000)
const q2 = await wiki({
  action: 'query',
  titles: page.title,
  redirects: '1',
  prop: 'extracts',
  explaintext: '1',
})
const full = Object.values(q2.query.pages)[0]?.extract || ''

// Build a clean general body: intro + first historical section if present
let general = intro
const re = /\n*={2,}\s*([^=\n]+?)\s*={2,}\n*/g
const sections = []
let last = 0
let m
const raw = full
const heads = [{ heading: '', start: 0 }]
while ((m = re.exec(raw))) {
  heads[heads.length - 1].end = m.index
  heads.push({ heading: m[1].trim(), start: re.lastIndex })
}
heads[heads.length - 1].end = raw.length
for (const h of heads) {
  const body = raw.slice(h.start, h.end).replace(/\s+/g, ' ').trim()
  if (body.length > 40) sections.push({ heading: h.heading, body })
}
const hist = sections.find((s) => /היסטוריה|הקמה|רקע/.test(s.heading))
if (hist && hist.body.length > intro.length + 40) {
  general = (intro + '\n\n' + hist.body).slice(0, 1800)
}

const info = [
  { key: 'general', body: general, entries: [], media: [] },
  { key: 'agriculture', body: '', entries: [], media: [] },
  { key: 'education', body: '', entries: [], media: [] },
  { key: 'community', body: '', entries: [], media: [] },
  { key: 'commerce', body: '', entries: [], media: [] },
]

await sleep(1000)
const img = await wiki({
  action: 'query',
  generator: 'images',
  titles: page.title,
  gimlimit: '12',
  prop: 'imageinfo',
  iiprop: 'url|mime|size',
  iiurlwidth: '1200',
  redirects: '1',
})
const gallery = []
for (const p of Object.values(img.query?.pages || {})) {
  const ii = p.imageinfo?.[0]
  if (!ii) continue
  if (!/^image\/(jpeg|png|webp)$/i.test(ii.mime || '')) continue
  const name = (p.title || '').toLowerCase()
  if (/icon|logo|flag|\.svg|scroll|torah|manuscript|mezuzah/.test(name)) continue
  gallery.push({
    id: `wiki-${gallery.length + 1}`,
    url: ii.url,
    thumb: ii.thumburl || ii.url,
    caption: (p.title || '').replace(/^קובץ:/, '').replace(/\.[^.]+$/, ''),
    credit: 'ויקיפדיה / ויקישיתוף',
    sourceUrl: pageUrl,
  })
  if (gallery.length >= 4) break
}
console.log('general chars:', general.length, 'gallery:', gallery.length)

async function fsFetch(method, url, bodyObj) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(bodyObj ? { 'Content-Type': 'application/json' } : {}),
      },
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
    })
    if (r.status === 429) {
      const wait = 20000 * (a + 1)
      console.log('Firestore 429, wait', wait / 1000, 's')
      await sleep(wait)
      continue
    }
    return r
  }
  throw new Error('firestore quota')
}

const gr = await fsFetch('GET', `https://firestore.googleapis.com/v1/${DOC}`)
console.log('GET', gr.status)
if (!gr.ok) throw new Error(await gr.text())
const existing = await gr.json()
const fields = {}
for (const [k, v] of Object.entries(existing.fields || {})) fields[k] = fromFs(v)
for (const sec of info) {
  const old = (fields.info || []).find((i) => i.key === sec.key)
  if (old?.entries?.length) sec.entries = old.entries
}

const patch = { info, wikiTitle: page.title }
if (gallery.length) patch.gallery = gallery
const qs = Object.keys(patch)
  .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
  .join('&')
const pr = await fsFetch('PATCH', `https://firestore.googleapis.com/v1/${DOC}?${qs}`, {
  fields: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, toFs(v)])),
})
console.log('PATCH', pr.status)
if (!pr.ok) throw new Error(await pr.text())
console.log('Done. שירת הים fixed from', page.title)
