import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Away days — a whole day the teacher wasn't at school (illness, leave, a course).
 *
 * Marking a lesson as missed answers "this class didn't run". An away day answers
 * "none of my classes were mine to teach", which is the case the streak and
 * coverage figures have to know about: a teacher off sick for three days should
 * come back to their streak intact, not be punished for it.
 *
 * Stored one document per date (`users/{uid}/awayDays/{yyyy-mm-dd}`) so marking a
 * day is a single idempotent write and unmarking is a single delete. No Firestore
 * rules change is needed — the recursive wildcard under /users/{uid} already
 * covers this subcollection (owner-writes, admin-reads).
 */

export type AwayReason = 'sick' | 'carers' | 'leave' | 'pd' | 'other'

export const AWAY_REASONS: { id: AwayReason; label: string }[] = [
  { id: 'sick', label: 'Sick leave' },
  { id: 'carers', label: 'Carer’s leave' },
  { id: 'leave', label: 'Personal / other leave' },
  { id: 'pd', label: 'Professional learning' },
  { id: 'other', label: 'Other' },
]

const REASON_IDS = new Set<string>(AWAY_REASONS.map((r) => r.id))

export const awayReasonLabel = (reason: AwayReason) =>
  AWAY_REASONS.find((r) => r.id === reason)?.label ?? 'Away'

export interface AwayDay {
  /** yyyy-mm-dd — mirrors the document id so the mailer can range-query on it. */
  date: string
  reason: AwayReason
  /** Optional free text ("flu", "Stage 5 moderation day"). */
  note?: string
  updatedAt?: Timestamp
}

/** Away days keyed by yyyy-mm-dd. */
export type AwayDays = Record<string, AwayDay>

/** An empty set, shared so the optional `awayDates` parameters have a stable default. */
export const NO_AWAY_DAYS: ReadonlySet<string> = new Set<string>()

/** Just the dates, which is all the streak and coverage maths needs. */
export const awayDateSet = (days: AwayDays): ReadonlySet<string> => new Set(Object.keys(days))

function normalize(id: string, raw: unknown): AwayDay | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as { date?: unknown; reason?: unknown; note?: unknown }
  const date = typeof v.date === 'string' && v.date ? v.date : id
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    // An unrecognised reason still means the day was away, so fall back rather than drop it.
    reason: typeof v.reason === 'string' && REASON_IDS.has(v.reason) ? (v.reason as AwayReason) : 'other',
    ...(typeof v.note === 'string' && v.note.trim() ? { note: v.note.trim() } : {}),
  }
}

function toMap(docs: { id: string; data: () => unknown }[]): AwayDays {
  const out: AwayDays = {}
  for (const d of docs) {
    const day = normalize(d.id, d.data())
    if (day) out[day.date] = day
  }
  return out
}

export function subscribeAwayDays(uid: string, cb: (days: AwayDays) => void) {
  if (!db) {
    cb({})
    return () => {}
  }
  return onSnapshot(
    collection(db, 'users', uid, 'awayDays'),
    (snap) => cb(toMap(snap.docs)),
    () => cb({}),
  )
}

/** One-time fetch, for the pages that load their data once (Reports, Achievements). */
export async function getAwayDaysOnce(uid: string): Promise<AwayDays> {
  if (!db) return {}
  try {
    return toMap((await getDocs(collection(db, 'users', uid, 'awayDays'))).docs)
  } catch {
    return {}
  }
}

/**
 * Marks (or re-labels) a day as away. Deliberately a full overwrite rather than a
 * merge, so clearing the note actually clears it.
 */
export async function markAwayDay(uid: string, date: string, reason: AwayReason, note?: string) {
  if (!db) throw { code: 'unavailable' }
  await setDoc(doc(db, 'users', uid, 'awayDays', date), {
    date,
    reason,
    // undefined is dropped on write (ignoreUndefinedProperties), so an empty note
    // leaves the field off the document entirely.
    note: note?.trim() || undefined,
    updatedAt: serverTimestamp(),
  })
}

export async function clearAwayDay(uid: string, date: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'awayDays', date))
}
