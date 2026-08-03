import { useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  ACTIVITY_KINDS,
  activityKindMeta,
  deleteActivity,
  parseISODate,
  relativeDayLabel,
  saveActivity,
  todayISO,
  updateActivity,
  upcomingActivities,
  type Activity,
  type ActivityKind,
} from '../../lib/agenda'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

/** Big day / small month block, so the date reads before the words do. */
function DateBlock({ iso }: { iso: string }) {
  const date = parseISODate(iso)
  return (
    <span className="flex w-10 shrink-0 flex-col items-center leading-none">
      <span className="text-base font-extrabold text-navy-900">
        {date ? String(date.getDate()).padStart(2, '0') : '--'}
      </span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-400">
        {date ? date.toLocaleDateString(undefined, { month: 'short' }) : ''}
      </span>
    </span>
  )
}

type Draft = { title: string; date: string; detail: string; kind: ActivityKind }

const emptyDraft = (): Draft => ({ title: '', date: todayISO(), detail: '', kind: 'event' })

function ActivityForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-navy-100 bg-cloud/60 p-3">
      <input
        autoFocus
        className={inputCls}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="What's happening? e.g. Excursion: Art Gallery"
        maxLength={140}
      />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input
          type="date"
          className={inputCls}
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
        <input
          className={inputCls}
          value={draft.detail}
          onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
          placeholder="Class or cohort (optional)"
          maxLength={120}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setDraft({ ...draft, kind: k.id })}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
              draft.kind === k.id ? k.chip + ' ring-1 ring-inset ring-current' : 'bg-white text-navy-400 hover:bg-navy-50'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-navy-500 hover:bg-navy-100">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !draft.title.trim() || !draft.date}
          className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-60"
        >
          {saving && <Loader2 size={12} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}

/** Full list with add / edit / delete — everything the widget only previews. */
function ActivityManager({
  uid,
  activities,
  now,
  onClose,
}: {
  uid: string
  activities: Activity[]
  now: Date
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const today = todayISO(now)
  const upcoming = useMemo(() => upcomingActivities(activities, now), [activities, now])
  const past = useMemo(
    () => activities.filter((a) => a.date < today).sort((a, b) => b.date.localeCompare(a.date)),
    [activities, today],
  )

  const save = async () => {
    if (!draft?.title.trim() || !draft.date) return
    setSaving(true)
    try {
      const payload = { title: draft.title, date: draft.date, detail: draft.detail, kind: draft.kind }
      if (editingId) await updateActivity(uid, editingId, { ...payload, detail: payload.detail.trim() })
      else await saveActivity(uid, payload)
      setDraft(null)
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (a: Activity) => {
    setEditingId(a.id ?? null)
    setDraft({ title: a.title, date: a.date, detail: a.detail ?? '', kind: a.kind ?? 'event' })
  }

  const row = (a: Activity, muted: boolean) => (
    <div
      key={a.id}
      className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${muted ? 'bg-cloud/60' : 'bg-cloud'}`}
    >
      <DateBlock iso={a.date} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${muted ? 'text-navy-500' : 'text-navy-900'}`}>{a.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-navy-400">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activityKindMeta(a.kind).chip}`}>
            {activityKindMeta(a.kind).label}
          </span>
          {a.detail && <span className="truncate">{a.detail}</span>}
          <span>{relativeDayLabel(a.date, now)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => startEdit(a)}
          className="rounded-lg p-1.5 text-navy-400 hover:bg-white hover:text-navy-700"
          aria-label={`Edit ${a.title}`}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => a.id && deleteActivity(uid, a.id)}
          className="rounded-lg p-1.5 text-navy-400 hover:bg-red-50 hover:text-red-500"
          aria-label={`Delete ${a.title}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-navy-950/60" onClick={onClose} />
      <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <CalendarDays size={16} className="text-sky-600" /> Upcoming activities
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {draft ? (
            <ActivityForm
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={() => {
                setDraft(null)
                setEditingId(null)
              }}
              saving={saving}
            />
          ) : (
            <button
              onClick={() => setDraft(emptyDraft())}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-navy-200 py-2.5 text-sm font-semibold text-teal-600 hover:border-teal-300 hover:bg-teal-50"
            >
              <Plus size={15} /> Add an activity
            </button>
          )}

          {upcoming.length > 0 && <div className="space-y-2">{upcoming.map((a) => row(a, false))}</div>}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Past</p>
              {past.slice(0, 10).map((a) => row(a, true))}
            </div>
          )}

          {!activities.length && !draft && (
            <p className="text-center text-sm text-navy-500">
              Nothing here yet. Add excursions, assessment due dates, meetings and whole-school events so they
              never catch you out.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Dashboard widget: the next few dated things a teacher needs to remember, with the
 * full list (and add / edit / delete) behind the header.
 */
export default function UpcomingActivities({
  uid,
  activities,
  now,
  canEdit,
}: {
  uid: string
  activities: Activity[]
  now: Date
  /** False while viewing another teacher's account — writes are owner-only. */
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const upcoming = useMemo(() => upcomingActivities(activities, now).slice(0, 4), [activities, now])

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-800">
          <CalendarDays size={16} className="text-sky-600" /> Upcoming activities
        </h2>
        {canEdit && (
          <button
            onClick={() => setOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-navy-300 hover:bg-navy-50 hover:text-navy-600"
            aria-label="Manage activities"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {upcoming.length > 0 ? (
        <div className="mt-3 space-y-3">
          {upcoming.map((a) => (
            <div key={a.id} className="flex items-start gap-3">
              <DateBlock iso={a.date} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy-900" title={a.title}>
                  {a.title}
                </p>
                {a.detail && <p className="truncate text-xs text-navy-400">{a.detail}</p>}
                <p className={`text-xs font-semibold ${activityKindMeta(a.kind).accent}`}>
                  {relativeDayLabel(a.date, now)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-navy-500">
          No activities coming up. Add excursions, due dates and meetings so they never catch you out.
        </p>
      )}

      {canEdit && (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700"
        >
          {activities.length ? 'View all activities' : 'Add an activity'} <ChevronRight size={13} />
        </button>
      )}

      {open && canEdit && (
        <ActivityManager uid={uid} activities={activities} now={now} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
