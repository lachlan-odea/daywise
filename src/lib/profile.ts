import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
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
  phone?: string
  plan?: Plan
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}

/** Fields a user is allowed to edit from the Settings page. */
export type EditableProfile = Pick<UserProfile, 'displayName' | 'school' | 'role' | 'phone'>

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
