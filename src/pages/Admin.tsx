import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Megaphone,
  Send,
  Loader2,
  Trash2,
  Edit2,
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
  ShieldCheck,
  Award,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import LineChart, { CHART_COLORS } from '../components/LineChart'
import { isAdmin } from '../lib/admin'
import {
  subscribeAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  type Announcement,
  type AnnouncementType,
} from '../lib/announcements'
import { getUsageStats, type UsageStats } from '../lib/adminStats'
import { PLAN_LABELS, type Plan } from '../lib/profile'
import { BADGES, CATEGORY_LABELS, CATEGORY_ORDER, getManualBadges, grantBadge } from '../lib/achievements'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Compact, comma-free date so it never wraps in a narrow column (e.g. "3 Jul 26").
const fmtDate = (d: Date | null) =>
  d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}` : '—'

/** yyyy-mm-dd → "3 Jul", for chart axis ticks. */
const shortDay = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

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

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Megaphone },
] as const

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

/* ---------- small building blocks (mirrors the Settings page) ---------- */

function SectionCard({
  id,
  icon: Icon,
  title,
  desc,
  action,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  desc: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="card p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Icon size={19} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-navy-900">{title}</h2>
              <p className="text-sm text-navy-500">{desc}</p>
            </div>
          </div>
          {action}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}

/**
 * Week-on-week change. The arrow and the "vs last week" wording carry the
 * direction on their own — colour only reinforces it, never states it.
 */
function Delta({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined || (previous === 0 && current === 0)) return null
  const diff = current - previous
  const pct = previous === 0 ? null : Math.round((diff / previous) * 100)
  const up = diff > 0
  const flat = diff === 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`flex flex-wrap items-center gap-x-1 text-[11px] font-bold leading-tight ${
        flat ? 'text-navy-400' : up ? 'text-emerald-700' : 'text-red-600'
      }`}
    >
      {!flat && <Icon size={12} strokeWidth={3} />}
      {flat ? 'No change' : `${up ? '+' : ''}${pct === null ? diff : `${pct}%`}`}
      <span className="font-semibold text-navy-400">vs last week</span>
    </span>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  delta,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone: string
  delta?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={17} />
      </span>
      <p className="mt-3 text-2xl font-extrabold text-navy-900">{value}</p>
      <p className="text-xs font-semibold text-navy-400">{label}</p>
      {delta && <p className="mt-1.5">{delta}</p>}
    </div>
  )
}

function ChartCard({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    // min-w-0 for the same reason as the page grid: the chart's svg carries an
    // explicit pixel width, which would otherwise hold its grid track open and
    // stop the chart ever measuring smaller than its widest past render.
    <div className="min-w-0 rounded-2xl border border-navy-100 bg-white p-4 sm:p-5">
      <p className="text-sm font-bold text-navy-900">{title}</p>
      <p className="mb-3 text-xs text-navy-400">{desc}</p>
      {children}
    </div>
  )
}

/* ---------- page ---------- */

export default function Admin() {
  const { user, startImpersonation } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const viewAs = (u: { uid: string; displayName: string | null; email: string | null }) => {
    startImpersonation(u.uid, u.displayName || u.email || 'user')
    navigate('/app')
  }

  // Click-and-drag horizontal scrolling for the usage table.
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false })
  const onDragStart = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    drag.current = { down: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false }
  }
  const onDragMove = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el || !drag.current.down) return
    const dx = e.pageX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.scrollLeft - dx
  }
  const onDragEnd = () => {
    drag.current.down = false
  }
  // Swallow the click that ends a drag so buttons/links don't fire.
  const onDragClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  // Grant achievement badges to a user
  const [badgeUser, setBadgeUser] = useState<{ uid: string; name: string } | null>(null)
  const [grantedIds, setGrantedIds] = useState<string[]>([])
  const [grantingId, setGrantingId] = useState<string | null>(null)

  const openBadges = async (u: { uid: string; displayName: string | null; email: string | null }) => {
    setBadgeUser({ uid: u.uid, name: u.displayName || u.email || 'user' })
    setGrantedIds([])
    setGrantedIds(await getManualBadges(u.uid))
  }
  const grant = async (badgeId: string) => {
    if (!badgeUser) return
    setGrantingId(badgeId)
    try {
      await grantBadge(badgeUser.uid, badgeId)
      setGrantedIds((prev) => (prev.includes(badgeId) ? prev : [...prev, badgeId]))
    } finally {
      setGrantingId(null)
    }
  }

  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<AnnouncementType>('update')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editType, setEditType] = useState<AnnouncementType>('update')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)
  const [usageError, setUsageError] = useState('')
  const [range, setRange] = useState<number>(90)
  const [active, setActive] = useState<string>('overview')

  useEffect(() => subscribeAnnouncements(setItems), [])

  const loadUsage = () => {
    setUsageLoading(true)
    setUsageError('')
    getUsageStats()
      .then(setUsage)
      .catch((e) => setUsageError(e instanceof Error ? e.message : 'Could not load usage data.'))
      .finally(() => setUsageLoading(false))
  }

  // Everything on this page except the announcement list is derived from one
  // aggregate read, so it's loaded once up front rather than per section.
  useEffect(loadUsage, [])

  // Highlight the nav entry for whichever section is nearest the top of the viewport.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e)
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (first) setActive(first.target.id)
      },
      { rootMargin: '-96px 0px -55% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [usage, usageLoading])

  /* ---- chart data, scoped to the selected range ---- */

  const charts = useMemo(() => {
    if (!usage) return null
    const daily = usage.daily.slice(-range)
    const weekly = usage.weekly.slice(-Math.ceil(range / 7))
    const week = weekly[weekly.length - 1]
    const prevWeek = weekly[weekly.length - 2]
    return {
      daily,
      weekly,
      dayLabels: daily.map((p) => shortDay(p.date)),
      weekLabels: weekly.map((p) => p.label),
      week,
      prevWeek,
    }
  }, [usage, range])

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

  const openEdit = (a: Announcement) => {
    if (!a.id) return
    setEditingId(a.id)
    setEditTitle(a.title)
    setEditBody(a.body)
    setEditType(a.type)
    setEditError('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    if (!editTitle.trim() || !editBody.trim()) {
      setEditError('Add a title and a message.')
      return
    }
    setEditBusy(true)
    setEditError('')
    try {
      await updateAnnouncement(editingId, {
        title: editTitle.trim(),
        body: editBody.trim(),
        type: editType,
      })
      setEditingId(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Could not save. Check your permissions.')
    } finally {
      setEditBusy(false)
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

  const loadingBlock = (
    <div className="flex items-center gap-3 py-8 text-navy-400">
      <Loader2 size={18} className="animate-spin" /> Loading usage data…
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
          <ShieldCheck size={15} /> Admin
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Admin</h1>
        <p className="mt-1 text-navy-500">Adoption, growth and broadcast messaging across all daywise accounts.</p>
      </div>

      {usageError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {usageError}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* section nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={active === s.id ? 'true' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  active === s.id
                    ? 'bg-white text-navy-900 shadow-soft'
                    : 'text-navy-600 hover:bg-white hover:text-navy-900'
                }`}
              >
                <s.icon size={16} /> {s.label}
              </a>
            ))}
            <button
              onClick={loadUsage}
              disabled={usageLoading}
              className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-navy-400 hover:text-navy-700 disabled:opacity-60"
            >
              <RefreshCw size={15} className={usageLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </nav>

        {/* min-w-0: a grid item defaults to min-width:auto, so without this the
            880px-wide users table stretches the 1fr track and the whole page
            scrolls sideways instead of the table scrolling inside its own box. */}
        <div className="min-w-0 space-y-6">
          {/* OVERVIEW */}
          <SectionCard
            id="overview"
            icon={BarChart3}
            title="Overview"
            desc="Where daywise stands right now."
            action={
              <button
                onClick={loadUsage}
                disabled={usageLoading}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-60 lg:hidden"
              >
                <RefreshCw size={13} className={usageLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            }
          >
            {usageLoading && !usage ? (
              loadingBlock
            ) : usage && charts ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    label="Total accounts"
                    value={usage.totals.users}
                    icon={Users}
                    tone="text-navy-700 bg-navy-50"
                    delta={<Delta current={charts.week?.totalUsers ?? 0} previous={charts.prevWeek?.totalUsers} />}
                  />
                  <StatTile
                    label="Weekly active users"
                    value={usage.totals.activeWeek}
                    icon={Activity}
                    tone="text-teal-700 bg-teal-50"
                    delta={<Delta current={charts.week?.activeUsers ?? 0} previous={charts.prevWeek?.activeUsers} />}
                  />
                  <StatTile
                    label="New accounts this week"
                    value={charts.week?.signups ?? 0}
                    icon={UserPlus}
                    tone="text-sky-700 bg-sky-50"
                    delta={<Delta current={charts.week?.signups ?? 0} previous={charts.prevWeek?.signups} />}
                  />
                  <StatTile
                    label="Lessons this week"
                    value={charts.week?.lessons ?? 0}
                    icon={Mic}
                    tone="text-amber-700 bg-amber-50"
                    delta={<Delta current={charts.week?.lessons ?? 0} previous={charts.prevWeek?.lessons} />}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Active today" value={usage.totals.activeToday} icon={Activity} tone="text-teal-700 bg-teal-50" />
                  <StatTile label="With a program" value={usage.totals.withProgram} icon={BookOpen} tone="text-navy-700 bg-navy-50" />
                  <StatTile label="With a timetable" value={usage.totals.withTimetable} icon={CalendarClock} tone="text-sky-700 bg-sky-50" />
                  <StatTile label="Lessons all time" value={usage.totals.lessons} icon={Mic} tone="text-amber-700 bg-amber-50" />
                </div>

                <p className="mt-3 text-xs text-navy-400">
                  “This week” is the current Monday-to-date week, so it is still filling — the comparison is against the
                  same measure for the whole of last week.
                </p>
              </>
            ) : null}
          </SectionCard>

          {/* GROWTH */}
          <SectionCard id="growth" icon={TrendingUp} title="Growth" desc="Usage and adoption over time.">
            {usageLoading && !usage ? (
              loadingBlock
            ) : charts ? (
              <>
                {/* One filter row, scoping every chart below it. */}
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs font-semibold text-navy-400">Range</span>
                  <div className="flex gap-1 rounded-xl bg-navy-50 p-1">
                    {RANGES.map((r) => (
                      <button
                        key={r.days}
                        onClick={() => setRange(r.days)}
                        aria-pressed={range === r.days}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          range === r.days ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-700'
                        }`}
                      >
                        Last {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`space-y-4 transition-opacity ${usageLoading ? 'opacity-50' : ''}`}>
                  <ChartCard
                    title="Daily active users"
                    desc="Distinct accounts that opened daywise or recorded a lesson that day."
                  >
                    <LineChart
                      title="Daily active users"
                      labels={charts.dayLabels}
                      area
                      series={[
                        {
                          label: 'Daily active users',
                          color: CHART_COLORS[0],
                          values: charts.daily.map((p) => p.activeUsers),
                        },
                      ]}
                      height={210}
                    />
                  </ChartCard>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ChartCard
                      title="Weekly active users"
                      desc="Distinct accounts active in each week, by week commencing."
                    >
                      <LineChart
                        title="Weekly active users by week commencing"
                        labels={charts.weekLabels}
                        area
                        series={[
                          {
                            label: 'Weekly active users',
                            color: CHART_COLORS[0],
                            values: charts.weekly.map((p) => p.activeUsers),
                          },
                        ]}
                      />
                    </ChartCard>

                    <ChartCard title="New accounts each week" desc="Sign-ups by week commencing.">
                      <LineChart
                        title="New accounts by week commencing"
                        labels={charts.weekLabels}
                        area
                        series={[
                          { label: 'New accounts', color: CHART_COLORS[1], values: charts.weekly.map((p) => p.signups) },
                        ]}
                      />
                    </ChartCard>

                    <ChartCard title="Lessons recorded each week" desc="Diary entries created, by week commencing.">
                      <LineChart
                        title="Lessons recorded by week commencing"
                        labels={charts.weekLabels}
                        area
                        series={[
                          { label: 'Lessons', color: CHART_COLORS[2], values: charts.weekly.map((p) => p.lessons) },
                        ]}
                      />
                    </ChartCard>

                    <ChartCard title="Total accounts" desc="Cumulative accounts on the platform.">
                      <LineChart
                        title="Total accounts over time"
                        labels={charts.dayLabels}
                        area
                        series={[
                          {
                            label: 'Total accounts',
                            color: CHART_COLORS[1],
                            values: charts.daily.map((p) => p.totalUsers),
                          },
                        ]}
                      />
                    </ChartCard>
                  </div>
                </div>

                <p className="mt-3 text-xs text-navy-400">
                  Active-day tracking began when this dashboard shipped; earlier days are reconstructed from recorded
                  lessons and last sign-in, so history before then understates real visits.
                </p>
              </>
            ) : null}
          </SectionCard>

          {/* USERS */}
          <SectionCard
            id="users"
            icon={Users}
            title="Users"
            desc={usage ? `${usage.totals.users} account${usage.totals.users === 1 ? '' : 's'}.` : 'All daywise accounts.'}
          >
            {usageLoading && !usage ? (
              loadingBlock
            ) : usage ? (
              <div
                ref={scrollRef}
                onMouseDown={onDragStart}
                onMouseMove={onDragMove}
                onMouseUp={onDragEnd}
                onMouseLeave={onDragEnd}
                onClickCapture={onDragClickCapture}
                className="cursor-grab select-none overflow-x-auto rounded-2xl border border-navy-100 bg-white active:cursor-grabbing"
              >
                <table className="w-full min-w-[880px] border-collapse text-left text-sm [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_th]:px-4 [&_th]:py-3">
                  <thead>
                    <tr className="border-b border-navy-100 bg-cloud/40 text-[11px] font-bold uppercase tracking-wide text-navy-400">
                      <th className="sticky left-0 z-20 border-r border-navy-100 bg-white text-left">User</th>
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
                          <td className="sticky left-0 z-10 border-r border-navy-100 bg-white">
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
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openBadges(u)}
                                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50"
                                title="Grant achievement badges"
                              >
                                <Award size={13} /> Badges
                              </button>
                              <button
                                onClick={() => viewAs(u)}
                                className="whitespace-nowrap rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50"
                              >
                                View as
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          {/* NOTIFICATIONS */}
          <SectionCard
            id="notifications"
            icon={Megaphone}
            title="Notifications"
            desc="Published announcements appear in every user’s notification bell."
          >
            <div className="space-y-4">
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

            <h3 className="mt-8 text-xs font-bold uppercase tracking-wide text-navy-400">Published</h3>
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
                        onClick={() => openEdit(a)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                        title="Edit"
                      >
                        <Edit2 size={15} />
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
          </SectionCard>
        </div>
      </div>

      {/* Grant badges modal */}
      {badgeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setBadgeUser(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-card">
            <div className="flex items-start justify-between gap-3 border-b border-navy-100 p-5">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-navy-900">
                  <Award size={18} className="text-amber-500" /> Grant badges
                </h3>
                <p className="mt-0.5 text-sm text-navy-500">
                  Award achievement badges to <b>{badgeUser.name}</b>. Grants are additive and can’t be removed here.
                </p>
              </div>
              <button
                onClick={() => setBadgeUser(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="space-y-5">
                {CATEGORY_ORDER.map((cat) => (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">{CATEGORY_LABELS[cat].title}</p>
                    <div className="space-y-1.5">
                      {BADGES.filter((b) => b.category === cat).map((b) => {
                        const isGranted = grantedIds.includes(b.id)
                        return (
                          <div key={b.id} className="flex items-center gap-3 rounded-xl border border-navy-100 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-navy-900">{b.title}</p>
                              <p className="truncate text-xs text-navy-400">{b.description}</p>
                            </div>
                            {isGranted ? (
                              <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-600">
                                <Check size={13} /> Granted
                              </span>
                            ) : (
                              <button
                                onClick={() => grant(b.id)}
                                disabled={grantingId === b.id}
                                className="shrink-0 rounded-full bg-teal-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-60"
                              >
                                {grantingId === b.id ? <Loader2 size={13} className="animate-spin" /> : 'Grant'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-navy-100 p-4 text-right">
              <button onClick={() => setBadgeUser(null)} className="btn-primary text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setEditingId(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-card">
            <div className="flex items-start justify-between gap-3 border-b border-navy-100 p-5">
              <h3 className="text-lg font-bold text-navy-900">Edit announcement</h3>
              <button
                onClick={() => setEditingId(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-navy-800">Title</span>
                <input
                  className={inputCls}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. New: planning notes on your diary"
                  maxLength={80}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-navy-800">Message</span>
                  <textarea
                    className={inputCls + ' resize-y'}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    placeholder="What would you like your teachers to know?"
                    maxLength={800}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-navy-800">Type</span>
                  <select className={inputCls} value={editType} onChange={(e) => setEditType(e.target.value as AnnouncementType)}>
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {editError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> {editError}
                </div>
              )}
            </div>
            <div className="border-t border-navy-100 p-4 text-right">
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setEditingId(null)} className="rounded-full border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-600 hover:bg-navy-50">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={editBusy} className="btn-primary text-sm">
                  {editBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={15} />} Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
