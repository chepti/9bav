// Lightweight visitor counter.
//   - Firestore mode: a single `meta/stats` doc with a `visits` integer, read
//     live via onSnapshot and bumped by exactly one, once per browser session.
//   - Local mode: a localStorage tally (meaningful only on that browser).
// Degrades silently: if the Firestore write is blocked (rules not deployed) the
// read still shows the current total; if the read is blocked, the counter hides.

import { useEffect, useState } from 'react'
import { isFirebaseConfigured, db } from './firebase.js'

const FB = isFirebaseConfigured
const SESSION_KEY = 'gk_visit_counted'
const LOCAL_KEY = 'gk_visits_local'

export function useVisitorCount() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    let unsub = null

    async function run() {
      if (FB) {
        const { doc, onSnapshot, runTransaction } = await import('firebase/firestore')
        const ref = doc(db, 'meta', 'stats')

        unsub = onSnapshot(
          ref,
          (snap) => { if (!cancelled) setCount(snap.exists() ? snap.data().visits || 0 : 0) },
          () => { /* read blocked (rules) — leave counter hidden */ },
        )

        if (!sessionStorage.getItem(SESSION_KEY)) {
          sessionStorage.setItem(SESSION_KEY, '1')
          try {
            await runTransaction(db, async (tx) => {
              const snap = await tx.get(ref)
              const cur = snap.exists() ? snap.data().visits || 0 : 0
              tx.set(ref, { visits: cur + 1 }, { merge: true })
            })
          } catch {
            /* write blocked — the displayed total simply won't include this visit */
          }
        }
      } else {
        let n = Number(localStorage.getItem(LOCAL_KEY) || '0')
        if (!sessionStorage.getItem(SESSION_KEY)) {
          sessionStorage.setItem(SESSION_KEY, '1')
          n += 1
          localStorage.setItem(LOCAL_KEY, String(n))
        }
        if (!cancelled) setCount(n)
      }
    }

    run()
    return () => { cancelled = true; if (unsub) unsub() }
  }, [])

  return count
}
