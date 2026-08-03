import type { LessonEntry } from './entries'
import type { Lesson, Program } from './programs'
import { unitLabel } from './programs'
import { cellKey, currentTermIndex, currentWeek, mondayOf, type ClassCell, type Timetable } from './timetable'

/**
 * Derivations behind the daybook dashboard. Pure functions over data the page has
 * already subscribed to, so each period row can answer the three questions the
 * dashboard exists to answer: where am I up to, what do I teach next, and what do
 * I need to remember.
 */

/** Only numbered teaching periods (1, Period 1, P1…) are recordable — not roll call/breaks. */
export const isTeachingPeriod = (label: string) => /^(period\s*|p\s*|lesson\s*)?\d+$/i.test((label || '').trim())

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export interface LoadedProgram {
  program: Program
  lessons: Lesson[]
}

/** A short labelled list drawn from a program lesson (its resources or activities). */
export interface LessonDetail {
  label: string
  items: string[]
}

/** Where a class sits in its program — the clickable "Lesson 3 of 8" line. */
export interface ProgramPosition {
  programId: string
  programName: string
  /** 1-based position of the most recently taught lesson, or 0 if none yet. */
  index: number
  total: number
  /** 'Lesson' or 'Module', depending on how the program is organised. */
  unit: string
  /** The lesson to deep-link to (the one just taught, else the one up next). */
  lessonId?: string
  /** Share of the program taught so far, 0–1. */
  progress: number
}

export interface PeriodContext {
  /** The last lesson actually taught to this class, on or before the viewed day. */
  last: {
    title: string
    date: string
    detail: LessonDetail | null
  } | null
  position: ProgramPosition | null
  /** What to teach next, plus the actions/follow-ups worth carrying into it. */
  next: {
    title: string | null
    actions: string[]
  }
}

const firstLine = (s: string, max = 80) => {
  const line = (s || '').trim().split('\n')[0].trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** The resources (else activities) attached to a program lesson, capped for the card. */
function lessonDetail(lesson?: Lesson | null): LessonDetail | null {
  if (!lesson) return null
  if (lesson.resources?.length) return { label: 'Resources', items: lesson.resources.slice(0, 2) }
  if (lesson.activities?.length) return { label: 'Activities', items: lesson.activities.slice(0, 2) }
  return null
}

/**
 * Picks which program a class is following, from program metadata alone — so the
 * dashboard knows which lesson lists are worth fetching before it fetches them.
 *
 * Prefers the explicit class → program link saved on Record Lesson, then a program
 * the class has actually recorded against, and finally a loose subject match so a
 * class shows something useful before it has ever been linked.
 *
 * `classEntries` must be this class's entries only, newest first.
 */
export function pickProgramIdForClass(params: {
  cell: Pick<ClassCell, 'subject' | 'className'>
  linkedIds: string[]
  classEntries: LessonEntry[]
  programs: Program[]
}): string | null {
  const { cell, linkedIds, classEntries, programs } = params
  if (!programs.length) return null
  const exists = (id?: string | null) => (id && programs.some((p) => p.id === id) ? id : null)

  // An explicit link wins. With several linked, prefer the one most recently taught.
  if (linkedIds.length) {
    const recent = classEntries.find((e) => e.programId && linkedIds.includes(e.programId))
    return exists(recent?.programId) ?? exists(linkedIds[0])
  }

  const recorded = exists(classEntries.find((e) => e.programId)?.programId)
  if (recorded) return recorded

  const subject = (cell.subject || '').trim().toLowerCase()
  if (!subject) return null
  return (
    programs.find((p) => {
      const s = (p.subject || '').trim().toLowerCase()
      return !!s && (s.includes(subject) || subject.includes(s))
    })?.id ?? null
  )
}

/**
 * Builds everything the centre columns of a period row show.
 *
 * `classEntries` must already be narrowed to this class and ordered newest-first
 * (as `subscribeEntries` returns them) — the date sort below preserves that order
 * within a single day, so two lessons logged on one date stay in recording order.
 */
export function buildPeriodContext(params: {
  /** yyyy-mm-dd of the day being viewed. */
  viewISO: string
  classEntries: LessonEntry[]
  program: LoadedProgram | null
}): PeriodContext {
  const { viewISO, classEntries: allClassEntries, program } = params

  const classEntries = allClassEntries
    .filter((e) => !e.missed && e.date && e.date <= viewISO)
    .sort((a, b) => b.date.localeCompare(a.date))

  const lastEntry = classEntries[0] ?? null
  const ordered = program ? [...program.lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []

  // Lessons of this program already taught to this class.
  const taughtIds = new Set(
    classEntries
      .filter((e) => !program || e.programId === program.program.id)
      .map((e) => e.lessonId)
      .filter((id): id is string => !!id),
  )

  const lastLessonIdx = lastEntry?.lessonId ? ordered.findIndex((l) => l.id === lastEntry.lessonId) : -1
  const lastLesson = lastLessonIdx >= 0 ? ordered[lastLessonIdx] : null

  // The next untaught lesson after the one just taught. Falling back to the earliest
  // untaught lesson anywhere in the program means a class that skipped ahead is still
  // pointed at what it missed, rather than being told there's nothing left.
  const untaught = (l: Lesson) => !l.id || !taughtIds.has(l.id)
  const nextLesson = ordered.slice(lastLessonIdx + 1).find(untaught) ?? ordered.find(untaught) ?? null

  const total = program ? program.program.lessonCount || ordered.length : 0
  const position: ProgramPosition | null =
    program && total > 0
      ? {
          programId: program.program.id!,
          programName: program.program.name,
          index: lastLessonIdx >= 0 ? lastLessonIdx + 1 : taughtIds.size,
          total,
          unit: unitLabel(program.program.structure).one,
          lessonId: lastLesson?.id ?? nextLesson?.id,
          progress: Math.min(1, taughtIds.size / total),
        }
      : null

  // Recommended next: the follow-ups the teacher recorded last time come first —
  // they're the things most likely to be forgotten — then the upcoming lesson's plan.
  const actions: string[] = []
  const push = (items?: string[] | null) => {
    for (const item of items ?? []) {
      const t = (item || '').trim()
      if (t && !actions.some((a) => a.toLowerCase() === t.toLowerCase())) actions.push(t)
    }
  }
  push(lastEntry?.evidence?.nextSteps)
  push(nextLesson?.activities)
  if (actions.length < 2) push(nextLesson?.learningIntentions)

  return {
    last: lastEntry
      ? {
          title: lastEntry.lessonTitle?.trim() || firstLine(lastEntry.note) || 'Lesson recorded',
          date: lastEntry.date,
          detail: lessonDetail(lastLesson),
        }
      : null,
    position,
    next: { title: nextLesson?.title?.trim() || null, actions: actions.slice(0, 4) },
  }
}

/* ------------------------------------------------------------------ *
 * Weekly snapshot
 * ------------------------------------------------------------------ */

/**
 * Rough minutes of admin saved per recorded lesson, and again for each lesson that
 * carries teaching evidence. Deliberately conservative estimates — the figure is
 * labelled as an estimate in the UI.
 */
export const MINUTES_SAVED_PER_LESSON = 12
export const MINUTES_SAVED_PER_EVIDENCE = 8

export interface WeekSnapshot {
  /** Teaching classes timetabled Mon–Fri this week. */
  scheduled: number
  taught: number
  remaining: number
  evidence: number
  minutesSaved: number
  streak: number
}

export const hasEvidence = (e: LessonEntry) =>
  !e.missed &&
  !!e.evidence &&
  !!(
    e.evidence.annotations ||
    e.evidence.assessmentEvidence ||
    e.evidence.differentiation ||
    e.evidence.reflection ||
    e.evidence.nextSteps?.length ||
    e.outcomes?.length
  )

/** How many teaching classes the timetable schedules across the week containing `now`. */
export function scheduledThisWeek(tt: Timetable | null, now: Date): number {
  if (!tt?.periods?.length) return 0
  const hasCalendar = (tt.terms ?? []).some((t) => t?.start && t?.end)
  const monday = mondayOf(now)
  let count = 0
  for (let day = 0; day < 5; day++) {
    const date = new Date(monday)
    date.setDate(date.getDate() + day)
    // Holidays and pupil-free weeks shouldn't inflate the denominator.
    if (hasCalendar && currentTermIndex(tt, date) < 0) continue
    const week = currentWeek(tt, date)
    for (const p of tt.periods) {
      if (!isTeachingPeriod(p.label)) continue
      const cell = tt.cells[cellKey(week, p.id, day)]
      if (cell && cell.kind !== 'meeting') count++
    }
  }
  return count
}

export function buildWeekSnapshot(params: {
  entries: LessonEntry[]
  timetable: Timetable | null
  now: Date
  streak: number
}): WeekSnapshot {
  const { entries, timetable, now, streak } = params
  const monday = mondayOf(now)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const startISO = toISO(monday)
  const endISO = toISO(sunday)

  const week = entries.filter((e) => e.date >= startISO && e.date <= endISO)
  // Missed lessons were logged, but nothing was taught — they don't count here.
  const taught = week.filter((e) => !e.missed).length
  const evidence = week.filter(hasEvidence).length
  const scheduled = scheduledThisWeek(timetable, now)

  return {
    scheduled,
    taught,
    remaining: Math.max(0, scheduled - taught),
    evidence,
    minutesSaved: taught * MINUTES_SAVED_PER_LESSON + evidence * MINUTES_SAVED_PER_EVIDENCE,
    streak,
  }
}

/** "5h 20m" / "45m" / "—" */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}
