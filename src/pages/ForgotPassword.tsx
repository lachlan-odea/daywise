import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { authErrorMessage, useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const location = useLocation()
  // Carried over from the sign-in form so the address doesn't have to be retyped.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firebaseConfigured) {
      setError('Firebase isn’t configured yet. Add your project credentials to enable sign-in.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      // auth/user-not-found is deliberately swallowed: telling a stranger whether an
      // address has an account here would leak who uses daywise. Firebase sends
      // nothing for unknown addresses, so the same confirmation is shown either way.
      if ((err as { code?: string })?.code === 'auth/user-not-found') setSent(true)
      else setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="We’ve sent you a link to reset your password.">
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600">
            <MailCheck size={26} />
          </span>
          <p className="mt-4 text-sm text-navy-700">
            If an account exists for <b className="break-all">{email.trim()}</b>, a password reset link is on its way.
            The link expires after an hour.
          </p>
          <p className="mt-3 text-xs text-navy-500">
            Can’t find it? Check your spam folder, or make sure you signed up with this address rather than Google or
            Microsoft.
          </p>
        </div>

        <button
          onClick={() => {
            setSent(false)
            setError('')
          }}
          className="btn-ghost mt-4 w-full justify-center text-sm"
        >
          Send to a different address
        </button>

        <p className="mt-6 text-center text-sm text-navy-500">
          <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send you a link to choose a new one."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-navy-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full text-base">
          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-500">
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-teal-600 hover:text-teal-700">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
