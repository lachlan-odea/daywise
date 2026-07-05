import { Fragment, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Trash2,
  Loader2,
  FileText,
  Pencil,
  Check,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { getProgram, deleteProgram, updateProgram, type Lesson, type Program } from '../lib/programs'

const CHIP_SECTIONS = new Set<keyof Lesson>(['outcomes', 'keywords'])

const SECTIONS: { key: keyof Lesson; label: string }[] = [
  { key: 'outcomes', label: 'Outcomes' },
  { key: 'learningIntentions', label: 'Learning intentions' },
  { key: 'successCriteria', label: 'Success criteria' },
  { key: 'activities', label: 'Activities' },
  { key: 'resources', label: 'Resources' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'keywords', label: 'Keywords' },
]

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'
const smallInput =
  'w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400'

const URL_RE = /(https?:\/\/[^\s]+)/g

/** Renders text with any URLs turned into clickable links. */
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const offset = m.index ?? 0
    if (offset > last) parts.push(text.slice(last, offset))
    let url = m[0]
    let trail = ''
    const t = url.match(/[).,;\]]+$/)
    if (t) {
      trail = t[0]
      url = url.slice(0, -trail.length)
    }
    parts.push(
      <a
        key={offset}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-medium text-teal-600 underline decoration-teal-300 underline-offset-2 hover:text-teal-700"
      >
        {url}
      </a>,
    )
    if (trail) parts.push(trail)
    last = offset + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const emptyLesson = (): Lesson => ({
  order: 0,
  term: 0,
  title: '',
  outcomes: [],
  learningIntentions: [],
  successCriteria: [],
  activities: [],
  resources: [],
  keywords: [],
  assessment: [],
})

const cloneLessons = (lessons: Lesson[]): Lesson[] =>
  lessons.map((l) => ({
    ...l,
    outcomes: [...l.outcomes],
    learningIntentions: [...l.learningIntentions],
    successCriteria: [...l.successCriteria],
    activities: [...l.activities],
    resources: [...l.resources],
    keywords: [...l.keywords],
    assessment: [...l.assessment],
  }))

function TermHeading({ term }: { term: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 rounded-full bg-navy-800 px-3 py-1 text-xs font-bold text-white">
        {term >= 1 ? `Term ${term}` : 'Additional lessons'}
      </span>
      <span className="h-px flex-1 bg-navy-100" />
    </div>
  )
}

function SectionEditor({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[]
  onChange: (v: string[]) => void
}) {
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
              className={smallInput}
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
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const [data, setData] = useState<{ program: Program; lessons: Lesson[] } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [meta, setMeta] = useState({ name: '', subject: '', stage: '', description: '' })
  const [draft, setDraft] = useState<Lesson[]>([])

  useEffect(() => {
    if (!user || !id) return
    let active = true
    getProgram(user.uid, id)
      .then((res) => {
        if (!active) return
        if (!res) setState('missing')
        else {
          setData(res)
          setState('ready')
        }
      })
      .catch(() => active && setState('missing'))
    return () => {
      active = false
    }
  }, [user, id])

  // Deep-link: scroll to and briefly highlight a lesson from a #lesson-<id> anchor.
  useEffect(() => {
    if (state !== 'ready' || editing) return
    const m = location.hash.match(/^#lesson-(.+)$/)
    if (!m) return
    const lid = m[1]
    const scroll = setTimeout(() => {
      const el = document.getElementById(`lesson-${lid}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(lid)
    }, 60)
    const clear = setTimeout(() => setHighlightId(null), 2600)
    return () => {
      clearTimeout(scroll)
      clearTimeout(clear)
    }
  }, [state, editing, location.hash, location.key])

  const startEdit = () => {
    if (!data) return
    setMeta({
      name: data.program.name,
      subject: data.program.subject,
      stage: data.program.stage,
      description: data.program.description ?? '',
    })
    setDraft(cloneLessons(data.lessons))
    setEditing(true)
  }

  const setLesson = (i: number, patch: Partial<Lesson>) =>
    setDraft((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  const moveLesson = (i: number, dir: -1 | 1) =>
    setDraft((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const save = async () => {
    if (!user || !id) return
    setSaving(true)
    try {
      // drop blank items and blank lessons
      const cleaned = draft
        .map((l) => {
          const c = { ...l }
          for (const { key } of SECTIONS) c[key] = (l[key] as string[]).map((s) => s.trim()).filter(Boolean) as never
          c.title = l.title.trim()
          return c
        })
        .filter((l) => l.title || SECTIONS.some(({ key }) => (l[key] as string[]).length))
      const trimmedMeta = {
        name: meta.name.trim() || 'Untitled program',
        subject: meta.subject.trim(),
        stage: meta.stage.trim(),
        description: meta.description.trim(),
      }
      await updateProgram(user.uid, id, trimmedMeta, cleaned)
      setData({ program: { ...(data as { program: Program }).program, ...trimmedMeta, lessonCount: cleaned.length }, lessons: cleaned })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!user || !id || !data) return
    const ok = await confirm({
      title: `Delete “${data.program.name}”?`,
      message: 'This permanently removes the program and all of its lessons.',
      confirmLabel: 'Delete program',
    })
    if (!ok) return
    await deleteProgram(user.uid, id)
    navigate('/app/programs')
  }

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading program…
        </div>
      </main>
    )
  }

  if (state === 'missing' || !data) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <p className="text-navy-600">This program could not be found.</p>
        <Link to="/app/programs" className="btn-navy mt-4 text-sm">
          <ArrowLeft size={16} /> Back to programs
        </Link>
      </main>
    )
  }

  const { program, lessons } = data
  const hasTerms = !editing && lessons.some((l) => (l.term ?? 0) >= 1)
  const lessonsToShow = editing
    ? draft
    : hasTerms
      ? [...lessons].sort((a, b) => (a.term || 99) - (b.term || 99) || a.order - b.order)
      : lessons

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link
        to="/app/programs"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
      >
        <ArrowLeft size={15} /> All programs
      </Link>

      {/* header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-1 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <BookOpen size={22} />
          </span>
          {editing ? (
            <div className="flex-1 space-y-3">
              <input
                value={meta.name}
                onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                className={inputCls + ' text-lg font-bold'}
                placeholder="Program name"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={meta.subject}
                  onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
                  className={smallInput}
                  placeholder="Subject"
                />
                <input
                  value={meta.stage}
                  onChange={(e) => setMeta({ ...meta, stage: e.target.value })}
                  className={smallInput}
                  placeholder="Stage / year"
                />
              </div>
              <textarea
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                className={inputCls + ' min-h-[60px]'}
                placeholder="Short description (optional)"
              />
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">{program.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {program.subject && (
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">{program.subject}</span>
                )}
                {program.stage && (
                  <span className="flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-600">
                    <GraduationCap size={12} /> {program.stage}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs font-semibold text-navy-500">
                  <FileText size={12} className="text-teal-500" /> {lessons.length} lessons
                </span>
              </div>
              {program.description && <p className="mt-3 max-w-2xl text-sm text-navy-600">{program.description}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} disabled={saving} className="btn-ghost text-sm">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn-primary text-sm">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="btn-navy text-sm">
                <Pencil size={15} /> Edit
              </button>
              <button
                onClick={remove}
                className="btn border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* lessons */}
      <div className="mt-8 space-y-4">
        {lessonsToShow.map((lesson, i) => {
          const showHeading = hasTerms && (i === 0 || (lessonsToShow[i - 1].term ?? 0) !== (lesson.term ?? 0))
          return (
            <Fragment key={editing ? i : (lesson.id ?? i)}>
              {showHeading && <TermHeading term={lesson.term ?? 0} />}
              <div
                id={!editing && lesson.id ? `lesson-${lesson.id}` : undefined}
                className={`card scroll-mt-24 p-6 transition-shadow ${
                  !editing && highlightId && highlightId === lesson.id ? 'ring-2 ring-teal-400' : ''
                }`}
              >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                {i + 1}
              </span>
              {editing ? (
                <>
                  <input
                    value={lesson.title}
                    onChange={(e) => setLesson(i, { title: e.target.value })}
                    className={smallInput + ' flex-1 font-bold'}
                    placeholder="Lesson title"
                  />
                  <select
                    value={lesson.term || ''}
                    onChange={(e) => setLesson(i, { term: e.target.value ? Number(e.target.value) : 0 })}
                    className="shrink-0 rounded-lg border border-navy-200 px-2 py-1.5 text-xs font-semibold text-navy-700 outline-none focus:border-teal-400"
                    title="Term"
                  >
                    <option value="">No term</option>
                    {[1, 2, 3, 4].map((t) => (
                      <option key={t} value={t}>
                        Term {t}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveLesson(i, -1)}
                      disabled={i === 0}
                      className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => moveLesson(i, 1)}
                      disabled={i === draft.length - 1}
                      className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      onClick={() => setDraft((prev) => prev.filter((_, k) => k !== i))}
                      className="rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-500"
                      aria-label="Delete lesson"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <h2 className="text-lg font-bold text-navy-900">{lesson.title}</h2>
              )}
            </div>

            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {SECTIONS.map(({ key, label }) => {
                const items = lesson[key] as string[]
                if (editing) {
                  return <SectionEditor key={key} label={label} items={items} onChange={(v) => setLesson(i, { [key]: v })} />
                }
                if (!Array.isArray(items) || items.length === 0) return null
                return (
                  <div key={key}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">{label}</p>
                    {CHIP_SECTIONS.has(key) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((it, j) => (
                          <span key={j} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                            {it}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {items.map((it, j) => (
                          <li key={j} className="flex gap-2 text-sm text-navy-700">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                            <span className="min-w-0 break-words">{linkify(it)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
              </div>
            </Fragment>
              )
            })}
      </div>

      {editing && (
        <button
          onClick={() => setDraft((prev) => [...prev, emptyLesson()])}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-200 py-4 text-sm font-semibold text-navy-500 hover:border-teal-300 hover:text-teal-600"
        >
          <Plus size={16} /> Add a lesson
        </button>
      )}
    </main>
  )
}
