import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, Sparkles, Waves, CalendarClock, Pencil, CalendarDays, Check, NotebookPen, Flame, Trophy, ChevronRight, ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import SetupChecklist from '../components/SetupChecklist'
import WelcomeModal from '../components/WelcomeModal'
import { buildOnboarding } from '../lib/onboarding'
import { updateUserProfileDoc } from '../lib/profile'
import {
  CLASS_COLORS,
  cellKey,
  currentWeek,
  effectiveTime,
  mondayOf,
  subscribeTimetable,
  termInfo,
  type ClassColor,
  type Timetable,
} from '../lib/timetable'
import { subscribePrograms, type Program } from '../lib/programs'
import { subscribeEntries, type LessonEntry } from '../lib/entries'
import { subscribePlanningDay, savePlanningNote, type PlanningNotes } from '../lib/planning'
import { computeStreak } from '../lib/reports'
import { BADGES, isBadgeEarned, type Stats } from '../lib/achievements'

/** Only numbered teaching periods (1, Period 1, P1…) are recordable — not roll call/breaks. */
const isTeachingPeriod = (label: string) => /^(period\s*|p\s*|lesson\s*)?\d+$/i.test((label || '').trim())
const classKey = (subject?: string, className?: string) =>
  `${(subject || '').trim().toLowerCase()}|${(className || '').trim().toLowerCase()}`

export default function Dashboard() {
  const { user, effectiveUid, impersonating } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const [tt, setTt] = useState<Timetable | null>(null)
  // subscribeTimetable reports null for "no timetable saved", so a separate flag is
  // needed to tell that apart from "still loading".
  const [ttLoaded, setTtLoaded] = useState(false)
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [planning, setPlanning] = useState<PlanningNotes>({})
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  // Closes the welcome modal immediately rather than waiting for the Firestore
  // snapshot carrying onboardingWelcomeSeen to round-trip.
  const [greetDismissed, setGreetDismissed] = useState(false)

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Teacher'
  const firstName = displayName.split(' ')[0]

  const now = useMemo(() => new Date(), [])
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  // The day shown in the timetable card — defaults to today, but can be paged with the arrows.
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
  const viewDayLabel = viewDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
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
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeEntries(effectiveUid, setEntries)
  }, [user])

  // Classes drawn from the saved timetable, for the viewed day's (A/B) week.
  const viewWeek = currentWeek(tt, viewDate)
  // All of the viewed day's periods (including breaks / free periods), not just those with a class.
  const viewPeriods =
    viewDayIdx >= 0 && tt ? tt.periods.map((p) => ({ p, cell: tt.cells[cellKey(viewWeek, p.id, viewDayIdx)] })) : []
  const hasClassesForView = viewPeriods.some((row) => row.cell)

  const hasTimetable = tt ? Object.keys(tt.cells).length > 0 : false
  const recordedForView = new Set(
    (entries ?? []).filter((e) => e.date === viewISOStr).map((e) => classKey(e.subject, e.className)),
  )
  const recordHref = (cell: { subject?: string; className?: string; room?: string }) => {
    const q = new URLSearchParams({ date: viewISOStr })
    if (cell.subject) q.set('subject', cell.subject)
    if (cell.className) q.set('class', cell.className)
    if (cell.room) q.set('room', cell.room)
    return `/app/record?${q.toString()}`
  }

  useEffect(() => {
    if (!user) return
    return subscribePlanningDay(effectiveUid, viewISOStr, setPlanning)
  }, [user, viewISOStr])

  const startEditNote = (periodId: string) => {
    setEditingNote(periodId)
    setDraft(planning[periodId] ?? '')
  }
  const cancelNote = () => {
    setEditingNote(null)
    setDraft('')
  }
  const saveNote = async (periodId: string) => {
    if (!user) return
    setSavingNote(true)
    try {
      await savePlanningNote(effectiveUid, viewISOStr, periodId, draft)
      setEditingNote(null)
      setDraft('')
    } finally {
      setSavingNote(false)
    }
  }

  const lastNextSteps = entries?.[0]?.evidence?.nextSteps ?? []

  const todayISOStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const weekStartISO = useMemo(() => {
    const d = mondayOf(now)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [now])
  // Missed lessons still count as "recorded" (the teacher logged them) but carry no evidence.
  const entriesThisWeek = (entries ?? []).filter((e) => e.date >= weekStartISO && e.date <= todayISOStr)
  const lessonsThisWeek = entriesThisWeek.length
  const evidenceCount = entriesThisWeek.filter(
    (e) =>
      !e.missed &&
      e.evidence &&
      (e.evidence.annotations ||
        e.evidence.assessmentEvidence ||
        e.evidence.reflection ||
        e.evidence.nextSteps?.length),
  ).length

  // Teaching streak — consecutive teaching days with a recorded lesson.
  const streak = useMemo(() => computeStreak(entries ?? [], tt, now), [entries, tt, now])

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
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">{dateStr}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
            {greeting}, {firstName} 👋
            {streak >= 2 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                <Flame size={14} className="text-amber-500" /> {streak}-day streak
              </span>
            )}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Today's timetable */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-400">
                <CalendarClock size={15} /> {isViewingToday ? 'Today’s timetable' : viewDayLabel}
                {tt?.fortnightly && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                    Week {viewWeek}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDayOffset((o) => o - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={16} />
                </button>
                {!isViewingToday && (
                  <button
                    onClick={() => setDayOffset(0)}
                    className="rounded-full border border-navy-200 px-2.5 py-1 text-xs font-semibold text-navy-600 hover:bg-navy-50"
                  >
                    Today
                  </button>
                )}
                <button
                  onClick={() => setDayOffset((o) => o + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                  aria-label="Next day"
                >
                  <ChevronRight size={16} />
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
              <div className="rounded-xl bg-cloud p-6 text-center text-sm text-navy-500">
                {isViewingToday
                  ? 'It’s the weekend — no classes scheduled today. Enjoy the break! 🎉'
                  : 'No classes scheduled — it’s the weekend.'}
              </div>
            ) : !hasTimetable ? (
              <div className="rounded-xl border border-dashed border-navy-200 p-6 text-center">
                <p className="text-sm font-semibold text-navy-700">No timetable yet</p>
                <p className="mt-1 text-sm text-navy-500">Set up your weekly classes to see them here each day.</p>
                <Link to="/app/timetable" className="btn-primary mt-4 text-sm">
                  <CalendarClock size={16} /> Set up timetable
                </Link>
              </div>
            ) : !hasClassesForView ? (
              <div className="rounded-xl bg-cloud p-6 text-center text-sm text-navy-500">
                No classes scheduled for {isViewingToday ? 'today' : 'this day'}.
              </div>
            ) : (
              <div className="space-y-2">
                {viewPeriods.map(({ p, cell }) => {
                  const time = effectiveTime(tt!, p, viewWeek, viewDayIdx)
                  const isNow =
                    isViewingToday && !!(time.start && time.end && time.start <= nowHHMM && nowHHMM < time.end)

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
                  const note = planning[p.id] ?? ''
                  const isEditing = editingNote === p.id
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl ${isNow ? 'bg-navy-800 text-white' : 'bg-cloud text-navy-700'}`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className={`text-xs font-bold ${isNow ? 'text-teal-300' : 'text-navy-400'}`}>
                          {p.label}
                          {time.start ? ` · ${time.start}` : ''}
                        </span>
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {!isNow && <span className={`h-2 w-2 rounded-full ${CLASS_COLORS[color].dot}`} />}
                          {cell.subject || cell.className}
                          {cell.kind === 'meeting' && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                isNow ? 'bg-white/20 text-white' : 'bg-navy-100 text-navy-500'
                              }`}
                            >
                              Meeting
                            </span>
                          )}
                        </span>
                        <span className={`ml-auto text-xs ${isNow ? 'text-navy-200' : 'text-navy-400'}`}>
                          {cell.subject && cell.className ? cell.className : ''}
                          {cell.room ? ` · ${cell.room}` : ''}
                        </span>
                        <button
                          onClick={() => (isEditing ? cancelNote() : startEditNote(p.id))}
                          className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors ${
                            note
                              ? isNow
                                ? 'bg-white/15 text-teal-200 hover:bg-white/25'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : isNow
                                ? 'text-navy-200 hover:bg-white/10'
                                : 'text-navy-400 hover:bg-navy-100'
                          }`}
                          title={note ? 'Edit planning note' : 'Add planning note'}
                        >
                          <NotebookPen size={12} /> Notes
                        </button>
                        {isTeachingPeriod(p.label) &&
                          cell.kind !== 'meeting' &&
                          (dayOffset < 0 || (isViewingToday && !!time.start && time.start <= nowHHMM)) &&
                          (recordedForView.has(classKey(cell.subject, cell.className)) ? (
                            <span
                              className={`flex shrink-0 items-center gap-1 text-[11px] font-bold ${
                                isNow ? 'text-teal-300' : 'text-teal-600'
                              }`}
                            >
                              <Check size={13} strokeWidth={3} /> Recorded
                            </span>
                          ) : (
                            <Link
                              to={recordHref(cell)}
                              className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-teal-500 px-2.5 text-[11px] font-bold text-white hover:bg-teal-600"
                              title="Record this lesson"
                            >
                              <Mic size={12} /> Record
                            </Link>
                          ))}
                        {isNow && (
                          <span className="flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">
                            <Waves size={10} /> Now
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="px-4 pb-3">
                          <textarea
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={3}
                            placeholder="Planning notes for this lesson…"
                            className="w-full rounded-lg border border-navy-200 bg-white p-2.5 text-sm text-navy-800 placeholder:text-navy-300 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={cancelNote}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                isNow ? 'text-navy-200 hover:bg-white/10' : 'text-navy-500 hover:bg-navy-100'
                              }`}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveNote(p.id)}
                              disabled={savingNote}
                              className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-60"
                            >
                              {savingNote ? 'Saving…' : 'Save note'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        note && (
                          <button
                            onClick={() => startEditNote(p.id)}
                            className="block w-full px-4 pb-3 text-left"
                            title="Edit planning note"
                          >
                            <span
                              className={`flex gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                isNow ? 'bg-white/10 text-navy-100' : 'bg-white text-navy-600'
                              }`}
                            >
                              <NotebookPen size={13} className="mt-0.5 shrink-0 opacity-60" />
                              {note}
                            </span>
                          </button>
                        )
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
                { l: 'Lessons recorded', v: String(lessonsThisWeek) },
                { l: 'Evidence items', v: String(evidenceCount) },
                { l: 'Teaching streak', v: streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '—' },
              ].map((s) => (
                <div key={s.l} className="flex items-center justify-between">
                  <span className="text-sm text-navy-500">{s.l}</span>
                  <span className="text-sm font-bold text-navy-900">{s.v}</span>
                </div>
              ))}
            </div>
          </div>

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
                <span className="shrink-0 text-xs font-bold text-navy-500">{Math.round(nextBadge.progress * 100)}%</span>
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
