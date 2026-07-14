import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2, X, Check, Loader2, RotateCcw, CalendarClock, Clock, Upload, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import TimetableImport from '../components/TimetableImport'
import {
  CLASS_COLORS,
  DAYS,
  DAYS_SHORT,
  WEEKS,
  cellKey,
  currentWeek,
  defaultTimetable,
  effectiveTime,
  hasTimeOverride,
  mondayISO,
  newId,
  saveTimetable,
  subscribeTimetable,
  termInfo,
  updateTerms,
  type ClassCell,
  type ClassColor,
  type TermRange,
  type Timetable,
  type TimeSlot,
  type WeekId,
} from '../lib/timetable'
import { firebaseConfigured } from '../lib/firebase'

const clone = (tt: Timetable): Timetable => JSON.parse(JSON.stringify(tt))

// Today as a Mon–Fri index (0–4), or -1 on weekends.
function todayIndex() {
  const d = new Date().getDay() // 0 Sun … 6 Sat
  return d >= 1 && d <= 5 ? d - 1 : -1
}

export default function Timetable() {
  const { user } = useAuth()
  const [tt, setTt] = useState<Timetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editCell, setEditCell] = useState<{ week: WeekId; periodId: string; day: number } | null>(null)
  const [viewWeek, setViewWeek] = useState<WeekId>('A')
  const [showImport, setShowImport] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [termsDraft, setTermsDraft] = useState<TermRange[]>([])
  const [savingTerms, setSavingTerms] = useState(false)
  const dragSrc = useRef<{ periodId: string; day: number } | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)

  const dirtyRef = useRef(false)
  const baselineRef = useRef<Timetable | null>(null)
  const firstLoad = useRef(true)
  const today = useMemo(() => todayIndex(), [])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeTimetable(user.uid, (remote) => {
      setLoading(false)
      if (!dirtyRef.current) {
        const next = remote ?? defaultTimetable()
        setTt(next)
        baselineRef.current = clone(next)
        if (firstLoad.current) {
          setViewWeek(currentWeek(next))
          firstLoad.current = false
        }
      }
    })
    return unsub
  }, [user])

  const mutate = (fn: (draft: Timetable) => void) => {
    setTt((prev) => {
      if (!prev) return prev
      const draft = clone(prev)
      fn(draft)
      return draft
    })
    setDirty(true)
    setMsg('')
  }

  const setCell = (week: WeekId, periodId: string, day: number, cell: ClassCell | null) => {
    mutate((d) => {
      const k = cellKey(week, periodId, day)
      if (cell && (cell.subject || cell.className)) d.cells[k] = cell
      else delete d.cells[k]
    })
  }

  /** Moves a class to another slot (or swaps if the target is occupied) within the viewed week. */
  const moveClass = (from: { periodId: string; day: number }, to: { periodId: string; day: number }) => {
    if (from.periodId === to.periodId && from.day === to.day) return
    mutate((d) => {
      const fromKey = cellKey(viewWeek, from.periodId, from.day)
      const toKey = cellKey(viewWeek, to.periodId, to.day)
      const src = d.cells[fromKey]
      if (!src) return
      const dst = d.cells[toKey]
      d.cells[toKey] = src
      if (dst) d.cells[fromKey] = dst
      else delete d.cells[fromKey]
    })
  }

  const setTimeOverride = (week: WeekId, periodId: string, day: number, time: TimeSlot | null) => {
    mutate((d) => {
      const k = cellKey(week, periodId, day)
      d.timeOverrides = d.timeOverrides ?? {}
      if (time && time.start && time.end) d.timeOverrides[k] = time
      else delete d.timeOverrides[k]
    })
  }

  const setFortnightly = (on: boolean) =>
    mutate((d) => {
      d.fortnightly = on
      if (on && !d.anchorMondayISO) {
        d.anchorMondayISO = mondayISO(new Date())
        d.anchorWeek = 'A'
      }
      if (!on) setViewWeek('A')
    })

  const markThisWeek = (week: WeekId) =>
    mutate((d) => {
      d.anchorMondayISO = mondayISO(new Date())
      d.anchorWeek = week
    })

  const updatePeriod = (id: string, patch: Partial<{ label: string; start: string; end: string }>) =>
    mutate((d) => {
      const p = d.periods.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    })

  const addPeriod = () =>
    mutate((d) => {
      d.periods.push({ id: newId(), label: `Period ${d.periods.length + 1}`, start: '', end: '' })
    })

  const removePeriod = (id: string) =>
    mutate((d) => {
      d.periods = d.periods.filter((p) => p.id !== id)
      Object.keys(d.cells).forEach((k) => {
        if (k.includes(`__${id}__`)) delete d.cells[k]
      })
      if (d.timeOverrides) {
        Object.keys(d.timeOverrides).forEach((k) => {
          if (k.includes(`__${id}__`)) delete d.timeOverrides![k]
        })
      }
    })

  const save = async () => {
    if (!user || !tt) return
    setSaving(true)
    setMsg('')
    try {
      await saveTimetable(user.uid, tt)
      baselineRef.current = clone(tt)
      setDirty(false)
      setEditing(false)
      setMsg('Timetable saved.')
    } catch {
      setMsg('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    if (baselineRef.current) setTt(clone(baselineRef.current))
    setDirty(false)
    setEditing(false)
    setMsg('')
  }

  const applyImport = (imported: Timetable) => {
    setTt(imported)
    setDirty(true)
    setEditing(true)
    setViewWeek('A')
    setShowImport(false)
    setMsg('Imported — review the timetable below and adjust anything, then Save.')
  }

  const openTerms = () => {
    const existing = tt?.terms ?? []
    setTermsDraft(Array.from({ length: 4 }, (_, i) => ({ start: existing[i]?.start ?? '', end: existing[i]?.end ?? '' })))
    setShowTerms(true)
  }

  const saveTerms = async () => {
    if (!user) return
    setSavingTerms(true)
    try {
      await updateTerms(user.uid, termsDraft)
      setShowTerms(false)
    } finally {
      setSavingTerms(false)
    }
  }

  if (loading || !tt) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your timetable…
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <CalendarClock size={15} /> Timetable
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Your weekly timetable</h1>
          <p className="mt-1 text-navy-500">
            {editing
              ? 'Tap a cell to add or edit — or drag a class to move it (drop on another class to swap).'
              : 'Your classes across the week, linked to your programs.'}
          </p>
          {(() => {
            const info = termInfo(tt)
            if (!info.hasCalendar) return null
            return (
              <p className="mt-1.5 text-sm font-semibold text-teal-600">
                {info.isHoliday ? 'Currently on holidays' : `Week ${info.week} · Term ${info.termNumber}`}
              </p>
            )
          })()}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setShowImport(true)} className="btn-ghost text-sm">
                <Upload size={16} /> Import
              </button>
              <button onClick={cancel} disabled={saving} className="btn-ghost text-sm">
                <RotateCcw size={16} /> Cancel
              </button>
              <button onClick={save} disabled={saving || !firebaseConfigured} className="btn-primary text-sm">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
              </button>
            </>
          ) : (
            <>
              <button onClick={openTerms} className="btn-ghost text-sm">
                <CalendarDays size={16} /> Term dates
              </button>
              <button onClick={() => setEditing(true)} className="btn-navy text-sm">
                <Pencil size={16} /> Edit timetable
              </button>
            </>
          )}
        </div>
      </div>

      {/* week controls */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        {tt.fortnightly && (
          <div className="inline-flex rounded-full border border-navy-100 bg-white p-1">
            {WEEKS.map((w) => (
              <button
                key={w}
                onClick={() => setViewWeek(w)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  viewWeek === w ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
                }`}
              >
                Week {w}
                {currentWeek(tt) === w && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      viewWeek === w ? 'bg-teal-400 text-navy-950' : 'bg-teal-100 text-teal-700'
                    }`}
                  >
                    This week
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {editing && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy-700">
            <input
              type="checkbox"
              checked={!!tt.fortnightly}
              onChange={(e) => setFortnightly(e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-teal-500 focus:ring-teal-300"
            />
            Fortnightly (Week A / Week B)
          </label>
        )}

        {editing && tt.fortnightly && !(tt.terms ?? []).some((t) => t?.start && t?.end) && (
          <div className="flex items-center gap-2 text-sm text-navy-500">
            <span>This calendar week is:</span>
            {WEEKS.map((w) => (
              <button
                key={w}
                onClick={() => markThisWeek(w)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                  currentWeek(tt) === w
                    ? 'border-teal-300 bg-teal-50 text-teal-700'
                    : 'border-navy-200 text-navy-600 hover:bg-navy-50'
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>
        )}
        {editing && tt.fortnightly && (tt.terms ?? []).some((t) => t?.start && t?.end) && (
          <span className="text-xs text-navy-400">Week A/B follows your term dates (each term starts on Week A).</span>
        )}
      </div>

      {msg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-700">
          <Check size={16} /> {msg}
        </div>
      )}
      {dirty && (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          You have unsaved changes.
        </div>
      )}

      {/* Grid */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-navy-100 bg-white">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-40 border-b border-r border-navy-100 bg-navy-50/70 p-3 text-left text-xs font-bold uppercase tracking-wide text-navy-400">
                Period
              </th>
              {DAYS.map((day, i) => (
                <th
                  key={day}
                  className={`border-b border-navy-100 p-3 text-center text-sm font-bold ${
                    i === today ? 'bg-teal-50 text-teal-700' : 'text-navy-800'
                  }`}
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{DAYS_SHORT[i]}</span>
                  {i === today && <span className="ml-1 text-[10px] font-bold text-teal-500">• Today</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tt.periods.map((p) => (
              <tr key={p.id} className="align-top">
                {/* period column */}
                <td className="sticky left-0 z-10 border-b border-r border-navy-100 bg-white p-2">
                  {editing ? (
                    <div className="space-y-1.5">
                      <input
                        value={p.label}
                        onChange={(e) => updatePeriod(p.id, { label: e.target.value })}
                        className="w-full rounded-lg border border-navy-200 px-2 py-1 text-sm font-semibold text-navy-800 outline-none focus:border-teal-400"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={p.start}
                          onChange={(e) => updatePeriod(p.id, { start: e.target.value })}
                          className="w-full rounded-lg border border-navy-200 px-1.5 py-1 text-xs text-navy-600 outline-none focus:border-teal-400"
                        />
                        <input
                          type="time"
                          value={p.end}
                          onChange={(e) => updatePeriod(p.id, { end: e.target.value })}
                          className="w-full rounded-lg border border-navy-200 px-1.5 py-1 text-xs text-navy-600 outline-none focus:border-teal-400"
                        />
                        <button
                          onClick={() => removePeriod(p.id)}
                          className="shrink-0 rounded-lg p-1 text-navy-300 hover:bg-red-50 hover:text-red-500"
                          title="Remove period"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-1 py-1">
                      <p className="text-sm font-bold text-navy-800">{p.label}</p>
                      {(p.start || p.end) && (
                        <p className="text-xs text-navy-400">
                          {p.start}
                          {p.start && p.end ? ' – ' : ''}
                          {p.end}
                        </p>
                      )}
                    </div>
                  )}
                </td>

                {/* day cells */}
                {DAYS.map((_, day) => {
                  const cell = tt.cells[cellKey(viewWeek, p.id, day)]
                  const color = cell?.color ?? 'teal'
                  const overridden = hasTimeOverride(tt, p.id, viewWeek, day)
                  const eff = effectiveTime(tt, p, viewWeek, day)
                  const key = cellKey(viewWeek, p.id, day)
                  const isDropTarget = dropKey === key
                  const dropHandlers = editing
                    ? {
                        onDragOver: (e: React.DragEvent) => {
                          if (!dragSrc.current) return
                          e.preventDefault()
                          if (dropKey !== key) setDropKey(key)
                        },
                        onDragLeave: () => setDropKey((k) => (k === key ? null : k)),
                        onDrop: (e: React.DragEvent) => {
                          e.preventDefault()
                          if (dragSrc.current) moveClass(dragSrc.current, { periodId: p.id, day })
                          dragSrc.current = null
                          setDropKey(null)
                        },
                      }
                    : {}
                  return (
                    <td
                      key={day}
                      {...dropHandlers}
                      className={`border-b border-l border-navy-100 p-1.5 ${day === today ? 'bg-teal-50/40' : ''} ${
                        isDropTarget ? 'bg-teal-100/70 ring-2 ring-inset ring-teal-400' : ''
                      }`}
                    >
                      {cell ? (
                        <button
                          type="button"
                          disabled={!editing}
                          draggable={editing}
                          onDragStart={(e) => {
                            dragSrc.current = { periodId: p.id, day }
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            dragSrc.current = null
                            setDropKey(null)
                          }}
                          onClick={() => editing && setEditCell({ week: viewWeek, periodId: p.id, day })}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left transition-transform ${CLASS_COLORS[color].chip} ${
                            editing ? 'cursor-move hover:-translate-y-0.5 hover:shadow-soft' : 'cursor-default'
                          }`}
                        >
                          <p className="text-xs font-bold leading-tight">{cell.subject || cell.className}</p>
                          {cell.subject && cell.className && (
                            <p className="text-[11px] opacity-80">{cell.className}</p>
                          )}
                          {cell.room && <p className="text-[10px] opacity-70">Room {cell.room}</p>}
                          {overridden && (
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold opacity-90">
                              <Clock size={9} /> {eff.start}–{eff.end}
                            </p>
                          )}
                        </button>
                      ) : editing ? (
                        <button
                          type="button"
                          onClick={() => setEditCell({ week: viewWeek, periodId: p.id, day })}
                          className="flex h-full min-h-[52px] w-full items-center justify-center rounded-lg border border-dashed border-navy-200 text-navy-300 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-500"
                        >
                          <Plus size={16} />
                        </button>
                      ) : (
                        <div className="min-h-[52px]" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <button
          onClick={addPeriod}
          className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-500 hover:border-teal-300 hover:text-teal-600"
        >
          <Plus size={16} /> Add a period
        </button>
      )}

      <p className="mt-8 text-center text-xs text-navy-400">
        <Link to="/app" className="font-semibold text-teal-600 hover:text-teal-700">
          ← Back to dashboard
        </Link>
      </p>

      {showImport && <TimetableImport onClose={() => setShowImport(false)} onImport={applyImport} />}

      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => !savingTerms && setShowTerms(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
            <button
              onClick={() => setShowTerms(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <CalendarDays size={22} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-navy-900">Term dates</h3>
            <p className="mt-1 text-sm text-navy-500">
              Enter the start and end of each term so daywise knows the current term, teaching week and holidays.
            </p>

            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-400">
                <span className="w-14">Term</span>
                <span>Start</span>
                <span>End</span>
              </div>
              {termsDraft.map((t, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                  <span className="w-14 text-sm font-semibold text-navy-700">Term {i + 1}</span>
                  <input
                    type="date"
                    value={t.start}
                    onChange={(e) =>
                      setTermsDraft((prev) => prev.map((x, k) => (k === i ? { ...x, start: e.target.value } : x)))
                    }
                    className="w-full rounded-lg border border-navy-200 px-2.5 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
                  />
                  <input
                    type="date"
                    value={t.end}
                    onChange={(e) =>
                      setTermsDraft((prev) => prev.map((x, k) => (k === i ? { ...x, end: e.target.value } : x)))
                    }
                    className="w-full rounded-lg border border-navy-200 px-2.5 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowTerms(false)} disabled={savingTerms} className="btn-ghost text-sm">
                Cancel
              </button>
              <button onClick={saveTerms} disabled={savingTerms || !firebaseConfigured} className="btn-primary text-sm">
                {savingTerms ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editCell &&
        (() => {
          const period = tt.periods.find((p) => p.id === editCell.periodId)
          if (!period) return null
          const key = cellKey(editCell.week, editCell.periodId, editCell.day)
          return (
            <CellEditor
              initial={tt.cells[key]}
              periodLabel={period.label}
              dayLabel={`${tt.fortnightly ? `Week ${editCell.week} · ` : ''}${DAYS[editCell.day]}`}
              defaultTime={{ start: period.start, end: period.end }}
              initialOverride={tt.timeOverrides?.[key]}
              onClose={() => setEditCell(null)}
              onClear={() => {
                setCell(editCell.week, editCell.periodId, editCell.day, null)
                setTimeOverride(editCell.week, editCell.periodId, editCell.day, null)
                setEditCell(null)
              }}
              onSave={(cell, time, applyColorAll) => {
                setCell(editCell.week, editCell.periodId, editCell.day, cell)
                setTimeOverride(editCell.week, editCell.periodId, editCell.day, time)
                if (applyColorAll) {
                  const keyOf = (c: ClassCell) =>
                    `${(c.subject || '').trim().toLowerCase()}|${(c.className || '').trim().toLowerCase()}`
                  const target = keyOf(cell)
                  mutate((d) => {
                    for (const k of Object.keys(d.cells)) {
                      if (keyOf(d.cells[k]) === target) d.cells[k].color = cell.color
                    }
                  })
                }
                setEditCell(null)
              }}
            />
          )
        })()}
    </main>
  )
}

/* ---------- cell editor modal ---------- */

function CellEditor({
  initial,
  periodLabel,
  dayLabel,
  defaultTime,
  initialOverride,
  onClose,
  onClear,
  onSave,
}: {
  initial?: ClassCell
  periodLabel: string
  dayLabel: string
  defaultTime: TimeSlot
  initialOverride?: TimeSlot
  onClose: () => void
  onClear: () => void
  onSave: (cell: ClassCell, time: TimeSlot | null, applyColorToMatching: boolean) => void
}) {
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [className, setClassName] = useState(initial?.className ?? '')
  const [room, setRoom] = useState(initial?.room ?? '')
  const [color, setColor] = useState<ClassColor>(initial?.color ?? 'teal')
  const [applyColorAll, setApplyColorAll] = useState(false)
  const [customTime, setCustomTime] = useState(!!initialOverride)
  const [start, setStart] = useState(initialOverride?.start ?? defaultTime.start)
  const [end, setEnd] = useState(initialOverride?.end ?? defaultTime.end)

  const inputCls =
    'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-600">
          {dayLabel} · {periodLabel}
        </p>
        <h3 className="mt-1 text-lg font-bold text-navy-900">Edit class</h3>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const override =
              customTime && start && end && (start !== defaultTime.start || end !== defaultTime.end)
                ? { start, end }
                : null
            onSave(
              { subject: subject.trim(), className: className.trim(), room: room.trim() || undefined, color },
              override,
              applyColorAll,
            )
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Subject</span>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Science" autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Class</span>
            <input className={inputCls} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Year 9 · 9SCI1" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Room (optional)</span>
            <input className={inputCls} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="S3" />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Colour</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CLASS_COLORS) as ClassColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ${CLASS_COLORS[c].dot} ${
                    color === c ? 'ring-2 ring-navy-800 ring-offset-2' : ''
                  }`}
                  title={CLASS_COLORS[c].label}
                  aria-label={CLASS_COLORS[c].label}
                />
              ))}
            </div>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-navy-600">
              <input
                type="checkbox"
                checked={applyColorAll}
                onChange={(e) => setApplyColorAll(e.target.checked)}
                className="h-4 w-4 rounded border-navy-300 text-teal-500 focus:ring-teal-300"
              />
              Apply this colour to all matching classes
            </label>
          </div>

          {/* per-day bell time */}
          <div className="rounded-xl border border-navy-100 bg-cloud/60 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy-800">
              <input
                type="checkbox"
                checked={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.checked)
                  if (e.target.checked) {
                    setStart((s) => s || defaultTime.start)
                    setEnd((en) => en || defaultTime.end)
                  }
                }}
                className="h-4 w-4 rounded border-navy-300 text-teal-500 focus:ring-teal-300"
              />
              <Clock size={15} className="text-navy-400" /> Different bell time on this day
            </label>
            {customTime ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-800 outline-none focus:border-teal-400"
                />
                <span className="text-sm text-navy-400">to</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-800 outline-none focus:border-teal-400"
                />
              </div>
            ) : (
              <p className="mt-1.5 pl-6 text-xs text-navy-400">
                Uses the default {defaultTime.start || '—'}
                {defaultTime.start && defaultTime.end ? '–' : ''}
                {defaultTime.end || ''} for {periodLabel}.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {initial ? (
              <button type="button" onClick={onClear} className="text-sm font-semibold text-red-500 hover:text-red-600">
                Clear class
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">
                Cancel
              </button>
              <button type="submit" disabled={!subject.trim() && !className.trim()} className="btn-primary text-sm">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
