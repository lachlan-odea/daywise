import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Table2 } from 'lucide-react'

export interface ChartSeries {
  label: string
  /** Series colour. Validated as a set — see CHART_COLORS. */
  color: string
  values: number[]
}

interface Props {
  /** One label per point, in x order. */
  labels: string[]
  series: ChartSeries[]
  /** Plot height in px (excludes legend, axis labels and the table disclosure). */
  height?: number
  /** Fill a 10% wash under the first series. Reserved for single-series charts. */
  area?: boolean
  /** Describes the chart for screen readers and the table caption. */
  title: string
}

/**
 * Categorical chart palette, drawn from the daywise brand ramps and validated as a
 * set (all pairs, light surface #ffffff): lightness band, chroma floor, CVD
 * separation, normal-vision separation and 3:1 contrast all pass. Assign by slot
 * order and never cycle — a chart needing a 4th series wants faceting instead.
 */
export const CHART_COLORS = ['#0f8570', '#1f72d6', '#d97706'] as const

const AXIS = '#c9d2e6'
const GRID = '#e8edf7'
const MUTED = '#8593b4'

const PAD = { top: 12, right: 14, bottom: 26, left: 40 }

/** Rounds a maximum up to a clean axis top so ticks land on readable numbers. */
function niceMax(v: number): number {
  if (v <= 4) return 4
  const mag = 10 ** Math.floor(Math.log10(v))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10
  return step * mag
}

const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n))

export default function LineChart({ labels, series, height = 200, area = false, title }: Props) {
  const gradId = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  // Measure rather than scaling a viewBox: a stretched viewBox would distort the
  // axis text and throw off pointer-to-index maths.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setHover(null)
  }, [labels.length])

  const n = labels.length
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom

  const max = useMemo(
    () => niceMax(Math.max(1, ...series.flatMap((s) => s.values))),
    [series],
  )

  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))

  // Thin the x labels to fit the measured width — ~64px per tick is enough for
  // "31 Jul" at 10px with air around it — always keeping the last point so "now"
  // stays anchored.
  const labelIdx = useMemo(() => {
    if (n === 0) return []
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))))
    const out: number[] = []
    for (let i = n - 1; i >= 0; i -= step) out.unshift(i)
    return out
  }, [n, plotW])

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  const pick = (clientX: number) => {
    const el = wrapRef.current
    if (!el || n === 0) return
    const rect = el.getBoundingClientRect()
    const rel = clientX - rect.left - PAD.left
    setHover(Math.min(n - 1, Math.max(0, Math.round((rel / plotW) * (n - 1)))))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setHover(null)
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + delta)))
  }

  const summary = `${title}. ${series
    .map((s) => `${s.label}: ${s.values[n - 1] ?? 0} at ${labels[n - 1] ?? ''}`)
    .join('. ')}`

  return (
    <div>
      {/* overflow-hidden guards the one frame between a container shrinking and the
          ResizeObserver re-rendering the svg at the smaller width. */}
      <div ref={wrapRef} className="relative min-w-0 overflow-hidden">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series[0]?.color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={series[0]?.color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* gridlines + y ticks */}
          {ticks.map((t, ti) => (
            <g key={ti}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth="1" />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill={MUTED}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmt(t)}
              </text>
            </g>
          ))}

          {/* x tick labels */}
          {/* End ticks anchor inward so they can't be clipped by the svg edge. */}
          {labelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              fontSize="10"
              fill={MUTED}
            >
              {labels[i]}
            </text>
          ))}

          {area && series[0] && n > 1 && (
            <path
              d={`${path(series[0].values)} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`}
              fill={`url(#${gradId})`}
            />
          )}

          {/* crosshair sits under the marks so it never cuts across them */}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={AXIS} strokeWidth="1" />
          )}

          {series.map((s) => (
            <path
              key={s.label}
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* end marker, and the hovered point on every series */}
          {series.map((s) => (
            <g key={`${s.label}-dots`}>
              {n > 0 && (
                <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r="4" fill={s.color} stroke="#ffffff" strokeWidth="2" />
              )}
              {hover !== null && hover !== n - 1 && (
                <circle cx={x(hover)} cy={y(s.values[hover] ?? 0)} r="4" fill={s.color} stroke="#ffffff" strokeWidth="2" />
              )}
            </g>
          ))}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[112px] rounded-xl border border-navy-100 bg-white/95 px-3 py-2 shadow-soft backdrop-blur-sm"
            style={{
              left: Math.min(Math.max(x(hover) - 56, 0), Math.max(0, width - 130)),
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.label} className="mt-1 flex items-baseline gap-1.5">
                <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-sm font-bold text-navy-900">{s.values[hover] ?? 0}</span>
                <span className="text-[11px] text-navy-400">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* A legend is required for two or more series; one series is named by the
          card heading, so a single-swatch box would only restate it. */}
      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-xs font-semibold text-navy-500">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-navy-400 hover:text-navy-600"
        aria-expanded={showTable}
      >
        <Table2 size={12} /> {showTable ? 'Hide' : 'Show'} data table
      </button>

      {showTable && (
        <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-navy-100">
          <table className="w-full text-left text-xs [&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-2">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-cloud">
              <tr className="text-[10px] font-bold uppercase tracking-wide text-navy-400">
                <th scope="col">Period</th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              {labels.map((l, i) => (
                <tr key={l + i} className="border-t border-navy-50">
                  <td className="text-navy-500">{l}</td>
                  {series.map((s) => (
                    <td key={s.label} className="text-right font-semibold text-navy-800">
                      {s.values[i] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
