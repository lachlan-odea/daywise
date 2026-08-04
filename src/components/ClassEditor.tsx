import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, Loader2, School, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { saveClass, timetableClasses, updateClass, type ClassInfo, type TimetableClass } from '../lib/classes'
import { sharedClassMeta, updateSharedClass } from '../lib/sharedClasses'
import { classKey } from '../lib/classPrograms'
import { getTimetableOnce, CLASS_COLORS, type ClassColor } from '../lib/timetable'
import ClassIconTile, { CLASS_ICONS, subjectIconKey } from './ClassIcon'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

/** Guesses "Year 9" from a class code like "9SC1" or "IESc269". */
function guessYearGroup(className: string): string {
  const m = className.match(/(?:^|\D)(1[0-2]|[1-9])(?=\D|$)/)
  return m ? `Year ${m[1]}` : ''
}

export default function ClassEditor({
  existing,
  prefill,
  onClose,
  onSaved,
}: {
  /** When set, the modal edits this class instead of creating one. */
  existing?: ClassInfo
  /** Initial values for a new class (e.g. from a timetable suggestion). */
  prefill?: Partial<ClassInfo>
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { user, effectiveUid } = useAuth()
  const base = existing ?? prefill
  const initialYear = base?.yearGroup || (base?.className ? guessYearGroup(base.className) : '')
  const initialName =
    base?.name ||
    (base?.subject
      ? initialYear
        ? `${initialYear} ${base.subject}`
        : [base.subject, base.className].filter(Boolean).join(' ')
      : '')
  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(base?.subject ?? '')
  const [className, setClassName] = useState(base?.className ?? '')
  const [yearGroup, setYearGroup] = useState(initialYear)
  const [room, setRoom] = useState(base?.room ?? '')
  const [color, setColor] = useState<ClassColor>(base?.color ?? 'teal')
  const [icon, setIcon] = useState(base?.icon && base.icon in CLASS_ICONS ? base.icon : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<TimetableClass[]>([])

  // Offer the classes already on the timetable as one-click fills when creating.
  useEffect(() => {
    if (existing || !user) return
    getTimetableOnce(effectiveUid).then((tt) => setSuggestions(timetableClasses(tt)))
  }, [existing, user])

  const applySuggestion = (s: TimetableClass) => {
    const year = guessYearGroup(s.className)
    setSubject(s.subject)
    setClassName(s.className)
    setRoom(s.room ?? '')
    if (s.color) setColor(s.color)
    setYearGroup(year)
    setName(year ? `${year} ${s.subject}` : [s.subject, s.className].filter(Boolean).join(' '))
  }

  const save = async () => {
    if (!user) return
    if (!name.trim() || !subject.trim()) {
      setError('Give the class a name and a subject.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      className: className.trim(),
      yearGroup: yearGroup.trim(),
      room: room.trim(),
      color,
      icon,
    }
    try {
      if (existing?.id) {
        await updateClass(effectiveUid, existing.id, payload)
        if (existing.sharedClassId) await updateSharedClass(existing.sharedClassId, sharedClassMeta(payload))
        onSaved(existing.id)
      } else {
        const id = await saveClass(effectiveUid, { ...payload, notes: '' })
        onSaved(id)
      }
    } catch {
      setError('Could not save the class. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={() => !saving && onClose()} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <School size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-navy-900">{existing ? 'Class settings' : 'Create a class'}</h3>
              <p className="text-xs text-navy-400">
                {existing ? 'Update the class details' : 'Set up a class you teach'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!existing && suggestions.length > 0 && (
            <div className="mb-5 rounded-2xl bg-cloud p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-500">
                <CalendarClock size={13} /> From your timetable
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => {
                  const active = classKey(subject, className) === classKey(s.subject, s.className)
                  return (
                    <button
                      key={classKey(s.subject, s.className)}
                      onClick={() => applySuggestion(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-navy-200 bg-white text-navy-600 hover:border-teal-300 hover:text-teal-600'
                      }`}
                    >
                      {[s.subject, s.className].filter(Boolean).join(' · ')}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Class name</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Year 9 Science" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Subject</span>
              <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Science" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Class code</span>
              <input className={inputCls} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="9SC1" />
              <span className="mt-1 block text-xs text-navy-400">As it appears on your timetable</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Year group</span>
              <input className={inputCls} value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} placeholder="Year 9" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Room</span>
              <input className={inputCls} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Main Classroom" />
            </label>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Icon</span>
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(CLASS_ICONS).map(([key, { icon: Icon, label }]) => {
                  const active = (icon || subjectIconKey(subject)) === key
                  return (
                    <button
                      key={key}
                      onClick={() => setIcon(icon === key ? '' : key)}
                      title={active && !icon ? `${label} (picked from subject)` : label}
                      aria-label={label}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                        active
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-navy-200 bg-white text-navy-400 hover:border-teal-300 hover:text-teal-600'
                      }`}
                    >
                      <Icon size={17} />
                    </button>
                  )
                })}
              </div>
              <span className="mt-1.5 block text-xs text-navy-400">
                {icon ? 'Click the selected icon again to pick automatically from the subject.' : 'Picked automatically from the subject — click to choose your own.'}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Colour</span>
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(CLASS_COLORS) as ClassColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={CLASS_COLORS[c].label}
                    aria-label={CLASS_COLORS[c].label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform ${CLASS_COLORS[c].dot} ${
                      color === c ? 'scale-110 ring-2 ring-navy-800 ring-offset-2' : 'hover:scale-110'
                    }`}
                  >
                    {color === c && <Check size={14} className="text-white" />}
                  </button>
                ))}
                <ClassIconTile subject={subject} icon={icon} color={color} size={36} iconSize={17} />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-navy-100 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="btn-ghost text-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {existing ? 'Save changes' : 'Create class'}
          </button>
        </div>
      </div>
    </div>
  )
}
