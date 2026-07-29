import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, BellOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { updateUserProfileDoc } from '../lib/profile'

type State = 'working' | 'done' | 'error' | 'reenabled'

export default function Unsubscribe() {
  const { user } = useAuth()
  const [state, setState] = useState<State>('working')

  useEffect(() => {
    if (!user) return
    updateUserProfileDoc(user.uid, { emailReminders: false })
      .then(() => setState('done'))
      .catch(() => setState('error'))
  }, [user])

  const reEnable = async () => {
    if (!user) return
    try {
      await updateUserProfileDoc(user.uid, { emailReminders: true })
      setState('reenabled')
    } catch {
      setState('error')
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      {state === 'working' ? (
        <>
          <Loader2 size={28} className="animate-spin text-navy-300" />
          <p className="mt-4 text-navy-500">Updating your preferences…</p>
        </>
      ) : state === 'error' ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertCircle size={28} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-navy-900">Something went wrong</h1>
          <p className="mt-1 text-navy-500">
            We couldn’t update your preference. You can turn weekly emails off any time in{' '}
            <Link to="/app/settings" className="font-semibold text-teal-600">Settings → Notifications</Link>.
          </p>
        </>
      ) : state === 'reenabled' ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Check size={28} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-navy-900">Weekly emails are back on</h1>
          <p className="mt-1 text-navy-500">You’ll keep getting your Friday progress summary.</p>
          <Link to="/app" className="btn-primary mt-6 text-sm">Back to daywise</Link>
        </>
      ) : (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">
            <BellOff size={28} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-navy-900">You’ve been unsubscribed</h1>
          <p className="mt-1 text-navy-500">
            You won’t receive the weekly progress email any more. Account and security emails still apply.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button onClick={reEnable} className="btn-ghost text-sm">
              Changed your mind? Re-enable
            </button>
            <Link to="/app" className="btn-primary text-sm">Back to daywise</Link>
          </div>
        </>
      )}
    </main>
  )
}
