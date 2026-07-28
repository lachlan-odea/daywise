import { useEffect, useRef, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useToast } from './ToastProvider'
import { db } from '../lib/firebase'
import { subscribeEntries, type LessonEntry } from '../lib/entries'
import { subscribePrograms, getProgram } from '../lib/programs'
import { subscribeTimetable, type Timetable } from '../lib/timetable'
import type { LoadedProgram } from '../lib/reports'
import { addNotification } from '../lib/notifications'
import {
  BADGES, computeStats, isBadgeEarned,
  subscribeAchievementEvents, subscribeManualBadges,
  getNotifiedBadges, markBadgesNotified,
  type AchievementEvents,
} from '../lib/achievements'

/**
 * Watches the signed-in user's data and shows a toast when a new achievement is
 * earned. Skipped while an admin is viewing another user (impersonating), and it
 * seeds silently on first run so existing users aren't flooded.
 */
export default function AchievementWatcher() {
  const { user, impersonating } = useAuth()
  const { profile } = useProfile()
  const { showAchievement } = useToast()

  const activeUid = impersonating ? null : user?.uid ?? null

  const [entries, setEntries] = useState<LessonEntry[] | null>(null)
  const [programs, setPrograms] = useState<LoadedProgram[] | null>(null)
  const [tt, setTt] = useState<Timetable | null>(null)
  const [events, setEvents] = useState<AchievementEvents>({})
  const [granted, setGranted] = useState<string[]>([])
  const [feedbackCount, setFeedbackCount] = useState(0)

  const knownRef = useRef<Set<string> | null>(null)
  const seededRef = useRef(false)

  // Reset when the active user changes (login / logout / enter-exit view-as).
  useEffect(() => {
    knownRef.current = null
    seededRef.current = false
    setEntries(null)
    setPrograms(null)
  }, [activeUid])

  useEffect(() => {
    if (!activeUid) return
    return subscribeEntries(activeUid, setEntries)
  }, [activeUid])

  useEffect(() => {
    if (!activeUid) return
    return subscribeTimetable(activeUid, setTt)
  }, [activeUid])

  useEffect(() => {
    if (!activeUid) return
    return subscribeAchievementEvents(activeUid, setEvents)
  }, [activeUid])

  useEffect(() => {
    if (!activeUid) return
    return subscribeManualBadges(activeUid, setGranted)
  }, [activeUid])

  useEffect(() => {
    if (!activeUid) return
    let alive = true
    const unsub = subscribePrograms(activeUid, async (list) => {
      const fulls = await Promise.all(list.map((p) => (p.id ? getProgram(activeUid, p.id) : null)))
      if (alive) setPrograms(fulls.filter(Boolean) as LoadedProgram[])
    })
    return () => {
      alive = false
      unsub()
    }
  }, [activeUid])

  useEffect(() => {
    if (!activeUid || !db) return
    getCountFromServer(collection(db, 'users', activeUid, 'feedback'))
      .then((s) => setFeedbackCount(s.data().count))
      .catch(() => {})
  }, [activeUid])

  useEffect(() => {
    if (!activeUid || !entries || !programs) return
    const stats = computeStats({
      entries,
      programs,
      timetable: tt,
      feedbackCount,
      events,
      perpetual: (profile?.plan ?? 'starter') === 'perpetual',
      granted,
    })
    const earned = BADGES.filter((b) => isBadgeEarned(b, stats)).map((b) => b.id)

    const toast = (ids: string[]) => {
      ids.forEach((id, i) => {
        const b = BADGES.find((x) => x.id === id)
        if (!b) return
        setTimeout(() => showAchievement(b.title, b.description), i * 900)
        // Also drop a matching entry in the notification bell.
        addNotification(activeUid, { type: 'achievement', title: `Achievement unlocked: ${b.title}`, body: b.description }).catch(() => {})
      })
    }

    if (!seededRef.current) {
      seededRef.current = true
      getNotifiedBadges(activeUid).then((persisted) => {
        if (persisted === null) {
          // First time ever — record current badges silently, don't toast.
          knownRef.current = new Set(earned)
          markBadgesNotified(activeUid, earned).catch(() => {})
          return
        }
        const known = new Set(persisted)
        knownRef.current = known
        const fresh = earned.filter((id) => !known.has(id))
        if (fresh.length) {
          toast(fresh)
          fresh.forEach((id) => known.add(id))
          markBadgesNotified(activeUid, fresh).catch(() => {})
        }
      })
      return
    }

    if (!knownRef.current) return
    const fresh = earned.filter((id) => !knownRef.current!.has(id))
    if (fresh.length) {
      toast(fresh)
      fresh.forEach((id) => knownRef.current!.add(id))
      markBadgesNotified(activeUid, fresh).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUid, entries, programs, tt, events, granted, feedbackCount, profile])

  return null
}
