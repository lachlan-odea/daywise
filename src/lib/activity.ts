import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/** Local-time yyyy-mm-dd. Used as the map key for a day of activity. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** The shape of users/{uid}/meta/activity. */
export interface ActivityDoc {
  /** yyyy-mm-dd → true for every day the user opened the app. */
  days?: Record<string, true>
}

const GUARD_KEY = 'daywise:activeDay'

/**
 * Marks today as an active day for this user.
 *
 * The profile document only keeps a single `lastLoginAt`, which can answer "who is
 * here now" but never "how many people were here last Tuesday". This adds one tiny
 * merge-write per user per day per device — guarded by localStorage so a page
 * reload doesn't repeat it — and that history is what the admin dashboard's
 * daily/weekly active-user charts are built from.
 *
 * Best-effort: failures are swallowed, since losing an analytics ping must never
 * interrupt sign-in.
 */
export async function pingActivity(uid: string) {
  if (!db) return
  const key = dayKey(new Date())
  try {
    if (localStorage.getItem(`${GUARD_KEY}:${uid}`) === key) return
  } catch {
    /* private mode / storage disabled — fall through and just write. */
  }
  try {
    await setDoc(doc(db, 'users', uid, 'meta', 'activity'), { days: { [key]: true } }, { merge: true })
    localStorage.setItem(`${GUARD_KEY}:${uid}`, key)
  } catch {
    /* offline, rules, or storage — not worth surfacing. */
  }
}
