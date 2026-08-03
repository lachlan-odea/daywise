import { Link } from 'react-router-dom'
import { BarChart3, BookOpen, CalendarCheck, ChevronRight, Clock, Flame, ShieldCheck } from 'lucide-react'
import { formatDuration, type WeekSnapshot } from '../../lib/dashboard'

/**
 * The weekly reference points the meters are measured against when there's no
 * natural denominator: the ~5 hours/week daywise aims to give back, and the
 * 10-consecutive-day Streak Master milestone.
 */
const TIME_SAVED_TARGET_MINUTES = 300
const STREAK_TARGET_DAYS = 10

/**
 * Meter fills are deliberately NOT one-hue-per-row. Teal marks the three rows that
 * represent work banked, the remainder is a recessive neutral because it isn't an
 * achievement, and the streak keeps the amber used for streaks everywhere else in
 * the app. Every row also carries an icon, a label and a number, so the colour only
 * ever reinforces meaning — it never has to be decoded.
 */
const FILL = {
  banked: 'bg-teal-500',
  remaining: 'bg-navy-300',
  streak: 'bg-amber-600',
}

function Row({
  icon,
  label,
  value,
  suffix,
  fill,
  progress,
}: {
  icon: React.ReactNode
  label: string
  value: string
  /** Small trailing context — "of 20", "This week", "Keep it going!". */
  suffix?: string
  fill: string
  /** 0–1 share of the meter to fill, or null for no meter. */
  progress: number | null
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cloud text-navy-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {/* Label and value share a line; the meter and its context sit beneath, so
            neither ever has to fight the other for width in a narrow sidebar. */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm text-navy-600">{label}</span>
          <span className="shrink-0 text-sm font-bold text-navy-900">{value}</span>
        </div>
        {progress !== null ? (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-navy-50">
              <span
                className={`block h-full rounded-full ${fill}`}
                style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
              />
            </span>
            {suffix && (
              <span className="shrink-0 text-[10px] font-semibold text-navy-400">{suffix}</span>
            )}
          </div>
        ) : (
          suffix && <p className="text-[10px] font-semibold text-navy-400">{suffix}</p>
        )}
      </div>
    </div>
  )
}

/**
 * This week at a glance. Progress against what's actually timetabled, so the
 * numbers mean something — rather than a bare count with nothing to measure it by.
 */
export default function WeeklySnapshot({ snapshot }: { snapshot: WeekSnapshot }) {
  const { scheduled, taught, remaining, evidence, minutesSaved, streak } = snapshot
  const outOf = scheduled > 0 ? `of ${scheduled}` : undefined
  const share = (n: number) => (scheduled > 0 ? n / scheduled : null)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-800">
          <BarChart3 size={16} className="text-navy-500" /> Weekly snapshot
        </h2>
      </div>

      <div className="mt-4 space-y-3">
        <Row
          icon={<BookOpen size={14} />}
          label="Lessons taught"
          value={String(taught)}
          suffix={outOf}
          fill={FILL.banked}
          progress={share(taught)}
        />
        <Row
          icon={<CalendarCheck size={14} />}
          label="Lessons remaining"
          value={scheduled > 0 ? String(remaining) : '—'}
          suffix={outOf}
          fill={FILL.remaining}
          progress={share(remaining)}
        />
        <Row
          icon={<ShieldCheck size={14} />}
          label="Evidence recorded"
          value={String(evidence)}
          suffix={outOf}
          fill={FILL.banked}
          progress={share(evidence)}
        />
        <Row
          icon={<Clock size={14} />}
          label="Est. time saved"
          value={formatDuration(minutesSaved)}
          suffix="This week"
          fill={FILL.banked}
          progress={minutesSaved / TIME_SAVED_TARGET_MINUTES}
        />
        <Row
          icon={<Flame size={14} />}
          label="Teaching streak"
          value={streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '—'}
          suffix={streak > 0 ? 'Keep it going!' : undefined}
          fill={FILL.streak}
          progress={streak / STREAK_TARGET_DAYS}
        />
      </div>

      <Link
        to="/app/reports"
        className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700"
      >
        View full report <ChevronRight size={13} />
      </Link>
    </div>
  )
}
