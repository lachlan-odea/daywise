import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  History as HistoryIcon,
  Mic,
  Loader2,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { subscribeEntries, deleteEntry, type LessonEntry } from '../lib/entries'
import {
  subscribeTimetable,
  cellKey,
  currentWeek,
  effectiveTime,
  currentTermIndex,
  CLASS_COLORS,
  type ClassCell,
  type ClassColor,
  type Timetable,
} from '../lib/timetable'

type DayStatus = 'none' | 'green' | 'yellow' | 'red'
const STATUS_DOT: Record<Exclude<DayStatus, 'none'>, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function formatLong(iso: string) {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Monday-based month grid as an array of Date|null (padded to full weeks). */
function monthMatrix(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Record-lesson link pre-filled with the class + date. */
function recordHref(dateISO: string, cell?: { subject?: string; className?: string; room?: string }) {
  const q = new URLSearchParams({ date: dateISO })
  if (cell?.subject) q.set('subject', cell.subject)
  if (cell?.className) q.set('class', cell.className)
  if (cell?.room) q.set('room', cell.room)
  return `/app/record?${q.toString()}`
}

const overview = (e: LessonEntry) => e.evidence?.annotations?.trim() || e.note?.trim() || '—'
const sameClass = (e: LessonEntry, cell: { subject: string; className: string }) => {
  const s = (x?: string) => (x ?? '').trim().toLowerCase()
  return (
    (!!s(e.subject) && s(e.subject) === s(cell.subject)) ||
    (!!s(e.className) && s(e.className) === s(cell.className))
  )
}

export default function History() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [tt, setTt] = useState<Timetable | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selected, setSelected] = useState<string>(isoOf(today))
  const seeded = useRef(false)

  useEffect(() => {
    if (!user) return
    return subscribeEntries(user.uid, setEntries)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(user.uid, setTt)
  }, [user])

  // On first load, jump to the most recent entry.
  useEffect(() => {
    if (seeded.current || !entries) return
    if (entries.length) {
      const d = parseISO(entries[0].date)
      setView({ year: d.getFullYear(), month: d.getMonth() })
      setSelected(entries[0].date)
    }
    seeded.current = true
  }, [entries])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, LessonEntry[]>()
    for (const e of entries ?? []) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return map
  }, [entries])

  const cells = useMemo(() => monthMatrix(view.year, view.month), [view])
  const selectedEntries = entriesByDate.get(selected) ?? []
  const todayISO = isoOf(today)

  const termsSet = (tt?.terms ?? []).some((t) => t?.start && t?.end)
  const isHoliday = (date: Date) => termsSet && currentTermIndex(tt, date) < 0

  const classesForDate = (date: Date): ClassCell[] => {
    if (!tt) return []
    const wd = (date.getDay() + 6) % 7
    if (wd > 4) return []
    const week = currentWeek(tt, date)
    return tt.periods.map((p) => tt.cells[cellKey(week, p.id, wd)]).filter((c): c is ClassCell => !!c)
  }

  // Evidence-coverage status for a day's pill: green=all classes recorded, yellow=some, red=none.
  const dayStatus = (date: Date): DayStatus => {
    if (isHoliday(date)) return 'none'
    const iso = isoOf(date)
    const dayEntries = entriesByDate.get(iso) ?? []
    const classes = classesForDate(date)
    if (classes.length > 0 && iso <= todayISO) {
      const matched = classes.filter((c) => dayEntries.some((e) => sameClass(e, c))).length
      if (matched === 0) return 'red'
      return matched >= classes.length ? 'green' : 'yellow'
    }
    return dayEntries.length > 0 ? 'green' : 'none'
  }

  // Build the selected day's timetable rows with attached entries.
  const dayView = useMemo(() => {
    const date = parseISO(selected)
    const weekday = (date.getDay() + 6) % 7 // 0=Mon … 6=Sun
    const holiday = termsSet && currentTermIndex(tt, date) < 0
    const used = new Set<string>()
    const rows: { periodLabel: string; time: string; cell: { subject: string; className: string; room?: string; color?: ClassColor }; entry?: LessonEntry }[] = []
    // No timetable on weekends or during the holidays.
    if (tt && weekday <= 4 && !holiday) {
      const week = currentWeek(tt, date)
      for (const p of tt.periods) {
        const cell = tt.cells[cellKey(week, p.id, weekday)]
        if (!cell) continue
        const entry = selectedEntries.find((e) => sameClass(e, cell))
        if (entry?.id) used.add(entry.id)
        const t = effectiveTime(tt, p, week, weekday)
        rows.push({ periodLabel: p.label, time: t.start ? `${t.start}` : '', cell, entry })
      }
    }
    const others = selectedEntries.filter((e) => !e.id || !used.has(e.id))
    return { rows, others, isWeekend: weekday > 4, holiday }
  }, [selected, tt, selectedEntries, termsSet])

  const remove = async (e: LessonEntry) => {
    if (!user || !e.id) return
    const ok = await confirm({
      title: 'Delete this diary entry?',
      message: 'This permanently removes the entry and its evidence.',
      confirmLabel: 'Delete entry',
    })
    if (!ok) return
    setDeletingId(e.id)
    try {
      await deleteEntry(user.uid, e.id)
    } finally {
      setDeletingId(null)
    }
  }

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const m = v.month + delta
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
    })
  }

  const loading = entries === null

  const EntryCard = ({ e, context }: { e: LessonEntry; context?: string }) => (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {context && <span className="text-xs font-bold text-navy-400">{context}</span>}
            {e.subject && (
              <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">{e.subject}</span>
            )}
            {e.className && (
              <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-bold text-navy-600">{e.className}</span>
            )}
            {e.lessonTitle && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                <Sparkles size={11} /> {e.lessonTitle}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-navy-600">{overview(e)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => remove(e)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-red-50 hover:text-red-500"
            aria-label="Delete entry"
          >
            {deletingId === e.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
          <Link
            to={`/app/history/${e.id}`}
            className="flex h-8 items-center gap-1 rounded-full bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-900"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <HistoryIcon size={15} /> History
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Teaching diary</h1>
          <p className="mt-1 text-navy-500">Pick a day to see its lessons and evidence.</p>
        </div>
        <Link to="/app/record" className="btn-primary text-sm">
          <Mic size={16} /> Record lesson
        </Link>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your diary…
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          {/* calendar */}
          <div className="card h-fit p-5">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => shiftMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-navy-500 hover:bg-navy-50" aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <p className="text-sm font-bold text-navy-900">
                {MONTHS[view.month]} {view.year}
              </p>
              <button onClick={() => shiftMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-navy-500 hover:bg-navy-50" aria-label="Next month">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_HEADERS.map((d) => (
                <div key={d} className="pb-1 text-[10px] font-bold uppercase tracking-wide text-navy-300">
                  {d}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const iso = isoOf(d)
                const status = dayStatus(d)
                const isSelected = iso === selected
                const isToday = iso === todayISO
                const weekend = (d.getDay() + 6) % 7 > 4
                const holiday = isHoliday(d)
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(iso)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                      isSelected
                        ? 'bg-navy-800 font-bold text-white'
                        : holiday
                          ? 'text-navy-200 hover:bg-navy-50'
                          : weekend
                            ? 'text-navy-300 hover:bg-navy-50'
                            : 'text-navy-700 hover:bg-navy-50'
                    } ${isToday && !isSelected ? 'ring-1 ring-teal-400' : ''}`}
                  >
                    {d.getDate()}
                    {status !== 'none' && (
                      <span
                        className={`absolute bottom-1 h-2 w-2 rounded-full ${STATUS_DOT[status]} ${
                          isSelected ? 'ring-2 ring-white/60' : ''
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 border-t border-navy-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400">Evidence</p>
                <button
                  onClick={() => {
                    setView({ year: today.getFullYear(), month: today.getMonth() })
                    setSelected(todayISO)
                  }}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                >
                  Today
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-navy-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> All recorded
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Some
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> None
                </span>
              </div>
            </div>
          </div>

          {/* selected day */}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900">
              <CalendarClock size={18} className="text-teal-500" /> {formatLong(selected)}
            </h2>

            {selectedEntries.length === 0 && dayView.rows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-navy-200 bg-white p-8 text-center">
                <p className="text-sm font-semibold text-navy-700">
                  {dayView.holiday ? 'Holiday period' : 'No classes for this day'}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">
                  {dayView.holiday
                    ? 'This day falls in the school holidays.'
                    : dayView.isWeekend
                      ? 'It’s the weekend.'
                      : 'No classes are timetabled for this day.'}{' '}
                  You can still record a lesson if you need to.
                </p>
                <Link to={recordHref(selected)} className="btn-primary mx-auto mt-4 text-sm">
                  <Mic size={16} /> Record a lesson
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {/* timetable-aligned rows */}
                {dayView.rows.length > 0 && (
                  <div className="space-y-2">
                    {dayView.rows.map((r, i) => {
                      const color = (r.cell.color ?? 'teal') as ClassColor
                      return (
                        <div
                          key={i}
                          className={`rounded-xl border p-4 ${r.entry ? 'border-navy-100 bg-white' : 'border-dashed border-navy-200 bg-cloud/40'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-16 shrink-0">
                              <p className="text-xs font-bold text-navy-400">{r.periodLabel}</p>
                              {r.time && <p className="text-[11px] text-navy-400">{r.time}</p>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 text-sm font-bold text-navy-900">
                                <span className={`h-2 w-2 rounded-full ${CLASS_COLORS[color].dot}`} />
                                {r.cell.subject || r.cell.className}
                                {r.cell.subject && r.cell.className && (
                                  <span className="text-xs font-normal text-navy-400">{r.cell.className}</span>
                                )}
                              </p>
                              {r.entry ? (
                                <p className="mt-1.5 line-clamp-2 text-sm text-navy-600">{overview(r.entry)}</p>
                              ) : (
                                <p className="mt-1.5 text-sm text-navy-400">No lesson recorded.</p>
                              )}
                            </div>
                            {r.entry ? (
                              <Link
                                to={`/app/history/${r.entry.id}`}
                                className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-900"
                              >
                                View <ChevronRight size={13} />
                              </Link>
                            ) : (
                              <Link
                                to={recordHref(selected, r.cell)}
                                className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700"
                              >
                                Record
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* entries not aligned to a timetabled class */}
                {dayView.others.length > 0 && (
                  <div className="space-y-2">
                    {dayView.rows.length > 0 && (
                      <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Other entries</p>
                    )}
                    {dayView.others.map((e) => (
                      <EntryCard key={e.id} e={e} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
