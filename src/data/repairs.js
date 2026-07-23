// One-time content repairs that the live site can apply without admin scripts.
// Used when a bad Wikipedia import (or similar) must be corrected while the
// Cloud Firestore REST quota is exhausted for tooling.

import { canEdit } from './session.js'
import { updateSettlementMeta } from './store.js'

const BIBLICAL_MARKERS = /ספר שמות|שירת מרים|פסוקי דזמרא|אריח על גבי לבנה|תיקון ליל שביעי/

/** Correct intro from https://he.wikipedia.org/wiki/שירת_הים_(יישוב) */
const SHIRAT_HAYAM_GENERAL =
  'שירת הים היה מאחז בדרום רצועת עזה, על חוף הים התיכון במרכז רצועת החוף של גוש קטיף, שפונתה במסגרת תוכנית ההתנתקות.'

function sectionBody(info, key) {
  return String((info || []).find((i) => i.key === key)?.body || '')
}

function isBiblicalShirat(info) {
  const blob = ['general', 'education', 'community', 'commerce', 'agriculture']
    .map((k) => sectionBody(info, k))
    .join('\n')
  return BIBLICAL_MARKERS.test(blob)
}

function repairedInfo(existing) {
  const keys = ['general', 'agriculture', 'education', 'community', 'commerce']
  const out = []
  for (const key of keys) {
    const prev = (existing || []).find((i) => i.key === key) || {}
    out.push({
      key,
      body: key === 'general' ? SHIRAT_HAYAM_GENERAL : '',
      entries: Array.isArray(prev.entries) ? prev.entries : [],
      media: Array.isArray(prev.media) ? prev.media : [],
    })
  }
  // Keep any extra custom keys
  for (const sec of existing || []) {
    if (!keys.includes(sec.key)) out.push(sec)
  }
  return out
}

/**
 * Returns a settlement object safe for display (wrong biblical text swapped out).
 * Does not write to the network.
 */
export function withContentRepairs(settlement) {
  if (!settlement || settlement.id !== 'shirat-hayam') return settlement
  if (!isBiblicalShirat(settlement.info)) return settlement
  return {
    ...settlement,
    info: repairedInfo(settlement.info),
    wikiTitle: 'שירת הים (יישוב)',
  }
}

let persistStarted = false

/**
 * Persist the שירת הים fix once a contributor is signed in.
 * Safe to call often; only writes when biblical text is still in the cache.
 */
export function persistContentRepairs(settlement, session) {
  if (!settlement || settlement.id !== 'shirat-hayam') return
  if (!canEdit(session?.role)) return
  if (!isBiblicalShirat(settlement.info)) return
  if (persistStarted) return
  persistStarted = true
  try {
    updateSettlementMeta(settlement.id, {
      info: repairedInfo(settlement.info),
      wikiTitle: 'שירת הים (יישוב)',
    })
    console.info('[gk] repaired שירת הים Wikipedia text')
  } catch (e) {
    persistStarted = false
    console.warn('[gk] shirat repair failed', e)
  }
}
