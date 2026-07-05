import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Trash2, Mic, Sparkles, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getEntry, deleteEntry, type LessonEntry } from '../lib/entries'

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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<LessonEntry | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!user || !id) return
    let active = true
    getEntry(user.uid, id)
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

  const remove = async () => {
    if (!user || !id) return
    if (!window.confirm('Delete this diary entry?')) return
    await deleteEntry(user.uid, id)
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
        <button
          onClick={remove}
          className="btn border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* the raw note */}
      <div className="mt-6 rounded-2xl border border-navy-100 bg-cloud/60 p-5">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">
          <Mic size={12} /> What you recorded
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{entry.note || '—'}</p>
      </div>

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
    </main>
  )
}
