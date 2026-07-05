import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Evidence {
  annotations: string
  assessmentEvidence: string
  differentiation: string
  reflection: string
  nextSteps: string[]
}

export interface LessonEntry {
  id?: string
  /** yyyy-mm-dd of the lesson. */
  date: string
  /** The teacher's raw voice/text note. */
  note: string
  subject: string
  className: string
  room?: string
  programId?: string
  programName?: string
  lessonId?: string
  lessonTitle?: string
  confidence?: string
  outcomes: string[]
  evidence: Evidence
  createdAt?: Timestamp
}

export const EMPTY_EVIDENCE: Evidence = {
  annotations: '',
  assessmentEvidence: '',
  differentiation: '',
  reflection: '',
  nextSteps: [],
}

export function subscribeEntries(uid: string, cb: (entries: LessonEntry[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users', uid, 'entries'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as LessonEntry) }))),
    () => cb([]),
  )
}

export async function getEntry(uid: string, id: string): Promise<LessonEntry | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid, 'entries', id))
  return snap.exists() ? { id: snap.id, ...(snap.data() as LessonEntry) } : null
}

export async function saveEntry(uid: string, entry: Omit<LessonEntry, 'id' | 'createdAt'>): Promise<string> {
  if (!db) throw { code: 'unavailable' }
  const ref = await addDoc(collection(db, 'users', uid, 'entries'), {
    ...entry,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteEntry(uid: string, id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'entries', id))
}
