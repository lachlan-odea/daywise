import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Trophy, X } from 'lucide-react'
import { burstConfetti } from '../lib/confetti'

interface Toast {
  id: number
  title: string
  description: string
}

interface ToastContextValue {
  /** Show an "Achievement unlocked" toast. */
  showAchievement: (title: string, description: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const remove = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))

  const showAchievement = useCallback((title: string, description: string) => {
    const id = ++counter
    setToasts((t) => [...t, { id, title, description }])
    burstConfetti()
    setTimeout(() => remove(id), 7000)
  }, [])

  return (
    <ToastContext.Provider value={{ showAchievement }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-card"
              style={{ animation: 'toast-in .3s ease' }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-sm">
                <Trophy size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Achievement unlocked</p>
                <p className="mt-0.5 text-sm font-bold text-navy-900">{t.title}</p>
                <p className="text-xs leading-snug text-navy-500">{t.description}</p>
              </div>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 rounded-full p-1 text-navy-300 hover:bg-navy-50 hover:text-navy-500"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
