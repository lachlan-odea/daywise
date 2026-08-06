import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

/*
 * The two sentences Curriculum Intelligence v6.5 returns verbatim when a lesson
 * recorded no assessment evidence / no differentiation. They are interpolated into
 * the prompt itself (src/lib/aiRecord.ts) so the wording the model is told to use and
 * the wording recognised here can never drift apart.
 *
 * They matter beyond display: an "evidence" field holding one of these says the
 * opposite of evidence, so entryHasEvidence() below must not count them. Without
 * that, every generated entry would register as having assessment evidence.
 */
export const NO_ASSESSMENT_EVIDENCE_RECORDED =
  'No explicit assessment evidence was recorded. Further checking for understanding is recommended to confirm student progress.'
export const NO_DIFFERENTIATION_RECORDED =
  'No explicit differentiation was recorded. A brief check for understanding could inform any targeted support or extension required next lesson.'

/** An outcome the completed lesson connected to, and how it connected. */
export interface OutcomeConnection {
  code: string
  /** The official descriptor, copied from the program — "" when only a code was supplied. */
  description?: string
  connection?: string
}

/** High Potential and Gifted Education opportunity — observed, or recommended for next time. */
export interface HpgeOpportunity {
  /** intellectual | creative | social-emotional | physical */
  domain: string
  type: 'observed' | 'recommended'
  description: string
}

/** An Australian Professional Standards for Teachers focus area the lesson evidences. */
export interface TeachingStandard {
  /** Focus area number, e.g. "2.2". */
  focusArea: string
  title?: string
  connection?: string
}

/** Where the lesson sits in the supplied curriculum, drawn only from supplied context. */
export interface CurriculumLinks {
  programPosition?: string
  syllabusContent?: string[]
  outcomes?: { code: string; description?: string }[]
}

/** A next-lesson action with the evidence-based reason for it. */
export interface NextAction {
  action: string
  reason?: string
}

export interface Evidence {
  annotations: string
  assessmentEvidence: string
  differentiation: string
  reflection: string
  /** Flat action text. Kept alongside `nextActions` so every existing reader — the
   *  dashboard's "Recommended next", the CSV, search — keeps working unchanged. */
  nextSteps: string[]
  /* ---- Curriculum Intelligence v6.5 additions. Optional: entries recorded before
     v6.5 don't have them, so every reader must tolerate undefined. ---- */
  outcomeConnections?: OutcomeConnection[]
  hpgeOpportunities?: HpgeOpportunity[]
  teachingStandards?: TeachingStandard[]
  curriculumLinks?: CurriculumLinks
  nextActions?: NextAction[]
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
  /** Marked as a missed/cancelled lesson — counts for coverage but not as a taught lesson. */
  missed?: boolean
  createdAt?: Timestamp
}

export const EMPTY_EVIDENCE: Evidence = {
  annotations: '',
  assessmentEvidence: '',
  differentiation: '',
  reflection: '',
  nextSteps: [],
}

/**
 * Evidence text that actually says something. The v6.5 "nothing was recorded"
 * fallbacks are prose, not evidence, so they read as empty here.
 */
export const isSubstantiveEvidence = (text?: string): boolean => {
  const t = (text ?? '').trim()
  return !!t && t !== NO_ASSESSMENT_EVIDENCE_RECORDED && t !== NO_DIFFERENTIATION_RECORDED
}

/**
 * Does this entry carry teaching evidence? The single definition behind the weekly
 * snapshot, the reports KPI and the evidence badges — previously duplicated three
 * times with slightly different field lists.
 *
 * Deliberately says nothing about `missed`: callers that have already filtered
 * missed lessons out shouldn't pay for the check twice (see hasEvidence in
 * src/lib/dashboard.ts, which adds it).
 */
export function entryHasEvidence(e: LessonEntry): boolean {
  const ev = e.evidence
  if (!ev) return false
  return !!(
    ev.annotations?.trim() ||
    isSubstantiveEvidence(ev.assessmentEvidence) ||
    isSubstantiveEvidence(ev.differentiation) ||
    ev.reflection?.trim() ||
    ev.nextSteps?.length ||
    e.outcomes?.length ||
    ev.outcomeConnections?.length ||
    ev.hpgeOpportunities?.length ||
    ev.teachingStandards?.length
  )
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

/** One-time fetch of all diary entries (for search). */
export async function getEntriesOnce(uid: string): Promise<LessonEntry[]> {
  if (!db) return []
  const snap = await getDocs(query(collection(db, 'users', uid, 'entries'), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as LessonEntry) }))
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

/** Edit an existing diary entry (note, class details, outcomes and evidence). */
export async function updateEntry(
  uid: string,
  id: string,
  patch: Partial<Omit<LessonEntry, 'id' | 'createdAt'>>,
) {
  if (!db) throw { code: 'unavailable' }
  await updateDoc(doc(db, 'users', uid, 'entries', id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteEntry(uid: string, id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'entries', id))
}
