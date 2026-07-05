import { useState } from 'react'
import { Upload, X, Loader2, AlertTriangle, Sparkles, FileText, BookOpen, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { aiAvailable } from '../lib/aiTimetable'
import { aiExtractProgram, type ExtractedProgram } from '../lib/aiPrograms'
import { saveProgram } from '../lib/programs'

const inputCls =
  'w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-teal-400 focus:ring-4 focus:ring-teal-100'

export default function ProgramImport({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { user } = useAuth()
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const [extracted, setExtracted] = useState<ExtractedProgram | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [stage, setStage] = useState('')
  const [source, setSource] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setSource(file.name)
    setBusy(true)
    try {
      const res = await aiExtractProgram(file)
      if (!res.lessons.length) throw new Error('No lessons could be found in that document.')
      setExtracted(res)
      setName(res.name)
      setSubject(res.subject)
      setStage(res.stage)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyse that file. Please try another.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!user || !extracted) return
    setSaving(true)
    setError('')
    try {
      const id = await saveProgram(
        user.uid,
        { name: name.trim() || 'Untitled program', subject: subject.trim(), stage: stage.trim(), description: extracted.description, source },
        extracted.lessons,
      )
      onSaved(id)
    } catch {
      setError('Could not save the program. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={() => !busy && !saving && onClose()} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-navy-900">Upload a program</h3>
              <p className="text-xs text-navy-400">Curriculum Intelligence reads it for you</p>
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
          {!aiAvailable() ? (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Program analysis needs Firebase AI Logic enabled. See FIREBASE_AI_SETUP.md, then try again.
            </div>
          ) : step === 'upload' ? (
            <>
              <label
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFile(f)
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
                  dragging ? 'border-teal-400 bg-teal-50/60' : 'border-navy-200 hover:border-teal-300 hover:bg-cloud'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
                {busy ? (
                  <>
                    <Loader2 size={30} className="animate-spin text-teal-500" />
                    <p className="mt-3 text-sm font-semibold text-navy-700">Analysing your program with AI…</p>
                    <p className="mt-1 text-xs text-navy-400">Extracting lessons, outcomes and activities</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <Upload size={24} />
                    </span>
                    <p className="mt-4 text-base font-bold text-navy-900">Drop your teaching program here</p>
                    <p className="mt-1 text-sm text-navy-500">or click to browse — PDF, Word (.docx) or Excel (.xlsx)</p>
                  </>
                )}
              </label>
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}
              <p className="mt-4 text-center text-xs text-navy-400">
                Read privately in your browser — only the text is sent to the AI, never the file itself.
              </p>
            </>
          ) : (
            extracted && (
              <>
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  <Sparkles size={16} /> Found <b>{extracted.lessons.length}</b> lessons. Review the details, then save.
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-semibold text-navy-800">Program name</span>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-navy-800">Subject</span>
                    <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Science" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-navy-800">Stage / year</span>
                    <input className={inputCls} value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Stage 4" />
                  </label>
                </div>

                <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-navy-400">
                  Lessons ({extracted.lessons.length})
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {extracted.lessons.map((l, i) => (
                    <div key={i} className="rounded-xl border border-navy-100 bg-white p-3">
                      <p className="flex items-center gap-2 text-sm font-bold text-navy-900">
                        <BookOpen size={14} className="text-teal-600" /> {i + 1}. {l.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {l.term > 0 && <Tag>Term {l.term}</Tag>}
                        {l.outcomes.length > 0 && <Tag>{l.outcomes.length} outcomes</Tag>}
                        {l.activities.length > 0 && <Tag>{l.activities.length} activities</Tag>}
                        {l.resources.length > 0 && <Tag>{l.resources.length} resources</Tag>}
                        {l.keywords.length > 0 && <Tag>{l.keywords.length} keywords</Tag>}
                        {l.assessment.length > 0 && <Tag>{l.assessment.length} assessment</Tag>}
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                  </div>
                )}
              </>
            )
          )}
        </div>

        {step === 'review' && extracted && (
          <div className="flex items-center justify-between border-t border-navy-100 px-6 py-4">
            <button onClick={() => setStep('upload')} disabled={saving} className="btn-ghost text-sm">
              <ArrowLeft size={16} /> Choose another
            </button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Save program
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-600">{children}</span>
}
