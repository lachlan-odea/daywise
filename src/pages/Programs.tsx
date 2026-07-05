import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Sparkles, Trash2, Loader2, FileText, GraduationCap, Lock, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { subscribePrograms, deleteProgram, type Program } from '../lib/programs'
import { useEntitlements } from '../hooks/useEntitlements'
import { useConfirm } from '../components/ConfirmProvider'
import ProgramImport from '../components/ProgramImport'

export default function Programs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { maxPrograms, paid } = useEntitlements()
  const confirm = useConfirm()
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const atLimit = !!programs && programs.length >= maxPrograms

  useEffect(() => {
    if (!user) return
    return subscribePrograms(user.uid, setPrograms)
  }, [user])

  const remove = async (p: Program) => {
    if (!user || !p.id) return
    const ok = await confirm({
      title: `Delete “${p.name}”?`,
      message: 'This permanently removes the program and all of its lessons.',
      confirmLabel: 'Delete program',
    })
    if (!ok) return
    setDeletingId(p.id)
    try {
      await deleteProgram(user.uid, p.id)
    } finally {
      setDeletingId(null)
    }
  }

  const loading = programs === null

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <BookOpen size={15} /> Programs
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Teaching programs</h1>
          <p className="mt-1 text-navy-500">Upload your programs and Curriculum Intelligence structures every lesson.</p>
        </div>
        {programs && programs.length > 0 && (
          atLimit ? (
            <Link to="/#pricing" className="btn-primary text-sm">
              <ArrowUpRight size={16} /> Upgrade for more
            </Link>
          ) : (
            <button onClick={() => setShowImport(true)} className="btn-primary text-sm">
              <Plus size={16} /> Upload program
            </button>
          )
        )}
      </div>

      {atLimit && !paid && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Lock size={17} />
            </span>
            <p className="text-sm text-amber-800">
              You’ve reached the <b>Starter</b> limit of {maxPrograms} program{maxPrograms === 1 ? '' : 's'}. Upgrade to
              Teacher Pro for <b>unlimited</b> programs.
            </p>
          </div>
          <Link to="/#pricing" className="btn-navy shrink-0 text-sm">
            See plans
          </Link>
        </div>
      )}

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your programs…
        </div>
      ) : programs.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-navy-200 bg-white p-10 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Sparkles size={28} />
          </span>
          <h2 className="mt-5 text-lg font-bold text-navy-900">Add your first teaching program</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">
            Drop in a PDF, Word or Excel program and the AI extracts every lesson, outcome, learning intention,
            activity, resource and keyword — ready to match to your recorded lessons.
          </p>
          <button onClick={() => setShowImport(true)} className="btn-primary mx-auto mt-6 text-sm">
            <Plus size={16} /> Upload program
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <div
              key={p.id}
              className="group relative flex cursor-pointer flex-col rounded-3xl border border-navy-100 bg-white p-6 transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-card"
              onClick={() => navigate(`/app/programs/${p.id}`)}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                  <BookOpen size={20} />
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(p)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  aria-label="Delete program"
                >
                  {deletingId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
              <h3 className="mt-4 line-clamp-2 text-base font-bold text-navy-900">{p.name}</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.subject && (
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">{p.subject}</span>
                )}
                {p.stage && (
                  <span className="flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-bold text-navy-600">
                    <GraduationCap size={11} /> {p.stage}
                  </span>
                )}
              </div>
              <div className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-semibold text-navy-500">
                <FileText size={13} className="text-teal-500" /> {p.lessonCount} lessons
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <ProgramImport
          onClose={() => setShowImport(false)}
          onSaved={(id) => {
            setShowImport(false)
            navigate(`/app/programs/${id}`)
          }}
        />
      )}
    </main>
  )
}
