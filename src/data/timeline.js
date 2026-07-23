/** First 4-digit year in a label (e.g. "ינואר 2025" → 2025). No year → Infinity (end). */
export function timelineYear(label) {
  const m = String(label || '').match(/(?:19|20)\d{2}/)
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY
}

/** Stable chronological sort by the year found in timeLabel. */
export function sortEntriesByYear(entries) {
  return (entries || [])
    .map((e, i) => ({ e, i, y: timelineYear(e.timeLabel) }))
    .sort((a, b) => a.y - b.y || a.i - b.i)
    .map(({ e }) => e)
}
