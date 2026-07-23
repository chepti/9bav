import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

async function fetchPost(id) {
  // embed=1 returns a focused single-post page
  const urls = [
    `https://t.me/BenTzionM/${id}?embed=1&mode=tme`,
    `https://t.me/s/BenTzionM/${id}`,
  ]
  for (const url of urls) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) continue
    const html = await r.text()
    const photos = [...html.matchAll(/background-image:url\('(https:\/\/cdn[^']+)'\)/g)].map((m) => m[1])
    const uniq = [...new Set(photos)]
    if (uniq.length) return { id, photos: uniq, source: url }
  }
  return { id, photos: [], source: null }
}

// Each settlement caption is on even-ish IDs; albums often span id and id+1
const settlements = [
  { name: 'ניסנית', id: 'nisanit', msg: 5614 },
  { name: 'אלי סיני', id: 'elei-sinai', msg: 5616 },
  { name: 'דוגית', id: 'dugit', msg: 5618 },
  { name: 'נצרים', id: 'netzarim', msg: 5620 },
  { name: 'כפר דרום', id: 'kfar-darom', msg: 5622 },
  { name: 'תל קטיפא', id: 'tel-katifa', msg: 5624 },
  { name: 'נצר חזני', id: 'netzer-hazani', msg: 5626 },
  { name: 'קטיף', id: 'katif', msg: 5628 },
  { name: 'גני טל', id: 'ganei-tal', msg: 5630 },
  { name: 'נווה דקלים', id: 'neve-dekalim', msg: 5632 },
  { name: 'גדיד', id: 'gadid', msg: 5634 },
  { name: 'גן אור', id: 'gan-or', msg: 5636 },
  { name: 'כפר ים', id: 'kfar-yam', msg: 5638 }, // also שירת הים
  { name: 'שירת הים', id: 'shirat-hayam', msg: 5638 },
  { name: 'בדולח', id: 'bedolah', msg: 5640 },
  { name: 'עצמונה', id: 'atzmona', msg: 5642 }, // בני עצמון
  { name: 'כרם עצמונה', id: 'kerem-atzmona', msg: 5644 },
  { name: 'מורג', id: 'morag', msg: 5646 },
  { name: 'פאת שדה', id: 'peat-sadeh', msg: 5648 },
  { name: 'שליו', id: 'shalev', msg: 5650 },
  { name: 'רפיח ים', id: 'rafiah-yam', msg: 5652 },
  { name: 'חומש', id: 'homesh', msg: 5656 },
  { name: 'שא־נור', id: 'sa-nur', msg: 5658 },
  { name: 'גנים', id: 'ganim', msg: 5660 },
  { name: 'כדים', id: 'kadim', msg: 5662 },
]

const results = []
for (const s of settlements) {
  const a = await fetchPost(s.msg)
  const b = await fetchPost(s.msg + 1)
  // Prefer largest/cdn4 photos; take unique across album pair
  const photos = [...new Set([...a.photos, ...b.photos])]
  // Prefer higher-res: Telegram CDN urls often have /size something - pick ones without tiny size if possible
  results.push({ ...s, photos, count: photos.length })
  console.log(`${s.name}: ${photos.length} photos (msg ${s.msg}/${s.msg + 1})`)
  for (const p of photos.slice(0, 4)) console.log('  ', p.slice(0, 100))
}

mkdirSync(join('scripts', 'tmp'), { recursive: true })
writeFileSync(join('scripts', 'tmp', 'settlement-photos.json'), JSON.stringify(results, null, 2), 'utf8')
