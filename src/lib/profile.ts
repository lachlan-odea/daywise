import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentReference,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export type Plan = 'starter' | 'pro' | 'school' | 'perpetual'

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  provider?: string
  school?: string
  role?: string
  /** Australian state/territory (e.g. NSW) — used for curriculum context. */
  state?: string
  plan?: Plan
  /** Weekly progress/reminder email opt-in. Undefined is treated as opted-in. */
  emailReminders?: boolean
  /**
   * Onboarding state. Only these two flags are stored — each setup step's
   * done-state is derived from real data instead (see src/lib/onboarding.ts).
   */
  onboardingWelcomeSeen?: boolean
  onboardingDismissed?: boolean
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}

/** Fields a user is allowed to edit from the Settings page. */
export type EditableProfile = Pick<UserProfile, 'displayName' | 'school' | 'role' | 'state'>

export const STATE_OPTIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

/**
 * Subscribes to the user's profile document (users/{uid}) in real time.
 * Returns an unsubscribe function. No-ops gracefully if Firestore isn't ready.
 */
export function subscribeProfile(uid: string, cb: (profile: UserProfile | null) => void) {
  if (!db) {
    cb(null)
    return () => {}
  }
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => cb(snap.exists() ? (snap.data() as UserProfile) : null),
    () => cb(null),
  )
}

/** Merges partial changes into the user's profile document. */
export async function updateUserProfileDoc(uid: string, data: Partial<UserProfile>) {
  if (!db) throw { code: 'unavailable' }
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

async function deleteRefs(refs: DocumentReference[]) {
  if (!db) return
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    refs.slice(i, i + 400).forEach((r) => batch.delete(r))
    await batch.commit()
  }
}

/**
 * Deletes ALL of a user's data under users/{uid} — every subcollection (Firestore
 * doesn't cascade), then the profile document. Best-effort: run before deleting the
 * auth account so a failure leaves the account intact to retry.
 */
export async function deleteAllUserData(uid: string) {
  if (!db) return
  const database = db

  // Programs have a nested `lessons` subcollection — clear those first.
  const programs = await getDocs(collection(database, 'users', uid, 'programs'))
  for (const p of programs.docs) {
    const lessons = await getDocs(collection(database, 'users', uid, 'programs', p.id, 'lessons'))
    await deleteRefs(lessons.docs.map((d) => d.ref))
  }
  await deleteRefs(programs.docs.map((d) => d.ref))

  // Flat per-user subcollections.
  // IMPORTANT: every new per-user subcollection must be added here — Firestore does
  // not cascade deletes, so anything missing survives as orphaned data under a
  // deleted parent and quietly breaks the "delete all associated data" promise.
  // ('state' holds announcement dismissals — see src/lib/announcements.ts.)
  for (const c of [
    'entries',
    'feedback',
    'notifications',
    'planning',
    'activities',
    'todos',
    'timetable',
    'meta',
    'state',
  ]) {
    const snap = await getDocs(collection(database, 'users', uid, c))
    await deleteRefs(snap.docs.map((d) => d.ref))
  }

  // Finally the profile document itself.
  await deleteDoc(doc(database, 'users', uid))
}

export const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  pro: 'Teacher Pro',
  school: 'Faculty & School',
  perpetual: 'Founding Teacher',
}

export const ROLE_OPTIONS = [
  'Classroom Teacher',
  'Head Teacher / Faculty Leader',
  'Deputy Principal',
  'Principal',
  'Casual / Relief Teacher',
  'Graduate Teacher',
  'Pre-service Teacher',
  'Other',
]
