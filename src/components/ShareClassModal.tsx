import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Crown,
  Loader2,
  Mail,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useConfirm } from './ConfirmProvider'
import { getProgram, type Program } from '../lib/programs'
import type { ClassInfo } from '../lib/classes'
import {
  inviteToClass,
  revokeInvite,
  removeMember,
  shareClass,
  subscribeClassInvites,
  unshareClass,
  type ClassInvite,
  type SharedClass,
} from '../lib/sharedClasses'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

const EMAIL_RE = /^\S+@\S+\.\S+$/

export default function ShareClassModal({
  cls,
  sharedClass,
  assignedPrograms,
  onClose,
}: {
  cls: ClassInfo
  /** The live shared doc when the class is already shared, else null. */
  sharedClass: SharedClass | null
  /** The class's currently assigned programs (snapshotted at share time). */
  assignedPrograms: Program[]
  onClose: () => void
}) {
  const { user, effectiveUid } = useAuth()
  const { profile } = useProfile()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [invites, setInvites] = useState<ClassInvite[]>([])

  const sharedId = cls.sharedClassId
  const ownerName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Teacher'

  useEffect(() => {
    if (!user || !sharedId) return
    return subscribeClassInvites(effectiveUid, sharedId, setInvites)
  }, [user, sharedId])

  const startSharing = async () => {
    if (!user || !cls.id) return
    setBusy(true)
    setError('')
    try {
      const withLessons = await Promise.all(
        assignedPrograms.filter((p) => p.id).map((p) => getProgram(effectiveUid, p.id!)),
      )
      await shareClass(
        effectiveUid,
        ownerName,
        cls,
        withLessons.filter((r): r is NonNullable<typeof r> => r !== null),
      )
    } catch {
      setError('Could not share the class. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const sendInvite = async () => {
    if (!sharedClass) return
    const addr = email.trim().toLowerCase()
    if (!EMAIL_RE.test(addr)) {
      setError('Enter a valid email address.')
      return
    }
    if (addr === user?.email?.toLowerCase()) {
      setError('That’s your own email address.')
      return
    }
    setSending(true)
    setError('')
    try {
      await inviteToClass(sharedClass, addr)
      setEmail('')
      setSent(true)
      setTimeout(() => setSent(false), 2000)
    } catch {
      setError('Could not send that invite — it may already be pending.')
    } finally {
      setSending(false)
    }
  }

  const stopSharing = async () => {
    if (!user || !cls.id || !sharedId) return
    const ok = await confirm({
      title: 'Stop sharing this class?',
      message: 'Everyone you shared it with loses access, and the shared program snapshot is removed. Your own class is not affected.',
      confirmLabel: 'Stop sharing',
    })
    if (!ok) return
    setBusy(true)
    try {
      await unshareClass(effectiveUid, cls.id, sharedId)
      onClose()
    } catch {
      setError('Could not stop sharing. Please try again.')
      setBusy(false)
    }
  }

  const kick = async (uid: string, name: string) => {
    if (!sharedId) return
    const ok = await confirm({
      title: `Remove ${name}?`,
      message: 'They will lose access to this shared class.',
      confirmLabel: 'Remove teacher',
    })
    if (!ok) return
    await removeMember(sharedId, uid)
  }

  const members = sharedClass
    ? sharedClass.memberUids
        .map((uid) => ({ uid, ...(sharedClass.members[uid] ?? { role: 'member' as const, name: 'Teacher' }) }))
        .sort((a) => (a.role === 'owner' ? -1 : 1))
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Share2 size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-navy-900">Share “{cls.name}”</h3>
              <p className="text-xs text-navy-400">Collaborate with other teachers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!sharedId || !sharedClass ? (
            <>
              <p className="text-sm text-navy-600">
                Share this class so other teachers can see it. They’ll get <b>read-only</b> access to:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-navy-600">
                {[
                  'The class details (name, code, year group, room)',
                  `Its assigned programs and their lessons (${assignedPrograms.length ? `a snapshot of ${assignedPrograms.length} program${assignedPrograms.length === 1 ? '' : 's'}` : 'none assigned yet'})`,
                  'Your class notes',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-teal-500" /> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                Your diary entries, evidence and timetable stay private. Contributing (co-teaching) is coming later.
              </div>
              <button onClick={startSharing} disabled={busy || !!sharedId} className="btn-primary mt-5 w-full justify-center text-sm">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Share this class
              </button>
            </>
          ) : (
            <>
              {/* invite */}
              <p className="text-sm font-semibold text-navy-800">Invite a teacher</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                  placeholder="colleague@school.edu.au"
                />
                <button onClick={sendInvite} disabled={sending} className="btn-primary shrink-0 text-sm">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : sent ? <Check size={15} /> : <Send size={15} />}
                  Invite
                </button>
              </div>
              <p className="mt-2 text-xs text-navy-400">
                They must sign in to daywise with this exact email address (verified) to accept.
              </p>

              {/* pending invites */}
              {invites.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Pending invites</p>
                  <div className="mt-2 space-y-2">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-navy-100 px-3 py-2.5">
                        <Mail size={15} className="shrink-0 text-navy-400" />
                        <span className="min-w-0 flex-1 truncate text-sm text-navy-700">{inv.email}</span>
                        <button
                          onClick={() => inv.id && revokeInvite(inv.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-600"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* members */}
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Who has access</p>
                <div className="mt-2 space-y-2">
                  {members.map((m) => (
                    <div key={m.uid} className="flex items-center gap-3 rounded-xl border border-navy-100 px-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-white">
                        {m.name
                          .split(' ')
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-800">{m.name}</span>
                      {m.role === 'owner' ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                          <Crown size={11} /> Owner
                        </span>
                      ) : (
                        <button
                          onClick={() => kick(m.uid, m.name)}
                          className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600"
                        >
                          <UserMinus size={13} /> Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-xs text-navy-400">
                Programs were shared as a snapshot when you shared the class; later program edits aren’t synced yet.
              </p>
            </>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        {sharedId && sharedClass && (
          <div className="flex items-center justify-between border-t border-navy-100 px-6 py-4">
            <button
              onClick={stopSharing}
              disabled={busy}
              className="btn border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Stop sharing
            </button>
            <button onClick={onClose} className="btn-ghost text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
