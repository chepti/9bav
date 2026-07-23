// Session / auth. Two modes:
//   - Firebase Auth (Google sign-in) when configured. Roles live in Firestore
//     `users/{uid}`. The owner email is granted 'moderator' automatically.
//   - Local picker (choose name + role) otherwise, for the offline prototype.
//
// Roles: 'guest' (read only) | 'resident' (add POIs & media) | 'moderator'
// (pin settlements, edit info, approve/delete media).

import { useSyncExternalStore } from 'react'
import { isFirebaseConfigured, auth, db, OWNER_EMAIL } from './firebase.js'

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
      try {
        const { doc, getDoc, setDoc } = await import('firebase/firestore')
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          role = snap.data().role || 'resident'
        } else {
          role = isOwner ? 'moderator' : 'resident'
          await setDoc(ref, {
            name: user.displayName || user.email,
            email: user.email,
            role,
            createdAt: Date.now(),
          })
        }
      } catch (e) {
        console.error('[gk] user role load failed', e)
      }
      if (isOwner && role !== 'moderator') role = 'moderator'
      session = {
        name: user.displayName || user.email,
        role,
        email: user.email,
        uid: user.uid,
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
