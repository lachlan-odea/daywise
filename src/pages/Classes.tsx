import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Check, ChevronRight, Loader2, Mail, Plus, School, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
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
import {
  acceptInvite,
  declineInvite,
  subscribeMyInvites,
  subscribeSharedWithMe,
  unshareClass,
  type ClassInvite,
  type SharedClass,
} from '../lib/sharedClasses'
import { subscribeTimetable, type Timetable } from '../lib/timetable'
import ClassIconTile from '../components/ClassIcon'
import ClassEditor from '../components/ClassEditor'

export default function Classes() {
  const { user, effectiveUid } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [tab, setTab] = useState<'mine' | 'shared'>('mine')
  const [classes, setClasses] = useState<ClassInfo[] | null>(null)
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [editor, setEditor] = useState<{ prefill?: Partial<ClassInfo> } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [invites, setInvites] = useState<ClassInvite[]>([])
  const [sharedWithMe, setSharedWithMe] = useState<SharedClass[] | null>(null)
  const [inviteBusy, setInviteBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeClasses(effectiveUid, setClasses)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(effectiveUid, setTimetable)
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsubs = [
      subscribeMyInvites(user.email ?? '', setInvites),
      subscribeSharedWithMe(effectiveUid, (all) => setSharedWithMe(all.filter((sc) => sc.ownerUid !== effectiveUid))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [user])

  const myName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Teacher'

  const accept = async (inv: ClassInvite) => {
    if (!user || !inv.id) return
    setInviteBusy(inv.id)
    try {
      await acceptInvite(inv, user.uid, myName)
      navigate(`/app/shared/${inv.classId}`)
    } finally {
      setInviteBusy(null)
    }
  }

  const decline = async (inv: ClassInvite) => {
    if (!inv.id) return
    setInviteBusy(inv.id)
    try {
      await declineInvite(inv)
    } finally {
      setInviteBusy(null)
    }
  }

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
      message: c.sharedClassId
        ? 'This removes the class page and stops sharing it — everyone you shared it with loses access. Your timetable, diary entries and programs are not affected.'
        : 'This removes the class page. Your timetable, diary entries and programs are not affected.',
      confirmLabel: 'Delete class',
    })
    if (!ok) return
    setDeletingId(c.id)
    try {
      if (c.sharedClassId) await unshareClass(effectiveUid, c.id, c.sharedClassId)
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
        <button
          onClick={() => setTab('mine')}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tab === 'mine' ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
          }`}
        >
          My Classes
        </button>
        <button
          onClick={() => setTab('shared')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tab === 'shared' ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
          }`}
        >
          Shared with Me
          {invites.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === 'shared' ? 'bg-white/20 text-white' : 'bg-teal-500 text-white'
              }`}
            >
              {invites.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'shared' ? (
        <div className="mt-6 space-y-3">
          {invites.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-teal-200 bg-teal-50/50 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                <Mail size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-navy-900">{inv.classDisplayName}</p>
                <p className="mt-0.5 truncate text-sm text-navy-500">
                  {inv.ownerName} invited you to this {inv.subject || 'class'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => decline(inv)} disabled={inviteBusy === inv.id} className="btn-ghost px-4 py-2 text-sm">
                  <X size={14} /> Decline
                </button>
                <button onClick={() => accept(inv)} disabled={inviteBusy === inv.id} className="btn-primary px-4 py-2 text-sm">
                  {inviteBusy === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
                </button>
              </div>
            </div>
          ))}

          {sharedWithMe === null ? (
            <div className="mt-4 flex items-center gap-3 text-navy-400">
              <Loader2 size={18} className="animate-spin" /> Loading shared classes…
            </div>
          ) : sharedWithMe.length === 0 && invites.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-navy-200 bg-white p-10 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <Users size={28} />
              </span>
              <h2 className="mt-5 text-lg font-bold text-navy-900">Nothing shared with you yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">
                When another teacher shares a class with your email address
                {user?.email ? ` (${user.email})` : ''}, it will appear here.
              </p>
              {user && !user.emailVerified && (
                <p className="mx-auto mt-3 max-w-md text-xs text-amber-600">
                  Your email isn’t verified yet — invites can only be accepted from a verified address.
                </p>
              )}
            </div>
          ) : (
            sharedWithMe.map((sc) => (
              <div
                key={sc.id}
                className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-navy-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-card"
                onClick={() => navigate(`/app/shared/${sc.id}`)}
              >
                <ClassIconTile subject={sc.subject} icon={sc.icon} color={sc.color} size={48} iconSize={22} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-navy-900">{sc.name}</h3>
                  <p className="mt-0.5 truncate text-sm text-navy-500">
                    Shared by {sc.ownerName}
                    {sc.className ? ` · ${sc.className}` : ''}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  <Users size={12} /> {sc.memberUids.length}
                </span>
                <ChevronRight size={18} className="shrink-0 text-navy-300 transition-colors group-hover:text-teal-500" />
              </div>
            ))
          )}
        </div>
      ) : loading ? (
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

      {tab === 'mine' && !loading && suggestions.length > 0 && (
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
