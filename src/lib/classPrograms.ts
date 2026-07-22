import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Maps a timetable class → the program(s) it follows, so Record Lesson matches a
 * recording only against that class's programs (not everything sharing a subject).
 * Stored as a single map document per user: users/{uid}/meta/classPrograms.
 */
export type ClassProgramMap = Record<string, string[]>

/** Stable key for a class derived from its subject + class name. */
export const classKey = (subject?: string, className?: string) =>
  `${(subject || '').trim().toLowerCase()}|${(className || '').trim().toLowerCase()}`

export function subscribeClassPrograms(uid: string, cb: (map: ClassProgramMap) => void) {
  if (!db) {
    cb({})
    return () => {}
  }
  return onSnapshot(
    doc(db, 'users', uid, 'meta', 'classPrograms'),
    (snap) => cb(((snap.data()?.map as ClassProgramMap) ?? {})),
    () => cb({}),
  )
}

export async function getClassPrograms(uid: string): Promise<ClassProgramMap> {
  if (!db) return {}
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'classPrograms'))
  return (snap.data()?.map as ClassProgramMap) ?? {}
}

export async function setClassProgramsForClass(uid: string, key: string, programIds: string[]) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'meta', 'classPrograms'), { map: { [key]: programIds } }, { merge: true })
}
