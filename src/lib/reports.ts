import { entryHasEvidence, type LessonEntry } from './entries'
import type { Lesson, Program } from './programs'
import { currentTermIndex, mondayOf, type Timetable, cellKey, currentWeek } from './timetable'
import { BADGES, computeStats } from './achievements'
import { classKey } from './classPrograms'
import { NO_AWAY_DAYS } from './away'

export type ReportPeriod = 'term' | 'ytd'

export interface Kpis {
  lessonsTaught: number
  daysRemaining: number | null
  evidenceEntries: number
  programsActive: number
  lessonsThisWeek: number
  outcomesCovered: number
  streak: number
  achievementProgress: number
  termNumber: number | null
}

export interface ProgramRow {
  programId: string
  name: string
  klass: string
  taught: number
  total: number
  progress: number
  lastLessonDate: string | null
  lastLessonTitle: string | null
  nextLessonTitle: string | null
  complete: boolean
}

export interface TimelineBar {
  label: string
  count: number
}

export type FocusSeverity = 'warning' | 'alert' | 'done'
export interface FocusItem {
  programId: string
  name: string
  reason: string
  severity: FocusSeverity
}

export interface Overview {
  kpis: Kpis
  programs: ProgramRow[]
  timeline: TimelineBar[]
  focus: FocusItem[]
  periodLabel: string
  timelineLabel: string
}

export interface LoadedProgram {
  program: Program
  lessons: Lesson[]
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000)
const classOf = (e: LessonEntry) => `${(e.subject || '').trim().toLowerCase()}|${(e.className || '').trim().toLowerCase()}`
const isTeachingPeriod = (label: string) => /^(period\s*|p\s*|lesson\s*)?\d+$/i.test((label || '').trim())

/** Resolve the current (or most recent) term's date range and number. */
function activeTerm(tt: Timetable | null, now: Date) {
  const terms = tt?.terms ?? []
  let idx = currentTermIndex(tt, now)
  if (idx < 0) {
    // Holidays / outside a term — use the most recent term that has already started.
    const iso = toISO(now)
    for (let i = terms.length - 1; i >= 0; i--) {
      if (terms[i]?.start && terms[i].start <= iso) {
        idx = i
        break
      }
    }
  }
  if (idx < 0 || !terms[idx]?.start || !terms[idx]?.end) return null
  return { index: idx, number: idx + 1, start: terms[idx].start, end: terms[idx].end }
}

/**
 * Calculate the longest streak of consecutive teaching days with entries.
 *
 * `awayDates` are the days the teacher marked themselves away (illness, leave — see
 * src/lib/away.ts). They're skipped exactly like a holiday: they neither break the
 * run nor extend it, so a week off sick leaves the streak intact.
 */
export function computeStreak(
  entries: LessonEntry[],
  tt: Timetable | null,
  now: Date,
  awayDates: ReadonlySet<string> = NO_AWAY_DAYS,
): number {
  if (!tt || !tt.periods?.length) return 0
  const hasCalendar = (tt.terms ?? []).some((t) => t?.start && t?.end)

  const recordedByDate = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!e.date || e.missed) continue
    if (!recordedByDate.has(e.date)) recordedByDate.set(e.date, new Set())
    recordedByDate.get(e.date)!.add(classKey(e.subject, e.className))
  }

  const teachingIds = new Set(tt.periods.filter((p) => isTeachingPeriod(p.label)).map((p) => p.id))
  const scheduledFor = (date: Date): string[] => {
    const wd = (date.getDay() + 6) % 7
    if (wd > 4) return []
    if (hasCalendar && currentTermIndex(tt, date) < 0) return []
    const week = currentWeek(tt, date)
    const keys: string[] = []
    for (const p of tt.periods) {
      if (!teachingIds.has(p.id)) continue
      const cell = tt.cells[cellKey(week, p.id, wd)]
      if (cell && cell.kind !== 'meeting') keys.push(classKey(cell.subject, cell.className))
    }
    return keys
  }

  // Copied so the day-stepping loop below can't mutate the caller's date.
  const today = new Date(now)
  const dates = entries.map((e) => e.date).filter(Boolean).sort()
  const firstStart = (tt.terms ?? []).map((t) => t?.start).filter(Boolean).sort()[0]
  const earliest = [dates[0], firstStart].filter(Boolean).sort()[0]
  if (!earliest) return 0
  let cursor = new Date(`${earliest}T00:00:00`)
  const floor = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
  if (cursor < floor) cursor = floor

  type Day = { iso: string; hasEntry: boolean }
  const days: Day[] = []
  for (let d = new Date(cursor); d <= today; d.setDate(d.getDate() + 1)) {
    const sched = scheduledFor(d)
    if (!sched.length) continue
    if (awayDates.has(toISO(d))) continue // marked away — neutral, like a holiday
    const rec = recordedByDate.get(toISO(d)) ?? new Set<string>()
    days.push({ iso: toISO(d), hasEntry: rec.size > 0 })
  }
  if (!days.length) return 0

  let streak = 0
  let run = 0
  for (const d of days) {
    run = d.hasEntry ? run + 1 : 0
    if (run > streak) streak = run
  }
  return streak
}

/** Build the full Teaching Overview from the teacher's data. Pure — no I/O. */
export function buildOverview(params: {
  entries: LessonEntry[]
  programs: LoadedProgram[]
  timetable: Timetable | null
  now: Date
  period: ReportPeriod
  /** Days marked away — excluded from the streak and coverage figures. */
  awayDates?: ReadonlySet<string>
}): Overview {
  const { entries, programs, timetable, now, period, awayDates = NO_AWAY_DAYS } = params
  const term = activeTerm(timetable, now)
  const todayISO = toISO(now)

  // Period window
  let startISO: string
  let endISO: string
  let periodLabel: string
  if (period === 'term' && term) {
    startISO = term.start
    endISO = term.end
    periodLabel = `Term ${term.number}`
  } else {
    startISO = `${now.getFullYear()}-01-01`
    endISO = todayISO
    periodLabel = 'Year to date'
  }

  const inPeriod = entries.filter((e) => e.date >= startISO && e.date <= endISO && !e.missed)

  // KPI: lessons this week (Monday → today)
  const weekStart = toISO(mondayOf(now))
  const lessonsThisWeek = entries.filter((e) => e.date >= weekStart && e.date <= todayISO).length

  // KPI: outcomes covered + classes taught (distinct, within period)
  const outcomeSet = new Set<string>()
  const classSet = new Set<string>()
  for (const e of inPeriod) {
    ;(e.outcomes ?? []).forEach((o) => o && outcomeSet.add(o.trim().toLowerCase()))
    const c = classOf(e)
    if (c !== '|') classSet.add(c)
  }

  // Programs active this period
  const programsActive =
    period === 'term' && term
      ? programs.filter((p) => (p.program.term ?? 0) === 0 || (p.program.term ?? 0) === term.number).length
      : programs.length

  const daysRemaining = term ? Math.max(0, daysBetween(now, new Date(`${term.end}T00:00:00`))) : null

  // KPI: streak (current recording streak)
  const streak = computeStreak(entries, timetable, now, awayDates)

  // KPI: achievement progress (earned badges / total badges)
  const taught = entries.filter((e) => !e.missed)
  const stats = computeStats({
    entries: taught,
    programs,
    timetable,
    feedbackCount: 0,
    events: {},
    perpetual: false,
    awayDates,
  })
  const earnedBadges = BADGES.filter((b) => b.earned(stats)).length
  const achievementProgress = BADGES.length > 0 ? Math.round((earnedBadges / BADGES.length) * 100) : 0

  const kpis: Kpis = {
    lessonsTaught: inPeriod.length,
    daysRemaining,
    // inPeriod has already excluded missed lessons, so entryHasEvidence is enough.
    evidenceEntries: inPeriod.filter(entryHasEvidence).length,
    programsActive,
    lessonsThisWeek,
    outcomesCovered: outcomeSet.size,
    streak,
    achievementProgress,
    termNumber: term?.number ?? null,
  }

  // Program snapshot rows
  const rows: ProgramRow[] = programs
    .map(({ program, lessons }) => {
      const pid = program.id!
      const progEntries = inPeriod
        .filter((e) => e.programId === pid)
        .sort((a, b) => a.date.localeCompare(b.date))
      const recordedLessonIds = new Set(progEntries.map((e) => e.lessonId).filter(Boolean) as string[])
      const total = program.lessonCount || lessons.length || 0
      const taught = recordedLessonIds.size || progEntries.length
      const progress = total > 0 ? Math.min(100, Math.round((taught / total) * 100)) : 0
      const last = progEntries[progEntries.length - 1]
      const ordered = [...lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      const next = ordered.find((l) => l.id && !recordedLessonIds.has(l.id))
      const complete = total > 0 && taught >= total
      return {
        programId: pid,
        name: program.name,
        klass: program.subject || program.stage || '',
        taught,
        total,
        progress,
        lastLessonDate: last?.date ?? null,
        lastLessonTitle: last?.lessonTitle || null,
        nextLessonTitle: complete ? null : next?.title ?? null,
        complete,
      } satisfies ProgramRow
    })
    .filter((r) => r.total > 0 || r.taught > 0)
    .sort((a, b) => b.progress - a.progress)

  // Teaching timeline — lessons per week of the active term
  let timeline: TimelineBar[] = []
  let timelineLabel = ''
  if (term) {
    const start = mondayOf(new Date(`${term.start}T00:00:00`))
    const end = mondayOf(new Date(`${term.end}T00:00:00`))
    const weeks = Math.max(1, Math.min(20, daysBetween(start, end) / 7 + 1))
    const counts = new Array(Math.ceil(weeks)).fill(0)
    for (const e of entries) {
      if (e.missed || e.date < term.start || e.date > term.end) continue
      const wk = Math.round(daysBetween(start, mondayOf(new Date(`${e.date}T00:00:00`))) / 7)
      if (wk >= 0 && wk < counts.length) counts[wk]++
    }
    timeline = counts.map((count, i) => ({ label: `Week ${i + 1}`, count }))
    timelineLabel = `Term ${term.number}`
  }

  // Upcoming focus — programs needing attention
  const focus: FocusItem[] = []
  for (const r of rows) {
    if (r.complete) {
      focus.push({ programId: r.programId, name: r.name, reason: 'Program complete', severity: 'done' })
      continue
    }
    const remaining = r.total - r.taught
    const daysSince = r.lastLessonDate ? daysBetween(new Date(`${r.lastLessonDate}T00:00:00`), now) : null
    if (daysSince === null) {
      focus.push({ programId: r.programId, name: r.name, reason: 'No lessons recorded yet', severity: 'alert' })
    } else if (daysSince >= 8) {
      focus.push({ programId: r.programId, name: r.name, reason: `No lesson recorded in ${daysSince} days`, severity: 'alert' })
    } else if (remaining > 0 && remaining <= 2) {
      focus.push({ programId: r.programId, name: r.name, reason: `${remaining} lesson${remaining === 1 ? '' : 's'} remaining`, severity: 'warning' })
    }
  }
  // Show attention items first, then completions.
  focus.sort((a, b) => (a.severity === 'done' ? 1 : 0) - (b.severity === 'done' ? 1 : 0))

  return { kpis, programs: rows, timeline, focus, periodLabel, timelineLabel }
}

/* ---------------- CSV exports ---------------- */

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  // Neutralise spreadsheet formula injection. Lesson notes and evidence are free
  // text, and an exported register is opened in Excel — often by someone else, since
  // admin "view as" lets an admin export another teacher's entries. A leading =, +,
  // -, @, tab or CR makes Excel evaluate the cell (e.g. =HYPERLINK(...) exfiltrating
  // neighbouring cells, or a DDE payload). Quoting alone does NOT prevent this, so
  // prefix a single quote to force text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Full evidence register for the period — one row per diary entry. */
export function evidenceRegisterCsv(entries: LessonEntry[]): string {
  const header = [
    'Date', 'Subject', 'Class', 'Room', 'Program', 'Lesson', 'Program position', 'Confidence', 'Outcomes',
    'Outcome connections', 'Note', 'Program annotation', 'Assessment evidence', 'Differentiation',
    'HPGE opportunities', 'Teaching standards (APST)', 'Syllabus content', 'Reflection', 'Next steps',
  ]
  // Each action carries the evidence-based reason it was recommended, which is the part
  // that makes it defensible in an accreditation conversation — so keep them paired.
  const action = (a: { action: string; reason?: string }) => (a.reason ? `${a.action} (${a.reason})` : a.action)
  const rows = entries
    .filter((e) => !e.missed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const ev = e.evidence
      const nextSteps = ev?.nextActions?.length
        ? ev.nextActions.map(action).join('; ')
        : (ev?.nextSteps ?? []).join('; ')
      return [
        e.date, e.subject || '', e.className || '', e.room || '', e.programName || '', e.lessonTitle || '',
        ev?.curriculumLinks?.programPosition || '',
        e.confidence || '', (e.outcomes ?? []).join('; '),
        (ev?.outcomeConnections ?? []).map((o) => `${o.code}: ${o.connection ?? ''}`.trim()).join(' | '),
        e.note || '',
        ev?.annotations || '', ev?.assessmentEvidence || '', ev?.differentiation || '',
        (ev?.hpgeOpportunities ?? []).map((h) => `${h.domain} (${h.type}): ${h.description}`).join(' | '),
        (ev?.teachingStandards ?? []).map((s) => `${s.focusArea} ${s.title ?? ''} — ${s.connection ?? ''}`.trim()).join(' | '),
        (ev?.curriculumLinks?.syllabusContent ?? []).join(' | '),
        ev?.reflection || '', nextSteps,
      ]
    })
  return toCsv([header, ...rows])
}

/** Program-by-program progress summary. */
export function programReportCsv(rows: ProgramRow[]): string {
  const header = ['Program', 'Class', 'Progress %', 'Lessons taught', 'Total lessons', 'Last lesson', 'Next lesson', 'Status']
  const body = rows.map((r) => [
    r.name, r.klass, r.progress, r.taught, r.total, r.lastLessonTitle || '',
    r.complete ? 'Complete' : r.nextLessonTitle || '', r.complete ? 'Complete' : 'In progress',
  ])
  return toCsv([header, ...body])
}
