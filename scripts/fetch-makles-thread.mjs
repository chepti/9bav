import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

async function fetchPage(id) {
  const r = await fetch(`https://t.me/s/BenTzionM/${id}`)
  return await r.text()
}

function parseMessages(html) {
  const blocks = html.split('tgme_widget_message_wrap')
  const out = []
  for (const b of blocks) {
    const idm = b.match(/data-post="BenTzionM\/(\d+)"/)
    if (!idm) continue
    const id = Number(idm[1])
    const textMatch = b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
    const photos = [...b.matchAll(/background-image:url\('([^']+)'\)/g)].map((m) => m[1])
    const date = (b.match(/datetime="([^"]+)"/) || [])[1] || ''
    out.push({ id, text, photos, date })
  }
  return out
}

const pages = [5613, 5630, 5650, 5665, 5680]
const uniq = new Map()
for (const p of pages) {
  const html = await fetchPage(p)
  for (const m of parseMessages(html)) uniq.set(m.id, m)
}

const msgs = [...uniq.values()].filter((m) => m.id >= 5613 && m.id <= 5680).sort((a, b) => a.id - b.id)

mkdirSync(join('scripts', 'tmp'), { recursive: true })
writeFileSync(join('scripts', 'tmp', 'makles-thread.json'), JSON.stringify(msgs, null, 2), 'utf8')

for (const m of msgs) {
  const t = m.text.slice(0, 140)
  console.log(`${m.id}\tphotos=${m.photos.length}\t${t}`)
}
