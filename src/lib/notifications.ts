import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export type NotificationType = 'achievement'

export interface UserNotification {
  id?: string
  type: NotificationType
  title: string
  body: string
  read?: boolean
  createdAt?: Timestamp
}

export function subscribeNotifications(uid: string, cb: (items: UserNotification[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserNotification) }))),
    () => cb([]),
  )
}

export async function addNotification(uid: string, n: Omit<UserNotification, 'id' | 'createdAt' | 'read'>) {
  if (!db) return
  await addDoc(collection(db, 'users', uid, 'notifications'), { ...n, read: false, createdAt: serverTimestamp() })
}

export async function markNotificationRead(uid: string, id: string) {
  if (!db) return
  await updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true })
}

export async function deleteNotification(uid: string, id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'users', uid, 'notifications', id))
}
