import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Flip any legacy media.status === 'pending' to 'approved' so old submissions go live.

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

function approveMediaList(arr) {
  let n = 0
  const next = (arr || []).map((m) => {
    if (m && m.status === 'pending') {
      n += 1
      return { ...m, status: 'approved' }
    }
    return m
  })
  return { next, n }
}

const token = await getAccessToken()
const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/settlements?pageSize=100`
const list = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

let total = 0
for (const d of list.documents || []) {
  const docId = d.name.split('/').pop()
  const fields = {}
  for (const [k, v] of Object.entries(d.fields || {})) fields[k] = fromFs(v)
  let changed = 0
  const pois = (fields.pois || []).map((p) => {
    const before = approveMediaList(p.before)
    const during = approveMediaList(p.during)
    const after = (p.after || []).map((e) => {
      const med = approveMediaList(e.media)
      changed += med.n
      return { ...e, media: med.next }
    })
    changed += before.n + during.n
    return { ...p, before: before.next, during: during.next, after }
  })
  if (!changed) continue

  const name = `projects/${PROJECT}/databases/(default)/documents/settlements/${docId}`
  const r = await fetch(`${name}?updateMask.fieldPaths=pois`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { pois: toFs(pois) } }),
  })
  if (!r.ok) throw new Error(`patch ${docId} failed ${r.status}: ${await r.text()}`)
  console.log(`✓ ${fields.name || docId}: ${changed} items approved`)
  total += changed
}
console.log(`Done. Approved ${total} pending items.`)
