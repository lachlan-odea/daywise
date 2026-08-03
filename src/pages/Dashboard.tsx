import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mic,
  CalendarClock,
  Pencil,
  CalendarDays,
  Flame,
  Trophy,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import SetupChecklist from '../components/SetupChecklist'
import WelcomeModal from '../components/WelcomeModal'
import DayPeriodRow from '../components/dashboard/DayPeriodRow'
import UpcomingActivities from '../components/dashboard/UpcomingActivities'
import TodoWidget from '../components/dashboard/TodoWidget'
import WeeklySnapshot from '../components/dashboard/WeeklySnapshot'
import { buildOnboarding } from '../lib/onboarding'
import { updateUserProfileDoc } from '../lib/profile'
import {
  cellKey,
  currentWeek,
  effectiveTime,
  subscribeTimetable,
  termInfo,
  type Timetable,
} from '../lib/timetable'
import { getProgram, subscribePrograms, type Program } from '../lib/programs'
import { subscribeEntries, type LessonEntry } from '../lib/entries'
import { subscribeClassPrograms, classKey, type ClassProgramMap } from '../lib/classPrograms'
import { subscribeActivities, subscribeTodos, type Activity, type TodoItem } from '../lib/agenda'
import { subscribePlanningDay, savePlanningNote, EMPTY_NOTE, type PlanningNote, type PlanningNotes } from '../lib/planning'
import { computeStreak } from '../lib/reports'
import {
  buildPeriodContext,
  buildWeekSnapshot,
  hasEvidence,
  isTeachingPeriod,
  pickProgramIdForClass,
  type LoadedProgram,
  type PeriodContext,
} from '../lib/dashboard'
import { BADGES, isBadgeEarned, type Stats } from '../lib/achievements'

export default function Dashboard() {
  const { user, effectiveUid, impersonating } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const [tt, setTt] = useState<Timetable | null>(null)
  // subscribeTimetable reports null for "no timetable saved", so a separate flag is
  // needed to tell that apart from "still loading".
  const [ttLoaded, setTtLoaded] = useState(false)
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [classMap, setClassMap] = useState<ClassProgramMap>({})
  const [activities, setActivities] = useState<Activity[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [planning, setPlanning] = useState<PlanningNotes>({})
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  // Closes the welcome modal immediately rather than waiting for the Firestore
  // snapshot carrying onboardingWelcomeSeen to round-trip.
  const [greetDismissed, setGreetDismissed] = useState(false)

  // Writes are owner-only (see firestore.rules), so "view as" is read-only.
  const canEdit = !impersonating

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Teacher'
  const firstName = displayName.split(' ')[0]

  const now = useMemo(() => new Date(), [])
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  // The day shown in the daybook — defaults to today, but can be paged with the arrows.
  const isViewingToday = dayOffset === 0
  const viewDate = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    return d
  }, [now, dayOffset])
  const viewDayIdx = useMemo(() => {
    const wd = viewDate.getDay()
    return wd >= 1 && wd <= 5 ? wd - 1 : -1
  }, [viewDate])
  const viewISOStr = useMemo(
    () =>
      `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(viewDate.getDate()).padStart(2, '0')}`,
    [viewDate],
  )
  const viewDayLabel = viewDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
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
    setTtLoaded(false)
    return subscribeTimetable(effectiveUid, (next) => {
      setTt(next)
      setTtLoaded(true)
    })
  }, [user, effectiveUid])

  useEffect(() => {
    if (!user) return
    return subscribePrograms(effectiveUid, setPrograms)
  }, [user, effectiveUid])

  useEffect(() => {
    if (!user) return
    return subscribeEntries(effectiveUid, setEntries)
  }, [user, effectiveUid])

  useEffect(() => {
    if (!user) return
    return subscribeClassPrograms(effectiveUid, setClassMap)
  }, [user, effectiveUid])

  useEffect(() => {
    if (!user) return
    return subscribeActivities(effectiveUid, setActivities)
  }, [user, effectiveUid])

  useEffect(() => {
    if (!user) return
    return subscribeTodos(effectiveUid, setTodos)
  }, [user, effectiveUid])

  useEffect(() => {
    if (!user) return
    return subscribePlanningDay(effectiveUid, viewISOStr, setPlanning)
  }, [user, effectiveUid, viewISOStr])

  // Classes drawn from the saved timetable, for the viewed day's (A/B) week.
  const viewWeek = currentWeek(tt, viewDate)
  // All of the viewed day's periods (including breaks / free periods), not just those with a class.
  const viewPeriods = useMemo(
    () =>
      viewDayIdx >= 0 && tt
        ? tt.periods.map((p) => ({ p, cell: tt.cells[cellKey(viewWeek, p.id, viewDayIdx)] }))
        : [],
    [tt, viewWeek, viewDayIdx],
  )
  const hasClassesForView = viewPeriods.some((row) => row.cell)
  const hasTimetable = tt ? Object.keys(tt.cells).length > 0 : false

  const recordedForView = useMemo(
    () =>
      new Set((entries ?? []).filter((e) => e.date === viewISOStr).map((e) => classKey(e.subject, e.className))),
    [entries, viewISOStr],
  )

  const recordHref = (cell: { subject?: string; className?: string; room?: string }) => {
    const q = new URLSearchParams({ date: viewISOStr })
    if (cell.subject) q.set('subject', cell.subject)
    if (cell.className) q.set('class', cell.className)
    if (cell.room) q.set('room', cell.room)
    return `/app/record?${q.toString()}`
  }

  /* ---------------- period context: last lesson, program position, next ---------------- */

  // The diary bucketed by class, newest entry first (the order subscribeEntries returns).
  const entriesByClass = useMemo(() => {
    const map = new Map<string, LessonEntry[]>()
    for (const e of entries ?? []) {
      const key = classKey(e.subject, e.className)
      const list = map.get(key)
      if (list) list.push(e)
      else map.set(key, [e])
    }
    return map
  }, [entries])

  // Which program each of the viewed day's classes is following. Resolved from
  // program metadata first so only the lesson lists actually needed get fetched.
  const programIdByPeriod = useMemo(() => {
    const out = new Map<string, string>()
    if (!programs) return out
    for (const { p, cell } of viewPeriods) {
      if (!cell || cell.kind === 'meeting' || !isTeachingPeriod(p.label)) continue
      const key = classKey(cell.subject, cell.className)
      const id = pickProgramIdForClass({
        cell,
        linkedIds: classMap[key] ?? [],
        classEntries: entriesByClass.get(key) ?? [],
        programs,
      })
      if (id) out.set(p.id, id)
    }
    return out
  }, [viewPeriods, programs, classMap, entriesByClass])

  // Lesson lists are a subcollection read per program, so they're fetched lazily for
  // just the day on screen and cached for the session. A miss is cached as null so a
  // deleted program isn't re-requested on every render.
  const [loadedPrograms, setLoadedPrograms] = useState<Record<string, LoadedProgram | null>>({})
  const loadedRef = useRef<Record<string, LoadedProgram | null>>({})
  const neededKey = useMemo(() => [...new Set(programIdByPeriod.values())].sort().join(','), [programIdByPeriod])

  useEffect(() => {
    if (!user) return
    const needed = neededKey ? neededKey.split(',') : []
    const missing = needed.filter((id) => !(id in loadedRef.current))
    if (!missing.length) return
    let active = true
    Promise.all(
      missing.map((id) =>
        getProgram(effectiveUid, id)
          .then((res) => [id, res] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((results) => {
      if (!active) return
      const next = { ...loadedRef.current }
      for (const [id, res] of results) next[id] = res
      loadedRef.current = next
      setLoadedPrograms(next)
    })
    return () => {
      active = false
    }
  }, [user, effectiveUid, neededKey])

  const contextReady =
    entries !== null &&
    programs !== null &&
    ttLoaded &&
    (neededKey ? neededKey.split(',').every((id) => id in loadedPrograms) : true)

  const contextByPeriod = useMemo(() => {
    const out = new Map<string, PeriodContext>()
    for (const { p, cell } of viewPeriods) {
      if (!cell || cell.kind === 'meeting' || !isTeachingPeriod(p.label)) continue
      const key = classKey(cell.subject, cell.className)
      const programId = programIdByPeriod.get(p.id)
      out.set(
        p.id,
        buildPeriodContext({
          viewISO: viewISOStr,
          classEntries: entriesByClass.get(key) ?? [],
          program: (programId ? loadedPrograms[programId] : null) ?? null,
        }),
      )
    }
    return out
  }, [viewPeriods, viewISOStr, entriesByClass, programIdByPeriod, loadedPrograms])

  /* ---------------- notes ---------------- */

  const saveNote = async (periodId: string, next: PlanningNote) => {
    if (!user || !canEdit) return
    setSavingNote(true)
    try {
      await savePlanningNote(effectiveUid, viewISOStr, periodId, next)
      setEditingNote(null)
    } finally {
      setSavingNote(false)
    }
  }

  /* ---------------- weekly snapshot & achievements ---------------- */

  // Teaching streak — consecutive teaching days with a recorded lesson.
  const streak = useMemo(() => computeStreak(entries ?? [], tt, now), [entries, tt, now])

  const snapshot = useMemo(
    () => buildWeekSnapshot({ entries: entries ?? [], timetable: tt, now, streak }),
    [entries, tt, now, streak],
  )

  // Guided onboarding. Progress is derived from real data, so it stays accurate for
  // existing users and un-ticks itself if the underlying data is removed. Held back
  // until everything has loaded so the card can't flash a misleading "0 of 5".
  const onboarding = useMemo(() => {
    if (profileLoading || !ttLoaded || programs === null || entries === null) return null
    return buildOnboarding({
      profile,
      timetable: tt,
      programCount: programs.length,
      entryCount: entries.length,
    })
  }, [profile, profileLoading, tt, ttLoaded, programs, entries])

  // Greet only genuinely new accounts. Long-standing users predate the flag, so
  // gating on isBrandNew stops them being welcomed to an app they already use.
  // Never while impersonating — rules allow profile writes by the owner only.
  const shouldGreet =
    !!user &&
    !impersonating &&
    !greetDismissed &&
    !!onboarding?.isBrandNew &&
    !profileLoading &&
    !profile?.onboardingWelcomeSeen

  const dismissOnboarding = () => {
    if (!user || impersonating) return
    updateUserProfileDoc(user.uid, { onboardingDismissed: true }).catch(() => {})
  }

  // Nearest unearned badge with visible progress, for a quick achievement nudge.
  const nextBadge = useMemo(() => {
    const taught = (entries ?? []).filter((e) => !e.missed)
    const programsCompleted = (programs ?? []).filter(
      (p) =>
        p.id &&
        p.lessonCount > 0 &&
        new Set(taught.filter((e) => e.programId === p.id && e.lessonId).map((e) => e.lessonId)).size >=
          p.lessonCount,
    ).length

    const stats: Stats = {
      lessons: taught.length,
      evidence: taught.filter(hasEvidence).length,
      programsStarted: 0,
      programsCompleted,
      outcomeExpert: false,
      streak,
      weekComplete: false,
      perfectMonth: false,
      perfectTerm: false,
      perfectYear: false,
      feedbackCount: 0,
      events: {},
      perpetual: false,
      beta: true,
      granted: [],
    }

    return BADGES.filter((b) => b.progress && !isBadgeEarned(b, stats))
      .map((b) => ({ badge: b, progress: Math.min(1, Math.max(0, b.progress!(stats))) }))
      .sort((a, b) => b.progress - a.progress)[0]
  }, [entries, programs, streak])

  return (
    <main className="mx-auto max-w-[1680px] px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">{dateStr}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-navy-500">Here’s your day at a glance.</p>
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
          {streak >= 2 && (
            <Link
              to="/app/achievements"
              className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100"
            >
              <Flame size={15} className="text-amber-500" /> {streak}-day streak
            </Link>
          )}
          <Link to="/app/record" className="btn-primary px-5 py-2.5 text-sm">
            <Mic size={17} /> Record a lesson
          </Link>
        </div>
      </div>

      {/* Guided setup — replaces the old program-only banner with the full sequence.
          Hidden while impersonating (the card is for the account holder, and its
          data sources aren't all keyed to effectiveUid). The completed state is only
          shown to people who were actually onboarded, so long-standing users who
          were already set up don't get a stray "all set up!" celebration. */}
      {onboarding &&
        !impersonating &&
        !profile?.onboardingDismissed &&
        (!onboarding.complete || profile?.onboardingWelcomeSeen) && (
          <SetupChecklist state={onboarding} onDismiss={dismissOnboarding} />
        )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------- The daybook ---------------- */}
        <div className="card min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold uppercase tracking-wide text-teal-600">{viewDayLabel}</span>
              {tt?.fortnightly && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                  Week {viewWeek}
                </span>
              )}
              {isViewingToday && (
                <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold text-navy-500">Today</span>
              )}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDayOffset((o) => o - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                aria-label="Previous day"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                onClick={() => setDayOffset(0)}
                disabled={isViewingToday}
                className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-40"
              >
                Today
              </button>
              <button
                onClick={() => setDayOffset((o) => o + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                aria-label="Next day"
              >
                <ChevronRight size={17} />
              </button>
              <Link
                to="/app/timetable"
                className="ml-1 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                <Pencil size={12} /> Edit
              </Link>
            </div>
          </div>

          {viewDayIdx < 0 ? (
            <div className="rounded-2xl bg-cloud p-6 text-center text-sm text-navy-500">
              {isViewingToday
                ? 'It’s the weekend — no classes scheduled today. Enjoy the break! 🎉'
                : 'No classes scheduled — it’s the weekend.'}
            </div>
          ) : !hasTimetable ? (
            <div className="rounded-2xl border border-dashed border-navy-200 p-6 text-center">
              <p className="text-sm font-semibold text-navy-700">No timetable yet</p>
              <p className="mt-1 text-sm text-navy-500">Set up your weekly classes to see them here each day.</p>
              <Link to="/app/timetable" className="btn-primary mt-4 text-sm">
                <CalendarClock size={16} /> Set up timetable
              </Link>
            </div>
          ) : !hasClassesForView ? (
            <div className="rounded-2xl bg-cloud p-6 text-center text-sm text-navy-500">
              No classes scheduled for {isViewingToday ? 'today' : 'this day'}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {viewPeriods.map(({ p, cell }) => {
                const time = effectiveTime(tt!, p, viewWeek, viewDayIdx)
                const isNow =
                  isViewingToday && !!(time.start && time.end && time.start <= nowHHMM && nowHHMM < time.end)
                return (
                  <DayPeriodRow
                    key={p.id}
                    period={p}
                    time={time}
                    cell={cell}
                    isNow={isNow}
                    context={contextByPeriod.get(p.id) ?? null}
                    contextReady={contextReady}
                    note={planning[p.id] ?? EMPTY_NOTE}
                    teaching={isTeachingPeriod(p.label)}
                    recorded={!!cell && recordedForView.has(classKey(cell.subject, cell.className))}
                    recordable={dayOffset < 0 || (isViewingToday && !!time.start && time.start <= nowHHMM)}
                    recordHref={cell ? recordHref(cell) : '/app/record'}
                    editingNote={editingNote === p.id}
                    savingNote={savingNote}
                    canEdit={canEdit}
                    onStartEditNote={() => setEditingNote(p.id)}
                    onCancelEditNote={() => setEditingNote(null)}
                    onSaveNote={(next) => saveNote(p.id, next)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ---------------- Supporting widgets ---------------- */}
        <div className="min-w-0 space-y-6">
          <UpcomingActivities uid={effectiveUid} activities={activities} now={now} canEdit={canEdit} />
          <TodoWidget uid={effectiveUid} todos={todos} canEdit={canEdit} />
          <WeeklySnapshot snapshot={snapshot} />

          {nextBadge && (
            <Link to="/app/achievements" className="card block p-5 transition-colors hover:bg-navy-50">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold text-navy-800">
                  <Trophy size={16} className="text-amber-500" /> Next badge
                </span>
                <ChevronRight size={15} className="text-navy-300" />
              </div>
              <p className="mt-2 text-sm font-bold text-navy-900">{nextBadge.badge.title}</p>
              <p className="mt-0.5 text-xs text-navy-400">{nextBadge.badge.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.round(nextBadge.progress * 100)}%` }}
                  />
                </span>
                <span className="shrink-0 text-xs font-bold text-navy-500">
                  {Math.round(nextBadge.progress * 100)}%
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {shouldGreet && user && (
        <WelcomeModal uid={user.uid} firstName={firstName} onClose={() => setGreetDismissed(true)} />
      )}
    </main>
  )
}
