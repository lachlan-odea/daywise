import { assignColors, cellKey, defaultTimetable, newId, type ClassCell, type Period, type Timetable } from './timetable'

export type SourceKind = 'excel' | 'word' | 'pdf'

/** A single table extracted from a file (an Excel sheet, a Word table, or a PDF block). */
export interface NamedGrid {
  name: string
  grid: string[][]
}

export interface ExtractResult {
  sources: NamedGrid[]
  kind: SourceKind
  note?: string
}

export interface Layout {
  headerRow: number
  /** Column index for each day (0=Mon … 4=Fri), or null if unmapped. */
  dayCols: (number | null)[]
  periodCol: number | null
  startCol: number | null
  endCol: number | null
}

/** Which source + column mapping to read one week from. */
export interface WeekPlan {
  sourceIndex: number
  layout: Layout
}

export interface ImportPlan {
  fortnightly: boolean
  single: WeekPlan
  weekA: WeekPlan
  weekB: WeekPlan
}

/* ------------------------------- helpers -------------------------------- */

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

const DAY_TOKENS = [
  ['monday', 'mon'],
  ['tuesday', 'tues', 'tue'],
  ['wednesday', 'weds', 'wed'],
  ['thursday', 'thurs', 'thur', 'thu'],
  ['friday', 'fri'],
]

export function dayIndexOf(s: string): number {
  const t = norm(s).toLowerCase()
  if (!t) return -1
  for (let i = 0; i < DAY_TOKENS.length; i++) {
    if (DAY_TOKENS[i].some((tok) => t === tok || t.startsWith(tok + ' ') || t.startsWith(tok))) return i
  }
  return -1
}

/** Detects a "Week A"/"Week B" marker in a piece of text. */
export function weekOf(text: string): 'A' | 'B' | null {
  const t = ' ' + norm(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' '
  if (/ (week|wk) *b | b /.test(t)) return 'B'
  if (/ (week|wk) *a | a /.test(t)) return 'A'
  return null
}

function timeTokens(s: string): string[] {
  const out: string[] = []
  const re = /(\d{1,2})[:.h](\d{2})\s*(am|pm)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    let h = +m[1]
    const min = m[2]
    const ap = (m[3] || '').toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23) out.push(`${String(h).padStart(2, '0')}:${min}`)
  }
  return out
}

const looksLikeTime = (s: string) => timeTokens(s).length > 0
const parseTimes = (s: string) => {
  const t = timeTokens(s)
  return { start: t[0] ?? '', end: t[1] ?? '' }
}

/** Best-effort split of a raw class cell into subject / class / room. */
export function splitClass(text: string): ClassCell {
  const t = norm(text)
  let room: string | undefined
  const rm = t.match(/\b(?:room|rm)\.?\s*([A-Za-z]?\d{1,3}[A-Za-z]?)\b/i)
  if (rm) room = rm[1]
  const cleaned = rm ? t.replace(rm[0], '').trim() : t
  const parts = cleaned.split(/\s*[/|,;–-]\s*|\s{2,}/).map(norm).filter(Boolean)
  const subject = (parts[0] || cleaned).slice(0, 48)
  const className = (parts[1] || '').slice(0, 48)
  return { subject, className, room, color: 'teal' }
}

/* ------------------------------ extraction ------------------------------ */

async function fromExcel(file: File): Promise<NamedGrid[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }) as unknown[][]
    return { name, grid: rows.map((r) => (Array.isArray(r) ? r.map(norm) : [])) }
  }).filter((s) => s.grid.length)
}

async function fromWord(file: File): Promise<NamedGrid[]> {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
  const dom = new DOMParser().parseFromString(html, 'text/html')
  const tables = Array.from(dom.querySelectorAll('table'))
  const sources: NamedGrid[] = []
  tables.forEach((t, i) => {
    const grid: string[][] = []
    t.querySelectorAll('tr').forEach((tr) => {
      grid.push(Array.from(tr.querySelectorAll('td,th')).map((td) => norm(td.textContent)))
    })
    if (!grid.length) return
    // Use nearby heading text as the table name (helps detect "Week A/B").
    let name = `Table ${i + 1}`
    let prev = t.previousElementSibling
    for (let hop = 0; hop < 3 && prev; hop++) {
      const txt = norm(prev.textContent)
      if (txt && weekOf(txt)) {
        name = txt.slice(0, 40)
        break
      }
      prev = prev.previousElementSibling
    }
    sources.push({ name, grid })
  })
  if (sources.length) return sources
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf })
  return [
    {
      name: 'Document',
      grid: text
        .split(/\r?\n/)
        .map((l) => [norm(l)])
        .filter((r) => r[0]),
    },
  ]
}

async function fromPdf(file: File): Promise<NamedGrid[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const items: { x: number; y: number; str: string }[] = []
  const pages = Math.min(pdf.numPages, 4)
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    for (const it of content.items as { str: string; transform: number[] }[]) {
      const str = norm(it.str)
      if (!str) continue
      const x = it.transform[4]
      const y = vp.height - it.transform[5] + p * 100000
      items.push({ x, y, str })
    }
  }
  const grid = clusterToGrid(items)
  return splitPdfBlocks(grid)
}

/** Splits a reconstructed PDF grid into blocks at each day-header row (handles two stacked week tables). */
function splitPdfBlocks(grid: string[][]): NamedGrid[] {
  const headerRows: number[] = []
  grid.forEach((row, r) => {
    let count = 0
    const seen = new Set<number>()
    row.forEach((c) => {
      const di = dayIndexOf(c)
      if (di >= 0 && !seen.has(di)) {
        seen.add(di)
        count++
      }
    })
    if (count >= 3) headerRows.push(r)
  })
  if (headerRows.length < 2) return [{ name: 'Timetable', grid }]
  const blocks: NamedGrid[] = []
  for (let i = 0; i < headerRows.length; i++) {
    const start = headerRows[i]
    const end = i + 1 < headerRows.length ? headerRows[i + 1] : grid.length
    // include a label line just above the header if present
    const labelRow = start > 0 ? norm(grid[start - 1].join(' ')) : ''
    const name = weekOf(labelRow) ? labelRow.slice(0, 40) : `Block ${i + 1}`
    blocks.push({ name, grid: grid.slice(start, end) })
  }
  return blocks
}

/** Reconstructs an approximate table grid from positioned PDF text runs. */
function clusterToGrid(items: { x: number; y: number; str: string }[]): string[][] {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => a.y - b.y)
  const rows: (typeof items)[] = []
  let cur: typeof items = []
  let lastY: number | null = null
  const yTol = 6
  for (const it of sorted) {
    if (lastY === null || Math.abs(it.y - lastY) <= yTol) {
      cur.push(it)
      lastY = lastY === null ? it.y : (lastY + it.y) / 2
    } else {
      rows.push(cur)
      cur = [it]
      lastY = it.y
    }
  }
  if (cur.length) rows.push(cur)

  const xs = items.map((i) => i.x).sort((a, b) => a - b)
  const centres: number[] = []
  const xTol = 24
  for (const x of xs) {
    const last = centres[centres.length - 1]
    if (last === undefined || x - last > xTol) centres.push(x)
  }

  return rows.map((r) => {
    const cells = new Array(centres.length).fill('')
    for (const it of [...r].sort((a, b) => a.x - b.x)) {
      let ci = 0
      let best = Infinity
      centres.forEach((c, idx) => {
        const d = Math.abs(c - it.x)
        if (d < best) {
          best = d
          ci = idx
        }
      })
      cells[ci] = cells[ci] ? `${cells[ci]} ${it.str}` : it.str
    }
    return cells
  })
}

export async function extractGrid(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return { sources: await fromExcel(file), kind: 'excel' }
  }
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    return { sources: await fromWord(file), kind: 'word' }
  }
  if (name.endsWith('.pdf')) {
    return {
      sources: await fromPdf(file),
      kind: 'pdf',
      note: 'PDF layouts vary — please check the mapping and preview carefully.',
    }
  }
  throw new Error('Unsupported file type. Please upload a PDF, Word (.docx) or Excel (.xlsx) file.')
}

/* --------------------------- layout detection --------------------------- */

const maxCols = (grid: string[][]) => grid.reduce((m, r) => Math.max(m, r.length), 0)

function findHeaderRow(grid: string[][]): { headerRow: number; occ: number[][] } {
  let headerRow = 0
  let bestCount = 0
  let bestOcc: number[][] = [[], [], [], [], []]
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const occ: number[][] = [[], [], [], [], []]
    let count = 0
    grid[r].forEach((cell, ci) => {
      const di = dayIndexOf(cell)
      if (di >= 0) {
        if (occ[di].length === 0) count++
        occ[di].push(ci)
      }
    })
    if (count > bestCount) {
      bestCount = count
      headerRow = r
      bestOcc = occ
    }
  }
  return { headerRow, occ: bestOcc }
}

export function detectLayout(grid: string[][]): Layout {
  const { headerRow, occ } = findHeaderRow(grid)
  const dayCols = occ.map((cols) => (cols.length ? cols[0] : null))
  return finishLayout(grid, headerRow, dayCols)
}

function finishLayout(grid: string[][], headerRow: number, dayCols: (number | null)[]): Layout {
  const dayColIdxs = dayCols.filter((c): c is number => c != null)
  const firstDayCol = dayColIdxs.length ? Math.min(...dayColIdxs) : Math.max(1, maxCols(grid) - 5)
  const dataRows = grid.slice(headerRow + 1)

  let startCol: number | null = null
  let bestTimes = 0
  for (let c = 0; c < firstDayCol; c++) {
    let tc = 0
    for (const row of dataRows) if (looksLikeTime(row[c] ?? '')) tc++
    if (tc > bestTimes) {
      bestTimes = tc
      startCol = c
    }
  }

  let periodCol: number | null = null
  for (let c = 0; c < firstDayCol; c++) {
    if (c !== startCol) {
      periodCol = c
      break
    }
  }

  return { headerRow, dayCols, periodCol, startCol, endCol: null }
}

/** Detects a single wide grid whose days appear twice (Week A block then Week B block). */
function detectWideWeeks(grid: string[][]): { headerRow: number; dayColsA: (number | null)[]; dayColsB: (number | null)[] } | null {
  const { headerRow, occ } = findHeaderRow(grid)
  const daysDuplicated = occ.filter((cols) => cols.length >= 2).length
  if (daysDuplicated < 3) return null
  return {
    headerRow,
    dayColsA: occ.map((cols) => (cols.length ? cols[0] : null)),
    dayColsB: occ.map((cols) => (cols.length >= 2 ? cols[1] : null)),
  }
}

const hasDayHeader = (grid: string[][]) => findHeaderRow(grid).occ.filter((c) => c.length).length >= 2

/** Builds an import plan, auto-detecting fortnightly (Week A/B) layouts. */
export function detectPlan(sources: NamedGrid[]): ImportPlan {
  const single: WeekPlan = { sourceIndex: 0, layout: detectLayout(sources[0].grid) }

  // 1) Multiple sources named Week A / Week B
  if (sources.length >= 2) {
    let ai = -1
    let bi = -1
    sources.forEach((s, i) => {
      const w = weekOf(s.name)
      if (w === 'A' && ai < 0) ai = i
      if (w === 'B' && bi < 0) bi = i
    })
    if (ai >= 0 && bi >= 0) {
      return {
        fortnightly: true,
        single,
        weekA: { sourceIndex: ai, layout: detectLayout(sources[ai].grid) },
        weekB: { sourceIndex: bi, layout: detectLayout(sources[bi].grid) },
      }
    }
    // 2) Two comparable tables/sheets with day headers → assume order A, B
    const withDays = sources.map((s, i) => ({ i, ok: hasDayHeader(s.grid) })).filter((x) => x.ok)
    if (withDays.length >= 2) {
      return {
        fortnightly: true,
        single,
        weekA: { sourceIndex: withDays[0].i, layout: detectLayout(sources[withDays[0].i].grid) },
        weekB: { sourceIndex: withDays[1].i, layout: detectLayout(sources[withDays[1].i].grid) },
      }
    }
  }

  // 3) Single wide grid with duplicated day columns
  const wide = detectWideWeeks(sources[0].grid)
  if (wide) {
    return {
      fortnightly: true,
      single,
      weekA: { sourceIndex: 0, layout: finishLayout(sources[0].grid, wide.headerRow, wide.dayColsA) },
      weekB: { sourceIndex: 0, layout: finishLayout(sources[0].grid, wide.headerRow, wide.dayColsB) },
    }
  }

  // Fallback: single week, with a sensible default second-week plan for manual toggling
  const bIdx = sources.length > 1 ? 1 : 0
  return {
    fortnightly: false,
    single,
    weekA: single,
    weekB: { sourceIndex: bIdx, layout: detectLayout(sources[bIdx].grid) },
  }
}

/* ---------------------------- build timetable --------------------------- */

interface RowData {
  label: string
  start: string
  end: string
  days: string[]
}

function collectRows(grid: string[][], layout: Layout): RowData[] {
  const { headerRow, dayCols, periodCol, startCol, endCol } = layout
  const out: RowData[] = []
  for (const row of grid.slice(headerRow + 1)) {
    if (!row.some((c) => norm(c))) continue
    const label = periodCol != null ? norm(row[periodCol]) : ''
    let start = ''
    let end = ''
    if (startCol != null) {
      const t = parseTimes(norm(row[startCol] ?? ''))
      start = t.start
      end = t.end
    }
    if (endCol != null) {
      const te = parseTimes(norm(row[endCol] ?? ''))
      if (te.start) end = te.start
    }
    const days = dayCols.map((col) => (col == null ? '' : norm(row[col] ?? '')))
    if (!label && !start && !days.some(Boolean)) continue
    out.push({ label, start, end, days })
  }
  return out
}

export function buildFromPlan(sources: NamedGrid[], plan: ImportPlan): Timetable {
  if (!plan.fortnightly) {
    const rows = collectRows(sources[plan.single.sourceIndex].grid, plan.single.layout)
    if (!rows.length) return defaultTimetable()
    const periods: Period[] = []
    const cells: Record<string, ClassCell> = {}
    rows.forEach((r, i) => {
      const id = newId()
      periods.push({ id, label: r.label || `Period ${i + 1}`, start: r.start, end: r.end })
      r.days.forEach((text, di) => {
        if (text) cells[cellKey('A', id, di)] = splitClass(text)
      })
    })
    return assignColors({ periods, cells, fortnightly: false })
  }

  const rowsA = collectRows(sources[plan.weekA.sourceIndex].grid, plan.weekA.layout)
  const rowsB = collectRows(sources[plan.weekB.sourceIndex].grid, plan.weekB.layout)
  if (!rowsA.length && !rowsB.length) return defaultTimetable()

  const periods: Period[] = []
  const cells: Record<string, ClassCell> = {}
  const n = Math.max(rowsA.length, rowsB.length)
  for (let i = 0; i < n; i++) {
    const ra = rowsA[i]
    const rb = rowsB[i]
    const id = newId()
    periods.push({
      id,
      label: ra?.label || rb?.label || `Period ${i + 1}`,
      start: ra?.start || rb?.start || '',
      end: ra?.end || rb?.end || '',
    })
    ra?.days.forEach((text, di) => {
      if (text) cells[cellKey('A', id, di)] = splitClass(text)
    })
    rb?.days.forEach((text, di) => {
      if (text) cells[cellKey('B', id, di)] = splitClass(text)
    })
  }
  return assignColors({ periods, cells, fortnightly: true })
}

/** Class counts (overall and per week) for the review UI. */
export function summarise(tt: Timetable) {
  const keys = Object.keys(tt.cells)
  return {
    periods: tt.periods.length,
    classes: keys.length,
    weekA: keys.filter((k) => k.startsWith('A__')).length,
    weekB: keys.filter((k) => k.startsWith('B__')).length,
  }
}
