import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, PartyPopper, Rocket, X } from 'lucide-react'
import type { OnboardingState } from '../lib/onboarding'

/**
 * Dashboard setup guide. Replaces the older single-purpose "upload a program"
 * banner with the full sequence, so a new user always has one obvious next action.
 *
 * Progress is derived from real data by buildOnboarding(), so this never claims a
 * step is done when it isn't. Dismissal is persisted; completion is not, which is
 * why the finished state still needs an explicit dismiss.
 */
export default function SetupChecklist({
  state,
  onDismiss,
}: {
  state: OnboardingState
  onDismiss: () => void
}) {
  const [open, setOpen] = useState(true)
  const { steps, doneCount, total, percent, complete } = state

  if (complete) {
    return (
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <PartyPopper size={18} />
          </span>
          <div>
            <p className="font-bold text-navy-900">You’re all set up — nice work!</p>
            <p className="text-sm text-navy-500">
              Everything’s in place. From here it’s just a quick recording after each lesson.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-full border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-600 hover:bg-navy-50"
        >
          Got it
        </button>
      </div>
    )
  }

  // The first outstanding step is the one we actively push; the rest stay quiet.
  const nextStep = steps.find((s) => !s.done)

  return (
    <div className="mt-6 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-white">
          <Rocket size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-navy-900">Get set up</p>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-navy-500">
                {doneCount} of {total}
              </span>
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-navy-400 hover:bg-white/70"
                aria-label={open ? 'Collapse setup guide' : 'Expand setup guide'}
                aria-expanded={open}
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${open ? '' : '-rotate-90'}`}
                />
              </button>
              <button
                onClick={onDismiss}
                className="flex h-7 w-7 items-center justify-center rounded-full text-navy-400 hover:bg-white/70"
                aria-label="Dismiss setup guide"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Progress bar. aria-hidden because the "N of M" text above already conveys this. */}
          <div className="mt-2 flex items-center gap-2" aria-hidden="true">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
              <span
                className="block h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="shrink-0 text-xs font-bold text-teal-700">{percent}%</span>
          </div>

          {!open && nextStep && (
            <p className="mt-2 text-sm text-navy-500">
              Next up: <span className="font-semibold text-navy-700">{nextStep.label}</span>
            </p>
          )}

          {open && (
            <ul className="mt-4 space-y-1">
              {steps.map((s) => {
                const isNext = s.id === nextStep?.id
                return (
                  <li key={s.id}>
                    <div
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                        isNext ? 'bg-white shadow-sm' : ''
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          s.done
                            ? 'bg-teal-500 text-white'
                            : 'border-2 border-navy-200 bg-white'
                        }`}
                      >
                        {s.done && <Check size={12} strokeWidth={3.5} />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            s.done ? 'text-navy-400 line-through' : 'text-navy-900'
                          }`}
                        >
                          {s.label}
                        </p>
                        {!s.done && <p className="text-xs text-navy-400">{s.detail}</p>}
                      </div>

                      {!s.done && (
                        <Link
                          to={s.href}
                          className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                            isNext
                              ? 'bg-teal-500 text-white hover:bg-teal-600'
                              : 'border border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                          }`}
                        >
                          {s.cta} <ChevronRight size={13} />
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
