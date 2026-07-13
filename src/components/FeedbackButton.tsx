import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageSquare, X, Loader2, Check, Send, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { submitFeedback } from '../lib/feedback'

const MODULES = ['Dashboard', 'Timetable', 'Record Lesson', 'Programs', 'History', 'Settings', 'General'] as const
const TYPES = ['Bug', 'Idea / suggestion', 'Praise', 'Other'] as const

function moduleFromPath(path: string): string {
  if (path.startsWith('/app/timetable')) return 'Timetable'
  if (path.startsWith('/app/record')) return 'Record Lesson'
  if (path.startsWith('/app/programs')) return 'Programs'
  if (path.startsWith('/app/history')) return 'History'
  if (path.startsWith('/app/settings')) return 'Settings'
  if (path.startsWith('/app')) return 'Dashboard'
  return 'General'
}

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

export default function FeedbackButton() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [moduleName, setModuleName] = useState('General')
  const [type, setType] = useState<string>('Idea / suggestion')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const openModal = () => {
    setModuleName(moduleFromPath(location.pathname))
    setType('Idea / suggestion')
    setMessage('')
    setError('')
    setDone(false)
    setOpen(true)
  }

  const submit = async () => {
    if (!message.trim()) {
      setError('Please enter your feedback.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitFeedback({
        uid: user?.uid ?? '',
        name: profile?.displayName || user?.displayName || '',
        email: user?.email ?? '',
        page: location.pathname,
        module: moduleName,
        type,
        message: message.trim(),
      })
      setDone(true)
      setTimeout(() => setOpen(false), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send feedback. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-navy-600 hover:bg-navy-50"
        title="Send feedback"
      >
        <MessageSquare size={17} />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => !busy && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {done ? (
              <div className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                  <Check size={28} />
                </span>
                <p className="mt-4 text-lg font-bold text-navy-900">Thanks for your feedback!</p>
                <p className="mt-1 text-sm text-navy-500">It helps us make daywise better.</p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                  <MessageSquare size={22} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-navy-900">Send feedback</h3>
                <p className="mt-1 text-sm text-navy-500">
                  Tell us what’s working, what’s not, or what you’d love to see.
                </p>

                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-navy-800">About</span>
                      <select className={inputCls} value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
                        {MODULES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-navy-800">Type</span>
                      <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-navy-800">Your feedback</span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder="Share as much detail as you like…"
                      className={inputCls + ' resize-y'}
                      autoFocus
                    />
                  </label>

                  {error && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs text-navy-400">Sent from {moduleFromPath(location.pathname)}</span>
                  <button onClick={submit} disabled={busy} className="btn-primary text-sm">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />} Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
