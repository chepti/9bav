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

const token = await getAccessToken()
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/settlements?pageSize=100`
const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
const data = await r.json()
const rows = (data.documents || []).map((d) => {
  const id = d.name.split('/').pop()
  const fields = {}
  for (const [k, v] of Object.entries(d.fields || {})) fields[k] = fromFs(v)
  const layers = fields.imageLayers || []
  const hist = fields.historical
  const years = layers.filter((l) => l.url || l.driveId).map((l) => String(l.year))
  if (hist && (hist.url || hist.driveId) && !years.includes(String(hist.year || '2005'))) {
    years.push(String(hist.year || '2005'))
  }
  return {
    id,
    name: fields.name,
    years: [...new Set(years)].sort(),
    both: years.includes('2005') && years.includes('2025'),
    layers: layers.map((l) => ({ year: l.year, driveId: l.driveId || null, hasUrl: !!l.url })),
    hist: hist ? { year: hist.year, has: !!(hist.url || hist.driveId) } : null,
  }
})
rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
const missing2025 = rows.filter((r) => !r.years.includes('2025'))
const both = rows.filter((r) => r.both)
console.log(JSON.stringify({ total: rows.length, both: both.length, missing2025: missing2025.map((r) => r.name), rows }, null, 2))
