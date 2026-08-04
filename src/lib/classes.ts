import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { classKey } from './classPrograms'
import { DAYS_SHORT, isMeetingCell, type ClassColor, type Timetable } from './timetable'

/**
 * A class the teacher has set up. Identified against the rest of the app
 * (timetable cells, diary entries, the classPrograms map) by classKey(subject, className).
 */
export interface ClassInfo {
  id?: string
  /** Display name, e.g. "Year 9 Science". */
  name: string
  /** Subject as it appears on the timetable, e.g. "Science". */
  subject: string
  /** Class code as it appears on the timetable, e.g. "9SC1". */
  className: string
  yearGroup?: string
  room?: string
  color?: ClassColor
  /** Icon key from CLASS_ICONS; empty/unset = pick automatically from the subject. */
  icon?: string
  /** Curriculum / syllabus the class follows — reserved; syllabus linking is not built yet. */
  curriculum?: string
  notes?: string
  createdAt?: Timestamp
}

/** The identity key linking a class to timetable cells, entries and assigned programs. */
export const classInfoKey = (c: Pick<ClassInfo, 'subject' | 'className'>) => classKey(c.subject, c.className)

export function subscribeClasses(uid: string, cb: (classes: ClassInfo[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users', uid, 'classes'), orderBy('name'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClassInfo) }))),
    () => cb([]),
  )
}

export function subscribeClass(uid: string, id: string, cb: (cls: ClassInfo | null) => void) {
  if (!db) {
    cb(null)
    return () => {}
  }
  return onSnapshot(
    doc(db, 'users', uid, 'classes', id),
    (snap) => cb(snap.exists() ? { id: snap.id, ...(snap.data() as ClassInfo) } : null),
    () => cb(null),
  )
}

export async function saveClass(uid: string, cls: Omit<ClassInfo, 'id' | 'createdAt'>): Promise<string> {
  if (!db) throw { code: 'unavailable' }
  const ref = await addDoc(collection(db, 'users', uid, 'classes'), {
    name: cls.name,
    subject: cls.subject,
    className: cls.className ?? '',
    yearGroup: cls.yearGroup ?? '',
    room: cls.room ?? '',
    color: cls.color ?? 'teal',
    icon: cls.icon ?? '',
    curriculum: cls.curriculum ?? '',
    notes: cls.notes ?? '',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateClass(uid: string, id: string, patch: Partial<Omit<ClassInfo, 'id' | 'createdAt'>>) {
  if (!db) throw { code: 'unavailable' }
  await updateDoc(doc(db, 'users', uid, 'classes', id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteClass(uid: string, id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'classes', id))
}

/**
 * The class's weekly schedule derived from the timetable, e.g. ["Mon 1", "Tue 2"].
 * On fortnightly timetables a slot taught in only one week is suffixed, e.g. "Mon 1 (Wk A)".
 */
export function classSchedule(tt: Timetable | null, subject: string, className: string): string[] {
  if (!tt) return []
  const key = classKey(subject, className)
  const periodIndex = new Map(tt.periods.map((p, i) => [p.id, i]))
  const slots = new Map<string, { day: number; order: number; label: string; weeks: Set<string> }>()
  for (const [k, cell] of Object.entries(tt.cells ?? {})) {
    if (isMeetingCell(cell) || classKey(cell.subject, cell.className) !== key) continue
    const [week, periodId, dayStr] = k.split('__')
    const day = Number(dayStr)
    const order = periodIndex.get(periodId)
    if (order === undefined || Number.isNaN(day) || !DAYS_SHORT[day]) continue
    const label = `${DAYS_SHORT[day]} ${tt.periods[order].label.replace(/^Period\s+/i, '')}`
    const slot = slots.get(label) ?? { day, order, label, weeks: new Set<string>() }
    slot.weeks.add(week)
    slots.set(label, slot)
  }
  return [...slots.values()]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((s) => (tt.fortnightly && s.weeks.size === 1 ? `${s.label} (Wk ${[...s.weeks][0]})` : s.label))
}

/** A unique teaching class found on the timetable (meetings/duties excluded). */
export interface TimetableClass {
  subject: string
  className: string
  room?: string
  color?: ClassColor
}

/** Unique classes on the timetable — used to suggest classes the teacher hasn't set up yet. */
export function timetableClasses(tt: Timetable | null): TimetableClass[] {
  if (!tt) return []
  const map = new Map<string, TimetableClass>()
  for (const cell of Object.values(tt.cells ?? {})) {
    if (isMeetingCell(cell)) continue
    const key = classKey(cell.subject, cell.className)
    if (key === '|' || map.has(key)) continue
    map.set(key, { subject: cell.subject, className: cell.className, room: cell.room, color: cell.color })
  }
  return [...map.values()].sort((a, b) => `${a.subject} ${a.className}`.localeCompare(`${b.subject} ${b.className}`))
}
