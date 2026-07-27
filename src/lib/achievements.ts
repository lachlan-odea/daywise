import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { LessonEntry } from './entries'
import type { Lesson, Program } from './programs'
import { classKey } from './classPrograms'
import { cellKey, currentTermIndex, currentWeek, mondayISO, type Timetable } from './timetable'

export type BadgeCategory = 'consistency' | 'milestones' | 'programs' | 'evidence' | 'community' | 'features' | 'special'

export interface Badge {
  id: string
  category: BadgeCategory
  title: string
  description: string
  /** Returns true when the badge is earned, given the computed stats. */
  earned: (s: Stats) => boolean
  /** Optional progress toward the badge, for locked badges (0–1). */
  progress?: (s: Stats) => number
}

/** Lightweight event flags we record as the teacher uses the app. */
export interface AchievementEvents {
  reportsVisited?: boolean
  reportGenerated?: boolean
  evidenceRegister?: boolean
}

export interface Stats {
  lessons: number
  evidence: number
  programsStarted: number
  programsCompleted: number
  outcomeExpert: boolean
  streak: number
  weekComplete: boolean
  perfectMonth: boolean
  perfectTerm: boolean
  perfectYear: boolean
  feedbackCount: number
  events: AchievementEvents
  perpetual: boolean
  beta: boolean
}

const isTeachingPeriod = (label: string) => /^(period\s*|p\s*|lesson\s*)?\d+$/i.test((label || '').trim())
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/* ---------------- event flags (Firestore) ---------------- */

export function subscribeAchievementEvents(uid: string, cb: (e: AchievementEvents) => void) {
  if (!db) {
    cb({})
    return () => {}
  }
  return onSnapshot(
    doc(db, 'users', uid, 'meta', 'achievements'),
    (snap) => cb(((snap.data()?.events as AchievementEvents) ?? {})),
    () => cb({}),
  )
}

export async function getAchievementEvents(uid: string): Promise<AchievementEvents> {
  if (!db) return {}
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'achievements'))
  return (snap.data()?.events as AchievementEvents) ?? {}
}

export async function markAchievementEvent(uid: string, key: keyof AchievementEvents) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'meta', 'achievements'), { events: { [key]: true } }, { merge: true })
}

/* ---------------- stats computation ---------------- */

interface LoadedProgram {
  program: Program
  lessons: Lesson[]
}

/** Consistency figures derived from the timetable + recorded entries. */
function completeness(entries: LessonEntry[], tt: Timetable | null) {
  const blank = { streak: 0, weekComplete: false, perfectMonth: false, perfectTerm: false, perfectYear: false }
  if (!tt || !tt.periods?.length) return blank
  const hasCalendar = (tt.terms ?? []).some((t) => t?.start && t?.end)

  const recordedByDate = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!e.date) continue
    if (!recordedByDate.has(e.date)) recordedByDate.set(e.date, new Set())
    recordedByDate.get(e.date)!.add(classKey(e.subject, e.className))
  }

  const teachingIds = new Set(tt.periods.filter((p) => isTeachingPeriod(p.label)).map((p) => p.id))
  const scheduledFor = (date: Date): string[] => {
    const wd = (date.getDay() + 6) % 7
    if (wd > 4) return []
    if (hasCalendar && currentTermIndex(tt, date) < 0) return [] // holiday
    const week = currentWeek(tt, date)
    const keys: string[] = []
    for (const p of tt.periods) {
      if (!teachingIds.has(p.id)) continue
      const cell = tt.cells[cellKey(week, p.id, wd)]
      if (cell) keys.push(classKey(cell.subject, cell.className))
    }
    return keys
  }

  // Range: earliest entry (or first term) → today, clamped to ~2 years.
  const today = new Date()
  const dates = entries.map((e) => e.date).filter(Boolean).sort()
  const firstStart = (tt.terms ?? []).map((t) => t?.start).filter(Boolean).sort()[0]
  const earliest = [dates[0], firstStart].filter(Boolean).sort()[0]
  if (!earliest) return blank
  let cursor = new Date(`${earliest}T00:00:00`)
  const floor = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
  if (cursor < floor) cursor = floor

  type Day = { iso: string; status: 'complete' | 'partial'; hasEntry: boolean }
  const days: Day[] = []
  for (let d = new Date(cursor); d <= today; d.setDate(d.getDate() + 1)) {
    const sched = scheduledFor(d)
    if (!sched.length) continue // not a teaching day
    const rec = recordedByDate.get(toISO(d)) ?? new Set<string>()
    const status = sched.every((k) => rec.has(k)) ? 'complete' : 'partial'
    days.push({ iso: toISO(d), status, hasEntry: rec.size > 0 })
  }
  if (!days.length) return blank

  // Streak — longest run of consecutive teaching days with any entry.
  let streak = 0
  let run = 0
  for (const d of days) {
    run = d.hasEntry ? run + 1 : 0
    if (run > streak) streak = run
  }

  const todayISO = toISO(today)
  const fridayOfWeek = (mondayIso: string) => {
    const [y, m, dd] = mondayIso.split('-').map(Number)
    const f = new Date(y, (m || 1) - 1, (dd || 1) + 4)
    return toISO(f)
  }

  // Group elapsed teaching days.
  const byWeek = new Map<string, Day[]>()
  const byMonth = new Map<string, Day[]>()
  for (const d of days) {
    const wk = mondayISO(new Date(`${d.iso}T00:00:00`))
    ;(byWeek.get(wk) ?? byWeek.set(wk, []).get(wk)!).push(d)
    const mo = d.iso.slice(0, 7)
    ;(byMonth.get(mo) ?? byMonth.set(mo, []).get(mo)!).push(d)
  }

  const weekComplete = [...byWeek.entries()].some(
    ([wk, ds]) => fridayOfWeek(wk) <= todayISO && ds.every((d) => d.status === 'complete'),
  )

  const monthEnd = (mo: string) => {
    const [y, m] = mo.split('-').map(Number)
    return toISO(new Date(y, m, 0)) // day 0 of next month = last day of this month
  }
  const perfectMonth = [...byMonth.entries()].some(
    ([mo, ds]) => monthEnd(mo) <= todayISO && ds.every((d) => d.status === 'complete'),
  )

  // Terms — only completed terms (end ≤ today).
  const terms = tt.terms ?? []
  const termComplete = terms.map((t) => {
    if (!t?.start || !t?.end || t.end > todayISO) return false
    const ds = days.filter((d) => d.iso >= t.start && d.iso <= t.end)
    return ds.length > 0 && ds.every((d) => d.status === 'complete')
  })
  const perfectTerm = termComplete.some(Boolean)
  const perfectYear = termComplete.length === 4 && termComplete.every(Boolean)

  return { streak, weekComplete, perfectMonth, perfectTerm, perfectYear }
}

export function computeStats(params: {
  entries: LessonEntry[]
  programs: LoadedProgram[]
  timetable: Timetable | null
  feedbackCount: number
  events: AchievementEvents
  perpetual: boolean
}): Stats {
  const { entries, programs, timetable, feedbackCount, events, perpetual } = params

  const hasEvidence = (e: LessonEntry) =>
    !!e.evidence &&
    !!(
      e.evidence.annotations ||
      e.evidence.assessmentEvidence ||
      e.evidence.differentiation ||
      e.evidence.reflection ||
      e.evidence.nextSteps?.length ||
      e.outcomes?.length
    )

  let programsStarted = 0
  let programsCompleted = 0
  let outcomeExpert = false
  for (const { program, lessons } of programs) {
    const pid = program.id
    const progEntries = entries.filter((e) => e.programId === pid)
    if (progEntries.length) programsStarted++
    const recordedLessons = new Set(progEntries.map((e) => e.lessonId).filter(Boolean) as string[])
    const total = program.lessonCount || lessons.length || 0
    if (total > 0 && recordedLessons.size >= total) programsCompleted++
    // Outcome expert: recorded outcomes cover every outcome in the program.
    const needed = new Set<string>()
    lessons.forEach((l) => (l.outcomes ?? []).forEach((o) => o && needed.add(o.trim().toLowerCase())))
    if (needed.size > 0) {
      const covered = new Set<string>()
      progEntries.forEach((e) => (e.outcomes ?? []).forEach((o) => o && covered.add(o.trim().toLowerCase())))
      if ([...needed].every((o) => covered.has(o))) outcomeExpert = true
    }
  }

  const cons = completeness(entries, timetable)

  return {
    lessons: entries.length,
    evidence: entries.filter(hasEvidence).length,
    programsStarted,
    programsCompleted,
    outcomeExpert,
    ...cons,
    feedbackCount,
    events,
    perpetual,
    beta: true, // closed beta — every current user
  }
}

/* ---------------- badge catalogue ---------------- */

export const CATEGORY_LABELS: Record<BadgeCategory, { title: string; blurb: string }> = {
  consistency: { title: 'Consistency', blurb: 'Celebrate consistent lesson recording and complete teaching records.' },
  milestones: { title: 'Milestones', blurb: 'Big milestones for every lesson you record.' },
  programs: { title: 'Programs', blurb: 'Rewards for planning, progress and completion.' },
  evidence: { title: 'Evidence', blurb: 'Building a strong evidence base for your teaching.' },
  community: { title: 'Community', blurb: 'Working together and supporting others.' },
  features: { title: 'Features & Feedback', blurb: 'Exploring daywise and helping it grow.' },
  special: { title: 'Special', blurb: 'Exclusive badges for our earliest supporters.' },
}

export const BADGES: Badge[] = [
  // Consistency
  { id: 'first-lesson', category: 'consistency', title: 'First Lesson', description: 'Recorded your first lesson.', earned: (s) => s.lessons >= 1 },
  { id: 'week-complete', category: 'consistency', title: 'Week Complete', description: 'Recorded every scheduled lesson for one week.', earned: (s) => s.weekComplete },
  { id: 'perfect-month', category: 'consistency', title: 'Perfect Month', description: 'Recorded every scheduled lesson for an entire month.', earned: (s) => s.perfectMonth },
  { id: 'perfect-term', category: 'consistency', title: 'Perfect Term', description: 'Recorded 100% of your scheduled lessons for an entire term.', earned: (s) => s.perfectTerm },
  { id: 'perfect-year', category: 'consistency', title: 'Perfect Year', description: 'Recorded 100% of your scheduled lessons for the entire school year.', earned: (s) => s.perfectYear },
  { id: 'streak-master', category: 'consistency', title: 'Streak Master', description: 'Recorded lessons for 10 consecutive teaching days.', earned: (s) => s.streak >= 10, progress: (s) => s.streak / 10 },

  // Milestones
  { id: 'lessons-10', category: 'milestones', title: '10 Lessons', description: 'Recorded 10 lessons.', earned: (s) => s.lessons >= 10, progress: (s) => s.lessons / 10 },
  { id: 'lessons-50', category: 'milestones', title: '50 Lessons', description: 'Recorded 50 lessons.', earned: (s) => s.lessons >= 50, progress: (s) => s.lessons / 50 },
  { id: 'lessons-100', category: 'milestones', title: '100 Lessons', description: 'Recorded 100 lessons.', earned: (s) => s.lessons >= 100, progress: (s) => s.lessons / 100 },
  { id: 'lessons-250', category: 'milestones', title: '250 Lessons', description: 'Recorded 250 lessons.', earned: (s) => s.lessons >= 250, progress: (s) => s.lessons / 250 },
  { id: 'lessons-500', category: 'milestones', title: '500 Lessons', description: 'Recorded 500 lessons.', earned: (s) => s.lessons >= 500, progress: (s) => s.lessons / 500 },
  { id: 'lessons-1000', category: 'milestones', title: '1000 Lessons', description: 'Recorded 1000 lessons.', earned: (s) => s.lessons >= 1000, progress: (s) => s.lessons / 1000 },

  // Programs
  { id: 'program-started', category: 'programs', title: 'Program Started', description: 'Recorded the first lesson in a program.', earned: (s) => s.programsStarted >= 1 },
  { id: 'program-completed', category: 'programs', title: 'Program Completed', description: 'Completed a teaching program.', earned: (s) => s.programsCompleted >= 1 },
  { id: 'five-programs', category: 'programs', title: 'Five Programs', description: 'Completed 5 teaching programs.', earned: (s) => s.programsCompleted >= 5, progress: (s) => s.programsCompleted / 5 },
  { id: 'outcome-expert', category: 'programs', title: 'Outcome Expert', description: 'Achieved 100% outcome coverage in a program.', earned: (s) => s.outcomeExpert },

  // Evidence
  { id: 'first-evidence', category: 'evidence', title: 'First Evidence', description: 'Added your first evidence entry.', earned: (s) => s.evidence >= 1 },
  { id: 'evidence-100', category: 'evidence', title: 'Evidence Builder', description: 'Added 100 evidence entries.', earned: (s) => s.evidence >= 100, progress: (s) => s.evidence / 100 },
  { id: 'evidence-500', category: 'evidence', title: 'Evidence Library', description: 'Added 500 evidence entries.', earned: (s) => s.evidence >= 500, progress: (s) => s.evidence / 500 },
  { id: 'accreditation-ready', category: 'evidence', title: 'Accreditation Ready', description: 'Generated your first Evidence Register.', earned: (s) => !!s.events.evidenceRegister },

  // Community (unlock as sharing features arrive)
  { id: 'team-teacher', category: 'community', title: 'Team Teacher', description: 'Contributed to a shared program.', earned: () => false },
  { id: 'shared-contributor', category: 'community', title: 'Shared Contributor', description: "Contributed lessons to a program you don't own.", earned: () => false },
  { id: 'supported-teacher', category: 'community', title: 'Supported Teacher', description: 'Helped another teacher by contributing evidence.', earned: () => false },

  // Features & feedback
  { id: 'first-report', category: 'features', title: 'First Report', description: 'Generated your first report.', earned: (s) => !!s.events.reportGenerated },
  { id: 'data-explorer', category: 'features', title: 'Data Explorer', description: 'Visited the Data & Reports dashboard.', earned: (s) => !!s.events.reportsVisited },
  { id: 'feedback-champion', category: 'features', title: 'Feedback Champion', description: 'Submitted feedback to help improve daywise.', earned: (s) => s.feedbackCount >= 1 },
  { id: 'bug-hunter', category: 'features', title: 'Bug Hunter', description: 'Reported a bug that was fixed.', earned: () => false },

  // Special
  { id: 'founding-teacher', category: 'special', title: 'Founding Teacher', description: 'Became a founding teacher in beta.', earned: (s) => s.perpetual },
  { id: 'beta-pioneer', category: 'special', title: 'Beta Pioneer', description: 'Using daywise during beta.', earned: (s) => s.beta },
]

export const CATEGORY_ORDER: BadgeCategory[] = ['consistency', 'milestones', 'programs', 'evidence', 'community', 'features', 'special']
