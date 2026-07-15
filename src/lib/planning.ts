import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Lightweight planning notes for a class on a specific day.
 * Stored one document per date (`users/{uid}/planning/{yyyy-mm-dd}`) holding a
 * map of period id → note text, so a day's notes load in a single read.
 */
export type PlanningNotes = Record<string, string>

export function subscribePlanningDay(uid: string, date: string, cb: (notes: PlanningNotes) => void) {
  if (!db) {
    cb({})
    return () => {}
  }
  const ref = doc(db, 'users', uid, 'planning', date)
  return onSnapshot(
    ref,
    (snap) => cb(((snap.data()?.notes as PlanningNotes) ?? {})),
    () => cb({}),
  )
}

export async function savePlanningNote(uid: string, date: string, periodId: string, note: string) {
  if (!db) throw { code: 'unavailable' }
  const ref = doc(db, 'users', uid, 'planning', date)
  const trimmed = note.trim()
  await setDoc(
    ref,
    { date, notes: { [periodId]: trimmed ? trimmed : deleteField() } },
    { merge: true },
  )
}
