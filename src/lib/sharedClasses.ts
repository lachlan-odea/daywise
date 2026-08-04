import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ClassInfo } from './classes'
import type { Lesson, Program } from './programs'
import type { ClassColor } from './timetable'

/**
 * Class sharing (Phase 1: read-only collaboration).
 *
 * A shared class lives in the top-level /sharedClasses collection so other
 * teachers can be granted access without touching the owner-only /users tree.
 * The owner's private class doc keeps a `sharedClassId` pointer and remains the
 * source of truth — edits are written through to the shared mirror. Assigned
 * programs are copied in as a snapshot at share time (programs + lessons under
 * /sharedClasses/{id}/programs). Diary entries and evidence are never shared.
 *
 * Invites live in /classInvites with the deterministic id "<classId>__<email>"
 * so the security rules can locate the invite from the acceptor's token email.
 */

export interface SharedMember {
  role: 'owner' | 'member'
  name: string
}

export interface SharedClass {
  id?: string
  name: string
  subject: string
  className: string
  yearGroup?: string
  room?: string
  color?: ClassColor
  icon?: string
  notes?: string
  ownerUid: string
  ownerName: string
  memberUids: string[]
  members: Record<string, SharedMember>
  createdAt?: Timestamp
}

export interface ClassInvite {
  id?: string
  /** Lower-cased email — the invitee must sign in with this (verified) address. */
  email: string
  classId: string
  classDisplayName: string
  subject: string
  ownerUid: string
  ownerName: string
  status: 'pending'
  createdAt?: Timestamp
}

export const classInviteId = (classId: string, email: string) => `${classId}__${email.trim().toLowerCase()}`

/** The class fields mirrored from the owner's private doc into the shared doc. */
export function sharedClassMeta(cls: Pick<ClassInfo, 'name' | 'subject' | 'className' | 'yearGroup' | 'room' | 'color' | 'icon'>) {
  return {
    name: cls.name,
    subject: cls.subject,
    className: cls.className ?? '',
    yearGroup: cls.yearGroup ?? '',
    room: cls.room ?? '',
    color: cls.color ?? 'teal',
    icon: cls.icon ?? '',
  }
}

/**
 * Shares a class: creates the shared doc (owner as sole member), snapshots the
 * class's assigned programs into it, and points the private class doc at it —
 * all in one atomic batch.
 */
export async function shareClass(
  uid: string,
  ownerName: string,
  cls: ClassInfo,
  programs: { program: Program; lessons: Lesson[] }[],
): Promise<string> {
  if (!db || !cls.id) throw { code: 'unavailable' }
  const database = db
  const ref = doc(collection(database, 'sharedClasses'))
  const batch = writeBatch(database)
  batch.set(ref, {
    ...sharedClassMeta(cls),
    notes: cls.notes ?? '',
    ownerUid: uid,
    ownerName,
    memberUids: [uid],
    members: { [uid]: { role: 'owner', name: ownerName } },
    createdAt: serverTimestamp(),
  })
  for (const { program, lessons } of programs) {
    const pref = doc(collection(database, 'sharedClasses', ref.id, 'programs'))
    const { id: _pid, createdAt: _pc, ...meta } = program
    batch.set(pref, { ...meta, lessonCount: lessons.length })
    lessons.forEach((l, i) => {
      const { id: _lid, ...data } = l
      batch.set(doc(collection(database, 'sharedClasses', ref.id, 'programs', pref.id, 'lessons')), {
        ...data,
        order: i,
      })
    })
  }
  batch.update(doc(database, 'users', uid, 'classes', cls.id), { sharedClassId: ref.id })
  await batch.commit()
  return ref.id
}

/** Write-through: mirrors owner edits (details, notes) onto the shared doc. */
export async function updateSharedClass(id: string, patch: Partial<Omit<SharedClass, 'id' | 'createdAt' | 'ownerUid' | 'memberUids' | 'members'>>) {
  if (!db) throw { code: 'unavailable' }
  await updateDoc(doc(db, 'sharedClasses', id), { ...patch, updatedAt: serverTimestamp() })
}

/** Stops sharing: deletes the shared doc, its program snapshots and open invites, and clears the pointer. */
export async function unshareClass(uid: string, localClassId: string, sharedId: string) {
  if (!db) return
  const database = db
  const batch = writeBatch(database)
  const psnap = await getDocs(collection(database, 'sharedClasses', sharedId, 'programs'))
  for (const p of psnap.docs) {
    const lsnap = await getDocs(collection(database, 'sharedClasses', sharedId, 'programs', p.id, 'lessons'))
    lsnap.docs.forEach((l) => batch.delete(l.ref))
    batch.delete(p.ref)
  }
  const isnap = await getDocs(
    query(collection(database, 'classInvites'), where('ownerUid', '==', uid), where('classId', '==', sharedId)),
  )
  isnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(database, 'sharedClasses', sharedId))
  batch.update(doc(database, 'users', uid, 'classes', localClassId), { sharedClassId: deleteField() })
  await batch.commit()
}

export function subscribeSharedClass(id: string, cb: (sc: SharedClass | null) => void) {
  if (!db) {
    cb(null)
    return () => {}
  }
  return onSnapshot(
    doc(db, 'sharedClasses', id),
    (snap) => cb(snap.exists() ? { id: snap.id, ...(snap.data() as SharedClass) } : null),
    () => cb(null),
  )
}

/** Every shared class the user belongs to (including ones they own). */
export function subscribeSharedWithMe(uid: string, cb: (classes: SharedClass[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'sharedClasses'), where('memberUids', 'array-contains', uid))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as SharedClass) }))),
    () => cb([]),
  )
}

/** The program snapshots shared with a class. */
export function subscribeSharedPrograms(classId: string, cb: (programs: Program[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'sharedClasses', classId, 'programs'), orderBy('name'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Program) }))),
    () => cb([]),
  )
}

export async function getSharedProgramLessons(classId: string, programId: string): Promise<Lesson[]> {
  if (!db) return []
  const snap = await getDocs(
    query(collection(db, 'sharedClasses', classId, 'programs', programId, 'lessons'), orderBy('order')),
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Lesson) }))
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function inviteToClass(sc: SharedClass, email: string) {
  if (!db || !sc.id) throw { code: 'unavailable' }
  const addr = email.trim().toLowerCase()
  await setDoc(doc(db, 'classInvites', classInviteId(sc.id, addr)), {
    email: addr,
    classId: sc.id,
    classDisplayName: sc.name,
    subject: sc.subject,
    ownerUid: sc.ownerUid,
    ownerName: sc.ownerName,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export async function revokeInvite(id: string) {
  if (!db) return
  await deleteDoc(doc(db, 'classInvites', id))
}

/** Pending invites the owner has sent for one class. */
export function subscribeClassInvites(ownerUid: string, classId: string, cb: (invites: ClassInvite[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'classInvites'), where('ownerUid', '==', ownerUid), where('classId', '==', classId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClassInvite) }))),
    () => cb([]),
  )
}

/** Pending invites addressed to the signed-in teacher's email. */
export function subscribeMyInvites(email: string, cb: (invites: ClassInvite[]) => void) {
  if (!db || !email) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'classInvites'), where('email', '==', email.trim().toLowerCase()))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClassInvite) }))),
    () => cb([]),
  )
}

/** Joins the class and consumes the invite atomically. */
export async function acceptInvite(invite: ClassInvite, uid: string, name: string) {
  if (!db || !invite.id) throw { code: 'unavailable' }
  const batch = writeBatch(db)
  batch.update(doc(db, 'sharedClasses', invite.classId), {
    memberUids: arrayUnion(uid),
    [`members.${uid}`]: { role: 'member', name },
  })
  batch.delete(doc(db, 'classInvites', invite.id))
  await batch.commit()
}

export async function declineInvite(invite: ClassInvite) {
  if (!db || !invite.id) return
  await deleteDoc(doc(db, 'classInvites', invite.id))
}

/** A member removes themselves from a shared class. */
export async function leaveSharedClass(sharedId: string, uid: string) {
  if (!db) return
  await updateDoc(doc(db, 'sharedClasses', sharedId), {
    memberUids: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
  })
}

/** The owner removes a member. */
export async function removeMember(sharedId: string, memberUid: string) {
  if (!db) return
  await updateDoc(doc(db, 'sharedClasses', sharedId), {
    memberUids: arrayRemove(memberUid),
    [`members.${memberUid}`]: deleteField(),
  })
}
