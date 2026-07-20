import { collection, doc, getCountFromServer, getDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'
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

export interface UsageStats {
  users: UserUsage[]
  totals: { users: number; withProgram: number; withTimetable: number; lessons: number }
}

const EMPTY: UsageStats = { users: [], totals: { users: 0, withProgram: 0, withTimetable: 0, lessons: 0 } }

/**
 * Aggregates per-user usage across the whole app (admin-only; relies on the admin
 * read rule for /users/**). Program/lesson counts use server-side aggregate
 * queries so we never download the documents themselves.
 */
export async function getUsageStats(): Promise<UsageStats> {
  const database = db
  if (!database) return EMPTY

  const snap = await getDocs(collection(database, 'users'))
  const users = await Promise.all(
    snap.docs.map(async (d) => {
      const p = d.data() as UserProfile
      const uid = d.id
      const [programs, entries, timetable] = await Promise.all([
        getCountFromServer(collection(database, 'users', uid, 'programs')),
        getCountFromServer(collection(database, 'users', uid, 'entries')),
        getDoc(doc(database, 'users', uid, 'timetable', 'main')),
      ])
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
        lessonCount: entries.data().count,
        createdAt: p.createdAt?.toDate?.() ?? null,
        lastLoginAt: p.lastLoginAt?.toDate?.() ?? null,
      } satisfies UserUsage
    }),
  )

  users.sort((a, b) => b.lessonCount - a.lessonCount)
  return {
    users,
    totals: {
      users: users.length,
      withProgram: users.filter((u) => u.hasProgram).length,
      withTimetable: users.filter((u) => u.hasTimetable).length,
      lessons: users.reduce((s, u) => s + u.lessonCount, 0),
    },
  }
}
