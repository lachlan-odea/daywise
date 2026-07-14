import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface Period {
  id: string
  label: string
  start: string
  end: string
}

export type ClassColor =
  | 'rose'
  | 'pink'
  | 'orange'
  | 'amber'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'navy'

export interface ClassCell {
  subject: string
  className: string
  room?: string
  color?: ClassColor
}

export type WeekId = 'A' | 'B'
export const WEEKS: WeekId[] = ['A', 'B']

export interface TimeSlot {
  start: string
  end: string
}

/** A term's date range (yyyy-mm-dd). Empty strings mean unset. */
export interface TermRange {
  start: string
  end: string
}

export interface Timetable {
  periods: Period[]
  /** Keyed by `${week}__${periodId}__${dayIndex}`; week is 'A'|'B', dayIndex 0 (Mon) … 4 (Fri). */
  cells: Record<string, ClassCell>
  /**
   * Per-day bell-time exceptions, keyed the same way as cells. A period uses its
   * default start/end unless an override exists for that specific week + day.
   */
  timeOverrides?: Record<string, TimeSlot>
  /** Term start/end dates (index 0 = Term 1 … 3 = Term 4), for term & holiday awareness. */
  terms?: TermRange[]
  /** Whether the school runs a fortnightly (A/B week) timetable. */
  fortnightly?: boolean
  /** Monday (yyyy-mm-dd) of a reference calendar week, used to work out the current week. */
  anchorMondayISO?: string
  /** Which week (A/B) that reference calendar week is. */
  anchorWeek?: WeekId
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export const otherWeek = (w: WeekId): WeekId => (w === 'A' ? 'B' : 'A')

/** Monday (local) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (date.getDay() + 6) % 7 // 0 = Mon … 6 = Sun
  date.setDate(date.getDate() - offset)
  return date
}

export function mondayISO(d: Date): string {
  const m = mondayOf(d)
  const mm = String(m.getMonth() + 1).padStart(2, '0')
  const dd = String(m.getDate()).padStart(2, '0')
  return `${m.getFullYear()}-${mm}-${dd}`
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Assigns a distinct colour to each unique class (same subject + class → same colour). */
export function assignColors(tt: Timetable): Timetable {
  const palette = Object.keys(CLASS_COLORS) as ClassColor[]
  const map = new Map<string, ClassColor>()
  let i = 0
  const cells: Record<string, ClassCell> = {}
  for (const [k, cell] of Object.entries(tt.cells)) {
    const key = `${(cell.subject || '').trim().toLowerCase()}|${(cell.className || '').trim().toLowerCase()}`
    let color = map.get(key)
    if (!color) {
      color = palette[i % palette.length]
      map.set(key, color)
      i++
    }
    cells[k] = { ...cell, color }
  }
  return { ...tt, cells }
}

/** Index (0–3) of the term containing `date`, or -1 if none (holiday / no calendar). */
export function currentTermIndex(tt: Timetable | null, date: Date = new Date()): number {
  const iso = toISO(date)
  const terms = tt?.terms ?? []
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i]
    if (t?.start && t?.end && iso >= t.start && iso <= t.end) return i
  }
  return -1
}

export interface TermInfo {
  hasCalendar: boolean
  isHoliday: boolean
  termNumber: number | null
  week: number | null
}

/** Resolves the current term, teaching week and holiday status from the term calendar. */
export function termInfo(tt: Timetable | null, date: Date = new Date()): TermInfo {
  const terms = tt?.terms ?? []
  const hasCalendar = terms.some((t) => t?.start && t?.end)
  if (!hasCalendar) return { hasCalendar: false, isHoliday: false, termNumber: null, week: null }
  const idx = currentTermIndex(tt, date)
  if (idx < 0) return { hasCalendar: true, isHoliday: true, termNumber: null, week: null }
  const [y, m, d] = terms[idx].start.split('-').map(Number)
  const start = mondayOf(new Date(y, (m || 1) - 1, d || 1))
  const weeks = Math.round((mondayOf(date).getTime() - start.getTime()) / (7 * 86_400_000))
  return { hasCalendar: true, isHoliday: false, termNumber: idx + 1, week: weeks + 1 }
}

/** Works out whether a given date falls in Week A or Week B. Each term starts on Week A. */
export function currentWeek(tt: Timetable | null, now: Date = new Date()): WeekId {
  if (!tt?.fortnightly) return 'A'
  // Each term starts on Week A, so derive A/B from the current term's start.
  const idx = currentTermIndex(tt, now)
  if (idx >= 0 && tt.terms?.[idx]?.start) {
    const [ty, tm, td] = tt.terms[idx].start.split('-').map(Number)
    const termStart = mondayOf(new Date(ty, (tm || 1) - 1, td || 1))
    const w = Math.round((mondayOf(now).getTime() - termStart.getTime()) / (7 * 86_400_000))
    return (((w % 2) + 2) % 2) === 0 ? 'A' : 'B'
  }
  // Fallback to the manual anchor (e.g. no term calendar, or during holidays).
  if (!tt.anchorMondayISO || !tt.anchorWeek) return 'A'
  const [y, m, d] = tt.anchorMondayISO.split('-').map(Number)
  const anchor = new Date(y, (m || 1) - 1, d || 1)
  const weeks = Math.round((mondayOf(now).getTime() - anchor.getTime()) / (7 * 86_400_000))
  const parity = ((weeks % 2) + 2) % 2
  return parity === 0 ? tt.anchorWeek : otherWeek(tt.anchorWeek)
}

export const CLASS_COLORS: Record<ClassColor, { chip: string; dot: string; label: string }> = {
  rose: { chip: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500', label: 'Rose' },
  pink: { chip: 'bg-pink-100 text-pink-800 border-pink-200', dot: 'bg-pink-500', label: 'Pink' },
  orange: { chip: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500', label: 'Orange' },
  amber: { chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', label: 'Amber' },
  emerald: { chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', label: 'Emerald' },
  teal: { chip: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-500', label: 'Teal' },
  cyan: { chip: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-500', label: 'Cyan' },
  sky: { chip: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500', label: 'Sky' },
  blue: { chip: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', label: 'Blue' },
  indigo: { chip: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500', label: 'Indigo' },
  violet: { chip: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-500', label: 'Violet' },
  navy: { chip: 'bg-navy-100 text-navy-800 border-navy-200', dot: 'bg-navy-700', label: 'Navy' },
}

export function cellKey(week: WeekId, periodId: string, dayIndex: number) {
  return `${week}__${periodId}__${dayIndex}`
}

/** The bell time for a period on a specific week + day: an override if set, else the default. */
export function effectiveTime(tt: Timetable, period: Period, week: WeekId, day: number): TimeSlot {
  const o = tt.timeOverrides?.[cellKey(week, period.id, day)]
  return { start: o?.start ?? period.start, end: o?.end ?? period.end }
}

/** True when this week+day uses a bell time different from the period default. */
export function hasTimeOverride(tt: Timetable, periodId: string, week: WeekId, day: number): boolean {
  return Boolean(tt.timeOverrides?.[cellKey(week, periodId, day)])
}

/**
 * Upgrades older single-week timetables (keys `${periodId}__${dayIndex}`) to the
 * fortnightly key format by assigning existing classes to Week A.
 */
export function migrateTimetable(tt: Timetable): Timetable {
  const cells: Record<string, ClassCell> = {}
  for (const [k, v] of Object.entries(tt.cells ?? {})) {
    cells[k.split('__').length === 2 ? `A__${k}` : k] = v
  }
  // A partial doc (e.g. saved with only `terms`) must still have periods to render.
  const periods = tt.periods?.length ? tt.periods : defaultTimetable().periods
  return { ...tt, periods, cells }
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
    (snap) => cb(snap.exists() ? migrateTimetable(snap.data() as Timetable) : null),
    () => cb(null),
  )
}

/** One-time fetch of the timetable (for search). */
export async function getTimetableOnce(uid: string): Promise<Timetable | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid, 'timetable', 'main'))
  return snap.exists() ? migrateTimetable(snap.data() as Timetable) : null
}

export async function saveTimetable(uid: string, tt: Timetable) {
  if (!db) throw { code: 'unavailable' }
  await setDoc(doc(db, 'users', uid, 'timetable', 'main'), { ...tt, updatedAt: serverTimestamp() })
}

/** Merges just the term calendar into the timetable doc (doesn't touch periods/cells). */
export async function updateTerms(uid: string, terms: TermRange[]) {
  if (!db) throw { code: 'unavailable' }
  await setDoc(doc(db, 'users', uid, 'timetable', 'main'), { terms, updatedAt: serverTimestamp() }, { merge: true })
}
