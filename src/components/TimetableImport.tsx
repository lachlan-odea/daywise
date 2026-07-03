import { useMemo, useRef, useState } from 'react'
import { Upload, X, Loader2, Check, ArrowLeft, FileText, AlertTriangle, Wand2 } from 'lucide-react'
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
import { DAYS_SHORT, type Timetable } from '../lib/timetable'

const KIND_LABEL: Record<SourceKind, string> = { excel: 'Excel', word: 'Word', pdf: 'PDF' }

/* mapping controls for a single week/source */
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

  const ColSelect = ({
    value,
    onChangeVal,
  }: {
    value: number | null
    onChangeVal: (v: number | null) => void
  }) => (
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

export default function TimetableImport({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (tt: Timetable) => void
}) {
  const [step, setStep] = useState<'upload' | 'map'>('upload')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const [sources, setSources] = useState<NamedGrid[]>([])
  const [kind, setKind] = useState<SourceKind>('excel')
  const [note, setNote] = useState<string | undefined>()
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [weekTab, setWeekTab] = useState<'A' | 'B'>('A')

  const inputRef = useRef<HTMLInputElement>(null)

  const built = useMemo(() => (plan ? buildFromPlan(sources, plan) : null), [sources, plan])
  const stats = built ? summarise(built) : { periods: 0, classes: 0, weekA: 0, weekB: 0 }

  // Which source grid to show in the preview
  const activePlan = !plan ? null : !plan.fortnightly ? plan.single : weekTab === 'A' ? plan.weekA : plan.weekB
  const previewGrid = activePlan ? (sources[activePlan.sourceIndex]?.grid ?? []) : []
  const previewMaxCols = previewGrid.reduce((m, r) => Math.max(m, r.length), 0)

  const handleFile = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      const res = await extractGrid(file)
      if (!res.sources.length) throw new Error('Could not read any content from that file.')
      setSources(res.sources)
      setKind(res.kind)
      setNote(res.note)
      setFileName(file.name)
      setPlan(detectPlan(res.sources))
      setWeekTab('A')
      setStep('map')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file. Please try another.')
    } finally {
      setBusy(false)
    }
  }

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
          {step === 'upload' ? (
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
                  ref={inputRef}
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
                    <p className="mt-3 text-sm font-semibold text-navy-700">Reading your file…</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <Upload size={24} />
                    </span>
                    <p className="mt-4 text-base font-bold text-navy-900">Drop your timetable here</p>
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
                Your file is read privately in your browser — it is never uploaded to a server.
              </p>
            </>
          ) : (
            plan && (
              <>
                {note && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {note}
                  </div>
                )}

                {/* fortnightly toggle */}
                <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy-800">
                  <input
                    type="checkbox"
                    checked={plan.fortnightly}
                    onChange={(e) => setPlan({ ...plan, fortnightly: e.target.checked })}
                    className="h-4 w-4 rounded border-navy-300 text-teal-500 focus:ring-teal-300"
                  />
                  This is a fortnightly (Week A / Week B) timetable
                </label>

                {/* week tabs when fortnightly */}
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

                {/* mapping */}
                {!plan.fortnightly ? (
                  <MappingPanel sources={sources} plan={plan.single} onChange={(single) => setPlan({ ...plan, single })} />
                ) : weekTab === 'A' ? (
                  <MappingPanel sources={sources} plan={plan.weekA} onChange={(weekA) => setPlan({ ...plan, weekA })} />
                ) : (
                  <MappingPanel sources={sources} plan={plan.weekB} onChange={(weekB) => setPlan({ ...plan, weekB })} />
                )}

                {/* result summary */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  <span className="flex items-center gap-1.5">
                    <Check size={16} /> <b>{stats.periods}</b> periods
                  </span>
                  {plan.fortnightly ? (
                    <>
                      <span>
                        Week A: <b>{stats.weekA}</b> classes
                      </span>
                      <span>
                        Week B: <b>{stats.weekB}</b> classes
                      </span>
                    </>
                  ) : (
                    <span>
                      <b>{stats.classes}</b> classes
                    </span>
                  )}
                  {stats.classes === 0 && <span>· try adjusting the mapping above</span>}
                </div>

                {/* raw grid preview */}
                <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-navy-400">
                  File preview{plan.fortnightly ? ` · Week ${weekTab} source` : ''}
                </p>
                <div className="max-h-56 overflow-auto rounded-xl border border-navy-100">
                  <table className="min-w-full border-collapse text-xs">
                    <tbody>
                      {previewGrid.slice(0, 12).map((row, r) => (
                        <tr
                          key={r}
                          className={
                            activePlan && r === activePlan.layout.headerRow ? 'bg-teal-50' : r % 2 ? 'bg-cloud/50' : ''
                          }
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
                {previewGrid.length > 12 && (
                  <p className="mt-1 text-xs text-navy-400">Showing first 12 of {previewGrid.length} rows.</p>
                )}
              </>
            )
          )}
        </div>

        {/* footer */}
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
