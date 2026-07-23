// Reactive data layer. Currently backed by localStorage; the exported API is
// intentionally shaped like an async-friendly repository so it can be swapped
// for a PHP + MySQL REST backend later without touching components.

import { useSyncExternalStore } from 'react'
import { SETTLEMENTS as SEED } from './seed.js'

const KEY = 'gk_state_v2'

/** @returns {{settlements: import('./types.js').Settlement[]}} */
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('state load failed', e)
  }
  return { settlements: structuredClone(SEED) }
}

let state = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('state persist failed', e)
  }
}

function emit() {
  persist()
  state = { ...state } // new reference so useSyncExternalStore fires
  listeners.forEach((l) => l())
}

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function getSnapshot() {
  return state
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// --- id helper (Math.random is fine at runtime in the browser) ---
let counter = 0
function uid(prefix = 'id') {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

// --- selectors ---
export function getSettlements() {
  return state.settlements
}
export function getSettlement(id) {
  return state.settlements.find((s) => s.id === id)
}

// --- mutations ---
function mutateSettlement(id, fn) {
  state.settlements = state.settlements.map((s) => (s.id === id ? fn(structuredClone(s)) : s))
  emit()
}

export function addSettlement({ name, region, lat, lng }) {
  const s = {
    id: uid('stl'),
    name,
    region,
    lat,
    lng,
    moderators: [],
    info: [],
    pois: [],
  }
  state.settlements = [...state.settlements, s]
  emit()
  return s.id
}

export function updateSettlementMeta(id, patch) {
  mutateSettlement(id, (s) => ({ ...s, ...patch }))
}

export function moveSettlement(id, lat, lng) {
  mutateSettlement(id, (s) => ({ ...s, lat, lng }))
}

export function setInfoSection(settlementId, key, body) {
  mutateSettlement(settlementId, (s) => {
    const existing = s.info.find((i) => i.key === key)
    if (existing) existing.body = body
    else s.info.push({ key, body, media: [] })
    return s
  })
}

export function addPoi(settlementId, { title, lat, lng, authorName }) {
  const poiId = uid('poi')
  mutateSettlement(settlementId, (s) => {
    s.pois.push({
      id: poiId,
      settlementId,
      title,
      lat,
      lng,
      authorName: authorName || 'אנונימי',
      before: [],
      during: [],
      after: [],
    })
    return s
  })
  return poiId
}

export function movePoi(settlementId, poiId, lat, lng) {
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (p) {
      p.lat = lat
      p.lng = lng
    }
    return s
  })
}

export function deletePoi(settlementId, poiId) {
  mutateSettlement(settlementId, (s) => {
    s.pois = s.pois.filter((p) => p.id !== poiId)
    return s
  })
}

/** phase: 'before' | 'during' | 'after' */
export function addMedia(settlementId, poiId, phase, item) {
  const media = {
    id: uid('m'),
    createdAt: Date.now(),
    status: 'pending',
    authorName: item.authorName || 'אנונימי',
    ...item,
  }
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (!p) return s
    if (phase === 'after') {
      // "after" needs a dated entry; if none targeted, create a standalone one
      p.after.push({
        id: uid('d'),
        dateLabel: item.dateLabel || 'ללא תאריך',
        title: item.title || '',
        description: item.body || '',
        media: item.url ? [media] : [],
      })
    } else {
      p[phase].push(media)
    }
    return s
  })
  return media.id
}

export function addAfterEntry(settlementId, poiId, { dateLabel, title, description }) {
  const entryId = uid('d')
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (p) p.after.push({ id: entryId, dateLabel, title, description, media: [] })
    return s
  })
  return entryId
}

export function setMediaStatus(settlementId, poiId, mediaId, status) {
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (!p) return s
    for (const phase of ['before', 'during']) {
      const m = p[phase].find((m) => m.id === mediaId)
      if (m) m.status = status
    }
    p.after.forEach((d) => d.media.forEach((m) => { if (m.id === mediaId) m.status = status }))
    return s
  })
}

export function deleteMedia(settlementId, poiId, mediaId) {
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (!p) return s
    p.before = p.before.filter((m) => m.id !== mediaId)
    p.during = p.during.filter((m) => m.id !== mediaId)
    p.after.forEach((d) => (d.media = d.media.filter((m) => m.id !== mediaId)))
    return s
  })
}

export function resetToSeed() {
  state = { settlements: structuredClone(SEED) }
  emit()
}
