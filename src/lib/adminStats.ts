import { collection, doc, getCountFromServer, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import { dayKey, type ActivityDoc } from './activity'
import type { UserProfile } from './profile'

export interface UserUsage {
  uid: string
  displayName: string | null
  email: string | null
  plan?: string
  school?: string
  state?: string
  hasProgram: boolean
  hasTimetable: boolean
  lessonCount: number
  createdAt: Date | null
  lastLoginAt: Date | null
}

/** One day of the trend window. */
export interface DayPoint {
  /** yyyy-mm-dd */
  date: string
  /** Distinct users who opened the app or recorded a lesson that day. */
  activeUsers: number
  /** Lessons recorded that day. */
  lessons: number
  /** Accounts created that day. */
  signups: number
  /** Cumulative accounts at the end of that day. */
  totalUsers: number
}

/** One week (Monday-start) of the trend window. */
export interface WeekPoint {
  /** yyyy-mm-dd of the Monday. */
  weekStart: string
  /** Short display label, e.g. "6 Jul". */
  label: string
  /** Distinct users active at any point during the week (WAU). */
  activeUsers: number
  lessons: number
  signups: number
  /** Cumulative accounts at the end of the week. */
  totalUsers: number
}

export interface UsageStats {
  users: UserUsage[]
  totals: {
    users: number
    withProgram: number
    withTimetable: number
    lessons: number
    /** Distinct users active today. */
    activeToday: number
    /** Distinct users active in the last 7 days. */
    activeWeek: number
  }
  daily: DayPoint[]
  weekly: WeekPoint[]
}

/** How far back the trend charts reach. Also bounds the per-user entry fetch. */
export const WINDOW_DAYS = 90

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const EMPTY: UsageStats = {
  users: [],
  totals: { users: 0, withProgram: 0, withTimetable: 0, lessons: 0, activeToday: 0, activeWeek: 0 },
  daily: [],
  weekly: [],
}

/** Midnight local time, n days before today. */
function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** The Monday on or before `d`, at midnight local time. */
function mondayOf(d: Date): Date {
  const x = startOfDay(d)
  // getDay(): 0 = Sunday, so Sunday steps back 6 days rather than forward 1.
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/**
 * Aggregates per-user usage across the whole app (admin-only; relies on the admin
 * read rule for /users/**).
 *
 * Totals use server-side aggregate queries so we never download whole collections
 * just to count them. The trend series needs per-document timestamps, which an
 * aggregate can't give, so entries are fetched — but only those inside the
 * WINDOW_DAYS window, which is what keeps that read bounded as accounts age.
 */
export async function getUsageStats(): Promise<UsageStats> {
  const database = db
  if (!database) return EMPTY

  const today = startOfDay(new Date())
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1))
  const windowCutoff = Timestamp.fromDate(windowStart)

  const snap = await getDocs(collection(database, 'users'))

  /** Per user: the set of days they were active, and lessons recorded per day. */
  const activeDaysByUser: Set<string>[] = []
  const lessonsByDay = new Map<string, number>()

  const users = await Promise.all(
    snap.docs.map(async (d) => {
      const p = d.data() as UserProfile
      const uid = d.id
      const [programs, entryCount, timetable, activity, recentEntries] = await Promise.all([
        getCountFromServer(collection(database, 'users', uid, 'programs')),
        getCountFromServer(collection(database, 'users', uid, 'entries')),
        getDoc(doc(database, 'users', uid, 'timetable', 'main')),
        getDoc(doc(database, 'users', uid, 'meta', 'activity')),
        getDocs(query(collection(database, 'users', uid, 'entries'), where('createdAt', '>=', windowCutoff))),
      ])

      const active = new Set<string>()

      // Explicit activity pings (src/lib/activity.ts) — the accurate signal, but
      // only from the day that tracking shipped.
      const days = (activity.data() as ActivityDoc | undefined)?.days ?? {}
      for (const k of Object.keys(days)) active.add(k)

      // Recording a lesson is unambiguous activity, and entries predate the pings —
      // so this backfills the chart with real history instead of a flat line.
      for (const e of recentEntries.docs) {
        const ts = e.data().createdAt as Timestamp | undefined
        if (!ts?.toDate) continue
        const k = dayKey(ts.toDate())
        active.add(k)
        lessonsByDay.set(k, (lessonsByDay.get(k) ?? 0) + 1)
      }

      const lastLogin = p.lastLoginAt?.toDate?.() ?? null
      if (lastLogin) active.add(dayKey(lastLogin))

      activeDaysByUser.push(active)

      const cells = (timetable.data()?.cells as Record<string, unknown> | undefined) ?? {}
      return {
        uid,
        displayName: p.displayName ?? null,
        email: p.email ?? null,
        plan: p.plan,
        school: p.school,
        state: p.state,
        hasProgram: programs.data().count > 0,
        hasTimetable: Object.keys(cells).length > 0,
        lessonCount: entryCount.data().count,
        createdAt: p.createdAt?.toDate?.() ?? null,
        lastLoginAt: lastLogin,
      } satisfies UserUsage
    }),
  )

  /* ---- daily series ---- */

  const signupsByDay = new Map<string, number>()
  for (const u of users) {
    if (u.createdAt) signupsByDay.set(dayKey(u.createdAt), (signupsByDay.get(dayKey(u.createdAt)) ?? 0) + 1)
  }
  // Accounts that already existed when the window opened — the cumulative line has
  // to start from them, not from zero.
  const carriedIn = users.filter((u) => u.createdAt && u.createdAt < windowStart).length

  const daily: DayPoint[] = []
  let cumulative = carriedIn
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(windowStart)
    d.setDate(d.getDate() + i)
    const key = dayKey(d)
    cumulative += signupsByDay.get(key) ?? 0
    daily.push({
      date: key,
      activeUsers: activeDaysByUser.filter((s) => s.has(key)).length,
      lessons: lessonsByDay.get(key) ?? 0,
      signups: signupsByDay.get(key) ?? 0,
      totalUsers: cumulative,
    })
  }

  /* ---- weekly rollup ---- */

  const weekly: WeekPoint[] = []
  for (let cursor = mondayOf(windowStart); cursor <= today; cursor.setDate(cursor.getDate() + 7)) {
    const keys: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor)
      d.setDate(d.getDate() + i)
      if (d <= today) keys.push(dayKey(d))
    }
    const inWindow = keys.filter((k) => k >= daily[0].date)
    weekly.push({
      weekStart: dayKey(cursor),
      label: `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`,
      // Distinct users across the week — a sum of daily counts would double-count
      // anyone who showed up on more than one day.
      activeUsers: activeDaysByUser.filter((s) => inWindow.some((k) => s.has(k))).length,
      lessons: inWindow.reduce((sum, k) => sum + (lessonsByDay.get(k) ?? 0), 0),
      signups: inWindow.reduce((sum, k) => sum + (signupsByDay.get(k) ?? 0), 0),
      totalUsers: daily.find((p) => p.date === inWindow[inWindow.length - 1])?.totalUsers ?? cumulative,
    })
  }

  users.sort((a, b) => b.lessonCount - a.lessonCount)

  const todayKey = dayKey(today)
  const last7 = daily.slice(-7).map((p) => p.date)

  return {
    users,
    totals: {
      users: users.length,
      withProgram: users.filter((u) => u.hasProgram).length,
      withTimetable: users.filter((u) => u.hasTimetable).length,
      lessons: users.reduce((s, u) => s + u.lessonCount, 0),
      activeToday: activeDaysByUser.filter((s) => s.has(todayKey)).length,
      activeWeek: activeDaysByUser.filter((s) => last7.some((k) => s.has(k))).length,
    },
    daily,
    weekly,
  }
}
