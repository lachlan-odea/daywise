import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpts(options)
      }),
    [],
  )

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpts(null)
  }, [])

  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false)
      else if (e.key === 'Enter') settle(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opts, settle])

  const danger = opts?.tone !== 'default'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-navy-950/50"
            onClick={() => settle(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-card"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                danger ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'
              }`}
            >
              {danger ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <h3 className="mt-4 text-lg font-bold text-navy-900">{opts.title}</h3>
            {opts.message && <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{opts.message}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => settle(false)} className="btn-ghost text-sm">
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                autoFocus
                onClick={() => settle(true)}
                className={
                  danger
                    ? 'btn bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700'
                    : 'btn-primary text-sm'
                }
              >
                {opts.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
