import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, Sparkles, Waves, Plus, CalendarClock, Pencil, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import {
  CLASS_COLORS,
  cellKey,
  currentWeek,
  effectiveTime,
  subscribeTimetable,
  termInfo,
  type ClassColor,
  type Timetable,
} from '../lib/timetable'
import { subscribePrograms, type Program } from '../lib/programs'
import { subscribeEntries, type LessonEntry } from '../lib/entries'

function todayIndex() {
  const d = new Date().getDay()
  return d >= 1 && d <= 5 ? d - 1 : -1
}

export default function Dashboard() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [tt, setTt] = useState<Timetable | null>(null)
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Teacher'
  const firstName = displayName.split(' ')[0]

  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => todayIndex(), [])
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  // Term / week / holiday derived from the term calendar (set on the Timetable page).
  const term = termInfo(tt, now)
  const termLabel = !term.hasCalendar
    ? 'Set term dates'
    : term.isHoliday
      ? 'Holidays'
      : `Week ${term.week} · Term ${term.termNumber}`

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(user.uid, setTt)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribePrograms(user.uid, setPrograms)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeEntries(user.uid, setEntries)
  }, [user])

  // Today's classes drawn from the saved timetable, for the current (A/B) week.
  const week = currentWeek(tt)
  // All of today's periods (including breaks / free periods), not just those with a class.
  const todaysPeriods =
    today >= 0 && tt ? tt.periods.map((p) => ({ p, cell: tt.cells[cellKey(week, p.id, today)] })) : []
  const hasClassesToday = todaysPeriods.some((row) => row.cell)

  const hasTimetable = tt ? Object.keys(tt.cells).length > 0 : false
  const lastNextSteps = entries?.[0]?.evidence?.nextSteps ?? []
  const evidenceCount =
    entries?.filter(
      (e) =>
        e.evidence &&
        (e.evidence.annotations ||
          e.evidence.assessmentEvidence ||
          e.evidence.reflection ||
          e.evidence.nextSteps?.length),
    ).length ?? 0

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">{dateStr}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
            {greeting}, {firstName} 👋
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/timetable"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
              term.hasCalendar
                ? 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                : 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
            title="Set on the Timetable page"
          >
            <CalendarDays size={16} />
            {termLabel}
          </Link>
          <Link to="/app/record" className="btn-primary text-sm">
            <Mic size={17} /> Record a lesson
          </Link>
        </div>
      </div>

      {/* Setup banner — only until the first program is uploaded */}
      {programs && programs.length === 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-white">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="font-bold text-navy-900">You’re signed in — welcome aboard!</p>
              <p className="text-sm text-navy-500">
                Upload your first teaching program so Curriculum Intelligence can start matching your lessons.
              </p>
            </div>
          </div>
          <Link to="/app/programs" className="btn-navy shrink-0 text-sm">
            <Plus size={16} /> Upload a program
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Today's timetable */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-400">
                <CalendarClock size={15} /> Today’s timetable
                {tt?.fortnightly && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                    Week {week}
                  </span>
                )}
              </h2>
              <Link
                to="/app/timetable"
                className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                <Pencil size={12} /> Edit
              </Link>
            </div>

            {today < 0 ? (
              <div className="rounded-xl bg-cloud p-6 text-center text-sm text-navy-500">
                It’s the weekend — no classes scheduled today. Enjoy the break! 🎉
              </div>
            ) : !hasTimetable ? (
              <div className="rounded-xl border border-dashed border-navy-200 p-6 text-center">
                <p className="text-sm font-semibold text-navy-700">No timetable yet</p>
                <p className="mt-1 text-sm text-navy-500">Set up your weekly classes to see them here each day.</p>
                <Link to="/app/timetable" className="btn-primary mt-4 text-sm">
                  <CalendarClock size={16} /> Set up timetable
                </Link>
              </div>
            ) : !hasClassesToday ? (
              <div className="rounded-xl bg-cloud p-6 text-center text-sm text-navy-500">
                No classes scheduled for today.
              </div>
            ) : (
              <div className="space-y-2">
                {todaysPeriods.map(({ p, cell }) => {
                  const time = effectiveTime(tt!, p, week, today)
                  const isNow = !!(time.start && time.end && time.start <= nowHHMM && nowHHMM < time.end)

                  // Break / free period — shown for context.
                  if (!cell) {
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 rounded-xl border border-dashed px-4 py-2 ${
                          isNow ? 'border-teal-300 bg-teal-50' : 'border-navy-100 bg-white'
                        }`}
                      >
                        <span className="text-xs font-bold text-navy-400">
                          {p.label}
                          {time.start ? ` · ${time.start}` : ''}
                        </span>
                        <span className="ml-auto text-xs text-navy-300">—</span>
                        {isNow && (
                          <span className="flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">
                            <Waves size={10} /> Now
                          </span>
                        )}
                      </div>
                    )
                  }

                  const color = (cell.color ?? 'teal') as ClassColor
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                        isNow ? 'bg-navy-800 text-white' : 'bg-cloud text-navy-700'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isNow ? 'text-teal-300' : 'text-navy-400'}`}>
                        {p.label}
                        {time.start ? ` · ${time.start}` : ''}
                      </span>
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {!isNow && <span className={`h-2 w-2 rounded-full ${CLASS_COLORS[color].dot}`} />}
                        {cell.subject || cell.className}
                      </span>
                      <span className={`ml-auto text-xs ${isNow ? 'text-navy-200' : 'text-navy-400'}`}>
                        {cell.subject && cell.className ? cell.className : ''}
                        {cell.room ? ` · ${cell.room}` : ''}
                      </span>
                      {isNow && (
                        <span className="flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">
                          <Waves size={10} /> Now
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Suggested next */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sky-600">
              <Sparkles size={16} />
              <h2 className="text-sm font-bold text-navy-800">Suggested next</h2>
            </div>
            {lastNextSteps.length > 0 ? (
              <>
                <p className="mt-2 text-xs text-navy-400">From your last recorded lesson:</p>
                <ul className="mt-2 space-y-1.5">
                  {lastNextSteps.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-navy-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-navy-500">
                Record a lesson and daywise will suggest what to teach next, based on your programs.
              </p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-bold text-navy-800">This week</h2>
            <div className="mt-3 space-y-3">
              {[
                { l: 'Lessons recorded', v: String(entries?.length ?? 0) },
                { l: 'Evidence items', v: String(evidenceCount) },
                { l: 'Classes timetabled', v: String(tt ? Object.keys(tt.cells).length : 0) },
              ].map((s) => (
                <div key={s.l} className="flex items-center justify-between">
                  <span className="text-sm text-navy-500">{s.l}</span>
                  <span className="text-sm font-bold text-navy-900">{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}
