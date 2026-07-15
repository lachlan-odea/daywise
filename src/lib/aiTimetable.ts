import app, { firebaseConfigured } from './firebase'
import { assignColors, cellKey, newId, type ClassCell, type Period, type Timetable } from './timetable'

/** Whether AI extraction can be attempted (Firebase configured + app initialised). */
export function aiAvailable(): boolean {
  return firebaseConfigured && !!app
}

/* --------------------------- text extraction ---------------------------- */

const norm = (v: unknown) => String(v ?? '').replace(/[ \t]+/g, ' ').trim()

/**
 * Extracts both the positioned text and a rendered image of each PDF page (up to 3).
 * The image gives Gemini the true 2-D layout; the text gives exact wording (codes, times).
 */
async function pdfExtract(file: File): Promise<{ text: string; images: string[] }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pageCount = Math.min(pdf.numPages, 3)
  let text = ''
  const images: string[] = []
  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p)

    // Text (line-clustered by y-position).
    const content = await page.getTextContent()
    const items = (content.items as { str: string; transform: number[] }[])
      .map((it) => ({ x: it.transform[4], y: Math.round(it.transform[5]), str: it.str }))
      .filter((it) => it.str.trim())
    items.sort((a, b) => b.y - a.y || a.x - b.x)
    const lines: string[] = []
    let line = ''
    let lastY: number | null = null
    for (const it of items) {
      if (lastY === null || Math.abs(it.y - lastY) <= 3) {
        line += (line ? ' ' : '') + it.str
        lastY = lastY ?? it.y
      } else {
        lines.push(line)
        line = it.str
        lastY = it.y
      }
    }
    if (line) lines.push(line)
    text += lines.join('\n') + '\n\n'

    // Rendered image (bounded to ~1600px wide, JPEG to keep the payload compact).
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(2, 1600 / base.width)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      images.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
  }
  return { text, images }
}

async function excelText(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map((n) => `# Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n')
}

async function wordText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
  const dom = new DOMParser().parseFromString(html, 'text/html')
  let text = ''
  dom.body.querySelectorAll('table').forEach((t) => {
    t.querySelectorAll('tr').forEach((tr) => {
      text += Array.from(tr.children).map((td) => norm(td.textContent)).join(' | ') + '\n'
    })
    text += '\n'
  })
  if (!text.trim()) {
    const { value: raw } = await mammoth.extractRawText({ arrayBuffer: buf })
    text = raw
  }
  return text
}

export async function extractTextForAI(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return (await pdfExtract(file)).text
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return excelText(file)
  if (name.endsWith('.docx') || name.endsWith('.doc')) return wordText(file)
  throw new Error('Unsupported file type.')
}

/* ----------------------------- AI extraction ---------------------------- */

const PROMPT = `You are extracting a school teacher's weekly timetable from raw text (it may be messy, exported from a PDF, Word or Excel file).

Return JSON with:
- fortnightly: true if the timetable has two distinct weeks (e.g. "Week A"/"Week B", or day headers like MonA/MonB, TueA/TueB). Otherwise false.
- periods: the ordered list of daily periods/rows. Each has:
    - label: a short name, e.g. "Roll Call", "1", "2", "Recess", "Lunch", "3", "Sport".
    - start, end: default bell times in 24-hour "HH:MM". Use the times that apply to MOST days as the defaults.
  Include breaks (recess/lunch) as periods even if they have no classes.
- classes: one entry per scheduled class in a cell:
    - week: "A" or "B" (use "A" when not fortnightly).
    - periodIndex: 0-based index into the periods array.
    - day: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday.
    - subject: the class/subject name (e.g. "English SE").
    - code: the class code if present (e.g. "SEEn269"), otherwise omit.
    - room: the room if present (e.g. "D-L-004"), otherwise omit.
    - startOverride, endOverride: ONLY include when this specific day runs a different bell time to the period's default (e.g. one day is on a different schedule). Otherwise omit.

Rules:
- Place every class in the correct day and period.
- Skip empty cells and pure break rows (recess/lunch with no class).
- All times must be "HH:MM" 24-hour.
- Never invent classes that are not in the text.`

async function getModel() {
  if (!app) throw new Error('Firebase is not configured.')
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai')
  const schema = Schema.object({
    properties: {
      fortnightly: Schema.boolean(),
      periods: Schema.array({
        items: Schema.object({
          properties: {
            label: Schema.string(),
            start: Schema.string(),
            end: Schema.string(),
          },
        }),
      }),
      classes: Schema.array({
        items: Schema.object({
          properties: {
            week: Schema.string(),
            periodIndex: Schema.number(),
            day: Schema.number(),
            subject: Schema.string(),
            code: Schema.string(),
            room: Schema.string(),
            startOverride: Schema.string(),
            endOverride: Schema.string(),
          },
          optionalProperties: ['code', 'room', 'startOverride', 'endOverride'],
        }),
      }),
    },
  })
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
  })
}

interface AIClass {
  week?: string
  periodIndex?: number
  day?: number
  subject?: string
  code?: string
  room?: string
  startOverride?: string
  endOverride?: string
}
interface AIResult {
  fortnightly?: boolean
  periods?: { label?: string; start?: string; end?: string }[]
  classes?: AIClass[]
}

function toTimetable(ai: AIResult): Timetable {
  const periods: Period[] = (ai.periods ?? []).map((p) => ({
    id: newId(),
    label: (p.label ?? '').trim(),
    start: (p.start ?? '').trim(),
    end: (p.end ?? '').trim(),
  }))
  const cells: Record<string, ClassCell> = {}
  const timeOverrides: Record<string, { start: string; end: string }> = {}

  for (const c of ai.classes ?? []) {
    const pi = Number(c.periodIndex)
    const day = Number(c.day)
    const period = periods[pi]
    if (!period || day < 0 || day > 4) continue
    const subject = (c.subject ?? '').trim()
    const code = (c.code ?? '').trim()
    if (!subject && !code) continue
    const week = c.week === 'B' ? 'B' : 'A'
    const key = cellKey(week, period.id, day)
    cells[key] = { subject, className: code, room: (c.room ?? '').trim() || undefined, color: 'teal' }
    if (c.startOverride || c.endOverride) {
      timeOverrides[key] = { start: (c.startOverride || period.start).trim(), end: (c.endOverride || period.end).trim() }
    }
  }

  return assignColors({ periods, cells, timeOverrides, fortnightly: !!ai.fortnightly })
}

export async function aiExtractTimetable(file: File): Promise<Timetable> {
  const model = await getModel()
  const isPdf = file.name.toLowerCase().endsWith('.pdf')

  // PDF → hybrid: page image(s) for layout + extracted text for exact wording.
  // Word/Excel → text only (already well-structured).
  let request: (string | { inlineData: { mimeType: string; data: string } })[]
  if (isPdf) {
    const { text, images } = await pdfExtract(file)
    if (!text.trim() && !images.length) throw new Error('No readable content found in the file.')
    request = [
      ...images.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
      `${PROMPT}\n\nUse the timetable IMAGE(S) above to understand the visual layout (which class sits under which day and period, Week A/B blocks, merged cells). Use the TEXT below for exact wording — subjects, class codes, rooms and times. Prefer the text for spelling and the image for placement.\n\nTIMETABLE TEXT:\n${text.slice(0, 40000)}`,
    ]
  } else {
    const text = await extractTextForAI(file)
    if (!text.trim()) throw new Error('No readable text found in the file.')
    request = [`${PROMPT}\n\nTIMETABLE TEXT:\n${text.slice(0, 40000)}`]
  }

  const result = await model.generateContent(request)
  const raw = result.response.text()
  let parsed: AIResult
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('The AI response could not be read. Please try the manual mapping.')
  }
  return toTimetable(parsed)
}
