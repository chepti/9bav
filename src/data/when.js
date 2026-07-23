// Absolute “when” helpers for expulsion-day moments.
// Supports Gregorian date + time, Hebrew date (via @hebcal/core), and legacy HH:MM-only labels.
import { HDate } from '@hebcal/core'

/** Default day used when an item only has HH:MM (legacy clock entries). */
export const DEFAULT_EXPULSION_DATE = '2005-08-15' // י׳ באב תשס״ה — תחילת הפינוי

export function parseTimeHHMM(label) {
  if (!label) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(label).trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** YYYY-MM-DD → Hebrew gematriya string (no nikkud), or '' on failure. */
export function gregorianToHebrew(isoDate) {
  if (!isoDate) return ''
  try {
    const [y, m, d] = isoDate.split('-').map(Number)
    if (!y || !m || !d) return ''
    const hd = new HDate(new Date(y, m - 1, d))
    return hd.renderGematriya(true)
  } catch {
    return ''
  }
}

/** Hebrew gematriya (or similar) → YYYY-MM-DD, or null. */
export function hebrewToGregorian(hebrewStr) {
  if (!hebrewStr || !String(hebrewStr).trim()) return null
  try {
    const hd = HDate.fromGematriyaString(String(hebrewStr).trim())
    const g = hd.greg()
    const y = g.getFullYear()
    const m = String(g.getMonth() + 1).padStart(2, '0')
    const d = String(g.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return null
  }
}

function isoToLocalMs(isoDate, minutesOfDay = 0) {
  const date = isoDate || DEFAULT_EXPULSION_DATE
  const [y, m, d] = date.split('-').map(Number)
  const h = Math.floor(minutesOfDay / 60)
  const min = minutesOfDay % 60
  return new Date(y, m - 1, d, h, min, 0, 0).getTime()
}

/**
 * Absolute sort key (ms) for a during-media item.
 * Prefer dateGregorian + timeLabel; fall back to legacy HH:MM on the default day.
 */
export function itemSortMs(item) {
  if (!item) return null
  if (typeof item.whenMs === 'number' && Number.isFinite(item.whenMs)) return item.whenMs
  const mins = parseTimeHHMM(item.timeLabel)
  if (item.dateGregorian) {
    return isoToLocalMs(item.dateGregorian, mins ?? 0)
  }
  if (mins != null) return isoToLocalMs(DEFAULT_EXPULSION_DATE, mins)
  return null
}

/** Short display for pills / clock center. */
export function formatWhenDisplay(item) {
  if (!item) return ''
  const approx = item.approximate ? '~' : ''
  const time = item.timeLabel ? String(item.timeLabel).trim() : ''
  const heb = item.dateHebrew || (item.dateGregorian ? gregorianToHebrew(item.dateGregorian) : '')
  if (heb && time) return `${approx}${heb} · ${time}`
  if (heb) return `${approx}${heb}`
  if (item.dateGregorian && time) {
    const [y, m, d] = item.dateGregorian.split('-')
    return `${approx}${Number(d)}.${Number(m)}.${y} · ${time}`
  }
  if (time) return `${approx}${time}`
  return item.dateGregorian || ''
}

/**
 * Group timed items into moments (same date+time), sorted chronologically,
 * then assign even fractions around the circle (by event count, not duration).
 */
export function groupMomentsEven(items) {
  const timed = (items || [])
    .map((it) => ({ ...it, sortMs: itemSortMs(it) }))
    .filter((it) => it.sortMs != null)
    .sort((a, b) => a.sortMs - b.sortMs || String(a.id).localeCompare(String(b.id)))

  const map = new Map()
  for (const it of timed) {
    // Group by absolute minute (+ approximate flag) so legacy HH:MM-only
    // items merge with new items that also store dateGregorian.
    const key = `${Math.round(it.sortMs / 60000)}|${it.approximate ? '~' : ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        sortMs: it.sortMs,
        label: formatWhenDisplay(it),
        approximate: !!it.approximate,
        items: [],
      })
    }
    map.get(key).items.push(it)
  }

  const moments = [...map.values()]
  const n = moments.length
  moments.forEach((m, i) => {
    // Even slots around a full circle (Kan-style): first at top, then clockwise.
    m.index = i
    m.frac = n <= 1 ? 0 : i / n
  })
  return moments
}

/** Build fields to store on a media item from the when form. */
export function buildWhenFields({ dateGregorian, dateHebrew, timeLabel, approximate }) {
  const time = (timeLabel || '').trim()
  let greg = (dateGregorian || '').trim() || undefined
  let heb = (dateHebrew || '').trim() || undefined
  if (greg && !heb) heb = gregorianToHebrew(greg) || undefined
  if (!greg && heb) {
    const g = hebrewToGregorian(heb)
    if (g) greg = g
  }
  const mins = parseTimeHHMM(time)
  const whenMs = greg || mins != null
    ? isoToLocalMs(greg || DEFAULT_EXPULSION_DATE, mins ?? 0)
    : undefined
  return {
    dateGregorian: greg,
    dateHebrew: heb,
    timeLabel: time || undefined,
    approximate: !!approximate,
    whenMs,
  }
}
