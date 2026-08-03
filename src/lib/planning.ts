import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Optional note types. A teacher writes their note as normal; tagging it is never
 * required. The tag only colour-codes the note so a day can be scanned at a glance.
 */
export type NoteTag = 'planning' | 'reminder' | 'resource' | 'followup'

export const NOTE_TAGS: {
  id: NoteTag
  label: string
  /** Chip styling for the tag when displayed on a light card. */
  chip: string
  /** Chip styling for the tag on the dark "happening now" row. */
  chipDark: string
  /** Left edge accent used on the note body. */
  edge: string
}[] = [
  {
    id: 'planning',
    label: 'Planning',
    chip: 'bg-sky-100 text-sky-700',
    chipDark: 'bg-sky-400/25 text-sky-100',
    edge: 'bg-sky-400',
  },
  {
    id: 'reminder',
    label: 'Reminder',
    chip: 'bg-amber-100 text-amber-700',
    chipDark: 'bg-amber-400/25 text-amber-100',
    edge: 'bg-amber-400',
  },
  {
    id: 'resource',
    label: 'Resource',
    chip: 'bg-emerald-100 text-emerald-700',
    chipDark: 'bg-emerald-400/25 text-emerald-100',
    edge: 'bg-emerald-400',
  },
  {
    id: 'followup',
    label: 'Follow-up',
    chip: 'bg-violet-100 text-violet-700',
    chipDark: 'bg-violet-400/25 text-violet-100',
    edge: 'bg-violet-400',
  },
]

const TAG_IDS = new Set<string>(NOTE_TAGS.map((t) => t.id))
export const noteTagMeta = (tag: NoteTag) => NOTE_TAGS.find((t) => t.id === tag) ?? NOTE_TAGS[0]

export interface PlanningNote {
  text: string
  tags: NoteTag[]
}

/**
 * Lightweight planning notes for a class on a specific day — a mini digital diary.
 * Stored one document per date (`users/{uid}/planning/{yyyy-mm-dd}`) holding a
 * map of period id → note, so a day's notes load in a single read.
 */
export type PlanningNotes = Record<string, PlanningNote>

export const EMPTY_NOTE: PlanningNote = { text: '', tags: [] }

export const isEmptyNote = (n?: PlanningNote | null) => !n || (!n.text.trim() && n.tags.length === 0)

/**
 * Reads a stored note into the current shape. Notes were originally saved as a
 * bare string, so those keep working (untagged) without a migration.
 */
function normalizeNote(raw: unknown): PlanningNote {
  if (typeof raw === 'string') return { text: raw, tags: [] }
  if (!raw || typeof raw !== 'object') return { ...EMPTY_NOTE }
  const v = raw as { text?: unknown; tags?: unknown }
  return {
    text: typeof v.text === 'string' ? v.text : '',
    tags: Array.isArray(v.tags) ? (v.tags.filter((t) => typeof t === 'string' && TAG_IDS.has(t)) as NoteTag[]) : [],
  }
}

function normalizeDay(raw: unknown): PlanningNotes {
  const out: PlanningNotes = {}
  for (const [periodId, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const note = normalizeNote(value)
    if (!isEmptyNote(note)) out[periodId] = note
  }
  return out
}

export function subscribePlanningDay(uid: string, date: string, cb: (notes: PlanningNotes) => void) {
  if (!db) {
    cb({})
    return () => {}
  }
  const ref = doc(db, 'users', uid, 'planning', date)
  return onSnapshot(
    ref,
    (snap) => cb(normalizeDay(snap.data()?.notes)),
    () => cb({}),
  )
}

export async function savePlanningNote(uid: string, date: string, periodId: string, note: PlanningNote) {
  if (!db) throw { code: 'unavailable' }
  const ref = doc(db, 'users', uid, 'planning', date)
  const text = note.text.trim()
  // A note with no text is deleted outright — a tag on its own carries no meaning.
  const value = text ? { text, tags: note.tags.filter((t) => TAG_IDS.has(t)) } : deleteField()
  await setDoc(ref, { date, notes: { [periodId]: value } }, { merge: true })
}
