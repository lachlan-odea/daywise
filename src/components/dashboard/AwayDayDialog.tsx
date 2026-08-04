import { useState } from 'react'
import { CalendarOff, Loader2 } from 'lucide-react'
import { AWAY_REASONS, type AwayDay, type AwayReason } from '../../lib/away'

/**
 * Marks a whole day as away — illness, leave, a course. Opened from the daybook
 * header on the Dashboard.
 *
 * Deliberately one decision (why) plus an optional note: the point is that it takes
 * a couple of seconds on the morning you wake up sick, otherwise nobody does it and
 * the streak breaks anyway.
 */
export default function AwayDayDialog({
  dayLabel,
  existing,
  saving,
  onSave,
  onClear,
  onClose,
}: {
  /** The day being marked, e.g. "Wednesday 5 August". */
  dayLabel: string
  /** The day's current away record, when it's already marked. */
  existing: AwayDay | null
  saving: boolean
  onSave: (reason: AwayReason, note: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState<AwayReason>(existing?.reason ?? 'sick')
  const [note, setNote] = useState(existing?.note ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 cursor-default bg-navy-950/60" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="flex items-start gap-3 border-b border-navy-100 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
            <CalendarOff size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-navy-900">
              {existing ? 'Away this day' : 'Mark this day as away'}
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">{dayLabel}</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-navy-800">Why were you away?</legend>
            <div className="space-y-1.5">
              {AWAY_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    reason === r.id
                      ? 'border-violet-300 bg-violet-50 text-violet-800'
                      : 'border-navy-100 text-navy-600 hover:bg-navy-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="away-reason"
                    className="h-4 w-4 accent-violet-500"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-navy-800">
              Note <span className="font-normal text-navy-400">(optional)</span>
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. flu — relief teacher covered Year 9"
              maxLength={200}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
          </label>

          <p className="rounded-xl bg-cloud px-3 py-2.5 text-xs leading-relaxed text-navy-500">
            The day is set aside like a holiday: it won’t break your teaching streak, and its
            lessons won’t count against your weekly or coverage figures. Anything you did record
            stays in your diary.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-navy-100 p-4">
          {existing ? (
            <button
              onClick={onClear}
              disabled={saving}
              className="rounded-full px-3 py-2 text-sm font-semibold text-navy-500 hover:bg-navy-50 disabled:opacity-60"
            >
              I wasn’t away
            </button>
          ) : (
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-full px-3 py-2 text-sm font-semibold text-navy-500 hover:bg-navy-50 disabled:opacity-60"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSave(reason, note)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {existing ? 'Update' : 'Mark as away'}
          </button>
        </div>
      </div>
    </div>
  )
}
