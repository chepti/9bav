import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const data = JSON.parse(readFileSync('scripts/tmp/settlement-photos.json', 'utf8'))
const missingNames = new Set(['נצרים', 'כפר ים', 'חומש', 'שא־נור', 'גנים', 'כדים'])
const targets = data.filter((s) => missingNames.has(s.name))

const outDir = join('scripts', 'tmp', 'photos')
mkdirSync(outDir, { recursive: true })

async function download(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`fail ${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(dest, buf)
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 10)
  return { bytes: buf.length, hash, dest }
}

const summary = []
for (const s of targets) {
  const dir = join(outDir, s.id)
  mkdirSync(dir, { recursive: true })
  const files = []
  let i = 0
  for (const url of s.photos) {
    i += 1
    const dest = join(dir, `${i}.jpg`)
    const meta = await download(url, dest)
    files.push({ ...meta, url })
    console.log(`${s.name} #${i}: ${meta.bytes}b hash=${meta.hash}`)
  }
  // unique by hash
  const uniq = []
  const seen = new Set()
  for (const f of files) {
    if (seen.has(f.hash)) continue
    seen.add(f.hash)
    uniq.push(f)
  }
  console.log(`  => ${uniq.length} unique`)
  summary.push({ id: s.id, name: s.name, msg: s.msg, unique: uniq })
}

writeFileSync(join('scripts', 'tmp', 'missing-photos.json'), JSON.stringify(summary, null, 2), 'utf8')
