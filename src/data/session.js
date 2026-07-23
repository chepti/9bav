// Session / auth. Two modes:
//   - Firebase Auth (Google sign-in) when configured. Roles live in Firestore
//     `users/{uid}`. The owner email is granted 'moderator' automatically.
//   - Local picker (choose name + role) otherwise, for the offline prototype.
//
// Roles: 'guest' (read only) | 'resident' (add POIs & media) | 'moderator'
// (pin settlements, edit info, approve/delete media).

import { useSyncExternalStore } from 'react'
import { isFirebaseConfigured, auth, db, OWNER_EMAIL } from './firebase.js'
import { fetchAssignedRole } from './roles.js'

const FB = isFirebaseConfigured
const KEY = 'gk_session_v1'

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: '', role: 'guest' }
}

let session = FB ? { name: '', role: 'guest', loading: true } : loadLocal()
const listeners = new Set()

function emit() {
  if (!FB) {
    try {
      localStorage.setItem(KEY, JSON.stringify(session))
    } catch {}
  }
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

// --- Firebase mode ---
if (FB) {
  // dynamic import keeps the local-mode path from needing these symbols
  import('firebase/auth').then(({ onAuthStateChanged }) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        session = { name: '', role: 'guest', loading: false }
        emit()
        return
      }
      const email = (user.email || '').toLowerCase()
      const isOwner = email === OWNER_EMAIL
      let role = 'resident'
      let assignedSettlement = null
      try {
        const { doc, getDoc, setDoc } = await import('firebase/firestore')
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)
        const current = snap.exists() ? snap.data().role || 'resident' : 'resident'

        // A pre-authorization by email (added by the owner) takes precedence.
        const assigned = await fetchAssignedRole(email)
        if (assigned) assignedSettlement = assigned.settlementId || null

        role = isOwner ? 'moderator' : assigned?.role || current
        if (isOwner) role = 'moderator'

        // Keep the user's own profile in sync so security rules (which read
        // users/{uid}.role) recognize moderators.
        if (!snap.exists() || current !== role) {
          await setDoc(
            ref,
            {
              name: user.displayName || user.email,
              email: user.email,
              role,
              settlementId: assignedSettlement,
              updatedAt: Date.now(),
            },
            { merge: true },
          )
        }
      } catch (e) {
        console.error('[gk] user role load failed', e)
      }
      session = {
        name: user.displayName || user.email,
        role,
        email: user.email,
        uid: user.uid,
        settlementId: assignedSettlement,
        loading: false,
      }
      emit()
    })
  })
}

export async function signInGoogle() {
  if (!FB) return
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    console.error('[gk] Google sign-in failed', e)
    throw e
  }
}

// Local-mode sign-in (name + chosen role)
export function signIn(name, role) {
  if (FB) return
  session = { name: name || 'אורח/ת', role }
  emit()
}

export async function signOut() {
  if (FB) {
    const { signOut: fbSignOut } = await import('firebase/auth')
    await fbSignOut(auth)
    return
  }
  session = { name: '', role: 'guest' }
  emit()
}

export function isLiveAuth() {
  return FB
}

export function canEdit(role) {
  return role === 'resident' || role === 'moderator'
}
export function canModerate(role) {
  return role === 'moderator'
}

/** Stable key for the signed-in user (uid → email → local name). */
export function authorKey(session) {
  if (session?.uid) return `uid:${session.uid}`
  if (session?.email) return `email:${String(session.email).toLowerCase()}`
  if (session?.role && session.role !== 'guest' && session.name) return `name:${session.name}`
  return null
}

/** Moderators, or the person who created the item (by authorKey / authorName). */
export function canEditOwned(session, item) {
  if (!session || session.role === 'guest') return false
  if (canModerate(session.role)) return true
  if (!item) return false
  const key = authorKey(session)
  if (key && item.authorKey && key === item.authorKey) return true
  if (session.name && item.authorName && session.name.trim() === String(item.authorName).trim()) return true
  return false
}
