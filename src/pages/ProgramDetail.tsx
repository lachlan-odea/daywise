import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, GraduationCap, Trash2, Loader2, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getProgram, deleteProgram, type Lesson, type Program } from '../lib/programs'

const CHIP_SECTIONS = new Set(['outcomes', 'keywords'])

const SECTIONS: { key: keyof Lesson; label: string }[] = [
  { key: 'outcomes', label: 'Outcomes' },
  { key: 'learningIntentions', label: 'Learning intentions' },
  { key: 'successCriteria', label: 'Success criteria' },
  { key: 'activities', label: 'Activities' },
  { key: 'resources', label: 'Resources' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'keywords', label: 'Keywords' },
]

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<{ program: Program; lessons: Lesson[] } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

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

  const remove = async () => {
    if (!user || !id || !data) return
    if (!window.confirm(`Delete "${data.program.name}"? This removes the program and its lessons.`)) return
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

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link to="/app/programs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700">
        <ArrowLeft size={15} /> All programs
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <BookOpen size={22} />
          </span>
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
        </div>
        <button
          onClick={remove}
          className="btn border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          <Trash2 size={15} /> Delete
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {lessons.map((lesson, i) => (
          <div key={lesson.id ?? i} className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                {i + 1}
              </span>
              <h2 className="text-lg font-bold text-navy-900">{lesson.title}</h2>
            </div>

            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {SECTIONS.map(({ key, label }) => {
                const items = lesson[key] as string[]
                if (!Array.isArray(items) || items.length === 0) return null
                return (
                  <div key={key}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">{label}</p>
                    {CHIP_SECTIONS.has(key) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((it, j) => (
                          <span
                            key={j}
                            className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700"
                          >
                            {it}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {items.map((it, j) => (
                          <li key={j} className="flex gap-2 text-sm text-navy-700">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                            {it}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
