// Firebase initialization. Config comes from Vite env vars (see .env.example).
// If the config is absent, `isFirebaseConfigured` is false and the app runs in
// local (localStorage) mode — so nothing breaks before the project is wired.

import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId)

// Email of the site owner — granted admin on first sign-in.
export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || 'chepti@gmail.com').toLowerCase()

let app = null
let db = null
let auth = null

if (isFirebaseConfigured) {
  app = initializeApp(cfg)
  // ignoreUndefinedProperties: our media/POI objects carry optional fields that
  // may be undefined; Firestore rejects undefined unless told to ignore it.
  db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  auth = getAuth(app)
} else {
  // eslint-disable-next-line no-console
  console.info('[gk] Firebase not configured — running in local (localStorage) mode.')
}

export { app, db, auth }
