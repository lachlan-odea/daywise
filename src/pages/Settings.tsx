import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User as UserIcon,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Building2,
  Mail,
  type LucideIcon,
} from 'lucide-react'
import { useAuth, authErrorMessage } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { updateUserProfileDoc, ROLE_OPTIONS, PLAN_LABELS, type Plan } from '../lib/profile'
import { firebaseConfigured } from '../lib/firebase'

const PLAN_META: Record<Plan, { price: string; blurb: string; features: string[] }> = {
  starter: {
    price: 'Free',
    blurb: 'For the individual teacher getting started.',
    features: ['1 teaching program', 'Record by voice or text', 'AI evidence generation', '30-day history'],
  },
  pro: {
    price: '$9/mo',
    blurb: 'Everything a working teacher needs, all year.',
    features: ['Unlimited programs & classes', 'Full Curriculum Intelligence', 'Instant reports & export', 'Unlimited history'],
  },
  school: {
    price: 'Custom',
    blurb: 'For faculties, executives and whole schools.',
    features: ['Everything in Pro', 'Whole-school reporting', 'Shared programs', 'Admin controls & SSO'],
  },
}

/* ---------- small building blocks ---------- */

function SectionCard({
  id,
  icon: Icon,
  title,
  desc,
  children,
  tone = 'default',
}: {
  id: string
  icon: LucideIcon
  title: string
  desc: string
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className={`card p-6 sm:p-7 ${tone === 'danger' ? 'border-red-200' : ''}`}>
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'
            }`}
          >
            <Icon size={19} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-navy-900">{title}</h2>
            <p className="text-sm text-navy-500">{desc}</p>
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-navy-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:bg-navy-50 disabled:text-navy-400'

function Banner({ type, children }: { type: 'success' | 'error'; children: React.ReactNode }) {
  const ok = type === 'success'
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
        ok ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      {children}
    </div>
  )
}

/* ---------- page ---------- */

export default function Settings() {
  const { user, providerId, updateDisplayName, changePassword, deleteAccount } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const navigate = useNavigate()

  const isPasswordUser = providerId === 'password'
  const providerLabel =
    providerId === 'google.com' ? 'Google' : providerId === 'microsoft.com' ? 'Microsoft' : 'email & password'

  /* profile form */
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const seeded = useRef(false)

  useEffect(() => {
    // Wait until the Firestore profile has finished loading before seeding the
    // form — otherwise school/role/phone (which live only in the profile) get
    // seeded to empty before the saved values arrive.
    if (!seeded.current && !profileLoading) {
      setName(profile?.displayName ?? user?.displayName ?? '')
      setSchool(profile?.school ?? '')
      setRole(profile?.role ?? '')
      setPhone(profile?.phone ?? '')
      seeded.current = true
    }
  }, [profile, profileLoading, user])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setProfileMsg(null)
    setSavingProfile(true)
    try {
      if (name && name !== user.displayName) await updateDisplayName(name)
      await updateUserProfileDoc(user.uid, { displayName: name, school, role, phone })
      setProfileMsg({ type: 'success', text: 'Profile saved.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: authErrorMessage(err) })
    } finally {
      setSavingProfile(false)
    }
  }

  /* password form */
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (newPw.length < 6) return setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' })
    if (newPw !== confirmPw) return setPwMsg({ type: 'error', text: 'New passwords don’t match.' })
    setSavingPw(true)
    try {
      await changePassword(curPw, newPw)
      setPwMsg({ type: 'success', text: 'Password updated.' })
      setCurPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setPwMsg({ type: 'error', text: authErrorMessage(err) })
    } finally {
      setSavingPw(false)
    }
  }

  /* delete account */
  const [showDelete, setShowDelete] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')

  const confirmDelete = async () => {
    setDelErr('')
    setDelBusy(true)
    try {
      await deleteAccount(isPasswordUser ? delPw : undefined)
      navigate('/')
    } catch (err) {
      setDelErr(authErrorMessage(err))
      setDelBusy(false)
    }
  }

  const plan = (profile?.plan ?? 'starter') as Plan
  const planMeta = PLAN_META[plan]

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-navy-500">Manage your profile, security and subscription.</p>
      </div>

      {!firebaseConfigured && (
        <div className="mb-6">
          <Banner type="error">Firebase isn’t configured, so changes can’t be saved right now.</Banner>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* section nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {[
              { href: '#profile', label: 'Profile', icon: UserIcon },
              { href: '#security', label: 'Account & security', icon: ShieldCheck },
              { href: '#subscription', label: 'Subscription', icon: CreditCard },
              { href: '#danger', label: 'Danger zone', icon: AlertTriangle },
            ].map((s) => (
              <a
                key={s.href}
                href={s.href}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-navy-600 hover:bg-white hover:text-navy-900"
              >
                <s.icon size={16} /> {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-6">
          {/* PROFILE */}
          <SectionCard id="profile" icon={UserIcon} title="Profile" desc="How you appear across Project Daybook.">
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="flex items-center gap-4">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-xl font-bold text-white">
                    {(name || 'T')
                      .split(' ')
                      .map((n) => n[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-navy-800">{name || 'Your name'}</p>
                  <p className="text-xs text-navy-400">Signed in with {providerLabel}</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Mitchell" />
                </Field>
                <Field label="Role">
                  <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">Select a role…</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="School / organisation">
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                    <input
                      className={inputCls + ' pl-10'}
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="Riverside High School"
                    />
                  </div>
                </Field>
                <Field label="Phone (optional)">
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" />
                </Field>
              </div>

              {profileMsg && <Banner type={profileMsg.type}>{profileMsg.text}</Banner>}

              <div className="flex justify-end">
                <button type="submit" disabled={savingProfile || !firebaseConfigured} className="btn-primary text-sm">
                  {savingProfile ? <Loader2 size={16} className="animate-spin" /> : 'Save changes'}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* SECURITY */}
          <SectionCard id="security" icon={ShieldCheck} title="Account & security" desc="Your sign-in details.">
            <Field label="Email address" hint="Your email is managed by your sign-in provider.">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <input className={inputCls + ' pl-10'} value={user?.email ?? ''} disabled />
              </div>
            </Field>

            <div className="mt-6 border-t border-navy-100 pt-6">
              {isPasswordUser ? (
                <form onSubmit={savePassword} className="space-y-5">
                  <p className="text-sm font-bold text-navy-800">Change password</p>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="Current password">
                      <input type="password" autoComplete="current-password" className={inputCls} value={curPw} onChange={(e) => setCurPw(e.target.value)} />
                    </Field>
                    <Field label="New password">
                      <input type="password" autoComplete="new-password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    </Field>
                    <Field label="Confirm new password">
                      <input type="password" autoComplete="new-password" className={inputCls} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                    </Field>
                  </div>
                  {pwMsg && <Banner type={pwMsg.type}>{pwMsg.text}</Banner>}
                  <div className="flex justify-end">
                    <button type="submit" disabled={savingPw} className="btn-navy text-sm">
                      {savingPw ? <Loader2 size={16} className="animate-spin" /> : 'Update password'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-3 rounded-xl bg-navy-50 p-4 text-sm text-navy-600">
                  <ShieldCheck size={18} className="shrink-0 text-teal-600" />
                  You sign in with {providerLabel}. Manage your password in your {providerLabel} account settings.
                </div>
              )}
            </div>
          </SectionCard>

          {/* SUBSCRIPTION */}
          <SectionCard id="subscription" icon={CreditCard} title="Subscription" desc="Your current plan and billing.">
            <div className="rounded-2xl border border-navy-100 bg-gradient-to-br from-cloud to-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-white">
                      <Sparkles size={12} /> {PLAN_LABELS[plan]}
                    </span>
                    <span className="text-sm font-bold text-navy-900">{planMeta.price}</span>
                  </div>
                  <p className="mt-2 text-sm text-navy-500">{planMeta.blurb}</p>
                </div>
                {plan === 'starter' ? (
                  <Link to="/#pricing" className="btn-primary text-sm">
                    Upgrade to Pro
                  </Link>
                ) : (
                  <button className="btn-ghost text-sm" title="Billing portal coming soon">
                    Manage billing
                  </button>
                )}
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {planMeta.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-navy-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-xs text-navy-400">
              Billing integration is coming soon. Need to change your plan now?{' '}
              <Link to="/#pricing" className="font-semibold text-teal-600 hover:text-teal-700">
                See all plans
              </Link>
              .
            </p>
          </SectionCard>

          {/* DANGER ZONE */}
          <SectionCard id="danger" icon={AlertTriangle} title="Danger zone" desc="Irreversible account actions." tone="danger">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-navy-900">Delete account</p>
                <p className="text-sm text-navy-500">Permanently delete your account and all associated data.</p>
              </div>
              <button
                onClick={() => {
                  setShowDelete(true)
                  setDelErr('')
                  setDelPw('')
                }}
                className="btn shrink-0 border border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Delete account
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => !delBusy && setShowDelete(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle size={22} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-navy-900">Delete your account?</h3>
            <p className="mt-1 text-sm text-navy-500">
              This permanently deletes your profile and data. This action cannot be undone.
            </p>

            {isPasswordUser ? (
              <div className="mt-4">
                <Field label="Confirm your password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={inputCls}
                    value={delPw}
                    onChange={(e) => setDelPw(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-600">
                You’ll be asked to confirm with {providerLabel} in a popup.
              </p>
            )}

            {delErr && (
              <div className="mt-4">
                <Banner type="error">{delErr}</Banner>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowDelete(false)} disabled={delBusy} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={delBusy || (isPasswordUser && !delPw)}
                className="btn bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {delBusy ? <Loader2 size={16} className="animate-spin" /> : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
