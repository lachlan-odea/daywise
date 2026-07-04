import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Lesson {
  id?: string
  order: number
  title: string
  outcomes: string[]
  learningIntentions: string[]
  successCriteria: string[]
  activities: string[]
  resources: string[]
  keywords: string[]
  assessment: string[]
}

export interface Program {
  id?: string
  name: string
  subject: string
  stage: string
  description?: string
  source?: string
  lessonCount: number
  createdAt?: Timestamp
}

/** The five detail sections rendered for each lesson. */
export const LESSON_SECTIONS: { key: keyof Lesson; label: string }[] = [
  { key: 'outcomes', label: 'Outcomes' },
  { key: 'learningIntentions', label: 'Learning intentions' },
  { key: 'successCriteria', label: 'Success criteria' },
  { key: 'activities', label: 'Activities' },
  { key: 'resources', label: 'Resources' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'keywords', label: 'Keywords' },
]

export function subscribePrograms(uid: string, cb: (programs: Program[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users', uid, 'programs'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Program) }))),
    () => cb([]),
  )
}

/** One-time fetch of the program list (for search / pickers). */
export async function getProgramList(uid: string): Promise<Program[]> {
  if (!db) return []
  const snap = await getDocs(query(collection(db, 'users', uid, 'programs'), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Program) }))
}

export async function getProgram(uid: string, id: string): Promise<{ program: Program; lessons: Lesson[] } | null> {
  if (!db) return null
  const psnap = await getDoc(doc(db, 'users', uid, 'programs', id))
  if (!psnap.exists()) return null
  const lsnap = await getDocs(query(collection(db, 'users', uid, 'programs', id, 'lessons'), orderBy('order')))
  return {
    program: { id: psnap.id, ...(psnap.data() as Program) },
    lessons: lsnap.docs.map((d) => ({ id: d.id, ...(d.data() as Lesson) })),
  }
}

function serializeLesson(l: Lesson, i: number) {
  return {
    order: i,
    title: l.title ?? '',
    outcomes: l.outcomes ?? [],
    learningIntentions: l.learningIntentions ?? [],
    successCriteria: l.successCriteria ?? [],
    activities: l.activities ?? [],
    resources: l.resources ?? [],
    keywords: l.keywords ?? [],
    assessment: l.assessment ?? [],
  }
}

export async function saveProgram(
  uid: string,
  program: Omit<Program, 'id' | 'createdAt' | 'lessonCount'>,
  lessons: Lesson[],
): Promise<string> {
  if (!db) throw { code: 'unavailable' }
  const database = db
  const ref = await addDoc(collection(database, 'users', uid, 'programs'), {
    name: program.name,
    subject: program.subject,
    stage: program.stage,
    description: program.description ?? '',
    source: program.source ?? '',
    lessonCount: lessons.length,
    createdAt: serverTimestamp(),
  })
  const batch = writeBatch(database)
  lessons.forEach((l, i) => {
    const lref = doc(collection(database, 'users', uid, 'programs', ref.id, 'lessons'))
    batch.set(lref, serializeLesson(l, i))
  })
  await batch.commit()
  return ref.id
}

/** Updates a program's metadata and fully replaces its lessons (handles edits, adds, removals, reorders). */
export async function updateProgram(
  uid: string,
  id: string,
  meta: Pick<Program, 'name' | 'subject' | 'stage' | 'description'>,
  lessons: Lesson[],
) {
  if (!db) throw { code: 'unavailable' }
  const database = db
  const existing = await getDocs(collection(database, 'users', uid, 'programs', id, 'lessons'))
  const batch = writeBatch(database)
  existing.docs.forEach((d) => batch.delete(d.ref))
  lessons.forEach((l, i) => {
    const lref = doc(collection(database, 'users', uid, 'programs', id, 'lessons'))
    batch.set(lref, serializeLesson(l, i))
  })
  batch.update(doc(database, 'users', uid, 'programs', id), {
    name: meta.name,
    subject: meta.subject,
    stage: meta.stage,
    description: meta.description ?? '',
    lessonCount: lessons.length,
  })
  await batch.commit()
}

export async function deleteProgram(uid: string, id: string) {
  if (!db) return
  const lsnap = await getDocs(collection(db, 'users', uid, 'programs', id, 'lessons'))
  const batch = writeBatch(db)
  lsnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'users', uid, 'programs', id))
  await batch.commit()
}
