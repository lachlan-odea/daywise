import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import SocialAuthButtons from '../components/SocialAuthButtons'
import { authErrorMessage, useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'

export default function Login() {
  const { signInWithEmail, signInWithGoogle, signInWithMicrosoft } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    if (!firebaseConfigured) {
      setError('Firebase isn’t configured yet. Add your project credentials to enable sign-in.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await fn()
      navigate(from, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up where your teaching left off.">
      <SocialAuthButtons
        action="Sign in"
        disabled={busy}
        onGoogle={() => run(signInWithGoogle)}
        onMicrosoft={() => run(signInWithMicrosoft)}
      />

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-navy-100" />
        <span className="text-xs font-semibold uppercase tracking-wider text-navy-400">or</span>
        <span className="h-px flex-1 bg-navy-100" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(() => signInWithEmail(email, password))
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-navy-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-semibold text-navy-800">
              Password
            </label>
            <Link
              to="/forgot-password"
              state={{ email }}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 pr-11 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full text-base">
          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-500">
        New to daywise?{' '}
        <Link to="/signup" className="font-semibold text-teal-600 hover:text-teal-700">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
