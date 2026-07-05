import app from './firebase'
import { extractTextForAI } from './aiTimetable'
import type { Lesson } from './programs'

export interface ExtractedProgram {
  name: string
  subject: string
  stage: string
  description: string
  lessons: Lesson[]
}

const PROMPT = `You are "Curriculum Intelligence" — you read a teacher's teaching program/scope-and-sequence document and extract it into structured data.

Return JSON with:
- name: a concise title for the program (e.g. "Stage 4 Science — Forces & Motion").
- subject: the subject (e.g. "Science", "English", "Mathematics").
- stage: the stage or year level if stated (e.g. "Stage 4", "Year 9"), else "".
- description: one or two sentences summarising the program, else "".
- lessons: the ordered list of lessons/units/sequences in the document. For each lesson extract:
    - term: if the program is organised by term or covers a full year, the school term number (1, 2, 3 or 4) this lesson belongs to. Omit (or 0) if the document is not organised by term.
    - title: the lesson/topic title.
    - outcomes: syllabus outcome codes and/or statements (e.g. "SC4-10PW").
    - learningIntentions: the learning intentions / goals.
    - successCriteria: success criteria if present.
    - activities: teaching and learning activities.
    - resources: resources/materials referenced.
    - keywords: key vocabulary/terms.
    - assessment: assessment tasks or evidence mentioned for this lesson.

Rules:
- Extract EVERY distinct lesson/week/sequence you can find.
- Each list contains short strings; use [] when a section is absent.
- Do not invent content that is not in the document. Summarise faithfully.`

async function getModel() {
  if (!app) throw new Error('Firebase is not configured.')
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai')
  const strArray = () => Schema.array({ items: Schema.string() })
  const schema = Schema.object({
    properties: {
      name: Schema.string(),
      subject: Schema.string(),
      stage: Schema.string(),
      description: Schema.string(),
      lessons: Schema.array({
        items: Schema.object({
          properties: {
            term: Schema.number(),
            title: Schema.string(),
            outcomes: strArray(),
            learningIntentions: strArray(),
            successCriteria: strArray(),
            activities: strArray(),
            resources: strArray(),
            keywords: strArray(),
            assessment: strArray(),
          },
          optionalProperties: [
            'term',
            'outcomes',
            'learningIntentions',
            'successCriteria',
            'activities',
            'resources',
            'keywords',
            'assessment',
          ],
        }),
      }),
    },
    optionalProperties: ['description', 'stage'],
  })
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 32768 },
  })
}

interface AILesson {
  term?: number
  title?: string
  outcomes?: string[]
  learningIntentions?: string[]
  successCriteria?: string[]
  activities?: string[]
  resources?: string[]
  keywords?: string[]
  assessment?: string[]
}
interface AIProgram {
  name?: string
  subject?: string
  stage?: string
  description?: string
  lessons?: AILesson[]
}

const arr = (v?: string[]) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [])

export async function aiExtractProgram(file: File): Promise<ExtractedProgram> {
  const text = await extractTextForAI(file)
  if (!text.trim()) throw new Error('No readable text found in the file.')
  const model = await getModel()
  const result = await model.generateContent(`${PROMPT}\n\nPROGRAM DOCUMENT:\n${text.slice(0, 120000)}`)
  let parsed: AIProgram
  try {
    parsed = JSON.parse(result.response.text())
  } catch {
    throw new Error('The AI response could not be read. The document may be too large — try splitting it.')
  }
  const lessons: Lesson[] = (parsed.lessons ?? []).map((l, i) => ({
    order: i,
    term: Number(l.term) >= 1 && Number(l.term) <= 4 ? Number(l.term) : 0,
    title: (l.title ?? `Lesson ${i + 1}`).trim(),
    outcomes: arr(l.outcomes),
    learningIntentions: arr(l.learningIntentions),
    successCriteria: arr(l.successCriteria),
    activities: arr(l.activities),
    resources: arr(l.resources),
    keywords: arr(l.keywords),
    assessment: arr(l.assessment),
  }))
  return {
    name: (parsed.name ?? file.name.replace(/\.[^.]+$/, '')).trim(),
    subject: (parsed.subject ?? '').trim(),
    stage: (parsed.stage ?? '').trim(),
    description: (parsed.description ?? '').trim(),
    lessons,
  }
}
