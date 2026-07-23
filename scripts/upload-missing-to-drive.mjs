import { readFileSync, writeFileSync, readdirSync, copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Prepare unique before/after files and upload to Drive, then patch Firestore.
// Drive upload uses the Apps Script endpoint (no Firebase auth).
// Firestore write needs an ID token — we accept FIREBASE_ID_TOKEN env, or
// print the patch payload for a browser console fallback.

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
const API_KEY = env.VITE_FB_API_KEY

const missing = JSON.parse(readFileSync('scripts/tmp/missing-photos.json', 'utf8'))

// Firestore doc ids (כפר ים was created with a generated id)
const DOC_IDS = {
  netzarim: 'netzarim',
  'kfar-yam': 'stl-mrxen0p0-1-fmxp',
  homesh: 'homesh',
  'sa-nur': 'sa-nur',
  ganim: 'ganim',
  kadim: 'kadim',
}

async function uploadFile(filePath, name) {
  const buf = readFileSync(filePath)
  const dataBase64 = buf.toString('base64')
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ name, mimeType: 'image/jpeg', dataBase64 }),
    redirect: 'follow',
  })
  if (!resp.ok) throw new Error(`Drive upload failed ${resp.status} for ${name}`)
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return data
}

const prepared = join('scripts', 'tmp', 'ready')
mkdirSync(prepared, { recursive: true })

const results = []
for (const s of missing) {
  const docId = DOC_IDS[s.id]
  if (!docId) throw new Error(`no doc id for ${s.id}`)
  // unique[0] = 2005, unique[1] = 2025 (first photo in album is before)
  const before = s.unique[0].dest
  const after = s.unique[1].dest
  const beforeName = `${s.id}-2005-makles.jpg`
  const afterName = `${s.id}-2025-makles.jpg`
  copyFileSync(before, join(prepared, beforeName))
  copyFileSync(after, join(prepared, afterName))

  console.log(`Uploading ${s.name}…`)
  const up2005 = await uploadFile(before, beforeName)
  console.log(`  2005 -> ${up2005.id}`)
  const up2025 = await uploadFile(after, afterName)
  console.log(`  2025 -> ${up2025.id}`)

  results.push({
    name: s.name,
    seedId: s.id,
    docId,
    imageLayers: [
      { year: '2005', driveId: up2005.id, url: up2005.url },
      { year: '2025', driveId: up2025.id, url: up2025.url },
    ],
  })
}

writeFileSync(join('scripts', 'tmp', 'upload-results.json'), JSON.stringify(results, null, 2), 'utf8')
console.log('\nAll uploaded. Results in scripts/tmp/upload-results.json')
console.log(JSON.stringify(results, null, 2))
