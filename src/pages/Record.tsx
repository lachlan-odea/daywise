import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Mic,
  Square,
  Sparkles,
  Loader2,
  AlertTriangle,
  Check,
  ArrowLeft,
  Plus,
  X,
  Wand2,
  BookOpen,
  Info,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { aiAvailable } from '../lib/aiTimetable'
import { generateEvidence, type Candidate, type GeneratedEvidence } from '../lib/aiRecord'
import { getProgramList, getProgram } from '../lib/programs'
import { subscribeTimetable, cellKey, currentWeek, type Timetable } from '../lib/timetable'
import { saveEntry, EMPTY_EVIDENCE, type Evidence } from '../lib/entries'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

function todayIndex() {
  const d = new Date().getDay()
  return d >= 1 && d <= 5 ? d - 1 : -1
}
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ListField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">{label}</p>
      <div className="space-y-1.5">
        {items.map((it, j) => (
          <div key={j} className="flex items-center gap-1.5">
            <input
              value={it}
              onChange={(e) => {
                const next = [...items]
                next[j] = e.target.value
                onChange(next)
              }}
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
            />
            <button
              onClick={() => onChange(items.filter((_, k) => k !== j))}
              className="shrink-0 rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-500"
              aria-label="Remove"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-600 hover:bg-teal-50"
        >
          <Plus size={13} /> Add {placeholder}
        </button>
      </div>
    </div>
  )
}

function EvidenceField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={inputCls + ' resize-y'}
      />
    </label>
  )
}

export default function Record() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [date, setDate] = useState(params.get('date') || todayISO())
  const [note, setNote] = useState('')
  const [subject, setSubject] = useState(params.get('subject') || '')
  const [className, setClassName] = useState(params.get('class') || '')
  const [room, setRoom] = useState(params.get('room') || '')

  const [tt, setTt] = useState<Timetable | null>(null)
  const [step, setStep] = useState<'compose' | 'review'>('compose')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // editable generated evidence
  const [gen, setGen] = useState<GeneratedEvidence | null>(null)
  const [ev, setEv] = useState<Evidence>(EMPTY_EVIDENCE)
  const [outcomes, setOutcomes] = useState<string[]>([])

  const candidatesRef = useRef<Candidate[] | null>(null)
  const voiceBaseRef = useRef('')

  const { supported, listening, transcript, interim, start, stop } = useSpeechRecognition()

  // Merge the recognised transcript onto the note captured when recording began.
  useEffect(() => {
    if (!transcript) return
    const base = voiceBaseRef.current
    setNote((base ? `${base} ` : '') + transcript)
  }, [transcript])

  const toggleVoice = () => {
    if (listening) {
      stop()
      return
    }
    voiceBaseRef.current = note.trim()
    start()
  }

  useEffect(() => {
    if (!user) return
    return subscribeTimetable(user.uid, setTt)
  }, [user])

  const todaysClasses = useMemo(() => {
    const day = todayIndex()
    if (day < 0 || !tt) return []
    const week = currentWeek(tt)
    return tt.periods
      .map((p) => tt.cells[cellKey(week, p.id, day)])
      .filter((c): c is NonNullable<typeof c> => !!c)
  }, [tt])

  const pickClass = (c: { subject: string; className: string; room?: string }) => {
    setSubject(c.subject)
    setClassName(c.className)
    setRoom(c.room ?? '')
  }

  const loadCandidates = async (): Promise<Candidate[]> => {
    if (candidatesRef.current) return candidatesRef.current
    if (!user) return []
    const list = await getProgramList(user.uid)
    const fulls = await Promise.all(list.map((p) => (p.id ? getProgram(user.uid, p.id) : null)))
    const cands: Candidate[] = []
    for (const res of fulls) {
      if (!res) continue
      for (const l of res.lessons) {
        if (l.id)
          cands.push({
            programId: res.program.id!,
            programName: res.program.name,
            subject: res.program.subject,
            lessonId: l.id,
            title: l.title,
            outcomes: l.outcomes,
          })
      }
    }
    candidatesRef.current = cands
    return cands
  }

  const generate = async () => {
    if (!note.trim()) {
      setError('Add a note about the lesson first.')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const all = await loadCandidates()
      const subj = subject.trim().toLowerCase()
      const filtered =
        subj && all.length
          ? all.filter((c) => {
              const s = (c.subject ?? '').toLowerCase()
              return s && (s.includes(subj) || subj.includes(s))
            })
          : all
      const candidates = filtered.length ? filtered : all
      const result = await generateEvidence({
        note: note.trim(),
        klass: subject || className ? { subject, className } : undefined,
        candidates,
      })
      setGen(result)
      setOutcomes(result.outcomes)
      setEv({
        annotations: result.annotations,
        assessmentEvidence: result.assessmentEvidence,
        differentiation: result.differentiation,
        reflection: result.reflection,
        nextSteps: result.nextSteps,
      })
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate evidence. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const save = async (withEvidence: boolean) => {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const id = await saveEntry(user.uid, {
        date,
        note: note.trim(),
        subject: subject.trim(),
        className: className.trim(),
        room: room.trim() || undefined,
        programId: withEvidence ? gen?.matchedProgramId ?? undefined : undefined,
        programName: withEvidence ? gen?.matchedProgramName ?? undefined : undefined,
        lessonId: withEvidence ? gen?.matchedLessonId ?? undefined : undefined,
        lessonTitle: withEvidence ? gen?.matchedLessonTitle || undefined : undefined,
        confidence: withEvidence ? gen?.confidence : undefined,
        outcomes: withEvidence ? outcomes : [],
        evidence: withEvidence ? ev : EMPTY_EVIDENCE,
      })
      navigate(`/app/history/${id}`)
    } catch {
      setError('Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
        <Mic size={15} /> Record lesson
      </div>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
        {step === 'compose' ? 'What happened in class?' : 'Review your evidence'}
      </h1>

      {step === 'compose' ? (
        <div className="mt-6 space-y-5">
          {/* class + date */}
          {todaysClasses.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">Today’s classes</p>
              <div className="flex flex-wrap gap-2">
                {todaysClasses.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => pickClass(c)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      subject === c.subject && className === c.className
                        ? 'border-teal-300 bg-teal-50 text-teal-700'
                        : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                    }`}
                  >
                    {c.subject || c.className}
                    {c.className && c.subject ? ` · ${c.className}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Subject</span>
              <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Science" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Class</span>
              <input className={inputCls} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Year 9" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-navy-800">Date</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          {/* note */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-navy-800">What happened?</span>
              {supported && (
                <button
                  onClick={toggleVoice}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    listening ? 'bg-red-500 text-white' : 'bg-teal-500 text-white hover:bg-teal-600'
                  }`}
                >
                  {listening ? <Square size={12} /> : <Mic size={13} />}
                  {listening ? 'Stop' : 'Record voice'}
                </button>
              )}
            </div>
            <textarea
              value={note + (interim ? ` ${interim}` : '')}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              placeholder="Speak or type a quick note — e.g. “Ran the trolley-and-ramp prac for Year 9. Most measured acceleration well; Jamal and Priya needed extra help with the results table…”"
              className={inputCls + ' resize-y'}
            />
            {listening && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Listening…
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {aiAvailable() ? (
              <button onClick={generate} disabled={generating} className="btn-primary text-base">
                {generating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                Generate evidence
              </button>
            ) : (
              <span className="text-sm text-amber-600">AI is not configured — you can still save the note.</span>
            )}
            <button onClick={() => save(false)} disabled={saving || !note.trim()} className="btn-ghost text-sm">
              Save note only
            </button>
          </div>
        </div>
      ) : (
        gen && (
          <div className="mt-6 space-y-5">
            {/* matched lesson */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <Sparkles size={18} className="text-teal-600" />
              {gen.matchedLessonTitle ? (
                <p className="flex-1 text-sm text-navy-700">
                  Matched to <b>{gen.matchedLessonTitle}</b>
                  {gen.matchedProgramName ? ` · ${gen.matchedProgramName}` : ''}
                </p>
              ) : (
                <p className="flex-1 text-sm text-navy-700">No specific lesson matched — evidence generated from your note.</p>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  gen.confidence === 'high'
                    ? 'bg-teal-500 text-white'
                    : gen.confidence === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-navy-100 text-navy-600'
                }`}
              >
                {gen.confidence} confidence
              </span>
            </div>

            <ListField label="Outcomes" items={outcomes} onChange={setOutcomes} placeholder="outcome" />
            <EvidenceField
              label="Program annotation"
              value={ev.annotations}
              onChange={(v) => setEv({ ...ev, annotations: v })}
            />
            <EvidenceField
              label="Assessment evidence"
              value={ev.assessmentEvidence}
              onChange={(v) => setEv({ ...ev, assessmentEvidence: v })}
            />
            <EvidenceField
              label="Differentiation"
              value={ev.differentiation}
              onChange={(v) => setEv({ ...ev, differentiation: v })}
              rows={2}
            />
            <div>
              <EvidenceField label="Reflection" value={ev.reflection} onChange={(v) => setEv({ ...ev, reflection: v })} />
              {!ev.reflection.trim() && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-navy-400">
                  <Info size={13} className="shrink-0 text-navy-300" /> No reflection was drawn from your note — add one
                  if you’d like.
                </p>
              )}
            </div>
            <div>
              <ListField
                label="Next lesson actions"
                items={ev.nextSteps}
                onChange={(v) => setEv({ ...ev, nextSteps: v })}
                placeholder="action"
              />
              {ev.nextSteps.length === 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-navy-400">
                  <Info size={13} className="shrink-0 text-navy-300" /> No next steps were drawn from your note — add any
                  follow-ups if you’d like.
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('compose')} disabled={saving} className="btn-ghost text-sm">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => save(true)} disabled={saving} className="btn-primary text-base">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Save to diary
              </button>
            </div>
          </div>
        )
      )}

      {step === 'compose' && !aiAvailable() && (
        <p className="mt-6 flex items-center gap-2 text-xs text-navy-400">
          <BookOpen size={13} /> Enable Firebase AI Logic to auto-generate evidence — see FIREBASE_AI_SETUP.md.
        </p>
      )}
    </main>
  )
}
