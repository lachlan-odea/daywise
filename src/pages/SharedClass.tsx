import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
  MapPin,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { unitLabel, type Lesson, type Program } from '../lib/programs'
import {
  getSharedProgramLessons,
  leaveSharedClass,
  subscribeSharedClass,
  subscribeSharedPrograms,
  type SharedClass as SharedClassDoc,
} from '../lib/sharedClasses'
import ClassIconTile from '../components/ClassIcon'

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

export default function SharedClass() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [cls, setCls] = useState<SharedClassDoc | null | undefined>(undefined) // undefined = loading
  const [programs, setPrograms] = useState<Program[]>([])
  const [openProgram, setOpenProgram] = useState<string | null>(null)
  const [lessonsById, setLessonsById] = useState<Record<string, Lesson[]>>({})

  useEffect(() => {
    if (!user || !id) return
    const unsubs = [subscribeSharedClass(id, setCls), subscribeSharedPrograms(id, setPrograms)]
    return () => unsubs.forEach((u) => u())
  }, [user, id])

  const toggleProgram = async (pid: string) => {
    if (openProgram === pid) {
      setOpenProgram(null)
      return
    }
    setOpenProgram(pid)
    if (!lessonsById[pid] && id) {
      const lessons = await getSharedProgramLessons(id, pid)
      setLessonsById((prev) => ({ ...prev, [pid]: lessons }))
    }
  }

  const leave = async () => {
    if (!user || !id || !cls) return
    const ok = await confirm({
      title: `Leave “${cls.name}”?`,
      message: 'You’ll lose access to this shared class until the owner invites you again.',
      confirmLabel: 'Leave class',
    })
    if (!ok) return
    await leaveSharedClass(id, user.uid)
    navigate('/app/classes')
  }

  if (cls === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading shared class…
        </div>
      </main>
    )
  }

  if (cls === null) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <p className="text-navy-600">This shared class could not be found, or you no longer have access to it.</p>
        <Link to="/app/classes" className="btn-navy mt-4 text-sm">
          <ArrowLeft size={16} /> Back to classes
        </Link>
      </main>
    )
  }

  const isOwner = user?.uid === cls.ownerUid
  const memberNames = cls.memberUids.map((uid) => cls.members[uid]?.name).filter(Boolean)

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link
        to="/app/classes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
      >
        <ArrowLeft size={15} /> Back to classes
      </Link>

      {/* header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-1 items-start gap-4">
          <ClassIconTile subject={cls.subject} icon={cls.icon} color={cls.color} size={56} iconSize={26} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">{cls.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {cls.className && (
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">{cls.className}</span>
              )}
              {cls.yearGroup && (
                <span className="flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-600">
                  <GraduationCap size={12} /> {cls.yearGroup}
                </span>
              )}
              {cls.room && (
                <span className="flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-600">
                  <MapPin size={12} /> {cls.room}
                </span>
              )}
              <span
                className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700"
                title={memberNames.join(', ')}
              >
                <Users size={12} /> {cls.memberUids.length} teacher{cls.memberUids.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-2 text-sm text-navy-500">Shared by {cls.ownerName}</p>
          </div>
        </div>
        {!isOwner && (
          <button
            onClick={leave}
            className="btn border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            <LogOut size={15} /> Leave class
          </button>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Eye size={16} className="mt-0.5 shrink-0" />
        Read-only — you can view this class’s details, programs and notes. Contributing is coming soon.
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Class details</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-navy-400">Subject</dt>
              <dd className="mt-0.5 text-sm font-bold text-navy-900">{cls.subject || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-navy-400">Year group</dt>
              <dd className="mt-0.5 text-sm font-bold text-navy-900">{cls.yearGroup || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-navy-400">Room</dt>
              <dd className="mt-0.5 text-sm font-bold text-navy-900">{cls.room || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-navy-400">Teachers</dt>
              <dd className="mt-0.5 text-sm font-bold text-navy-900">{memberNames.join(', ') || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Class notes</h2>
          {cls.notes?.trim() ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-navy-700">{cls.notes}</p>
          ) : (
            <p className="mt-4 text-sm text-navy-400">No class notes yet.</p>
          )}
        </section>
      </div>

      {/* programs */}
      <section className="mt-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Programs</h2>
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-400">{programs.length}</span>
          <span className="h-px flex-1 bg-navy-100" />
        </div>
        {programs.length === 0 ? (
          <p className="mt-4 text-sm text-navy-400">No programs were shared with this class.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {programs.map((p) => {
              const open = openProgram === p.id
              const lessons = p.id ? lessonsById[p.id] : undefined
              const unit = unitLabel(p.structure)
              return (
                <div key={p.id} className="card overflow-hidden">
                  <button
                    onClick={() => p.id && toggleProgram(p.id)}
                    className="flex w-full items-center gap-4 p-5 text-left hover:bg-cloud/60"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <BookOpen size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-900">{p.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {p.subject && (
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                            {p.subject}
                          </span>
                        )}
                        {p.stage && (
                          <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-bold text-navy-600">
                            {p.stage}
                          </span>
                        )}
                        {(p.term ?? 0) >= 1 && (
                          <span className="rounded-md bg-navy-800 px-2 py-0.5 text-[11px] font-bold text-white">
                            Term {p.term}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-navy-400">
                          <FileText size={11} className="text-teal-500" /> {p.lessonCount} {unit.many}
                        </span>
                      </div>
                    </div>
                    {open ? (
                      <ChevronUp size={18} className="shrink-0 text-navy-400" />
                    ) : (
                      <ChevronDown size={18} className="shrink-0 text-navy-400" />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-navy-100 p-5">
                      {!lessons ? (
                        <div className="flex items-center gap-2 text-sm text-navy-400">
                          <Loader2 size={15} className="animate-spin" /> Loading {unit.many}…
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {lessons.map((lesson, i) => (
                            <div key={lesson.id ?? i} className="rounded-2xl border border-navy-100 p-5">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                                  {i + 1}
                                </span>
                                <h3 className="text-base font-bold text-navy-900">
                                  {lesson.title || `${unit.one} ${i + 1}`}
                                </h3>
                              </div>
                              <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                {SECTIONS.map(({ key, label }) => {
                                  const items = lesson[key] as string[]
                                  if (!Array.isArray(items) || items.length === 0) return null
                                  return (
                                    <div key={key}>
                                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">
                                        {label}
                                      </p>
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
                                              <span className="min-w-0 break-words">{it}</span>
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
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
