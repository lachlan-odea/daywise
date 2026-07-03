import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface Period {
  id: string
  label: string
  start: string
  end: string
}

export type ClassColor = 'teal' | 'sky' | 'navy' | 'amber' | 'violet' | 'rose'

export interface ClassCell {
  subject: string
  className: string
  room?: string
  color?: ClassColor
}

export interface Timetable {
  periods: Period[]
  /** Keyed by `${periodId}__${dayIndex}` where dayIndex is 0 (Mon) … 4 (Fri). */
  cells: Record<string, ClassCell>
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export const CLASS_COLORS: Record<ClassColor, { chip: string; dot: string; label: string }> = {
  teal: { chip: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-500', label: 'Teal' },
  sky: { chip: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500', label: 'Sky' },
  navy: { chip: 'bg-navy-100 text-navy-800 border-navy-200', dot: 'bg-navy-700', label: 'Navy' },
  amber: { chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', label: 'Amber' },
  violet: { chip: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-500', label: 'Violet' },
  rose: { chip: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500', label: 'Rose' },
}

export function cellKey(periodId: string, dayIndex: number) {
  return `${periodId}__${dayIndex}`
}

/** Generates a stable unique id (used for period rows). */
export function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'p_' + Math.abs(Date.now() ^ Math.floor(Math.random() * 1e9)).toString(36)
}

export function defaultTimetable(): Timetable {
  return {
    periods: [
      { id: 'p1', label: 'Period 1', start: '09:00', end: '09:55' },
      { id: 'p2', label: 'Period 2', start: '09:55', end: '10:50' },
      { id: 'p3', label: 'Recess', start: '10:50', end: '11:15' },
      { id: 'p4', label: 'Period 3', start: '11:15', end: '12:10' },
      { id: 'p5', label: 'Period 4', start: '12:10', end: '13:05' },
      { id: 'p6', label: 'Lunch', start: '13:05', end: '13:45' },
      { id: 'p7', label: 'Period 5', start: '13:45', end: '14:40' },
      { id: 'p8', label: 'Period 6', start: '14:40', end: '15:35' },
    ],
    cells: {},
  }
}

/** Live-subscribes to the user's timetable document. Falls back to a default. */
export function subscribeTimetable(uid: string, cb: (tt: Timetable | null) => void) {
  if (!db) {
    cb(null)
    return () => {}
  }
  return onSnapshot(
    doc(db, 'users', uid, 'timetable', 'main'),
    (snap) => cb(snap.exists() ? (snap.data() as Timetable) : null),
    () => cb(null),
  )
}

export async function saveTimetable(uid: string, tt: Timetable) {
  if (!db) throw { code: 'unavailable' }
  await setDoc(doc(db, 'users', uid, 'timetable', 'main'), { ...tt, updatedAt: serverTimestamp() })
}
