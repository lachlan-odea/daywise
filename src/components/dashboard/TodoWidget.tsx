import { useMemo, useState } from 'react'
import { Check, ClipboardList, Plus, Trash2, X } from 'lucide-react'
import { addTodo, deleteTodo, updateTodo, type TodoItem } from '../../lib/agenda'

/** How many done tasks stay visible before they're rolled up behind a toggle. */
const DONE_PREVIEW = 3

/**
 * The teacher's running task list. Deliberately plain — a checkbox and a line of
 * text — so it stays as fast as scribbling on a sticky note.
 */
export default function TodoWidget({
  uid,
  todos,
  canEdit,
}: {
  uid: string
  todos: TodoItem[]
  /** False while viewing another teacher's account — writes are owner-only. */
  canEdit: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAllDone, setShowAllDone] = useState(false)

  // Outstanding tasks first — the point of the widget is what's left to do.
  const { open, done } = useMemo(() => {
    const open: TodoItem[] = []
    const done: TodoItem[] = []
    for (const t of todos) (t.done ? done : open).push(t)
    return { open, done }
  }, [todos])

  const visibleDone = showAllDone ? done : done.slice(0, DONE_PREVIEW)

  const submit = async () => {
    const text = draft.trim()
    if (!text) {
      setAdding(false)
      return
    }
    setBusy(true)
    try {
      await addTodo(uid, text)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  const row = (t: TodoItem) => (
    <li key={t.id} className="group flex items-start gap-2.5">
      <button
        onClick={() => canEdit && t.id && updateTodo(uid, t.id, { done: !t.done })}
        disabled={!canEdit}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          t.done
            ? 'border-teal-500 bg-teal-500 text-white'
            : 'border-navy-200 bg-white hover:border-teal-400 disabled:hover:border-navy-200'
        }`}
        aria-label={t.done ? `Mark "${t.text}" as not done` : `Mark "${t.text}" as done`}
      >
        {t.done && <Check size={11} strokeWidth={3.5} />}
      </button>
      <span className={`flex-1 text-sm leading-snug ${t.done ? 'text-navy-300 line-through' : 'text-navy-700'}`}>
        {t.text}
      </span>
      {canEdit && (
        <button
          onClick={() => t.id && deleteTodo(uid, t.id)}
          className="shrink-0 rounded p-0.5 text-navy-200 opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
          aria-label={`Delete "${t.text}"`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  )

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-800">
          <ClipboardList size={16} className="text-teal-600" /> To do
        </h2>
        {open.length > 0 && (
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold text-navy-500">
            {open.length} left
          </span>
        )}
      </div>

      {todos.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {open.map(row)}
          {visibleDone.map(row)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-navy-500">Nothing on the list. Add the small things you don’t want to forget.</p>
      )}

      {done.length > DONE_PREVIEW && (
        <button
          onClick={() => setShowAllDone((v) => !v)}
          className="mt-2 text-xs font-semibold text-navy-400 hover:text-navy-600"
        >
          {showAllDone ? 'Hide' : `Show ${done.length - DONE_PREVIEW} more`} completed
        </button>
      )}

      {canEdit &&
        (adding ? (
          <div className="mt-3 flex items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') {
                  setDraft('')
                  setAdding(false)
                }
              }}
              onBlur={submit}
              disabled={busy}
              placeholder="Add a task…"
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-800 outline-none placeholder:text-navy-300 focus:border-teal-400"
            />
            <button
              // mousedown fires before blur — preventing its default keeps focus on
              // the input, so cancelling discards the draft instead of saving it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDraft('')
                setAdding(false)
              }}
              className="shrink-0 rounded-lg p-1.5 text-navy-400 hover:bg-navy-50"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700"
          >
            <Plus size={14} /> Add a new task
          </button>
        ))}
    </div>
  )
}
