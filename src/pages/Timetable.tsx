import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2, X, Check, Loader2, RotateCcw, CalendarClock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  CLASS_COLORS,
  DAYS,
  DAYS_SHORT,
  cellKey,
  defaultTimetable,
  newId,
  saveTimetable,
  subscribeTimetable,
  type ClassCell,
  type ClassColor,
  type Timetable,
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
  const [editCell, setEditCell] = useState<{ periodId: string; day: number } | null>(null)

  const dirtyRef = useRef(false)
  const baselineRef = useRef<Timetable | null>(null)
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

  const setCell = (periodId: string, day: number, cell: ClassCell | null) => {
    mutate((d) => {
      const k = cellKey(periodId, day)
      if (cell && (cell.subject || cell.className)) d.cells[k] = cell
      else delete d.cells[k]
    })
  }

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
        if (k.startsWith(`${id}__`)) delete d.cells[k]
      })
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
            {editing ? 'Tap any cell to add or edit a class.' : 'Your classes across the week, linked to your programs.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={cancel} disabled={saving} className="btn-ghost text-sm">
                <RotateCcw size={16} /> Cancel
              </button>
              <button onClick={save} disabled={saving || !firebaseConfigured} className="btn-primary text-sm">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-navy text-sm">
              <Pencil size={16} /> Edit timetable
            </button>
          )}
        </div>
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
                  const cell = tt.cells[cellKey(p.id, day)]
                  const color = cell?.color ?? 'teal'
                  return (
                    <td
                      key={day}
                      className={`border-b border-l border-navy-100 p-1.5 ${day === today ? 'bg-teal-50/40' : ''}`}
                    >
                      {cell ? (
                        <button
                          type="button"
                          disabled={!editing}
                          onClick={() => editing && setEditCell({ periodId: p.id, day })}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left transition-transform ${CLASS_COLORS[color].chip} ${
                            editing ? 'hover:-translate-y-0.5 hover:shadow-soft' : 'cursor-default'
                          }`}
                        >
                          <p className="text-xs font-bold leading-tight">{cell.subject || cell.className}</p>
                          {cell.subject && cell.className && (
                            <p className="text-[11px] opacity-80">{cell.className}</p>
                          )}
                          {cell.room && <p className="text-[10px] opacity-70">Room {cell.room}</p>}
                        </button>
                      ) : editing ? (
                        <button
                          type="button"
                          onClick={() => setEditCell({ periodId: p.id, day })}
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

      {editCell && (
        <CellEditor
          initial={tt.cells[cellKey(editCell.periodId, editCell.day)]}
          periodLabel={tt.periods.find((p) => p.id === editCell.periodId)?.label ?? ''}
          dayLabel={DAYS[editCell.day]}
          onClose={() => setEditCell(null)}
          onClear={() => {
            setCell(editCell.periodId, editCell.day, null)
            setEditCell(null)
          }}
          onSave={(cell) => {
            setCell(editCell.periodId, editCell.day, cell)
            setEditCell(null)
          }}
        />
      )}
    </main>
  )
}

/* ---------- cell editor modal ---------- */

function CellEditor({
  initial,
  periodLabel,
  dayLabel,
  onClose,
  onClear,
  onSave,
}: {
  initial?: ClassCell
  periodLabel: string
  dayLabel: string
  onClose: () => void
  onClear: () => void
  onSave: (cell: ClassCell) => void
}) {
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [className, setClassName] = useState(initial?.className ?? '')
  const [room, setRoom] = useState(initial?.room ?? '')
  const [color, setColor] = useState<ClassColor>(initial?.color ?? 'teal')

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
            onSave({ subject: subject.trim(), className: className.trim(), room: room.trim() || undefined, color })
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
