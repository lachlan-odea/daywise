import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { History as HistoryIcon, Mic, Loader2, Trash2, Sparkles, ChevronRight, BookOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { subscribeEntries, deleteEntry, type LessonEntry } from '../lib/entries'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return iso
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeEntries(user.uid, setEntries)
  }, [user])

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

  const loading = entries === null

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <HistoryIcon size={15} /> History
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Teaching diary</h1>
          <p className="mt-1 text-navy-500">Every lesson you’ve recorded, with its evidence.</p>
        </div>
        {entries && entries.length > 0 && (
          <Link to="/app/record" className="btn-primary text-sm">
            <Mic size={16} /> Record lesson
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your diary…
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-navy-200 bg-white p-10 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Mic size={28} />
          </span>
          <h2 className="mt-5 text-lg font-bold text-navy-900">No entries yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">
            Record what happened in a lesson by voice or text — Project Daybook turns it into professional evidence.
          </p>
          <Link to="/app/record" className="btn-primary mx-auto mt-6 text-sm">
            <Mic size={16} /> Record your first lesson
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {entries.map((e) => (
            <div
              key={e.id}
              onClick={() => navigate(`/app/history/${e.id}`)}
              className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-navy-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-soft sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-navy-400">{formatDate(e.date)}</span>
                  {e.subject && (
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                      {e.subject}
                    </span>
                  )}
                  {e.className && (
                    <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-bold text-navy-600">
                      {e.className}
                    </span>
                  )}
                  {e.lessonTitle && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                      <Sparkles size={11} /> {e.lessonTitle}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-navy-600">{e.note || '—'}</p>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation()
                  remove(e)
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-navy-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                aria-label="Delete entry"
              >
                {deletingId === e.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
              <ChevronRight size={18} className="shrink-0 text-navy-300" />
            </div>
          ))}
        </div>
      )}

      {entries && entries.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-navy-400">
          <BookOpen size={13} /> {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      )}
    </main>
  )
}
