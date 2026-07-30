import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Info, Sparkles, Wrench, Trophy, Check, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  subscribeAnnouncements,
  subscribeDismissals,
  dismissAnnouncement,
  type Announcement,
  type AnnouncementType,
  type Dismissals,
} from '../lib/announcements'
import {
  subscribeNotifications,
  markNotificationRead,
  deleteNotification,
  type UserNotification,
} from '../lib/notifications'

const TYPE_META: Record<AnnouncementType, { icon: LucideIcon; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-sky-600', bg: 'bg-sky-50' },
  update: { icon: Sparkles, color: 'text-teal-600', bg: 'bg-teal-50' },
  maintenance: { icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50' },
}
const ACHIEVEMENT_META = { icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' }

const whenLabel = (ts?: { toDate?: () => Date }) => {
  const d = ts?.toDate?.()
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
}
const millis = (ts?: { toMillis?: () => number }) => ts?.toMillis?.() ?? 0

interface Entry {
  key: string
  icon: LucideIcon
  color: string
  bg: string
  title: string
  body: string
  when: string
  sort: number
  unread: boolean
  onRead: () => void
  onDismiss: () => void
}

export default function NotificationsBell() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Dismissals>({})
  const [notifs, setNotifs] = useState<UserNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeAnnouncements(setAnnouncements), [])
  useEffect(() => {
    if (!user) return
    return subscribeDismissals(user.uid, setDismissed)
  }, [user])
  useEffect(() => {
    if (!user) return
    return subscribeNotifications(user.uid, setNotifs)
  }, [user])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = []
    for (const a of announcements) {
      if (!a.active || !a.id) continue
      const meta = TYPE_META[a.type] ?? TYPE_META.info
      const id = a.id
      list.push({
        key: `a-${id}`,
        icon: meta.icon,
        color: meta.color,
        bg: meta.bg,
        title: a.title,
        body: a.body,
        when: whenLabel(a.createdAt),
        sort: millis(a.createdAt),
        unread: !dismissed[id],
        onRead: () => user && dismissAnnouncement(user.uid, id),
        onDismiss: () => user && dismissAnnouncement(user.uid, id),
      })
    }
    for (const n of notifs) {
      if (!n.id) continue
      const id = n.id
      list.push({
        key: `n-${id}`,
        icon: ACHIEVEMENT_META.icon,
        color: ACHIEVEMENT_META.color,
        bg: ACHIEVEMENT_META.bg,
        title: n.title,
        body: n.body,
        when: whenLabel(n.createdAt),
        sort: millis(n.createdAt),
        unread: !n.read,
        onRead: () => user && markNotificationRead(user.uid, id),
        onDismiss: () => user && deleteNotification(user.uid, id),
      })
    }
    return list.sort((x, y) => y.sort - x.sort)
  }, [announcements, dismissed, notifs, user])

  const unreadCount = entries.filter((e) => e.unread).length
  const markAll = () => entries.forEach((e) => e.unread && e.onRead())

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy-500 hover:bg-navy-50"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-bold text-navy-900">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto border-t border-navy-100">
            {entries.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={22} className="mx-auto text-navy-200" />
                <p className="mt-2 text-sm text-navy-400">You’re all caught up.</p>
              </div>
            ) : (
              entries.map((e) => {
                const Icon = e.icon
                return (
                  <div key={e.key} className={`relative flex gap-3 border-b border-navy-50 px-4 py-3 ${e.unread ? 'bg-teal-50/40' : ''}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${e.bg} ${e.color}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-navy-900">{e.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-navy-300">{e.when}</span>
                          <button
                            onClick={e.onDismiss}
                            className="flex h-5 w-5 items-center justify-center rounded text-navy-400 hover:bg-navy-100 hover:text-navy-600"
                            aria-label="Dismiss notification"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-navy-600">{e.body}</p>
                      {e.unread && (
                        <button
                          onClick={e.onRead}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
                        >
                          <Check size={12} /> Mark as read
                        </button>
                      )}
                    </div>
                    {e.unread && <span className="absolute right-6 top-4 h-2 w-2 rounded-full bg-teal-500" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
