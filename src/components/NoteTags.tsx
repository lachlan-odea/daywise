import { NOTE_TAGS, noteTagMeta, type NoteTag } from '../lib/planning'

/** The tags on a saved note, as coloured chips. */
export function NoteTagChips({ tags, className = '' }: { tags: NoteTag[]; className?: string }) {
  if (!tags.length) return null
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((t) => (
        <span key={t} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${noteTagMeta(t).chip}`}>
          {noteTagMeta(t).label}
        </span>
      ))}
    </span>
  )
}

/**
 * Optional note-type picker. Tagging is never required — teachers write the note as
 * normal, and a tag just colour-codes it so the day is easier to scan.
 */
export function NoteTagPicker({
  tags,
  onChange,
  className = '',
}: {
  tags: NoteTag[]
  onChange: (next: NoteTag[]) => void
  className?: string
}) {
  const toggle = (tag: NoteTag) =>
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {NOTE_TAGS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle(t.id)}
          aria-pressed={tags.includes(t.id)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
            tags.includes(t.id) ? t.chip : 'bg-navy-50 text-navy-400 hover:bg-navy-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
