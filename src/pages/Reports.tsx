import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  Users,
  Target,
  TrendingUp,
  Layers,
  ChevronRight,
  AlertTriangle,
  CircleAlert,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getEntriesOnce, type LessonEntry } from '../lib/entries'
import { getProgramList, getProgram } from '../lib/programs'
import { subscribeTimetable, type Timetable } from '../lib/timetable'
import {
  buildOverview,
  evidenceRegisterCsv,
  programReportCsv,
  downloadCsv,
  type LoadedProgram,
  type ReportPeriod,
  type FocusSeverity,
} from '../lib/reports'
import { markAchievementEvent } from '../lib/achievements'

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return iso
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
const fmtTime = (d: Date | null) => (d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '')

const FOCUS_META: Record<FocusSeverity, { icon: LucideIcon; color: string }> = {
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  alert: { icon: CircleAlert, color: 'text-rose-500' },
  done: { icon: CheckCircle2, color: 'text-emerald-500' },
}

const PROGRESS_COLOR = (p: number, complete: boolean) =>
  complete ? 'bg-emerald-500' : p >= 66 ? 'bg-teal-500' : p >= 40 ? 'bg-amber-500' : 'bg-rose-500'

export default function Reports() {
  const { user, effectiveUid } = useAuth()
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [programs, setPrograms] = useState<LoadedProgram[] | null>(null)
  const [tt, setTt] = useState<Timetable | null>(null)
  const [period, setPeriod] = useState<ReportPeriod>('term')
  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(effectiveUid, setTt)
  }, [user])

  // Visiting this page unlocks the "Data Explorer" achievement.
  useEffect(() => {
    if (user) markAchievementEvent(effectiveUid, 'reportsVisited').catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [ents, list] = await Promise.all([getEntriesOnce(effectiveUid), getProgramList(effectiveUid)])
      const fulls = await Promise.all(list.map((p) => (p.id ? getProgram(effectiveUid, p.id) : null)))
      if (!active) return
      setEntries(ents)
      setPrograms(fulls.filter(Boolean) as LoadedProgram[])
    })()
    return () => {
      active = false
    }
  }, [user])

  const loading = entries === null || programs === null

  const ov = useMemo(() => {
    if (!entries || !programs) return null
    return buildOverview({ entries, programs, timetable: tt, now, period })
  }, [entries, programs, tt, now, period])

  if (loading || !ov) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your reports…
        </div>
      </main>
    )
  }

  const k = ov.kpis
  const cards: { label: string; value: string; sub: string; icon: LucideIcon; tint: string }[] = [
    { label: 'Lessons Taught', value: String(k.lessonsTaught), sub: 'All classes', icon: BookOpen, tint: 'bg-teal-50 text-teal-600' },
    { label: 'Days Remaining', value: k.daysRemaining == null ? '—' : String(k.daysRemaining), sub: k.termNumber ? `In Term ${k.termNumber}` : 'Set term dates', icon: CalendarDays, tint: 'bg-sky-50 text-sky-600' },
    { label: 'Evidence Entries', value: String(k.evidenceEntries), sub: 'Across all programs', icon: BarChart3, tint: 'bg-violet-50 text-violet-600' },
    { label: 'Programs Active', value: String(k.programsActive), sub: ov.periodLabel, icon: BookOpen, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Lessons This Week', value: String(k.lessonsThisWeek), sub: 'Across all classes', icon: TrendingUp, tint: 'bg-teal-50 text-teal-600' },
    { label: 'Outcomes Covered', value: String(k.outcomesCovered), sub: 'Across all programs', icon: Target, tint: 'bg-amber-50 text-amber-600' },
    { label: 'Classes Taught', value: String(k.classesTaught), sub: ov.periodLabel, icon: Users, tint: 'bg-rose-50 text-rose-600' },
    {
      label: 'Last Recorded',
      value: k.lastRecorded ? (isToday(k.lastRecorded, now) ? 'Today' : fmtDate(toISO(k.lastRecorded))) : '—',
      sub: k.lastRecorded ? fmtTime(k.lastRecorded) : 'No entries yet',
      icon: Clock,
      tint: 'bg-navy-50 text-navy-600',
    },
  ]

  const maxBar = Math.max(1, ...ov.timeline.map((t) => t.count))

  const runEvidenceRegister = () => {
    const startISO = period === 'term' && k.termNumber ? termStartISO(tt, now) : `${now.getFullYear()}-01-01`
    const endISO = period === 'term' && k.termNumber ? termEndISO(tt, now) : toISO(now)
    const rows = (entries ?? []).filter((e) => e.date >= startISO && e.date <= endISO)
    downloadCsv(`daywise-evidence-register-${period}.csv`, evidenceRegisterCsv(rows))
    if (user) {
      markAchievementEvent(effectiveUid, 'evidenceRegister').catch(() => {})
      markAchievementEvent(effectiveUid, 'reportGenerated').catch(() => {})
    }
  }
  const runProgramReport = () => {
    downloadCsv(`daywise-program-report-${period}.csv`, programReportCsv(ov.programs))
    if (user) markAchievementEvent(effectiveUid, 'reportGenerated').catch(() => {})
  }
  const runTermSummary = () => {
    if (user) markAchievementEvent(effectiveUid, 'reportGenerated').catch(() => {})
    window.print()
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <BarChart3 size={15} /> Data &amp; Reports
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Teaching Overview</h1>
          <p className="mt-1 text-navy-500">Track your teaching progress and evidence.</p>
        </div>
        <div className="flex rounded-xl border border-navy-200 bg-white p-1">
          {([
            { id: 'term', label: 'This Term' },
            { id: 'ytd', label: 'Year to Date' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                period === t.id ? 'bg-navy-800 text-white' : 'text-navy-500 hover:text-navy-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-navy-100 bg-white p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold text-navy-400">{c.label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.tint}`}>
                <c.icon size={16} />
              </span>
            </div>
            <p className={`mt-2 text-3xl font-extrabold tracking-tight ${c.value === 'Today' ? 'text-teal-600' : 'text-navy-900'}`}>
              {c.value}
            </p>
            <p className="mt-0.5 text-xs text-navy-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Program snapshot */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <Layers size={16} className="text-navy-400" /> Program Snapshot
            </h2>
            {ov.programs.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-navy-200 p-8 text-center">
                <p className="text-sm font-semibold text-navy-700">No program activity yet</p>
                <p className="mt-1 text-sm text-navy-500">Upload a program and record lessons to see progress here.</p>
                <Link to="/app/programs" className="btn-primary mx-auto mt-4 text-sm">
                  <BookOpen size={15} /> Go to programs
                </Link>
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy-100 text-[11px] font-bold uppercase tracking-wide text-navy-400">
                      <th className="py-2 pr-3">Program / Class</th>
                      <th className="px-3 py-2">Progress</th>
                      <th className="px-3 py-2">Lessons</th>
                      <th className="px-3 py-2">Last Lesson</th>
                      <th className="px-3 py-2">Next Lesson</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ov.programs.map((r) => (
                      <tr key={r.programId} className="group border-b border-navy-50 last:border-0">
                        <td className="py-3 pr-3">
                          <Link to={`/app/programs/${r.programId}`} className="block">
                            <p className="font-bold text-navy-900 group-hover:text-teal-600">{r.name}</p>
                            <p className="text-xs text-navy-400">{r.klass}</p>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-9 text-xs font-bold text-navy-700">{r.progress}%</span>
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-navy-100">
                              <span className={`block h-full rounded-full ${PROGRESS_COLOR(r.progress, r.complete)}`} style={{ width: `${r.progress}%` }} />
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-navy-700">
                          {r.taught} <span className="text-navy-300">/ {r.total}</span>
                        </td>
                        <td className="px-3 py-3">
                          {r.lastLessonDate ? (
                            <>
                              <p className="text-navy-700">{fmtDate(r.lastLessonDate)}</p>
                              {r.lastLessonTitle && <p className="text-xs text-navy-400">{r.lastLessonTitle}</p>}
                            </>
                          ) : (
                            <span className="text-navy-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {r.complete ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle2 size={13} /> Complete
                            </span>
                          ) : r.nextLessonTitle ? (
                            <>
                              <p className="text-navy-700">{r.nextLessonTitle}</p>
                              <p className="text-xs text-navy-400">Next up</p>
                            </>
                          ) : (
                            <span className="text-navy-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex justify-center">
                  <Link to="/app/programs" className="flex items-center gap-1 rounded-full border border-navy-200 px-4 py-2 text-xs font-semibold text-navy-600 hover:bg-navy-50">
                    View all programs <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-5">
          {/* Teaching timeline */}
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <TrendingUp size={16} className="text-teal-500" /> Teaching Timeline
            </h2>
            {ov.timeline.length === 0 ? (
              <p className="mt-3 text-sm text-navy-400">Set your term dates on the timetable to see weekly activity.</p>
            ) : (
              <>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-navy-400">Lessons recorded</p>
                <div className="mt-3 flex h-32 items-end gap-1">
                  {ov.timeline.map((b) => (
                    <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.count}`}>
                      <div
                        className="w-full rounded-t bg-teal-400"
                        style={{ height: `${Math.max(4, (b.count / maxBar) * 100)}%`, opacity: b.count ? 1 : 0.25 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-1">
                  {ov.timeline.map((b, i) => (
                    <span key={b.label} className="flex-1 text-center text-[9px] text-navy-300">
                      {(i + 1) % 2 === 1 ? i + 1 : ''}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-center text-[11px] font-semibold text-navy-400">{ov.timelineLabel}</p>
              </>
            )}
          </div>

          {/* Upcoming focus */}
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <ClipboardList size={16} className="text-amber-500" /> Upcoming Focus
            </h2>
            {ov.focus.length === 0 ? (
              <p className="mt-3 text-sm text-navy-400">Nothing needs attention — nice work.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {ov.focus.slice(0, 6).map((f) => {
                  const meta = FOCUS_META[f.severity]
                  return (
                    <li key={f.programId + f.reason} className="flex items-start gap-2.5">
                      <meta.icon size={16} className={`mt-0.5 shrink-0 ${meta.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy-900">{f.name}</p>
                        <p className="text-xs text-navy-400">{f.reason}</p>
                      </div>
                      <Link to={`/app/programs/${f.programId}`} className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700">
                        View
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Quick reports */}
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <FileText size={16} className="text-navy-400" /> Quick Reports
            </h2>
            <div className="mt-3 space-y-2">
              <QuickReport icon={FileSpreadsheet} title="Evidence Register" sub="Export teaching evidence (CSV)" onClick={runEvidenceRegister} />
              <QuickReport icon={FileText} title="Program Report" sub="Program progress summary (CSV)" onClick={runProgramReport} />
              <QuickReport icon={BarChart3} title="Term Summary" sub="Print this overview" onClick={runTermSummary} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function QuickReport({ icon: Icon, title, sub, onClick }: { icon: LucideIcon; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-navy-100 px-3 py-2.5 text-left transition-colors hover:bg-navy-50"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-navy-900">{title}</span>
        <span className="block text-xs text-navy-400">{sub}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-navy-300" />
    </button>
  )
}

/* helpers */
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isToday(d: Date, now: Date) {
  return toISO(d) === toISO(now)
}
function termStartISO(tt: Timetable | null, now: Date) {
  const terms = tt?.terms ?? []
  const iso = toISO(now)
  for (let i = terms.length - 1; i >= 0; i--) if (terms[i]?.start && terms[i].start <= iso) return terms[i].start
  return `${now.getFullYear()}-01-01`
}
function termEndISO(tt: Timetable | null, now: Date) {
  const terms = tt?.terms ?? []
  const iso = toISO(now)
  for (let i = 0; i < terms.length; i++) if (terms[i]?.start && terms[i]?.end && iso >= terms[i].start && iso <= terms[i].end) return terms[i].end
  for (let i = terms.length - 1; i >= 0; i--) if (terms[i]?.end) return terms[i].end
  return toISO(now)
}
