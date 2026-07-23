// Lightweight session. Front-end only for now — a real deployment would back
// this with server auth. Roles: guest (read), resident (add POIs & media),
// moderator (pin settlements, edit settlement info, approve media).

import { useSyncExternalStore } from 'react'

const KEY = 'gk_session_v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: '', role: 'guest' } // 'guest' | 'resident' | 'moderator'
}

let session = load()
const listeners = new Set()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {}
  session = { ...session }
  listeners.forEach((l) => l())
}

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => session,
  )
}

export function signIn(name, role) {
  session = { name: name || 'אורח/ת', role }
  emit()
}

export function signOut() {
  session = { name: '', role: 'guest' }
  emit()
}

export function canEdit(role) {
  return role === 'resident' || role === 'moderator'
}
export function canModerate(role) {
  return role === 'moderator'
}
