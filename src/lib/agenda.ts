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

/* ------------------------------------------------------------------ *
 * Upcoming activities
 * ------------------------------------------------------------------ *
 * The dated things a teacher has to remember but which aren't lessons —
 * excursions, assessment due dates, meetings, whole-school events.
 * Stored one document per activity: users/{uid}/activities/{id}.
 */

export type ActivityKind = 'excursion' | 'assessment' | 'meeting' | 'event' | 'reminder'

export const ACTIVITY_KINDS: { id: ActivityKind; label: string; chip: string; accent: string }[] = [
  { id: 'excursion', label: 'Excursion', chip: 'bg-sky-100 text-sky-700', accent: 'text-sky-600' },
  { id: 'assessment', label: 'Assessment', chip: 'bg-violet-100 text-violet-700', accent: 'text-violet-600' },
  { id: 'meeting', label: 'Meeting', chip: 'bg-amber-100 text-amber-700', accent: 'text-amber-600' },
  { id: 'event', label: 'Event', chip: 'bg-teal-100 text-teal-700', accent: 'text-teal-600' },
  { id: 'reminder', label: 'Reminder', chip: 'bg-navy-100 text-navy-600', accent: 'text-navy-500' },
]

export const activityKindMeta = (kind?: ActivityKind) =>
  ACTIVITY_KINDS.find((k) => k.id === kind) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1]

export interface Activity {
  id?: string
  title: string
  /** yyyy-mm-dd the activity falls on. */
  date: string
  /** Free-text context — the class, faculty or cohort it relates to. */
  detail?: string
  kind: ActivityKind
  createdAt?: Timestamp
}

/** Live-subscribes to every activity, soonest first. */
export function subscribeActivities(uid: string, cb: (items: Activity[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users', uid, 'activities'), orderBy('date'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Activity) }))),
    () => cb([]),
  )
}

export async function saveActivity(uid: string, activity: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
  if (!db) throw { code: 'unavailable' }
  const ref = await addDoc(collection(db, 'users', uid, 'activities'), {
    title: activity.title.trim(),
    date: activity.date,
    detail: activity.detail?.trim() ?? '',
    kind: activity.kind,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateActivity(uid: string, id: string, patch: Partial<Omit<Activity, 'id' | 'createdAt'>>) {
  if (!db) throw { code: 'unavailable' }
  await updateDoc(doc(db, 'users', uid, 'activities', id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteActivity(uid: string, id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'activities', id))
}

/* ------------------------------------------------------------------ *
 * To-do items
 * ------------------------------------------------------------------ *
 * Stored one document per task: users/{uid}/todos/{id}.
 */

export interface TodoItem {
  id?: string
  text: string
  done: boolean
  createdAt?: Timestamp
}

export function subscribeTodos(uid: string, cb: (items: TodoItem[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users', uid, 'todos'), orderBy('createdAt'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TodoItem) }))),
    () => cb([]),
  )
}

export async function addTodo(uid: string, text: string): Promise<string> {
  if (!db) throw { code: 'unavailable' }
  const ref = await addDoc(collection(db, 'users', uid, 'todos'), {
    text: text.trim(),
    done: false,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTodo(uid: string, id: string, patch: Partial<Omit<TodoItem, 'id' | 'createdAt'>>) {
  if (!db) throw { code: 'unavailable' }
  await updateDoc(doc(db, 'users', uid, 'todos', id), patch)
}

export async function deleteTodo(uid: string, id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'todos', id))
}

/* ------------------------------------------------------------------ *
 * Shared date helpers
 * ------------------------------------------------------------------ */

export const todayISO = (now: Date = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

/** Parses a yyyy-mm-dd string as a local date (never UTC, which can shift the day). */
export function parseISODate(iso: string): Date | null {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/**
 * Day/month/year, always DD/MM/YY. Built by hand rather than via
 * toLocaleDateString: the browser locale decides field order, so a US-locale
 * machine renders 7 August as 08/07/26 — the same string an Australian teacher
 * reads as 8 July.
 */
export function formatDDMMYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

/** "Today" / "Tomorrow" / "Fri, 07/08/26" — how soon an activity is, at a glance. */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const date = parseISODate(iso)
  if (!date) return ''
  const days = Math.round(
    (date.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
  )
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  return `${weekday}, ${formatDDMMYY(date)}`
}

/** The upcoming activities, soonest first — anything from today onwards. */
export function upcomingActivities(items: Activity[], now: Date = new Date()): Activity[] {
  const today = todayISO(now)
  return items.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date))
}
