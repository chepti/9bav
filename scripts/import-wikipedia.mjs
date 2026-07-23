import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Pull Wikipedia HE text into settlement.info tabs + photos into gallery.
// Specialty tabs (חקלאות / קהילה / …) are filled from matching wiki sections
// when they exist, otherwise from keyword-scored paragraphs of the full article.
// Never overwrites a non-empty section body (community edits win).

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
const API = 'https://he.wikipedia.org/w/api.php'

const WIKI_TITLE = {
  'נווה דקלים': 'נווה דקלים',
  'נצר חזני': 'נצר חזני',
  'גדיד': 'גדיד',
  'גן אור': 'גן אור',
  'קטיף': 'קטיף (מושב)',
  'גני טל': 'גני טל',
  'בדולח': 'בדולח',
  'עצמונה': 'עצמונה',
  'בני עצמון': 'עצמונה',
  'כפר ים': 'כפר ים',
  'כפר דרום': 'כפר דרום',
  'מורג': 'מורג',
  'נצרים': 'נצרים',
  'פאת שדה': 'פאת שדה',
  'רפיח ים': 'רפיח ים',
  'שירת הים': 'שירת הים (יישוב)',
  'תל קטיפא': 'תל קטיפא',
  'אלי סיני': 'אלי סיני',
  'דוגית': 'דוגית',
  'ניסנית': 'ניסנית',
  'כרם עצמונה': 'כרם עצמונה',
  'שליו': 'שליו',
  'חומש': 'חומש (יישוב)',
  'שא־נור': 'שא-נור',
  'שא-נור': 'שא-נור',
  'גנים': 'גנים',
  'כדים': 'כדים',
}

/** Explicit wiki heading → info tab */
const SECTION_MAP = [
  { key: 'general', hints: ['היסטוריה', 'רקע', 'כללי', 'אודות', 'הקמה', 'הקמת', 'שם'] },
  { key: 'education', hints: ['חינוך', 'בית ספר', 'ישיבה', 'אולפנה', 'גן ילדים'] },
  { key: 'community', hints: ['קהילה', 'אוכלוסייה', 'דת', 'תרבות', 'חיי קהילה', 'שירותי דת', 'היישוב'] },
  { key: 'agriculture', hints: ['חקלאות', 'חממות', 'כלכלה'] },
  { key: 'commerce', hints: ['מסחר', 'תעשייה', 'שירותים', 'מרכז מסחרי', 'תעסוקה'] },
]

/** Paragraph keyword bags when the article has no dedicated heading */
const PARA_HINTS = {
  agriculture: [
    'חקלא', 'חממ', 'גידול', 'פרח', 'ירק', 'עגבני', 'תות', 'פלפל', 'תבלין',
    'דיג', 'חקלאי', 'ייצוא', 'מטע', 'פרדס', 'לול', 'רפת', 'חלב', 'עלי קטיף',
    'אבוקדו', 'מנגו', 'בננ', 'עגבניות', 'חממה',
  ],
  education: [
    'חינוך', 'בית ספר', 'ישיב', 'אולפנ', 'גן ילד', 'תלמוד', 'מדרש', 'תלמיד',
    'כיתות', 'גני ילדים', 'בני עקיבא',
  ],
  community: [
    'קהיל', 'אוכלוס', 'בית כנסת', 'בתי כנסת', 'שירותי דת', 'מתנ"ס', 'מתנס',
    'תרבות', 'משפח', 'תושב', 'דתי', 'סינגוג', 'מקווה', 'חגים',
  ],
  commerce: [
    'מסחר', 'תעשי', 'מכולת', 'מרכז מסחר', 'בנק', 'מרפא', 'שירותים', 'תעסוק',
    'מפעל', 'חנויות', 'מועצה', 'מרכז אזורי', 'קניון', 'סופר',
  ],
}

const SKIP_PARA = /^(קישורים|הערות שוליים|ראו גם|לקריאה|מיפוי|ספרים)\b/
const EVICTION_HEAVY = /(התנתקות|פינוי היישוב|פונו ב|תוכנית ההתנתקות)/

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

async function wikiJson(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  const r = await fetch(url, { headers: { 'Api-User-Agent': '9bav-memorial/1.0 (chepti@gmail.com; settlement memorial site)' } })
  if (r.status === 429 && attempt < 6) {
    const wait = 9000 * (attempt + 1)
    process.stdout.write(`(429 wait ${wait / 1000}s) `)
    await new Promise((res) => setTimeout(res, wait))
    return wikiJson(params, attempt + 1)
  }
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`wiki ${r.status} ${t.slice(0, 80)}`)
  }
  return r.json()
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

function scoreParagraph(text, hints) {
  const t = text.toLowerCase()
  let score = 0
  for (const h of hints) {
    if (t.includes(h.toLowerCase())) score += 1
  }
  if (EVICTION_HEAVY.test(text) && score < 2) return 0
  return score
}

/** Split Wikipedia plaintext extract on == Heading == markers. */
function splitWikiSections(fullText) {
  const raw = String(fullText || '')
  const re = /\n*={2,}\s*([^=\n]+?)\s*={2,}\n*/g
  const out = [{ heading: '', body: '' }]
  let last = 0
  let m
  while ((m = re.exec(raw))) {
    out[out.length - 1].body = raw.slice(last, m.index).trim()
    out.push({ heading: m[1].trim(), body: '' })
    last = re.lastIndex
  }
  out[out.length - 1].body = raw.slice(last).trim()
  return out.filter((s) => s.body && s.body.length > 30)
}

function mapHeadingToKey(heading) {
  const line = String(heading || '')
  for (const { key, hints } of SECTION_MAP) {
    if (key === 'general') continue
    if (hints.some((h) => line.includes(h))) return key
  }
  return null
}

function fillFromParagraphs(infoBits, fullText) {
  // 1) Prefer explicit wiki section bodies (from plaintext == headings ==)
  for (const { heading, body } of splitWikiSections(fullText)) {
    const clean = body.replace(/\s+/g, ' ').trim()
    if (clean.length <= 40) continue
    const key = mapHeadingToKey(heading)
    if (key && !infoBits[key]) infoBits[key] = clean.slice(0, 1800)
    // "כלכלה" in Gush Katif articles usually covers greenhouses + local services
    if (/כלכל/.test(heading)) {
      if (!infoBits.agriculture) infoBits.agriculture = clean.slice(0, 1800)
      if (!infoBits.commerce) infoBits.commerce = clean.slice(0, 1800)
    }
  }

  // 2) Keyword fallback for still-empty specialty tabs
  const paras = String(fullText || '')
    .split(/\n{2,}|\n*={2,}[^=]+={2,}\n*/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 55 && !SKIP_PARA.test(p))

  for (const [key, hints] of Object.entries(PARA_HINTS)) {
    if (infoBits[key]) continue
    const ranked = paras
      .map((p) => ({ p, score: scoreParagraph(p, hints) }))
      .filter((x) => x.score >= 1)
      .sort((a, b) => b.score - a.score || b.p.length - a.p.length)
    if (!ranked.length) continue
    const picked = []
    let total = 0
    for (const { p } of ranked) {
      if (picked.some((x) => x.includes(p.slice(0, 40)) || p.includes(x.slice(0, 40)))) continue
      picked.push(p)
      total += p.length
      if (picked.length >= 3 || total >= 1400) break
    }
    if (picked.length) infoBits[key] = picked.join('\n\n').slice(0, 1800)
  }
}

async function fetchWikiBundle(title) {
  const q1 = await wikiJson({
    action: 'query',
    titles: title,
    redirects: '1',
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    piprop: 'thumbnail|original',
    pithumbsize: '1200',
    inprop: 'url',
  })
  const page = Object.values(q1.query?.pages || {})[0]
  if (!page || page.missing != null) return null

  const resolvedTitle = page.title
  const pageUrl = page.fullurl || `https://he.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle)}`
  const infoBits = {
    general: (page.extract || '').trim(),
  }

  await sleep(1100)

  // Full article plaintext — used to seed specialty tabs when headings are missing
  const fullQ = await wikiJson({
    action: 'query',
    titles: resolvedTitle,
    redirects: '1',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'plain',
  })
  const fullPage = Object.values(fullQ.query?.pages || {})[0]
  const fullText = (fullPage?.extract || '').trim()

  // Map == sections == + keyword paragraphs into specialty tabs (no extra parse calls)
  fillFromParagraphs(infoBits, fullText)

  await sleep(1100)

  const imgData = await wikiJson({
    action: 'query',
    generator: 'images',
    titles: resolvedTitle,
    gimlimit: '16',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata|size',
    iiurlwidth: '1200',
    redirects: '1',
  })
  const pages = Object.values(imgData.query?.pages || {})
  const gallery = []
  const seen = new Set()
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii) continue
    const mime = ii.mime || ''
    if (!/^image\/(jpeg|png|webp)$/i.test(mime)) continue
    const name = (p.title || '').toLowerCase()
    if (/icon|logo|flag|coat_of_arms|symbol|map_of|locator|\.svg/i.test(name)) continue
    if ((ii.width || 0) < 350 && (ii.thumbwidth || 0) < 350) continue
    const url = ii.thumburl || ii.url
    if (!url || seen.has(url)) continue
    seen.add(url)
    const artist = stripHtml(ii.extmetadata?.Artist?.value || '')
    gallery.push({
      id: `wiki-${gallery.length + 1}`,
      url: ii.url || url,
      thumb: ii.thumburl || ii.url || url,
      caption: (p.title || '').replace(/^קובץ:/, '').replace(/\.[^.]+$/, ''),
      credit: artist ? `${artist} · ויקישיתוף` : 'ויקיפדיה / ויקישיתוף',
      sourceUrl: pageUrl,
    })
    if (gallery.length >= 4) break
  }

  if (gallery.length === 0) {
    const src = page.original?.source || page.thumbnail?.source
    if (src) {
      gallery.push({
        id: 'wiki-1',
        url: src,
        thumb: page.thumbnail?.source || src,
        caption: resolvedTitle,
        credit: 'ויקיפדיה',
        sourceUrl: pageUrl,
      })
    }
  }

  return { title: resolvedTitle, pageUrl, infoBits, gallery }
}

function isEmptyBody(sec) {
  const t = String(sec?.body || '').trim()
  // Treat tiny stubs as empty so wiki can replace them
  return t.length < 40
}

function mergeInfo(existing, bits, { force = false } = {}) {
  const info = Array.isArray(existing) ? existing.map((s) => ({ ...s })) : []
  const ensure = (key) => {
    let sec = info.find((i) => i.key === key)
    if (!sec) {
      sec = { key, body: '', entries: [], media: [] }
      info.push(sec)
    }
    return sec
  }
  let filled = 0
  for (const [key, body] of Object.entries(bits)) {
    if (!body || !String(body).trim()) continue
    const sec = ensure(key)
    const empty = isEmptyBody(sec)
    // Default: only fill empty. --force-info overwrites (for wrong-wiki fixes).
    if (force || empty) {
      sec.body = String(body).trim()
      if (!Array.isArray(sec.entries)) sec.entries = []
      if (!Array.isArray(sec.media)) sec.media = []
      filled += 1
    }
  }
  return { info, filled }
}

const infoOnly = process.argv.includes('--info-only')
const forceInfo = process.argv.includes('--force-info')

const token = await getAccessToken()
const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/settlements?pageSize=100`
const list = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

let updated = 0
for (const d of list.documents || []) {
  const docId = d.name.split('/').pop()
  const fields = {}
  for (const [k, v] of Object.entries(d.fields || {})) fields[k] = fromFs(v)
  const name = fields.name
  const wikiTitle = WIKI_TITLE[name] || name
  process.stdout.write(`${name} → ${wikiTitle} … `)

  // Once wiki text was imported, do not refill emptied tabs (user clears must stick)
  // unless --force-info. Gallery can still fill if empty.
  const skipInfo = !!fields.wikiTitle && !forceInfo

  let bundle
  try {
    bundle = await fetchWikiBundle(wikiTitle)
  } catch (e) {
    console.log(`fail ${e.message}`)
    continue
  }
  if (!bundle) {
    console.log('not found')
    continue
  }

  const patch = {}
  if (!infoOnly) {
    const hasGallery = Array.isArray(fields.gallery) && fields.gallery.length > 0
    if (!hasGallery && bundle.gallery.length) patch.gallery = bundle.gallery
  }

  if (!skipInfo) {
    const { info: merged, filled } = mergeInfo(fields.info, bundle.infoBits, { force: forceInfo })
    if (filled > 0) {
      patch.info = merged
      patch.wikiTitle = bundle.title || wikiTitle
    }
  }

  if (!Object.keys(patch).length) {
    console.log(skipInfo ? 'skip (wiki already imported)' : 'skip (already filled)')
    continue
  }

  const paths = Object.keys(patch)
  const qs = paths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&')
  const namePath = `projects/${PROJECT}/databases/(default)/documents/settlements/${docId}`
  const bodyFields = {}
  for (const [k, v] of Object.entries(patch)) bodyFields[k] = toFs(v)
  const r = await fetch(`https://firestore.googleapis.com/v1/${namePath}?${qs}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: bodyFields }),
  })
  if (!r.ok) {
    console.log(`patch fail ${r.status}`)
    continue
  }
  updated += 1
  const keys = Object.keys(bundle.infoBits).filter((k) => k !== 'general' && bundle.infoBits[k])
  console.log(`ok (gallery=${patch.gallery?.length || 0}, infoTabs=+${filled}${keys.length ? ' [' + keys.join(',') + ']' : ''})`)
  await sleep(4500)
}

console.log(`\nDone. Updated ${updated} settlements.`)
