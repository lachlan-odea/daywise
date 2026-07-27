import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Trash2, Mic, Sparkles, ExternalLink, NotebookPen, Pencil, Check, X, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { getEntry, deleteEntry, updateEntry, type LessonEntry, type Evidence } from '../lib/entries'
import { subscribeTimetable, currentWeek, cellKey, type Timetable } from '../lib/timetable'
import { subscribePlanningDay, type PlanningNotes } from '../lib/planning'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

interface Draft {
  date: string
  subject: string
  className: string
  room: string
  note: string
  outcomes: string[]
  evidence: Evidence
}

function EditTextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy-400">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={inputCls + ' resize-y'} />
    </label>
  )
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">{label}</p>
      <div className="space-y-1.5">
        {items.map((it, j) => (
          <div key={j} className="flex items-center gap-1.5">
            <input
              value={it}
              onChange={(e) => {
                const next = [...items]
                next[j] = e.target.value
                onChange(next)
              }}
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
            />
            <button
              onClick={() => onChange(items.filter((_, k) => k !== j))}
              className="shrink-0 rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-500"
              aria-label="Remove"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-600 hover:bg-teal-50"
        >
          <Plus size={13} /> Add {placeholder}
        </button>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return iso
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const isTeachingPeriod = (label: string) => /^(period\s*|p\s*|lesson\s*)?\d+$/i.test((label || '').trim())
const sameClass = (e: LessonEntry, cell: { subject?: string; className?: string }) => {
  const s = (x?: string) => (x ?? '').trim().toLowerCase()
  const eSub = s(e.subject)
  const eCls = s(e.className)
  const cSub = s(cell.subject)
  const cCls = s(cell.className)
  // When both name a class, the class must match (so same-subject classes don't collide).
  if (eCls && cCls) return eCls === cCls && (!eSub || !cSub || eSub === cSub)
  return (!!eSub && eSub === cSub) || (!!eCls && eCls === cCls)
}

function Section({ label, text }: { label: string; text: string }) {
  if (!text?.trim()) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{text}</p>
    </div>
  )
}

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, effectiveUid } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [entry, setEntry] = useState<LessonEntry | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [tt, setTt] = useState<Timetable | null>(null)
  const [planning, setPlanning] = useState<PlanningNotes>({})
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    if (!user || !id) return
    let active = true
    getEntry(effectiveUid, id)
      .then((e) => {
        if (!active) return
        if (!e) setState('missing')
        else {
          setEntry(e)
          setState('ready')
        }
      })
      .catch(() => active && setState('missing'))
    return () => {
      active = false
    }
  }, [user, id])

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(effectiveUid, setTt)
  }, [user])

  useEffect(() => {
    if (!user || !entry?.date) return
    return subscribePlanningDay(effectiveUid, entry.date, setPlanning)
  }, [user, entry?.date])

  // Match this entry to its timetabled period on that date to surface its planning note.
  const planningNote = useMemo(() => {
    if (!tt || !entry) return ''
    const [y, m, d] = entry.date.split('-').map(Number)
    if (!y) return ''
    const date = new Date(y, (m || 1) - 1, d || 1)
    const weekday = (date.getDay() + 6) % 7
    if (weekday > 4) return ''
    const week = currentWeek(tt, date)
    for (const p of tt.periods) {
      if (!isTeachingPeriod(p.label)) continue
      const cell = tt.cells[cellKey(week, p.id, weekday)]
      if (cell && sameClass(entry, cell)) return planning[p.id] ?? ''
    }
    return ''
  }, [tt, entry, planning])

  const startEdit = () => {
    if (!entry) return
    const e = entry.evidence
    setDraft({
      date: entry.date,
      subject: entry.subject ?? '',
      className: entry.className ?? '',
      room: entry.room ?? '',
      note: entry.note ?? '',
      outcomes: entry.outcomes ?? [],
      evidence: {
        annotations: e?.annotations ?? '',
        assessmentEvidence: e?.assessmentEvidence ?? '',
        differentiation: e?.differentiation ?? '',
        reflection: e?.reflection ?? '',
        nextSteps: e?.nextSteps ?? [],
      },
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft(null)
  }

  const saveEdit = async () => {
    if (!user || !id || !entry || !draft) return
    setSaving(true)
    try {
      const patch = {
        date: draft.date,
        subject: draft.subject.trim(),
        className: draft.className.trim(),
        room: draft.room.trim() || undefined,
        note: draft.note.trim(),
        outcomes: draft.outcomes.map((s) => s.trim()).filter(Boolean),
        evidence: {
          annotations: draft.evidence.annotations.trim(),
          assessmentEvidence: draft.evidence.assessmentEvidence.trim(),
          differentiation: draft.evidence.differentiation.trim(),
          reflection: draft.evidence.reflection.trim(),
          nextSteps: draft.evidence.nextSteps.map((s) => s.trim()).filter(Boolean),
        },
      }
      await updateEntry(effectiveUid, id, patch)
      setEntry({ ...entry, ...patch })
      setEditing(false)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!user || !id) return
    const ok = await confirm({
      title: 'Delete this diary entry?',
      message: 'This permanently removes the entry and its evidence.',
      confirmLabel: 'Delete entry',
    })
    if (!ok) return
    await deleteEntry(effectiveUid, id)
    navigate('/app/history')
  }

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading entry…
        </div>
      </main>
    )
  }
  if (state === 'missing' || !entry) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <p className="text-navy-600">This entry could not be found.</p>
        <Link to="/app/history" className="btn-navy mt-4 text-sm">
          <ArrowLeft size={16} /> Back to diary
        </Link>
      </main>
    )
  }

  const ev = entry.evidence
  const hasEvidence =
    ev &&
    (ev.annotations || ev.assessmentEvidence || ev.differentiation || ev.reflection || ev.nextSteps?.length || entry.outcomes?.length)

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link
        to="/app/history"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
      >
        <ArrowLeft size={15} /> Diary
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">{formatDate(entry.date)}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900">
            {entry.subject || entry.className || 'Lesson'}
            {entry.subject && entry.className ? ` · ${entry.className}` : ''}
          </h1>
          {entry.lessonTitle && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-navy-500">
              <Sparkles size={14} className="text-teal-500" /> {entry.lessonTitle}
              {entry.programId && entry.lessonId && (
                <Link
                  to={`/app/programs/${entry.programId}#lesson-${entry.lessonId}`}
                  className="ml-1 inline-flex items-center gap-0.5 font-semibold text-teal-600 hover:text-teal-700"
                >
                  view <ExternalLink size={12} />
                </Link>
              )}
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={startEdit}
              className="btn border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50"
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              onClick={remove}
              className="btn border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
              aria-label="Delete entry"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {editing && draft ? (
        <div className="mt-6 space-y-5 rounded-2xl border border-navy-100 bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <Pencil size={16} className="text-teal-600" /> Edit entry
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy-400">Date</span>
              <input type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy-400">Room</span>
              <input className={inputCls} value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy-400">Subject</span>
              <input className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy-400">Class</span>
              <input className={inputCls} value={draft.className} onChange={(e) => setDraft({ ...draft, className: e.target.value })} />
            </label>
          </div>
          <EditTextArea label="What you recorded" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} rows={4} />
          <ListEditor label="Outcomes" items={draft.outcomes} onChange={(v) => setDraft({ ...draft, outcomes: v })} placeholder="outcome" />
          <EditTextArea label="Program annotation" value={draft.evidence.annotations} onChange={(v) => setDraft({ ...draft, evidence: { ...draft.evidence, annotations: v } })} />
          <EditTextArea label="Assessment evidence" value={draft.evidence.assessmentEvidence} onChange={(v) => setDraft({ ...draft, evidence: { ...draft.evidence, assessmentEvidence: v } })} />
          <EditTextArea label="Differentiation" value={draft.evidence.differentiation} onChange={(v) => setDraft({ ...draft, evidence: { ...draft.evidence, differentiation: v } })} rows={2} />
          <EditTextArea label="Reflection" value={draft.evidence.reflection} onChange={(v) => setDraft({ ...draft, evidence: { ...draft.evidence, reflection: v } })} />
          <ListEditor label="Next lesson actions" items={draft.evidence.nextSteps} onChange={(v) => setDraft({ ...draft, evidence: { ...draft.evidence, nextSteps: v } })} placeholder="action" />
          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={cancelEdit} disabled={saving} className="btn-ghost text-sm">
              Cancel
            </button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save changes
            </button>
          </div>
        </div>
      ) : (
        <>
      {/* the raw note */}
      <div className="mt-6 rounded-2xl border border-navy-100 bg-cloud/60 p-5">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">
          <Mic size={12} /> What you recorded
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{entry.note || '—'}</p>
      </div>

      {/* planning note (managed on the diary/dashboard for this class + day) */}
      {planningNote && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
            <NotebookPen size={12} /> Planning note
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{planningNote}</p>
        </div>
      )}

      {/* evidence */}
      {hasEvidence ? (
        <div className="mt-6 space-y-5 rounded-2xl border border-navy-100 bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <Sparkles size={16} className="text-teal-600" /> Teaching evidence
          </h2>
          {entry.outcomes?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">Outcomes</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.outcomes.map((o, i) => (
                  <span key={i} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Section label="Program annotation" text={ev.annotations} />
          <Section label="Assessment evidence" text={ev.assessmentEvidence} />
          <Section label="Differentiation" text={ev.differentiation} />
          <Section label="Reflection" text={ev.reflection} />
          {ev.nextSteps?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">Next lesson actions</p>
              <ul className="space-y-1">
                {ev.nextSteps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-navy-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-cloud p-5 text-sm text-navy-500">
          No AI evidence was generated for this entry.
        </p>
      )}
        </>
      )}
    </main>
  )
}
