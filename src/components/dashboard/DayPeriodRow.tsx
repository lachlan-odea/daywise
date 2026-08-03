import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Circle, Loader2, Mic, NotebookPen, Plus, Sparkles, Waves } from 'lucide-react'
import { CLASS_COLORS, type ClassCell, type ClassColor, type TimeSlot, type Period } from '../../lib/timetable'
import { isEmptyNote, type NoteTag, type PlanningNote } from '../../lib/planning'
import { NoteTagChips, NoteTagPicker } from '../NoteTags'
import type { PeriodContext } from '../../lib/dashboard'

/** Small uppercase heading that labels each column, repeated per row so it survives stacking. */
function ColLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-navy-400">{children}</p>
}

function Dash() {
  return <span className="text-sm text-navy-200">—</span>
}

/* ------------------------------------------------------------------ *
 * Notes — the mini digital diary
 * ------------------------------------------------------------------ */

function NoteEditor({
  note,
  saving,
  placeholder,
  onSave,
  onCancel,
}: {
  note: PlanningNote
  saving: boolean
  placeholder: string
  onSave: (next: PlanningNote) => void
  onCancel: () => void
}) {
  // Seeded once on mount — the editor is mounted only while this row is being
  // edited, so it must NOT re-seed from `note`: every Firestore snapshot hands down
  // a fresh object, which would wipe whatever is being typed.
  const [text, setText] = useState(note.text)
  const [tags, setTags] = useState<NoteTag[]>(note.tags)

  return (
    <div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-lg border border-navy-200 bg-white p-2.5 text-sm text-navy-800 outline-none placeholder:text-navy-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
      />
      <NoteTagPicker tags={tags} onChange={setTags} className="mt-2" />
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button onClick={onCancel} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-navy-500 hover:bg-navy-100">
          Cancel
        </button>
        <button
          onClick={() => onSave({ text, tags })}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-60"
        >
          {saving && <Loader2 size={11} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}

interface NoteCellProps {
  note: PlanningNote
  editing: boolean
  saving: boolean
  canEdit: boolean
  placeholder: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (next: PlanningNote) => void
}

/**
 * The notes column, shared by class rows and free/break rows.
 *
 * `compact` is for free periods and breaks: those rows are deliberately slim, so an
 * empty one gets a small inline "Note" button rather than a full dashed panel that
 * would make every gap in the day as tall as a lesson.
 */
function NoteCell({
  note,
  editing,
  saving,
  canEdit,
  placeholder,
  compact = false,
  onStartEdit,
  onCancelEdit,
  onSave,
}: NoteCellProps & { compact?: boolean }) {
  if (editing) {
    return (
      <NoteEditor
        note={note}
        saving={saving}
        placeholder={placeholder}
        onSave={onSave}
        onCancel={onCancelEdit}
      />
    )
  }

  if (isEmptyNote(note)) {
    if (!canEdit) return compact ? null : <Dash />
    return compact ? (
      <button
        onClick={onStartEdit}
        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-navy-300 hover:bg-navy-50 hover:text-teal-600"
      >
        <Plus size={11} /> Note
      </button>
    ) : (
      <button
        onClick={onStartEdit}
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy-200 px-2.5 py-2 text-xs font-semibold text-navy-400 hover:border-teal-300 hover:text-teal-600"
      >
        <Plus size={12} /> Add a note
      </button>
    )
  }

  return (
    <button
      onClick={canEdit ? onStartEdit : undefined}
      className={`block w-full text-left ${canEdit ? 'group' : 'cursor-default'}`}
      title={canEdit ? 'Edit note' : undefined}
    >
      <NoteTagChips tags={note.tags} className="mb-1.5" />
      <span className="flex gap-1.5 whitespace-pre-wrap text-xs leading-relaxed text-navy-600 group-hover:text-navy-900">
        <NotebookPen size={12} className="mt-0.5 shrink-0 text-navy-300" />
        {note.text}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * The row
 * ------------------------------------------------------------------ */

export interface DayPeriodRowProps {
  period: Period
  time: TimeSlot
  cell?: ClassCell
  /** This period is happening right now (only ever true when viewing today). */
  isNow: boolean
  /** Derived last lesson / program position / recommended next for this class. */
  context: PeriodContext | null
  /** True once the day's programs have loaded, so an empty context isn't mistaken for "nothing to show". */
  contextReady: boolean
  note: PlanningNote
  /**
   * A numbered teaching period. Roll call, sport and the like still show on the day
   * (and can carry a note) but have no lesson to record or program to sit within.
   */
  teaching: boolean
  recorded: boolean
  /** The lesson can be recorded now — a teaching period whose start time has passed. */
  recordable: boolean
  recordHref: string
  editingNote: boolean
  savingNote: boolean
  canEdit: boolean
  onStartEditNote: () => void
  onCancelEditNote: () => void
  onSaveNote: (next: PlanningNote) => void
}

export default function DayPeriodRow({
  period,
  time,
  cell,
  isNow,
  context,
  contextReady,
  note,
  teaching,
  recorded,
  recordable,
  recordHref,
  editingNote,
  savingNote,
  canEdit,
  onStartEditNote,
  onCancelEditNote,
  onSaveNote,
}: DayPeriodRowProps) {
  const timeLabel = time.start ? (time.end ? `${time.start} – ${time.end}` : time.start) : ''

  const noteCell: NoteCellProps = {
    note,
    editing: editingNote,
    saving: savingNote,
    canEdit,
    placeholder: cell
      ? 'Anything you need to remember for this lesson…'
      : 'Anything you need to remember for this period…',
    onStartEdit: onStartEditNote,
    onCancelEdit: onCancelEditNote,
    onSave: onSaveNote,
  }

  // Break / free period — no lesson to report on, but still a slot in the day worth
  // making notes against (marking, a meeting to prep, someone to chase up).
  if (!cell) {
    return (
      <div
        className={`grid gap-x-5 gap-y-2 rounded-2xl border border-dashed px-4 py-2.5 2xl:grid-cols-[12rem_1fr_1fr_1fr] ${
          editingNote ? 'items-start' : 'items-center'
        } ${isNow ? 'border-teal-300 bg-teal-50/60' : 'border-navy-100'}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-navy-400">{timeLabel}</span>
          <span className="flex items-center gap-1 rounded-md bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy-500">
            {period.label}
          </span>
          {isNow && (
            <span className="flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">
              <Waves size={10} /> Now
            </span>
          )}
        </div>
        <div className="hidden 2xl:block">
          <Dash />
        </div>
        <div className="hidden 2xl:block">
          <Dash />
        </div>
        {/* Sits in the same column as the class rows' notes, so the day still reads
            as four aligned columns. */}
        <NoteCell {...noteCell} compact />
      </div>
    )
  }

  const color = (cell.color ?? 'teal') as ClassColor
  const isMeeting = cell.kind === 'meeting'
  const position = context?.position ?? null
  // Meetings and non-teaching periods have no lesson history or program to report on.
  const lessonBearing = teaching && !isMeeting

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isNow ? 'border-teal-300 bg-teal-50/50 ring-1 ring-teal-200' : 'border-navy-100 bg-white'
      }`}
    >
      <div className="grid gap-x-5 gap-y-4 p-4 sm:grid-cols-2 2xl:grid-cols-[12rem_1fr_1fr_1fr]">
        {/* ---- Left: time, class, recording status ---- */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-navy-800">{timeLabel || period.label}</p>
            {isNow && (
              <span className="flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">
                <Waves size={10} /> Now
              </span>
            )}
          </div>
          {timeLabel && <p className="text-xs text-navy-400">{period.label}</p>}

          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-navy-900">
            <span className={`h-2 w-2 shrink-0 rounded-full ${CLASS_COLORS[color].dot}`} />
            <span className="truncate">{cell.subject || cell.className}</span>
          </p>
          {(cell.subject && cell.className) || cell.room ? (
            <p className="mt-0.5 truncate pl-4 text-xs text-navy-400">
              {cell.subject && cell.className ? cell.className : ''}
              {cell.room ? `${cell.subject && cell.className ? ' · ' : ''}${cell.room}` : ''}
            </p>
          ) : null}

          <div className={isMeeting || teaching ? 'mt-2.5' : ''}>
            {isMeeting ? (
              <span className="inline-flex items-center rounded-md bg-navy-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-500">
                Meeting
              </span>
            ) : !teaching ? (
              // Roll call, sport and the like — the period label above says it all.
              null
            ) : recorded ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
                <Check size={12} strokeWidth={3} /> Recorded
              </span>
            ) : recordable ? (
              <Link
                to={recordHref}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                title="Record this lesson"
              >
                <Circle size={11} strokeWidth={3} /> Not recorded
              </Link>
            ) : (
              <Link
                to={recordHref}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-navy-400 hover:bg-navy-50 hover:text-navy-600"
                title="Record this lesson"
              >
                <Mic size={11} /> Record
              </Link>
            )}
          </div>
        </div>

        {/* ---- Centre-left: last lesson + program position ---- */}
        <div className="min-w-0">
          <ColLabel>Last lesson</ColLabel>
          {!lessonBearing ? (
            <Dash />
          ) : context?.last ? (
            <>
              <p className="text-sm font-bold leading-snug text-navy-900">{context.last.title}</p>
              {context.last.detail && (
                <div className="mt-1.5">
                  <p className="text-[11px] font-semibold text-navy-400">{context.last.detail.label}</p>
                  {context.last.detail.items.map((item, i) => (
                    <p key={i} className="truncate text-xs text-navy-500" title={item}>
                      {item}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-navy-400">
              {contextReady ? 'Nothing recorded for this class yet.' : 'Loading…'}
            </p>
          )}

          {position && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-navy-400">Program position</p>
              <Link
                to={`/app/programs/${position.programId}${position.lessonId ? `#lesson-${position.lessonId}` : ''}`}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline"
                title={position.programName}
              >
                {position.index > 0
                  ? `${position.unit} ${position.index} of ${position.total}`
                  : `Not started · 0 of ${position.total}`}
              </Link>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-navy-50">
                <span
                  className="block h-full rounded-full bg-teal-500"
                  style={{ width: `${Math.round(position.progress * 100)}%` }}
                />
              </span>
            </div>
          )}
        </div>

        {/* ---- Centre-right: recommended next ---- */}
        <div className="min-w-0">
          <ColLabel>Recommended next</ColLabel>
          {!lessonBearing ? (
            <Dash />
          ) : context?.next.title || context?.next.actions.length ? (
            <>
              {context.next.title && (
                <p className="text-sm font-bold leading-snug text-navy-900">
                  {context.last ? 'Next: ' : ''}
                  {context.next.title}
                </p>
              )}
              {context.next.actions.length > 0 && (
                <ul className={context.next.title ? 'mt-1.5 space-y-1' : 'space-y-1'}>
                  {context.next.actions.map((a, i) => (
                    <li key={i} className="flex gap-1.5 text-xs leading-snug text-navy-600">
                      <ArrowRight size={11} className="mt-0.5 shrink-0 text-teal-500" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : !contextReady ? (
            <p className="text-sm text-navy-400">Loading…</p>
          ) : position ? (
            <p className="text-sm text-navy-400">
              {position.progress >= 1
                ? 'Program complete — nothing left to teach. 🎉'
                : 'No further lessons in this program yet.'}
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-xs leading-snug text-navy-400">
              <Sparkles size={12} className="mt-0.5 shrink-0 text-navy-300" />
              Link a program to this class on Record Lesson to see what to teach next.
            </p>
          )}
        </div>

        {/* ---- Right: teacher notes ---- */}
        <div className="min-w-0">
          <ColLabel>Notes</ColLabel>
          <NoteCell {...noteCell} />
        </div>
      </div>
    </div>
  )
}
