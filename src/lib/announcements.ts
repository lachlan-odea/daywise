import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export type AnnouncementType = 'info' | 'update' | 'maintenance'

export interface Announcement {
  id?: string
  title: string
  body: string
  type: AnnouncementType
  /** Only active announcements are shown to users; deactivating hides without deleting. */
  active: boolean
  createdByEmail?: string
  createdAt?: Timestamp
}

/** All announcements (newest first). Admins see everything; the bell filters to active. */
export function subscribeAnnouncements(cb: (items: Announcement[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Announcement) }))),
    () => cb([]),
  )
}

export async function createAnnouncement(a: Omit<Announcement, 'id' | 'createdAt'>) {
  if (!db) throw { code: 'unavailable' }
  await addDoc(collection(db, 'announcements'), { ...a, createdAt: serverTimestamp() })
}

export async function updateAnnouncement(id: string, updates: Partial<Omit<Announcement, 'id' | 'createdAt' | 'createdByEmail'>>) {
  if (!db) return
  await updateDoc(doc(db, 'announcements', id), updates)
}

export async function setAnnouncementActive(id: string, active: boolean) {
  if (!db) return
  await updateDoc(doc(db, 'announcements', id), { active })
}

export async function deleteAnnouncement(id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'announcements', id))
}

/** Per-user read/dismiss state, stored under the user's own tree. */
export type Dismissals = Record<string, boolean>

export function subscribeDismissals(uid: string, cb: (d: Dismissals) => void) {
  if (!db) {
    cb({})
    return () => {}
  }
  const ref = doc(db, 'users', uid, 'state', 'notifications')
  return onSnapshot(
    ref,
    (snap) => cb(((snap.data()?.dismissed as Dismissals) ?? {})),
    () => cb({}),
  )
}

export async function dismissAnnouncement(uid: string, id: string) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'state', 'notifications'), { dismissed: { [id]: true } }, { merge: true })
}
