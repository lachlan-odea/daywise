import type { LessonEntry } from './entries'
import type { Lesson, Program } from './programs'
import { currentTermIndex, mondayOf, type Timetable } from './timetable'

export type ReportPeriod = 'term' | 'ytd'

export interface Kpis {
  lessonsTaught: number
  daysRemaining: number | null
  evidenceEntries: number
  programsActive: number
  lessonsThisWeek: number
  outcomesCovered: number
  classesTaught: number
  lastRecorded: Date | null
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

/** Build the full Teaching Overview from the teacher's data. Pure — no I/O. */
export function buildOverview(params: {
  entries: LessonEntry[]
  programs: LoadedProgram[]
  timetable: Timetable | null
  now: Date
  period: ReportPeriod
}): Overview {
  const { entries, programs, timetable, now, period } = params
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

  // KPI: last recorded (across all entries, excluding missed)
  let lastRecorded: Date | null = null
  for (const e of entries) {
    if (e.missed) continue
    const t = e.createdAt?.toDate?.() ?? (e.date ? new Date(e.date) : null)
    if (t && (!lastRecorded || t > lastRecorded)) lastRecorded = t
  }

  // Programs active this period
  const programsActive =
    period === 'term' && term
      ? programs.filter((p) => (p.program.term ?? 0) === 0 || (p.program.term ?? 0) === term.number).length
      : programs.length

  const daysRemaining = term ? Math.max(0, daysBetween(now, new Date(`${term.end}T00:00:00`))) : null

  const kpis: Kpis = {
    lessonsTaught: inPeriod.length,
    daysRemaining,
    evidenceEntries: inPeriod.filter(hasEvidence).length,
    programsActive,
    lessonsThisWeek,
    outcomesCovered: outcomeSet.size,
    classesTaught: classSet.size,
    lastRecorded,
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
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
    'Date', 'Subject', 'Class', 'Room', 'Program', 'Lesson', 'Confidence', 'Outcomes',
    'Note', 'Program annotation', 'Assessment evidence', 'Differentiation', 'Reflection', 'Next steps',
  ]
  const rows = entries
    .filter((e) => !e.missed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date, e.subject || '', e.className || '', e.room || '', e.programName || '', e.lessonTitle || '',
      e.confidence || '', (e.outcomes ?? []).join('; '), e.note || '',
      e.evidence?.annotations || '', e.evidence?.assessmentEvidence || '', e.evidence?.differentiation || '',
      e.evidence?.reflection || '', (e.evidence?.nextSteps ?? []).join('; '),
    ])
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
