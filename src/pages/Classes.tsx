import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, Loader2, Plus, School, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import {
  classInfoKey,
  classSchedule,
  deleteClass,
  subscribeClasses,
  timetableClasses,
  type ClassInfo,
} from '../lib/classes'
import { classKey } from '../lib/classPrograms'
import { subscribeTimetable, type Timetable } from '../lib/timetable'
import ClassIconTile from '../components/ClassIcon'
import ClassEditor from '../components/ClassEditor'

export default function Classes() {
  const { user, effectiveUid } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [classes, setClasses] = useState<ClassInfo[] | null>(null)
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [editor, setEditor] = useState<{ prefill?: Partial<ClassInfo> } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeClasses(effectiveUid, setClasses)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(effectiveUid, setTimetable)
  }, [user])

  // Timetable classes the teacher hasn't set up yet — offered as one-click suggestions.
  const suggestions = useMemo(() => {
    if (!classes) return []
    const existing = new Set(classes.map(classInfoKey))
    return timetableClasses(timetable).filter((s) => !existing.has(classKey(s.subject, s.className)))
  }, [classes, timetable])

  const remove = async (c: ClassInfo) => {
    if (!user || !c.id) return
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      message: 'This removes the class page. Your timetable, diary entries and programs are not affected.',
      confirmLabel: 'Delete class',
    })
    if (!ok) return
    setDeletingId(c.id)
    try {
      await deleteClass(effectiveUid, c.id)
    } finally {
      setDeletingId(null)
    }
  }

  const loading = classes === null

  const renderRow = (c: ClassInfo) => {
    const schedule = classSchedule(timetable, c.subject, c.className)
    return (
      <div
        key={c.id}
        className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-navy-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-card"
        onClick={() => navigate(`/app/classes/${c.id}`)}
      >
        <ClassIconTile subject={c.subject} icon={c.icon} color={c.color} size={48} iconSize={22} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-navy-900">{c.name}</h3>
          <p className="mt-0.5 truncate text-sm text-navy-500">
            {[c.className, c.yearGroup].filter(Boolean).join(' · ') || c.subject}
          </p>
        </div>
        {schedule.length > 0 && (
          <p className="hidden max-w-[180px] text-right text-sm font-medium text-navy-500 sm:block">
            {schedule.join(', ')}
          </p>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            remove(c)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label="Delete class"
        >
          {deletingId === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        </button>
        <ChevronRight size={18} className="shrink-0 text-navy-300 transition-colors group-hover:text-teal-500" />
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <School size={15} /> Classes
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">My Classes</h1>
          <p className="mt-1 text-navy-500">Select a class to view details, programs and analytics.</p>
        </div>
        {classes && classes.length > 0 && (
          <button onClick={() => setEditor({})} className="btn-primary text-sm">
            <Plus size={16} /> Create class
          </button>
        )}
      </div>

      <div className="mt-6 inline-flex rounded-full border border-navy-100 bg-white p-1">
        <button className="rounded-full bg-navy-800 px-3.5 py-1.5 text-sm font-semibold text-white">My Classes</button>
        <button
          type="button"
          title="Coming soon"
          className="flex cursor-default items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-navy-400"
        >
          Shared with Me
          <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold text-navy-500">Soon</span>
        </button>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your classes…
        </div>
      ) : classes.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-navy-200 bg-white p-10 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <School size={28} />
          </span>
          <h2 className="mt-5 text-lg font-bold text-navy-900">Set up your first class</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">
            Each class gets its own page with the programs it follows, its schedule, progress analytics and your
            notes — all in one place.
          </p>
          <button onClick={() => setEditor({})} className="btn-primary mx-auto mt-6 text-sm">
            <Plus size={16} /> Create class
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {classes.map(renderRow)}
          <button
            onClick={() => setEditor({})}
            className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-navy-200 bg-white p-5 text-left transition-colors hover:border-teal-300"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <Plus size={20} />
            </span>
            <span>
              <span className="block text-base font-bold text-teal-600">Add class</span>
              <span className="mt-0.5 block text-sm text-navy-500">Manually create another class that you teach.</span>
            </span>
          </button>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-navy-500">
              <CalendarClock size={14} /> On your timetable
            </h2>
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-400">
              {suggestions.length}
            </span>
            <span className="h-px flex-1 bg-navy-100" />
          </div>
          <p className="mt-2 text-sm text-navy-500">
            These classes appear on your timetable but don’t have a class page yet.
          </p>
          <div className="mt-3 space-y-2">
            {suggestions.map((s) => (
              <div
                key={classKey(s.subject, s.className)}
                className="flex items-center gap-4 rounded-2xl border border-navy-100 bg-white p-4"
              >
                <ClassIconTile subject={s.subject} color={s.color} size={40} iconSize={18} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900">
                    {[s.subject, s.className].filter(Boolean).join(' · ')}
                  </p>
                  <p className="truncate text-xs text-navy-500">
                    {classSchedule(timetable, s.subject, s.className).join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => setEditor({ prefill: { subject: s.subject, className: s.className, room: s.room, color: s.color } })}
                  className="btn-ghost shrink-0 px-4 py-2 text-sm"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {editor && (
        <ClassEditor
          prefill={editor.prefill}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null)
            navigate(`/app/classes/${id}`)
          }}
        />
      )}
    </main>
  )
}
