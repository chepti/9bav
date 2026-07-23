// Role assignments by email. Lets the owner/moderators pre-authorize people by
// email *before* they ever sign in. On sign-in, session.js looks up the
// assignment for the user's email and applies the role.
//
// Firestore: collection `roles/{emailLower}` = { email, role, settlementId?,
// settlementName?, addedBy, createdAt }. Local mode keeps the list in memory
// (moderation is really a live-mode feature).

import { useSyncExternalStore } from 'react'
import { isFirebaseConfigured, db } from './firebase.js'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'

const FB = isFirebaseConfigured
const COL = 'roles'

let roles = [] // [{ email, role, settlementId, settlementName }]
const listeners = new Set()

function notify() {
  roles = [...roles]
  listeners.forEach((l) => l())
}

export function useRoles() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => roles,
  )
}

export function emailKey(email) {
  return String(email || '').trim().toLowerCase()
}

if (FB) {
  onSnapshot(
    collection(db, COL),
    (snap) => {
      roles = snap.docs.map((d) => ({ email: d.id, ...d.data() }))
      roles.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
      listeners.forEach((l) => l())
    },
    (err) => console.error('[gk] roles snapshot error', err),
  )
}

export function addRole({ email, role, settlementId, settlementName, addedBy }) {
  const key = emailKey(email)
  if (!key) return Promise.reject(new Error('empty email'))
  const data = {
    email: key,
    role: role || 'moderator',
    settlementId: settlementId || null,
    settlementName: settlementName || null,
    addedBy: addedBy || null,
    createdAt: Date.now(),
  }
  if (FB) {
    return setDoc(doc(db, COL, key), data)
  }
  roles = [...roles.filter((r) => r.email !== key), data]
  notify()
  return Promise.resolve()
}

export function removeRole(email) {
  const key = emailKey(email)
  if (FB) {
    return deleteDoc(doc(db, COL, key))
  }
  roles = roles.filter((r) => r.email !== key)
  notify()
  return Promise.resolve()
}

// Used by session.js to resolve a signed-in user's assigned role.
export async function fetchAssignedRole(email) {
  const key = emailKey(email)
  if (!FB || !key) return null
  try {
    const { getDoc } = await import('firebase/firestore')
    const snap = await getDoc(doc(db, COL, key))
    return snap.exists() ? snap.data() : null
  } catch (e) {
    console.error('[gk] fetchAssignedRole failed', e)
    return null
  }
}
