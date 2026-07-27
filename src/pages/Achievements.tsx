import { useEffect, useMemo, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import {
  Sprout, CalendarCheck, Target, CalendarCheck2, Trophy, Flame,
  BookOpen, CheckCircle2, Layers, FileText, Files, FolderOpen, BadgeCheck,
  Users, Handshake, Star, BarChart3, MessageSquare, Bug, Crown, Rocket,
  Award, Loader2, Lock, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { db } from '../lib/firebase'
import { getEntriesOnce, type LessonEntry } from '../lib/entries'
import { getProgramList, getProgram } from '../lib/programs'
import { subscribeTimetable, type Timetable } from '../lib/timetable'
import type { LoadedProgram } from '../lib/reports'
import {
  BADGES, CATEGORY_LABELS, CATEGORY_ORDER, computeStats, subscribeAchievementEvents,
  type AchievementEvents, type Badge, type BadgeCategory, type Stats,
} from '../lib/achievements'

const CAT_COLOR: Record<BadgeCategory, { grad: string; ring: string; text: string }> = {
  consistency: { grad: 'from-emerald-400 to-teal-500', ring: 'ring-teal-100', text: 'text-teal-600' },
  milestones: { grad: 'from-blue-400 to-indigo-500', ring: 'ring-indigo-100', text: 'text-indigo-600' },
  programs: { grad: 'from-emerald-400 to-green-600', ring: 'ring-emerald-100', text: 'text-emerald-600' },
  evidence: { grad: 'from-violet-400 to-purple-600', ring: 'ring-violet-100', text: 'text-violet-600' },
  community: { grad: 'from-orange-400 to-amber-500', ring: 'ring-orange-100', text: 'text-orange-600' },
  features: { grad: 'from-sky-400 to-blue-500', ring: 'ring-sky-100', text: 'text-sky-600' },
  special: { grad: 'from-amber-400 to-yellow-500', ring: 'ring-amber-100', text: 'text-amber-600' },
}

const ICONS: Record<string, LucideIcon> = {
  'first-lesson': Sprout, 'week-complete': CalendarCheck, 'perfect-month': Target,
  'perfect-term': CalendarCheck2, 'perfect-year': Trophy, 'streak-master': Flame,
  'program-started': BookOpen, 'program-completed': CheckCircle2, 'five-programs': Layers, 'outcome-expert': Target,
  'first-evidence': FileText, 'evidence-100': Files, 'evidence-500': FolderOpen, 'accreditation-ready': BadgeCheck,
  'team-teacher': Users, 'shared-contributor': Handshake, 'supported-teacher': Star,
  'first-report': FileText, 'data-explorer': BarChart3, 'feedback-champion': MessageSquare, 'bug-hunter': Bug,
  'founding-teacher': Crown, 'beta-pioneer': Rocket,
}
// Milestone badges show their number inside the medallion instead of an icon.
const MILESTONE_NUM: Record<string, string> = {
  'lessons-10': '10', 'lessons-50': '50', 'lessons-100': '100', 'lessons-250': '250', 'lessons-500': '500', 'lessons-1000': '1000',
}

function BadgeMedal({ badge, stats }: { badge: Badge; stats: Stats }) {
  const earned = badge.earned(stats)
  const color = CAT_COLOR[badge.category]
  const Icon = ICONS[badge.id] ?? Award
  const num = MILESTONE_NUM[badge.id]
  const pct = !earned && badge.progress ? Math.min(0.99, Math.max(0, badge.progress(stats))) : 0

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
          earned ? `bg-gradient-to-br ${color.grad} text-white shadow-md ring-4 ${color.ring}` : 'bg-navy-50 text-navy-300'
        }`}
      >
        {num ? (
          <span className={`text-lg font-extrabold ${num.length >= 4 ? 'text-sm' : ''}`}>{num}</span>
        ) : (
          <Icon size={26} strokeWidth={earned ? 2 : 1.8} />
        )}
        {!earned && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-navy-300 ring-1 ring-navy-100">
            <Lock size={11} />
          </span>
        )}
      </div>
      <p className={`mt-2 text-sm font-bold ${earned ? 'text-navy-900' : 'text-navy-400'}`}>{badge.title}</p>
      <p className="mt-0.5 text-xs leading-snug text-navy-400">{badge.description}</p>
      {!earned && pct > 0 && (
        <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-navy-100">
          <div className={`h-full rounded-full bg-gradient-to-r ${color.grad}`} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

export default function Achievements() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [programs, setPrograms] = useState<LoadedProgram[] | null>(null)
  const [tt, setTt] = useState<Timetable | null>(null)
  const [events, setEvents] = useState<AchievementEvents>({})
  const [feedbackCount, setFeedbackCount] = useState(0)

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(user.uid, setTt)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeAchievementEvents(user.uid, setEvents)
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [ents, list] = await Promise.all([getEntriesOnce(user.uid), getProgramList(user.uid)])
      const fulls = await Promise.all(list.map((p) => (p.id ? getProgram(user.uid, p.id) : null)))
      let fbCount = 0
      if (db) {
        try {
          fbCount = (await getCountFromServer(collection(db, 'users', user.uid, 'feedback'))).data().count
        } catch {
          fbCount = 0
        }
      }
      if (!active) return
      setEntries(ents)
      setPrograms(fulls.filter(Boolean) as LoadedProgram[])
      setFeedbackCount(fbCount)
    })()
    return () => {
      active = false
    }
  }, [user])

  const loading = entries === null || programs === null

  const stats = useMemo<Stats | null>(() => {
    if (!entries || !programs) return null
    return computeStats({
      entries,
      programs,
      timetable: tt,
      feedbackCount,
      events,
      perpetual: (profile?.plan ?? 'starter') === 'perpetual',
    })
  }, [entries, programs, tt, feedbackCount, events, profile])

  const earnedCount = useMemo(() => (stats ? BADGES.filter((b) => b.earned(stats)).length : 0), [stats])

  if (loading || !stats) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={18} className="animate-spin" /> Loading your achievements…
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            <Trophy size={15} /> Achievements
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Achievement Badges</h1>
          <p className="mt-1 text-navy-500">Recognising great teaching and consistent practice.</p>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white px-5 py-3 text-center">
          <p className="text-2xl font-extrabold text-navy-900">
            {earnedCount}
            <span className="text-base font-bold text-navy-300"> / {BADGES.length}</span>
          </p>
          <p className="text-xs font-semibold text-navy-400">Badges earned</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const badges = BADGES.filter((b) => b.category === cat)
          const meta = CATEGORY_LABELS[cat]
          const catEarned = badges.filter((b) => b.earned(stats)).length
          return (
            <section key={cat} className="rounded-2xl border border-navy-100 bg-white p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <div>
                  <h2 className={`text-lg font-extrabold ${CAT_COLOR[cat].text}`}>{meta.title}</h2>
                  <p className="mt-1 text-sm text-navy-500">{meta.blurb}</p>
                  <p className="mt-2 text-xs font-semibold text-navy-400">{catEarned} / {badges.length} earned</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {badges.map((b) => (
                    <BadgeMedal key={b.id} badge={b} stats={stats} />
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-6 text-center text-xs text-navy-400">
        ✦ Badges are awarded automatically based on your teaching activity and milestones.
      </p>
    </main>
  )
}
