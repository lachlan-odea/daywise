import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { updateUserProfileDoc, ROLE_OPTIONS, STATE_OPTIONS } from '../lib/profile'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

/**
 * First-login greeting. Collects only the three things that are quick to answer
 * and immediately useful (school, state, role) — deliberately NOT the timetable or
 * program, since demanding a file upload at the moment someone signs up assumes
 * they have it to hand. Those are driven by the Dashboard checklist instead.
 *
 * Rendered by Dashboard only when the account looks brand new and the flag isn't
 * set; see shouldGreet in src/pages/Dashboard.tsx.
 */
export default function WelcomeModal({
  uid,
  firstName,
  onClose,
}: {
  uid: string
  firstName: string
  onClose: () => void
}) {
  const [school, setSchool] = useState('')
  const [stateLoc, setStateLoc] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)

  /** Persists whatever was filled in. The flag is set either way, so skipping is final. */
  const finish = async (save: boolean) => {
    setBusy(true)
    try {
      await updateUserProfileDoc(uid, {
        onboardingWelcomeSeen: true,
        ...(save && school.trim() ? { school: school.trim() } : {}),
        ...(save && stateLoc ? { state: stateLoc } : {}),
        ...(save && role ? { role } : {}),
      })
    } catch {
      /* Non-fatal — don't trap someone behind a failed write. */
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/60" />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="bg-navy-900 px-6 py-5 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 text-white">
            <Sparkles size={20} />
          </span>
          <h2 className="mt-3 text-xl font-extrabold text-white">Welcome to daywise, {firstName} 👋</h2>
          <p className="mt-1 text-sm text-navy-200">
            Two quick questions, then we’ll walk you through setting up.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">Your school</span>
            <input
              autoFocus
              className={inputCls}
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. Riverside High School"
              maxLength={120}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">State</span>
              <select className={inputCls} value={stateLoc} onChange={(e) => setStateLoc(e.target.value)}>
                <option value="">Select…</option>
                {STATE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Your role</span>
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Select…</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs leading-relaxed text-navy-400">
            Your state sets the curriculum context for matching outcomes. You can change any of this
            later in Settings.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-navy-100 p-4">
          <button
            onClick={() => finish(false)}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-semibold text-navy-500 hover:bg-navy-50 disabled:opacity-60"
          >
            Skip for now
          </button>
          <button onClick={() => finish(true)} disabled={busy} className="btn-primary text-sm">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Let’s go
          </button>
        </div>
      </div>
    </div>
  )
}
