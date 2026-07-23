// Shared category definitions for the map "area" polygons (where agriculture,
// education, etc. were located). Mirrors the settlement info sections, plus a
// color per category used both for drawing the polygon and for the legend.

export const AREA_CATEGORIES = [
  { key: 'agriculture', label: 'חקלאות', color: '#3f9b46' },
  { key: 'education', label: 'חינוך', color: '#2f6fb0' },
  { key: 'community', label: 'קהילה', color: '#e0892a' },
  { key: 'commerce', label: 'מסחר', color: '#8a5cc4' },
  { key: 'general', label: 'כללי', color: '#7a6a55' },
]

export const AREA_COLOR = Object.fromEntries(AREA_CATEGORIES.map((c) => [c.key, c.color]))
export const AREA_LABEL = Object.fromEntries(AREA_CATEGORIES.map((c) => [c.key, c.label]))
