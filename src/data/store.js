// Reactive data layer with two interchangeable backends:
//   - Firebase/Firestore  (live, collaborative) when configured
//   - localStorage         (offline prototype) otherwise
//
// Components never see the difference: they read from the in-memory `state`
// cache via useStore()/selectors, and call the same mutation functions. In
// Firestore mode the cache is fed by an onSnapshot listener and mutations are
// transactional writes; the snapshot then refreshes the cache.

import { useSyncExternalStore } from 'react'
import { SETTLEMENTS as SEED } from './seed.js'
import { isFirebaseConfigured, db } from './firebase.js'
import { sortEntriesByYear } from './timeline.js'
import { collection, doc, onSnapshot, setDoc, deleteDoc, runTransaction, writeBatch } from 'firebase/firestore'

const FB = isFirebaseConfigured
const KEY = 'gk_state_v2'
const COL = 'settlements'

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('state load failed', e)
  }
  return { settlements: structuredClone(SEED) }
}

let state = FB ? { settlements: [], loading: true } : loadLocal()
const listeners = new Set()

function persistLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('state persist failed', e)
  }
}

function notify() {
  state = { ...state } // new reference so useSyncExternalStore fires
  listeners.forEach((l) => l())
}

function emit() {
  if (!FB) persistLocal()
  notify()
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

export function isLive() {
  return FB
}
export function isLoading() {
  return !!state.loading
}

// --- Firestore live subscription ---
if (FB) {
  onSnapshot(
    collection(db, COL),
    (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
      state = { settlements: arr, loading: false }
      listeners.forEach((l) => l())
    },
    (err) => console.error('[gk] settlements snapshot error', err),
  )
}

// --- id helper ---
let counter = 0
function uid(prefix = 'id') {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

function stripId(obj) {
  const { id, ...rest } = obj
  return rest
}

// --- selectors (read the cache; identical in both modes) ---
export function getSettlements() {
  return state.settlements
}
export function getSettlement(id) {
  return state.settlements.find((s) => s.id === id)
}

// --- core mutation primitive ---
// fn receives a fresh settlement object (with id + nested pois), mutates and
// returns it. Local: map+emit. Firestore: transactional read-modify-write.
function mutateSettlement(id, fn) {
  if (FB) {
    const ref = doc(db, COL, id)
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const updated = fn({ id, ...snap.data() })
      tx.set(ref, stripId(updated))
    }).catch((e) => console.error('[gk] mutate failed', e))
  }
  state.settlements = state.settlements.map((s) => (s.id === id ? fn(structuredClone(s)) : s))
  emit()
}

export function addSettlement({ name, region, lat, lng }) {
  const id = uid('stl')
  const s = { id, name, region, lat, lng, moderators: [], info: [], pois: [] }
  if (FB) {
    setDoc(doc(db, COL, id), stripId(s)).catch((e) => console.error('[gk] addSettlement failed', e))
  } else {
    state.settlements = [...state.settlements, s]
    emit()
  }
  return id
}

export function updateSettlementMeta(id, patch) {
  mutateSettlement(id, (s) => ({ ...s, ...patch }))
}

export function deleteSettlement(id) {
  if (FB) {
    return deleteDoc(doc(db, COL, id)).catch((e) => console.error('[gk] deleteSettlement failed', e))
  }
  state.settlements = state.settlements.filter((s) => s.id !== id)
  emit()
}

export function moveSettlement(id, lat, lng) {
  mutateSettlement(id, (s) => ({ ...s, lat, lng }))
}

// Points come in as [{x,y}, …] (percentages). Firestore forbids arrays of
// arrays, so vertices are stored as objects — never [[x,y], …].
export function addArea(settlementId, { category, points, label }) {
  const areaId = uid('area')
  const clean = (points || []).map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }))
  mutateSettlement(settlementId, (s) => {
    if (!Array.isArray(s.areas)) s.areas = []
    s.areas.push({ id: areaId, category, points: clean, label: label || '' })
    return s
  })
  return areaId
}

export function deleteArea(settlementId, areaId) {
  mutateSettlement(settlementId, (s) => {
    s.areas = (s.areas || []).filter((a) => a.id !== areaId)
    return s
  })
}

export function setInfoSection(settlementId, key, body) {
  mutateSettlement(settlementId, (s) => {
    if (!Array.isArray(s.info)) s.info = []
    const existing = s.info.find((i) => i.key === key)
    if (existing) existing.body = body
    else s.info.push({ key, body, media: [] })
    return s
  })
}

// Full update of an info section: an intro paragraph plus a chronological list
// of { id, timeLabel, body } entries shown as a settlement-level timeline.
// Edits publish immediately (wiki-style); moderators delete unwanted content.
export function setInfoSectionFull(settlementId, key, { body, entries }) {
  mutateSettlement(settlementId, (s) => {
    if (!Array.isArray(s.info)) s.info = []
    let sec = s.info.find((i) => i.key === key)
    if (!sec) {
      sec = { key, body: '', entries: [], media: [] }
      s.info.push(sec)
    }
    sec.body = body || ''
    sec.entries = sortEntriesByYear(
      (entries || [])
        .filter((e) => (e.timeLabel && e.timeLabel.trim()) || (e.body && e.body.trim()))
        .map((e) => ({ id: e.id || uid('ie'), timeLabel: (e.timeLabel || '').trim(), body: (e.body || '').trim() })),
    )
    delete sec.pendingReview
    return s
  })
}

// POIs are placed on the settlement's historical photo, so position is stored
// as a relative percentage (x,y in 0..100) of the image — not lat/lng. This
// keeps a point in the same spot when toggling between year layers.
export function addPoi(settlementId, { title, x, y, authorName }) {
  const poiId = uid('poi')
  mutateSettlement(settlementId, (s) => {
    if (!Array.isArray(s.pois)) s.pois = []
    s.pois.push({
      id: poiId,
      settlementId,
      title,
      x,
      y,
      authorName: authorName || 'אנונימי',
      before: [],
      during: [],
      after: [],
    })
    return s
  })
  return poiId
}

export function movePoi(settlementId, poiId, x, y) {
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (p) {
      p.x = x
      p.y = y
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
  const mediaId = uid('m')
  const media = {
    id: mediaId,
    createdAt: Date.now(),
    status: 'approved', // published immediately; moderators may delete
    likedBy: [],
    authorName: item.authorName || 'אנונימי',
    ...item,
  }
  if (!Array.isArray(media.likedBy)) media.likedBy = []
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((p) => p.id === poiId)
    if (!p) return s
    if (phase === 'after') {
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
  return mediaId
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

// Toggle a nostalgic "heart" on a media item. userKey is uid (live) or display name (local).
export function toggleMediaHeart(settlementId, poiId, mediaId, userKey) {
  if (!userKey) return
  mutateSettlement(settlementId, (s) => {
    const p = s.pois.find((x) => x.id === poiId)
    if (!p) return s
    const apply = (arr) => {
      const m = (arr || []).find((x) => x.id === mediaId)
      if (!m) return false
      if (!Array.isArray(m.likedBy)) m.likedBy = []
      const i = m.likedBy.indexOf(userKey)
      if (i >= 0) m.likedBy.splice(i, 1)
      else m.likedBy.push(userKey)
      return true
    }
    if (apply(p.before) || apply(p.during)) return s
    for (const d of p.after || []) {
      if (apply(d.media)) return s
    }
    return s
  })
}

// Loads the seed settlements. Local: replaces cache. Firestore: writes the seed
// docs (used once by an admin to populate an empty database).
export function resetToSeed() {
  if (FB) {
    const batch = writeBatch(db)
    SEED.forEach((s) => batch.set(doc(db, COL, s.id), stripId(structuredClone(s))))
    return batch.commit().catch((e) => console.error('[gk] seed failed', e))
  }
  state = { settlements: structuredClone(SEED) }
  emit()
}
