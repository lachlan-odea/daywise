import app from './firebase'

export interface Candidate {
  programId: string
  programName: string
  subject?: string
  lessonId: string
  title: string
  outcomes: string[]
}

export interface GeneratedEvidence {
  matchedProgramId: string | null
  matchedProgramName: string | null
  matchedLessonId: string | null
  matchedLessonTitle: string
  confidence: 'high' | 'medium' | 'low'
  outcomes: string[]
  annotations: string
  assessmentEvidence: string
  differentiation: string
  reflection: string
  nextSteps: string[]
}

const PROMPT = `You are an experienced Australian teacher writing professional teaching evidence from a quick note a teacher made about a lesson they just taught.

You are given:
- the teacher's note (voice or text),
- optionally the class/subject,
- a list of candidate lessons from their programs, each with an id, title and outcomes.

Do two things:
1. MATCH: identify which candidate lesson was most likely taught, based on the note (and class/subject). Return its lessonId in "matchedLessonId", or null if none clearly match. Set "confidence" to "high", "medium" or "low".
2. GENERATE professional evidence, written in first person past tense ("I ..."), grounded ONLY in what the note says plus the matched lesson. Be specific and concise; do not invent student names or results not implied by the note.

Return JSON:
- matchedLessonId: the chosen lesson id, or null.
- confidence: "high" | "medium" | "low".
- outcomes: syllabus outcomes addressed (codes/statements) drawn from the matched lesson, [] if unknown.
- annotations: a short program annotation noting what was taught and any adjustments (2–4 sentences).
- assessmentEvidence: evidence of student learning/assessment observed, per the note (2–4 sentences).
- differentiation: any differentiation/adjustments made or needed (1–3 sentences); "" if none.
- reflection: a brief professional reflection (2–3 sentences).
- nextSteps: 1–4 concrete actions for the next lesson.`

async function getModel() {
  if (!app) throw new Error('Firebase is not configured.')
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai')
  const strArray = () => Schema.array({ items: Schema.string() })
  const schema = Schema.object({
    properties: {
      matchedLessonId: Schema.string(),
      confidence: Schema.string(),
      outcomes: strArray(),
      annotations: Schema.string(),
      assessmentEvidence: Schema.string(),
      differentiation: Schema.string(),
      reflection: Schema.string(),
      nextSteps: strArray(),
    },
    optionalProperties: ['matchedLessonId', 'outcomes', 'differentiation', 'nextSteps'],
  })
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 4096 },
  })
}

export async function generateEvidence(params: {
  note: string
  klass?: { subject: string; className: string }
  candidates: Candidate[]
}): Promise<GeneratedEvidence> {
  const { note, klass, candidates } = params
  const model = await getModel()

  const candidateText = candidates
    .slice(0, 80)
    .map((c) => `[${c.lessonId}] (${c.programName}) ${c.title}${c.outcomes.length ? ` — outcomes: ${c.outcomes.join(', ')}` : ''}`)
    .join('\n')

  const context = [
    klass ? `CLASS: ${klass.subject} ${klass.className}`.trim() : '',
    `TEACHER'S NOTE:\n${note}`,
    candidates.length ? `CANDIDATE LESSONS:\n${candidateText}` : 'CANDIDATE LESSONS: none provided.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await model.generateContent(`${PROMPT}\n\n${context}`)
  let parsed: Partial<GeneratedEvidence> & { matchedLessonId?: string | null }
  try {
    parsed = JSON.parse(result.response.text())
  } catch {
    throw new Error('The AI response could not be read. Please try again.')
  }

  const matchedLessonId = parsed.matchedLessonId || null
  const match = matchedLessonId ? candidates.find((c) => c.lessonId === matchedLessonId) : undefined
  const clean = (v?: string) => (v ?? '').trim()
  const arr = (v?: string[]) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [])

  return {
    matchedProgramId: match?.programId ?? null,
    matchedProgramName: match?.programName ?? null,
    matchedLessonId: match?.lessonId ?? null,
    matchedLessonTitle: match?.title ?? '',
    confidence: (['high', 'medium', 'low'] as const).includes(parsed.confidence as 'high') ? (parsed.confidence as GeneratedEvidence['confidence']) : 'low',
    outcomes: arr(parsed.outcomes),
    annotations: clean(parsed.annotations),
    assessmentEvidence: clean(parsed.assessmentEvidence),
    differentiation: clean(parsed.differentiation),
    reflection: clean(parsed.reflection),
    nextSteps: arr(parsed.nextSteps),
  }
}
