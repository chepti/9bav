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
const results = JSON.parse(readFileSync('scripts/tmp/upload-results.json', 'utf8'))

const toolsPath = join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json')
const tools = JSON.parse(readFileSync(toolsPath, 'utf8'))

async function getAccessToken() {
  const tok = tools.tokens || {}
  if (tok.access_token && tok.expires_at && Date.now() < tok.expires_at - 60_000) {
    return tok.access_token
  }
  // refresh
  const body = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', // firebase-tools public client
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
  tools.tokens = {
    ...tok,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    expires_in: data.expires_in,
    id_token: data.id_token || tok.id_token,
  }
  writeFileSync(toolsPath, JSON.stringify(tools, null, 2))
  return data.access_token
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val)
    return { mapValue: { fields } }
  }
  throw new Error(`unsupported ${typeof v}`)
}

async function patchImageLayers(token, docId, imageLayers) {
  const name = `projects/${PROJECT}/databases/(default)/documents/settlements/${docId}`
  const url = `https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=imageLayers`
  const body = {
    fields: {
      imageLayers: toFirestoreValue(imageLayers),
    },
  }
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`patch ${docId} failed ${r.status}: ${await r.text()}`)
  return r.json()
}

const token = await getAccessToken()
for (const row of results) {
  // Store only driveId (site resolves via googleusercontent); keep url optional
  const layers = row.imageLayers.map((l) => ({ year: l.year, driveId: l.driveId }))
  await patchImageLayers(token, row.docId, layers)
  console.log(`✓ ${row.name} (${row.docId})`)
}
console.log('Done.')
