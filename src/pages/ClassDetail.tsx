import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Settings as SettingsIcon,
  Share2,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { classInfoKey, classSchedule, deleteClass, subscribeClass, updateClass, type ClassInfo } from '../lib/classes'
import { classKey, subscribeClassPrograms, setClassProgramsForClass, type ClassProgramMap } from '../lib/classPrograms'
import { getProgram, subscribePrograms, unitLabel, type Lesson, type Program } from '../lib/programs'
import { currentTermIndex, subscribeTimetable, termInfo, type Timetable } from '../lib/timetable'
import { subscribeEntries, type LessonEntry } from '../lib/entries'
import { subscribeSharedClass, unshareClass, updateSharedClass, type SharedClass } from '../lib/sharedClasses'
import ClassIconTile from '../components/ClassIcon'
import ClassEditor from '../components/ClassEditor'
import ShareClassModal from '../components/ShareClassModal'

type Tab = 'overview' | 'programs' | 'notes'

const SOON_TABS = ['Analytics', 'Resources']

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
      <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <p className="text-xs font-semibold text-navy-500">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-navy-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-navy-400">{sub}</p>}
    </div>
  )
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, effectiveUid } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [cls, setCls] = useState<ClassInfo | null | undefined>(undefined) // undefined = loading
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programMap, setProgramMap] = useState<ClassProgramMap>({})
  const [entries, setEntries] = useState<LessonEntry[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [showSettings, setShowSettings] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [sharedClass, setSharedClass] = useState<SharedClass | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<{ programId: string; lessons: Lesson[] } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    return subscribeClass(effectiveUid, id, setCls)
  }, [user, id])

  useEffect(() => {
    if (!user) return
    const unsubs = [
      subscribeTimetable(effectiveUid, setTimetable),
      subscribePrograms(effectiveUid, setPrograms),
      subscribeClassPrograms(effectiveUid, setProgramMap),
      subscribeEntries(effectiveUid, setEntries),
    ]
    return () => unsubs.forEach((u) => u())
  }, [user])

  useEffect(() => {
    setNoteDraft(cls?.notes ?? '')
  }, [cls?.id])

  const sharedId = cls?.sharedClassId
  useEffect(() => {
    if (!user || !sharedId) {
      setSharedClass(null)
      return
    }
    return subscribeSharedClass(sharedId, setSharedClass)
  }, [user, sharedId])

  const key = cls ? classInfoKey(cls) : ''
  const assignedIds = useMemo(() => programMap[key] ?? [], [programMap, key])
  const assigned = useMemo(
    () => programs.filter((p) => p.id && assignedIds.includes(p.id)),
    [programs, assignedIds],
  )
  const classEntries = useMemo(
    () => (key ? entries.filter((e) => classKey(e.subject, e.className) === key) : []),
    [entries, key],
  )

  const progressOf = (p: Program) => {
    if (!p.id || !p.lessonCount) return 0
    const done = new Set(classEntries.filter((e) => e.programId === p.id && e.lessonId).map((e) => e.lessonId)).size
    return Math.min(100, Math.round((done / p.lessonCount) * 100))
  }

  // The assigned program taught most recently (falls back to the first assigned).
  const currentProgram = useMemo(() => {
    if (!assigned.length) return null
    const lastDate = new Map<string, string>()
    for (const e of classEntries) {
      if (!e.programId) continue
      const d = lastDate.get(e.programId)
      if (!d || e.date > d) lastDate.set(e.programId, e.date)
    }
    return [...assigned].sort((a, b) => (lastDate.get(b.id!) ?? '').localeCompare(lastDate.get(a.id!) ?? ''))[0]
  }, [assigned, classEntries])

  useEffect(() => {
    const pid = currentProgram?.id
    if (!user || !pid) {
      setTimeline(null)
      return
    }
    let active = true
    getProgram(effectiveUid, pid).then((res) => {
      if (active && res) setTimeline({ programId: pid, lessons: res.lessons })
    })
    return () => {
      active = false
    }
  }, [user, currentProgram?.id])

  // Analytics scope: the current term when the term calendar is set, otherwise all time.
  const term = termInfo(timetable)
  const termEntries = useMemo(() => {
    const idx = currentTermIndex(timetable)
    const range = idx >= 0 ? timetable?.terms?.[idx] : undefined
    if (!range?.start || !range?.end) return classEntries
    return classEntries.filter((e) => e.date >= range.start && e.date <= range.end)
  }, [classEntries, timetable])

  const stats = useMemo(() => {
    const taught = termEntries.filter((e) => !e.missed)
    const outcomes = new Set(taught.flatMap((e) => e.outcomes ?? []).filter(Boolean))
    const reflections = taught.filter((e) => e.evidence?.reflection?.trim()).length
    const coverage = assigned.length
      ? Math.round(assigned.reduce((sum, p) => sum + progressOf(p), 0) / assigned.length)
      : null
    return { recorded: taught.length, outcomes: outcomes.size, reflections, coverage }
  }, [termEntries, assigned, classEntries])

  const toggleProgram = async (p: Program) => {
    if (!user || !p.id || !cls) return
    const ids = assignedIds.includes(p.id) ? assignedIds.filter((x) => x !== p.id) : [...assignedIds, p.id]
    setTogglingId(p.id)
    try {
      await setClassProgramsForClass(effectiveUid, key, ids)
    } finally {
      setTogglingId(null)
    }
  }

  const saveNotes = async () => {
    if (!user || !cls?.id) return
    setNoteSaving(true)
    try {
      await updateClass(effectiveUid, cls.id, { notes: noteDraft })
      if (cls.sharedClassId) await updateSharedClass(cls.sharedClassId, { notes: noteDraft })
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
    } finally {
      setNoteSaving(false)
    }
  }

  const remove = async () => {
    if (!user || !cls?.id) return
    const ok = await confirm({
      title: `Delete “${cls.name}”?`,
      message: cls.sharedClassId
        ? 'This removes the class page and stops sharing it — everyone you shared it with loses access. Your timetable, diary entries and programs are not affected.'
        : 'This removes the class page. Your timetable, diary entries and programs are not affected.',
      confirmLabel: 'Delete class',
    })
    if (!ok) return
    if (cls.sharedClassId) await unshareClass(effectiveUid, cls.id, cls.sharedClassId)
    await deleteClass(effectiveUid, cls.id)
    navigate('/app/classes')
  }

  if (cls === undefined) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading class…
        </div>
      </main>
    )
  }

  if (cls === null) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <p className="text-navy-600">This class could not be found.</p>
        <Link to="/app/classes" className="btn-navy mt-4 text-sm">
          <ArrowLeft size={16} /> Back to classes
        </Link>
      </main>
    )
  }

  const schedule = classSchedule(timetable, cls.subject, cls.className)
  const termLabel = term.termNumber ? `Term ${term.termNumber}` : 'All time'

  const quickActions = [
    { label: 'Assign program', icon: ClipboardList, cls: 'bg-teal-50 text-teal-700', run: () => setTab('programs') },
    { label: 'Record lesson', icon: Mic, cls: 'bg-amber-50 text-amber-700', run: () => navigate('/app/record') },
    { label: 'Add note', icon: StickyNote, cls: 'bg-violet-50 text-violet-700', run: () => setTab('notes') },
    { label: 'View data', icon: BarChart3, cls: 'bg-sky-50 text-sky-700', run: () => navigate('/app/reports') },
  ]

  const recordedLessonIds = new Set(
    timeline ? classEntries.filter((e) => e.programId === timeline.programId && e.lessonId).map((e) => e.lessonId) : [],
  )
  const nextLessonIdx = timeline ? timeline.lessons.findIndex((l) => !recordedLessonIds.has(l.id)) : -1

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
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
              {schedule.length > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">
                  <CalendarClock size={12} /> {schedule.join(' · ')}
                </span>
              )}
              {sharedClass && sharedClass.memberUids.length > 1 && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  <Users size={12} /> Shared with {sharedClass.memberUids.length - 1} teacher
                  {sharedClass.memberUids.length - 1 === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShare(true)} className="btn-ghost text-sm">
            <Share2 size={15} /> {cls.sharedClassId ? 'Sharing' : 'Share'}
          </button>
          <button onClick={() => setShowSettings(true)} className="btn-navy text-sm">
            <SettingsIcon size={15} /> Class settings
          </button>
          <button
            onClick={remove}
            className="btn border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
            aria-label="Delete class"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-8 flex gap-6 overflow-x-auto border-b border-navy-100">
        {(
          [
            { value: 'overview', label: 'Overview' },
            { value: 'programs', label: 'Programs' },
            { value: 'notes', label: 'Notes' },
          ] as { value: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
              tab === t.value ? 'border-teal-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-700'
            }`}
          >
            {t.label}
          </button>
        ))}
        {SOON_TABS.map((label) => (
          <button
            key={label}
            type="button"
            title="Coming soon"
            className="-mb-px flex cursor-default items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent pb-3 text-sm font-semibold text-navy-300"
          >
            {label}
            <span className="rounded-full bg-navy-100 px-1.5 py-0.5 text-[10px] font-bold text-navy-500">Soon</span>
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          {/* left column */}
          <div className="space-y-6">
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Current program</h2>
                {currentProgram && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                    ACTIVE
                  </span>
                )}
              </div>
              {currentProgram ? (
                <>
                  <div className="mt-4 flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <BookOpen size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-navy-900">{currentProgram.name}</p>
                      <p className="mt-0.5 text-sm text-navy-500">
                        {[currentProgram.stage, (currentProgram.term ?? 0) >= 1 ? `Term ${currentProgram.term}` : '']
                          .filter(Boolean)
                          .join(' · ') || currentProgram.subject}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-navy-500">
                      <span>Progress</span>
                      <span>{progressOf(currentProgram)}%</span>
                    </div>
                    <ProgressBar pct={progressOf(currentProgram)} />
                  </div>
                  <Link to={`/app/programs/${currentProgram.id}`} className="btn-ghost mt-4 text-sm">
                    View program
                  </Link>
                  {assigned.length > 1 && (
                    <div className="mt-5 border-t border-navy-100 pt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Also assigned</p>
                      <div className="mt-2 space-y-2">
                        {assigned
                          .filter((p) => p.id !== currentProgram.id)
                          .map((p) => (
                            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-navy-100 p-3">
                              <BookOpen size={16} className="shrink-0 text-teal-600" />
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-800">{p.name}</p>
                              <span className="text-xs font-semibold text-navy-400">{progressOf(p)}%</span>
                              <Link
                                to={`/app/programs/${p.id}`}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700"
                              >
                                View
                              </Link>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-navy-500">
                    No program is assigned to this class yet. Assign one so recorded lessons are matched against it.
                  </p>
                  <button onClick={() => setTab('programs')} className="btn-primary mt-4 text-sm">
                    <Plus size={15} /> Assign a program
                  </button>
                </div>
              )}
            </section>

            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Curriculum</h2>
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold text-navy-500">Soon</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-300">
                  <FileText size={20} />
                </span>
                <p className="text-sm text-navy-400">
                  Link the official syllabus this class follows — coming soon.
                </p>
              </div>
            </section>

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
                  <dt className="text-xs font-semibold text-navy-400">Schedule</dt>
                  <dd className="mt-0.5 text-sm font-bold text-navy-900">
                    {schedule.length ? schedule.join(', ') : 'Not on your timetable'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          {/* right column */}
          <div className="space-y-6">
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Analytics</h2>
                <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-bold text-navy-500">{termLabel}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatTile label="Lessons recorded" value={String(stats.recorded)} sub={termLabel} />
                <StatTile
                  label="Programs covered"
                  value={stats.coverage === null ? '—' : `${stats.coverage}%`}
                  sub={assigned.length ? `${assigned.length} assigned` : 'No program assigned'}
                />
                <StatTile label="Outcomes addressed" value={String(stats.outcomes)} sub="Distinct outcomes" />
                <StatTile label="Reflections added" value={String(stats.reflections)} sub={termLabel} />
              </div>
            </section>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Learning timeline</h2>
              {timeline && currentProgram ? (
                <ol className="mt-4 space-y-1.5">
                  {timeline.lessons.slice(0, 10).map((l, i) => {
                    const done = recordedLessonIds.has(l.id)
                    const next = !done && i === nextLessonIdx
                    return (
                      <li key={l.id ?? i} className="flex items-center gap-2.5 py-1">
                        {done ? (
                          <CheckCircle2 size={17} className="shrink-0 text-emerald-500" />
                        ) : next ? (
                          <CircleDot size={17} className="shrink-0 text-sky-500" />
                        ) : (
                          <Circle size={17} className="shrink-0 text-navy-200" />
                        )}
                        <span
                          className={`truncate text-sm ${done ? 'text-navy-400' : next ? 'font-bold text-navy-900' : 'text-navy-600'}`}
                        >
                          {l.title || `${unitLabel(currentProgram.structure).one} ${i + 1}`}
                        </span>
                      </li>
                    )
                  })}
                  {timeline.lessons.length > 10 && (
                    <li>
                      <Link
                        to={`/app/programs/${timeline.programId}`}
                        className="text-xs font-bold text-teal-600 hover:text-teal-700"
                      >
                        +{timeline.lessons.length - 10} more — view the full program
                      </Link>
                    </li>
                  )}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-navy-400">
                  Assign a program to see its {unitLabel().many} tracked off here as you record them.
                </p>
              )}
            </section>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Quick actions</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.run}
                    className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-xs font-bold transition-transform hover:-translate-y-0.5 ${a.cls}`}
                  >
                    <a.icon size={20} />
                    {a.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'programs' && (
        <div className="mt-6">
          <p className="text-sm text-navy-500">
            Choose the program{programs.length === 1 ? '' : 's'} this class follows. Recorded lessons for{' '}
            <b>{cls.name}</b> are matched against its assigned programs.
          </p>
          {programs.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-navy-200 bg-white p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <BookOpen size={24} />
              </span>
              <h3 className="mt-4 text-base font-bold text-navy-900">No programs yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">
                Upload a teaching program first, then assign it to this class.
              </p>
              <Link to="/app/programs" className="btn-primary mx-auto mt-5 inline-flex text-sm">
                <Plus size={15} /> Upload a program
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {programs.map((p) => {
                const isAssigned = !!p.id && assignedIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 transition-colors ${
                      isAssigned ? 'border-teal-200' : 'border-navy-100'
                    }`}
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
                        <span className="text-[11px] font-semibold text-navy-400">
                          {p.lessonCount} {unitLabel(p.structure).many}
                        </span>
                      </div>
                      {isAssigned && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="w-40">
                            <ProgressBar pct={progressOf(p)} />
                          </div>
                          <span className="text-xs font-semibold text-navy-500">{progressOf(p)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link to={`/app/programs/${p.id}`} className="text-xs font-bold text-teal-600 hover:text-teal-700">
                        View
                      </Link>
                      <button
                        onClick={() => toggleProgram(p)}
                        disabled={togglingId === p.id}
                        className={
                          isAssigned
                            ? 'btn bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600'
                            : 'btn-ghost px-4 py-2 text-sm'
                        }
                      >
                        {togglingId === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isAssigned ? (
                          <Check size={14} />
                        ) : (
                          <Plus size={14} />
                        )}
                        {isAssigned ? 'Assigned' : 'Assign'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="mt-6">
          <section className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Class notes</h2>
            <p className="mt-1 text-sm text-navy-500">
              Anything worth remembering about this class — seating, groupings, adjustments, reminders.
            </p>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="mt-4 min-h-[220px] w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
              placeholder={`Notes about ${cls.name}…`}
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              {noteSaved && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <Check size={13} /> Saved
                </span>
              )}
              <button
                onClick={saveNotes}
                disabled={noteSaving || noteDraft === (cls.notes ?? '')}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {noteSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save notes
              </button>
            </div>
          </section>
        </div>
      )}

      {showSettings && (
        <ClassEditor existing={cls} onClose={() => setShowSettings(false)} onSaved={() => setShowSettings(false)} />
      )}

      {showShare && (
        <ShareClassModal
          cls={cls}
          sharedClass={sharedClass}
          assignedPrograms={assigned}
          onClose={() => setShowShare(false)}
        />
      )}
    </main>
  )
}
