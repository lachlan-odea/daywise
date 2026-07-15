import { useMemo, useRef, useState } from 'react'
import { Upload, X, Loader2, Check, ArrowLeft, FileText, AlertTriangle, Wand2, Sparkles } from 'lucide-react'
import {
  buildFromPlan,
  detectLayout,
  detectPlan,
  extractGrid,
  summarise,
  type ImportPlan,
  type NamedGrid,
  type SourceKind,
  type WeekPlan,
} from '../lib/importTimetable'
import { aiAvailable, aiExtractTimetable } from '../lib/aiTimetable'
import { CLASS_COLORS, DAYS_SHORT, cellKey, effectiveTime, type ClassColor, type Timetable } from '../lib/timetable'

const KIND_LABEL: Record<SourceKind, string> = { excel: 'Excel', word: 'Word', pdf: 'PDF' }

function kindOf(name: string): SourceKind {
  const n = name.toLowerCase()
  if (n.endsWith('.pdf')) return 'pdf'
  if (n.match(/\.xls|\.csv/)) return 'excel'
  return 'word'
}

/* ---------------------- editable preview of a built timetable ----------- */
function ResultPreview({ tt, onChange }: { tt: Timetable; onChange: (tt: Timetable) => void }) {
  const [week, setWeek] = useState<'A' | 'B'>('A')
  const dragSrc = useRef<{ periodId: string; day: number } | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)

  const move = (from: { periodId: string; day: number }, to: { periodId: string; day: number }) => {
    if (from.periodId === to.periodId && from.day === to.day) return
    const cells = { ...tt.cells }
    const fromKey = cellKey(week, from.periodId, from.day)
    const toKey = cellKey(week, to.periodId, to.day)
    const src = cells[fromKey]
    if (!src) return
    const dst = cells[toKey]
    cells[toKey] = src
    if (dst) cells[fromKey] = dst
    else delete cells[fromKey]
    onChange({ ...tt, cells })
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {tt.fortnightly ? (
          <div className="inline-flex rounded-full border border-navy-100 bg-white p-1">
            {(['A', 'B'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  week === w ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="text-xs text-navy-400">Drag a class to fix its slot (drop on another to swap).</span>
      </div>
      <div className="max-h-72 overflow-auto rounded-xl border border-navy-100">
        <table className="min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-navy-50/70 p-2 text-left font-bold text-navy-400">Period</th>
              {DAYS_SHORT.map((d) => (
                <th key={d} className="border-b border-navy-100 p-2 font-bold text-navy-700">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tt.periods.map((p) => (
              <tr key={p.id}>
                <td className="sticky left-0 border-b border-r border-navy-100 bg-white p-2">
                  <p className="font-bold text-navy-800">{p.label}</p>
                  {(p.start || p.end) && (
                    <p className="text-[10px] text-navy-400">
                      {p.start}
                      {p.start && p.end ? '–' : ''}
                      {p.end}
                    </p>
                  )}
                </td>
                {DAYS_SHORT.map((_, di) => {
                  const cell = tt.cells[cellKey(week, p.id, di)]
                  const time = effectiveTime(tt, p, week, di)
                  const overridden = time.start !== p.start || time.end !== p.end
                  const color = (cell?.color ?? 'teal') as ClassColor
                  const key = cellKey(week, p.id, di)
                  return (
                    <td
                      key={di}
                      onDragOver={(e) => {
                        if (!dragSrc.current) return
                        e.preventDefault()
                        setDropKey(key)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragSrc.current) move(dragSrc.current, { periodId: p.id, day: di })
                        dragSrc.current = null
                        setDropKey(null)
                      }}
                      className={`border-b border-l border-navy-100 p-1 align-top ${dropKey === key ? 'bg-teal-50' : ''}`}
                    >
                      {cell ? (
                        <div
                          draggable
                          onDragStart={() => (dragSrc.current = { periodId: p.id, day: di })}
                          onDragEnd={() => {
                            dragSrc.current = null
                            setDropKey(null)
                          }}
                          className={`cursor-move rounded-md border px-1.5 py-1 ${CLASS_COLORS[color].chip}`}
                        >
                          <p className="font-bold leading-tight">{cell.subject || cell.className}</p>
                          {cell.subject && cell.className && <p className="opacity-80">{cell.className}</p>}
                          {cell.room && <p className="opacity-70">Rm {cell.room}</p>}
                          {overridden && (
                            <p className="opacity-80">
                              {time.start}–{time.end}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="min-h-[28px]" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------------- manual column-mapping panel --------------------- */
function MappingPanel({
  sources,
  plan,
  onChange,
}: {
  sources: NamedGrid[]
  plan: WeekPlan
  onChange: (p: WeekPlan) => void
}) {
  const grid = sources[plan.sourceIndex]?.grid ?? []
  const maxCols = grid.reduce((m, r) => Math.max(m, r.length), 0)
  const { layout } = plan

  const colLabel = (ci: number) => {
    const head = grid[layout.headerRow]?.[ci]
    return `Col ${ci + 1}${head ? ` · ${head.slice(0, 14)}` : ''}`
  }
  const setLayout = (patch: Partial<typeof layout>) => onChange({ ...plan, layout: { ...layout, ...patch } })
  const setDayCol = (di: number, col: number | null) => {
    const dayCols = [...layout.dayCols]
    dayCols[di] = col
    setLayout({ dayCols })
  }

  const ColSelect = ({ value, onChangeVal }: { value: number | null; onChangeVal: (v: number | null) => void }) => (
    <select
      value={value ?? ''}
      onChange={(e) => onChangeVal(e.target.value === '' ? null : Number(e.target.value))}
      className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
    >
      <option value="">— none —</option>
      {Array.from({ length: maxCols }, (_, ci) => (
        <option key={ci} value={ci}>
          {colLabel(ci)}
        </option>
      ))}
    </select>
  )

  return (
    <div className="rounded-2xl border border-navy-100 bg-cloud/60 p-4">
      {sources.length > 1 && (
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-navy-700">Sheet / table</span>
          <select
            value={plan.sourceIndex}
            onChange={(e) => {
              const sourceIndex = Number(e.target.value)
              onChange({ sourceIndex, layout: detectLayout(sources[sourceIndex].grid) })
            }}
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
          >
            {sources.map((s, i) => (
              <option key={i} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-700">Header row (days)</span>
          <select
            value={layout.headerRow}
            onChange={(e) => setLayout({ headerRow: Number(e.target.value) })}
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-800 outline-none focus:border-teal-400"
          >
            {grid.slice(0, 15).map((_, r) => (
              <option key={r} value={r}>
                Row {r + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-700">Period label column</span>
          <ColSelect value={layout.periodCol} onChangeVal={(v) => setLayout({ periodCol: v })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-700">Start-time column</span>
          <ColSelect value={layout.startCol} onChangeVal={(v) => setLayout({ startCol: v })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-700">End-time column (optional)</span>
          <ColSelect value={layout.endCol} onChangeVal={(v) => setLayout({ endCol: v })} />
        </label>
      </div>
      <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-navy-400">Day columns</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {DAYS_SHORT.map((d, di) => (
          <label key={d} className="block">
            <span className="mb-1 block text-xs font-semibold text-navy-700">{d}</span>
            <ColSelect value={layout.dayCols[di]} onChangeVal={(v) => setDayCol(di, v)} />
          </label>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- modal ---------------------------------- */
export default function TimetableImport({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (tt: Timetable) => void
}) {
  const [step, setStep] = useState<'upload' | 'review' | 'map'>('upload')
  const [busy, setBusy] = useState(false)
  const [busyMsg, setBusyMsg] = useState('Reading your file…')
  const [error, setError] = useState('')
  const [aiError, setAiError] = useState('')
  const [dragging, setDragging] = useState(false)

  const [fileName, setFileName] = useState('')
  const [kind, setKind] = useState<SourceKind>('excel')
  const fileRef = useRef<File | null>(null)

  // AI result
  const [aiResult, setAiResult] = useState<Timetable | null>(null)

  // manual mapping
  const [sources, setSources] = useState<NamedGrid[]>([])
  const [note, setNote] = useState<string | undefined>()
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [weekTab, setWeekTab] = useState<'A' | 'B'>('A')

  const built = useMemo(() => (plan ? buildFromPlan(sources, plan) : null), [sources, plan])
  const stats = built ? summarise(built) : { periods: 0, classes: 0, weekA: 0, weekB: 0 }

  const runManual = async (file: File) => {
    const res = await extractGrid(file)
    if (!res.sources.length) throw new Error('Could not read any content from that file.')
    setSources(res.sources)
    setNote(res.note)
    setPlan(detectPlan(res.sources))
    setWeekTab('A')
    setStep('map')
  }

  const handleFile = async (file: File) => {
    setError('')
    setAiError('')
    fileRef.current = file
    setFileName(file.name)
    setKind(kindOf(file.name))
    setBusy(true)
    try {
      if (aiAvailable()) {
        setBusyMsg('Reading your timetable with Curriculum Intelligence…')
        try {
          const tt = await aiExtractTimetable(file)
          if (summarise(tt).classes === 0) throw new Error('No classes found')
          setAiResult(tt)
          setStep('review')
          return
        } catch {
          setAiError('Curriculum Intelligence couldn’t read this file — you can map the columns manually below.')
        }
      }
      setBusyMsg('Reading your file…')
      await runManual(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file. Please try another.')
    } finally {
      setBusy(false)
    }
  }

  const switchToManual = async () => {
    if (!fileRef.current) return
    setBusy(true)
    setBusyMsg('Reading your file…')
    try {
      await runManual(fileRef.current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  // preview grid for the manual step
  const activePlan = !plan ? null : !plan.fortnightly ? plan.single : weekTab === 'A' ? plan.weekA : plan.weekB
  const previewGrid = activePlan ? (sources[activePlan.sourceIndex]?.grid ?? []) : []
  const previewMaxCols = previewGrid.reduce((m, r) => Math.max(m, r.length), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-card">
        {/* header */}
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Wand2 size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-navy-900">Import timetable</h3>
              <p className="text-xs text-navy-400">
                {step === 'upload' ? 'PDF, Word or Excel' : `${KIND_LABEL[kind]} · ${fileName}`}
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
          {/* UPLOAD */}
          {step === 'upload' && (
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
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
                {busy ? (
                  <>
                    <Loader2 size={30} className="animate-spin text-teal-500" />
                    <p className="mt-3 text-sm font-semibold text-navy-700">{busyMsg}</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <Upload size={24} />
                    </span>
                    <p className="mt-4 text-base font-bold text-navy-900">Drop your timetable here</p>
                    <p className="mt-1 text-sm text-navy-500">or click to browse — PDF, Word (.docx) or Excel (.xlsx)</p>
                    {aiAvailable() && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-teal-600">
                        <Sparkles size={13} /> Curriculum Intelligence will read it for you
                      </p>
                    )}
                  </>
                )}
              </label>
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}
              <p className="mt-4 text-center text-xs text-navy-400">
                Your file is read privately in your browser — the file itself is never stored.
              </p>
            </>
          )}

          {/* AI REVIEW */}
          {step === 'review' && aiResult && (
            <>
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
                <Sparkles size={16} />
                Curriculum Intelligence read your timetable — <b>{summarise(aiResult).periods}</b> periods,{' '}
                {aiResult.fortnightly ? (
                  <>
                    <b>{summarise(aiResult).weekA}</b> classes in Week A, <b>{summarise(aiResult).weekB}</b> in Week B.
                  </>
                ) : (
                  <>
                    <b>{summarise(aiResult).classes}</b> classes.
                  </>
                )}
              </div>
              <ResultPreview tt={aiResult} onChange={setAiResult} />
              <p className="mt-3 text-xs text-navy-400">
                Check it looks right — you can fine-tune everything after importing. Not quite right?{' '}
                <button onClick={switchToManual} className="font-semibold text-teal-600 hover:text-teal-700">
                  Map the columns manually
                </button>
                .
              </p>
            </>
          )}

          {/* MANUAL MAP */}
          {step === 'map' && plan && (
            <>
              {aiError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {aiError}
                </div>
              )}
              {note && !aiError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {note}
                </div>
              )}

              <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy-800">
                <input
                  type="checkbox"
                  checked={plan.fortnightly}
                  onChange={(e) => setPlan({ ...plan, fortnightly: e.target.checked })}
                  className="h-4 w-4 rounded border-navy-300 text-teal-500 focus:ring-teal-300"
                />
                This is a fortnightly (Week A / Week B) timetable
              </label>

              {plan.fortnightly && (
                <div className="mb-3 inline-flex rounded-full border border-navy-100 bg-white p-1">
                  {(['A', 'B'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWeekTab(w)}
                      className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                        weekTab === w ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
                      }`}
                    >
                      Week {w}
                    </button>
                  ))}
                </div>
              )}

              {!plan.fortnightly ? (
                <MappingPanel sources={sources} plan={plan.single} onChange={(single) => setPlan({ ...plan, single })} />
              ) : weekTab === 'A' ? (
                <MappingPanel sources={sources} plan={plan.weekA} onChange={(weekA) => setPlan({ ...plan, weekA })} />
              ) : (
                <MappingPanel sources={sources} plan={plan.weekB} onChange={(weekB) => setPlan({ ...plan, weekB })} />
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
                <span className="flex items-center gap-1.5">
                  <Check size={16} /> <b>{stats.periods}</b> periods
                </span>
                {plan.fortnightly ? (
                  <>
                    <span>
                      Week A: <b>{stats.weekA}</b>
                    </span>
                    <span>
                      Week B: <b>{stats.weekB}</b>
                    </span>
                  </>
                ) : (
                  <span>
                    <b>{stats.classes}</b> classes
                  </span>
                )}
              </div>

              <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-navy-400">
                File preview{plan.fortnightly ? ` · Week ${weekTab} source` : ''}
              </p>
              <div className="max-h-56 overflow-auto rounded-xl border border-navy-100">
                <table className="min-w-full border-collapse text-xs">
                  <tbody>
                    {previewGrid.slice(0, 12).map((row, r) => (
                      <tr
                        key={r}
                        className={activePlan && r === activePlan.layout.headerRow ? 'bg-teal-50' : r % 2 ? 'bg-cloud/50' : ''}
                      >
                        <td className="border border-navy-100 px-2 py-1 font-bold text-navy-300">{r + 1}</td>
                        {Array.from({ length: previewMaxCols }, (_, c) => (
                          <td key={c} className="max-w-[140px] truncate border border-navy-100 px-2 py-1 text-navy-700">
                            {row[c] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* footer */}
        {step === 'review' && aiResult && (
          <div className="flex items-center justify-between border-t border-navy-100 px-6 py-4">
            <button onClick={() => setStep('upload')} className="btn-ghost text-sm">
              <ArrowLeft size={16} /> Choose another file
            </button>
            <button onClick={() => onImport(aiResult)} className="btn-primary text-sm">
              <FileText size={16} /> Import {summarise(aiResult).classes} classes
            </button>
          </div>
        )}
        {step === 'map' && (
          <div className="flex items-center justify-between border-t border-navy-100 px-6 py-4">
            <button onClick={() => setStep('upload')} className="btn-ghost text-sm">
              <ArrowLeft size={16} /> Choose another file
            </button>
            <button
              onClick={() => built && onImport(built)}
              disabled={!built || stats.classes === 0}
              className="btn-primary text-sm"
            >
              <FileText size={16} /> Import {stats.classes} classes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
