import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Megaphone,
  Send,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Minus,
  Users,
  BookOpen,
  CalendarClock,
  Mic,
  RefreshCw,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { isAdmin } from '../lib/admin'
import {
  subscribeAnnouncements,
  createAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  type Announcement,
  type AnnouncementType,
} from '../lib/announcements'
import { getUsageStats, type UsageStats } from '../lib/adminStats'
import { PLAN_LABELS, type Plan } from '../lib/profile'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Compact, comma-free date so it never wraps in a narrow column (e.g. "3 Jul 26").
const fmtDate = (d: Date | null) =>
  d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}` : '—'

// Short plan labels for the table badge; full label shown on hover.
const SHORT_PLAN: Record<Plan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  school: 'School',
  perpetual: 'Founding',
}

const TYPES: { value: AnnouncementType; label: string }[] = [
  { value: 'update', label: 'Product update' },
  { value: 'info', label: 'Information' },
  { value: 'maintenance', label: 'Maintenance' },
]

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

export default function Admin() {
  const { user, startImpersonation } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const viewAs = (u: { uid: string; displayName: string | null; email: string | null }) => {
    startImpersonation(u.uid, u.displayName || u.email || 'user')
    navigate('/app')
  }
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<AnnouncementType>('update')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [tab, setTab] = useState<'notify' | 'usage'>('notify')
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState('')

  useEffect(() => subscribeAnnouncements(setItems), [])

  const loadUsage = () => {
    setUsageLoading(true)
    setUsageError('')
    getUsageStats()
      .then(setUsage)
      .catch((e) => setUsageError(e instanceof Error ? e.message : 'Could not load usage data.'))
      .finally(() => setUsageLoading(false))
  }

  // Load usage the first time the tab is opened.
  useEffect(() => {
    if (tab === 'usage' && !usage && !usageLoading) loadUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  if (!isAdmin(user)) return <Navigate to="/app" replace />

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Add a title and a message.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        type,
        active: true,
        createdByEmail: user?.email ?? '',
      })
      setTitle('')
      setBody('')
      setType('update')
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish. Check your permissions.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: Announcement) => {
    if (!a.id) return
    const ok = await confirm({
      title: 'Delete this announcement?',
      message: 'It will be removed for everyone.',
      confirmLabel: 'Delete',
    })
    if (ok) await deleteAnnouncement(a.id)
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
        <Megaphone size={15} /> Admin
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
        {tab === 'notify' ? 'Send a notification' : 'App usage'}
      </h1>
      <p className="mt-1 text-navy-500">
        {tab === 'notify'
          ? 'Published announcements appear in every user’s notification bell.'
          : 'Adoption across all daywise accounts.'}
      </p>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-xl bg-navy-50 p-1">
        {([
          { id: 'notify', label: 'Notifications', icon: Megaphone },
          { id: 'usage', label: 'App usage', icon: BarChart3 },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'notify' && (
      <>
      {/* Composer */}
      <div className="mt-6 space-y-4 rounded-2xl border border-navy-100 bg-white p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-navy-800">Title</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New: planning notes on your diary"
            maxLength={80}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Message</span>
            <textarea
              className={inputCls + ' resize-y'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="What would you like your teachers to know?"
              maxLength={600}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Type</span>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as AnnouncementType)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {done && (
            <span className="flex items-center gap-1 text-sm font-semibold text-teal-600">
              <Check size={15} /> Published
            </span>
          )}
          <button onClick={publish} disabled={busy} className="btn-primary text-sm">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />} Publish to all users
          </button>
        </div>
      </div>

      {/* Existing */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-navy-400">Published</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy-200 bg-white p-6 text-center text-sm text-navy-500">
            No announcements yet.
          </p>
        ) : (
          items.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                a.active ? 'border-navy-100 bg-white' : 'border-navy-100 bg-cloud/50 opacity-70'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-navy-900">{a.title}</p>
                  <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase text-navy-500">
                    {a.type}
                  </span>
                  {!a.active && (
                    <span className="rounded-md bg-navy-100 px-2 py-0.5 text-[10px] font-bold uppercase text-navy-500">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-navy-600">{a.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => a.id && setAnnouncementActive(a.id, !a.active)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                  title={a.active ? 'Hide from users' : 'Show to users'}
                >
                  {a.active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => remove(a)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-red-50 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}

      {tab === 'usage' && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-navy-400">
              {usage ? `${usage.totals.users} account${usage.totals.users === 1 ? '' : 's'}` : ' '}
            </p>
            <button
              onClick={loadUsage}
              disabled={usageLoading}
              className="flex items-center gap-1.5 rounded-full border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-60"
            >
              <RefreshCw size={13} className={usageLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {usageError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {usageError}
            </div>
          )}

          {usageLoading && !usage ? (
            <div className="flex items-center gap-3 py-10 text-navy-400">
              <Loader2 size={18} className="animate-spin" /> Loading usage data…
            </div>
          ) : usage ? (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total users', value: usage.totals.users, icon: Users, color: 'text-navy-700 bg-navy-50' },
                  { label: 'With a program', value: usage.totals.withProgram, icon: BookOpen, color: 'text-teal-700 bg-teal-50' },
                  { label: 'With a timetable', value: usage.totals.withTimetable, icon: CalendarClock, color: 'text-sky-700 bg-sky-50' },
                  { label: 'Lessons recorded', value: usage.totals.lessons, icon: Mic, color: 'text-amber-700 bg-amber-50' },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-navy-100 bg-white p-4">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                      <s.icon size={17} />
                    </span>
                    <p className="mt-3 text-2xl font-extrabold text-navy-900">{s.value}</p>
                    <p className="text-xs font-semibold text-navy-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Per-user table */}
              <div className="mt-6 overflow-x-auto rounded-2xl border border-navy-100 bg-white">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_th]:px-4 [&_th]:py-3">
                  <thead>
                    <tr className="border-b border-navy-100 bg-cloud/40 text-[11px] font-bold uppercase tracking-wide text-navy-400">
                      <th className="text-left">User</th>
                      <th className="text-left">Plan</th>
                      <th className="text-left">School / State</th>
                      <th className="whitespace-nowrap text-left">Joined</th>
                      <th className="whitespace-nowrap text-left">Last active</th>
                      <th className="text-center">Program</th>
                      <th className="text-center">Timetable</th>
                      <th className="text-right">Lessons</th>
                      <th className="text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.users.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-navy-400">
                          No users yet.
                        </td>
                      </tr>
                    ) : (
                      usage.users.map((u) => (
                        <tr key={u.uid} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/40">
                          <td>
                            <p className="font-semibold text-navy-900">{u.displayName || '—'}</p>
                            <p className="text-xs text-navy-400">{u.email || u.uid}</p>
                          </td>
                          <td>
                            <span
                              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                u.plan === 'perpetual' ? 'bg-amber-50 text-amber-700' : 'bg-navy-50 text-navy-600'
                              }`}
                              title={u.plan ? PLAN_LABELS[u.plan as Plan] ?? u.plan : 'Starter'}
                            >
                              {u.plan ? SHORT_PLAN[u.plan as Plan] ?? u.plan : 'Starter'}
                            </span>
                          </td>
                          <td className="text-navy-600">
                            {u.school || u.state ? (
                              <div className="flex items-center gap-1.5">
                                <span className="max-w-[150px] truncate" title={u.school || ''}>
                                  {u.school || '—'}
                                </span>
                                {u.state && (
                                  <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                                    {u.state}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-navy-300">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap text-navy-500">{fmtDate(u.createdAt)}</td>
                          <td className="whitespace-nowrap text-navy-500">{fmtDate(u.lastLoginAt)}</td>
                          <td className="text-center">
                            {u.hasProgram ? (
                              <Check size={16} className="mx-auto text-teal-600" strokeWidth={3} />
                            ) : (
                              <Minus size={16} className="mx-auto text-navy-200" />
                            )}
                          </td>
                          <td className="text-center">
                            {u.hasTimetable ? (
                              <Check size={16} className="mx-auto text-teal-600" strokeWidth={3} />
                            ) : (
                              <Minus size={16} className="mx-auto text-navy-200" />
                            )}
                          </td>
                          <td className="text-right font-bold text-navy-900">{u.lessonCount}</td>
                          <td className="text-right">
                            <button
                              onClick={() => viewAs(u)}
                              className="whitespace-nowrap rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50"
                            >
                              View as
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </main>
  )
}
