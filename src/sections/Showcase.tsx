import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import Reveal from '../components/Reveal'
import { ProgramsMockup, RecordMockup, ReportsMockup } from '../components/Mockups'

interface Row {
  id?: string
  eyebrow: string
  title: ReactNode
  text: string
  bullets: string[]
  visual: ReactNode
  flip?: boolean
}

const rows: Row[] = [
  {
    eyebrow: 'Curriculum Intelligence',
    title: (
      <>
        Your programs, <span className="text-gradient-teal">understood by AI</span>
      </>
    ),
    text: 'Upload a program once and the engine does the reading for you — extracting every lesson, outcome, learning intention, activity, resource and keyword into a structured, searchable database.',
    bullets: [
      'Reads PDFs, Word docs and more',
      'Maps lessons to syllabus outcomes automatically',
      'Indexes keywords for instant lesson matching',
      'Keeps everything linked to your classes',
    ],
    visual: <ProgramsMockup />,
  },
  {
    eyebrow: 'Record → Evidence',
    title: (
      <>
        Say what happened. <span className="text-gradient-teal">Get the paperwork.</span>
      </>
    ),
    text: "A 30-second voice note becomes a full, professional record. Daybook identifies the lesson from your timetable and curriculum, then writes the evidence in your voice — not a generic template.",
    bullets: [
      'Voice or text — whatever is fastest',
      'Auto-matches to the lesson you most likely taught',
      'Generates annotations, assessment evidence & differentiation',
      'Suggests reflections and next-lesson actions',
    ],
    visual: <RecordMockup />,
    flip: true,
  },
  {
    id: 'reports',
    eyebrow: 'Data & Reports',
    title: (
      <>
        Any report, <span className="text-gradient-teal">in seconds</span>
      </>
    ),
    text: 'Every lesson you record feeds a living evidence base. Ask for what you need — by subject, class, student, outcome, assessment evidence or date range — and export it instantly.',
    bullets: [
      'Filter by student, class, subject or outcome',
      'Pull assessment evidence across any date range',
      'Perfect for accreditation, parent meetings & reviews',
      'One-click PDF and spreadsheet export',
    ],
    visual: <ReportsMockup />,
  },
]

export default function Showcase() {
  return (
    <section className="space-y-24 py-20 lg:space-y-32 lg:py-28">
      {rows.map((row) => (
        <div key={row.eyebrow} id={row.id} className="container-page scroll-mt-24">
          <div
            className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
              row.flip ? 'lg:[&>*:first-child]:order-2' : ''
            }`}
          >
            <Reveal>
              <span className="eyebrow">{row.eyebrow}</span>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
                {row.title}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-navy-600">{row.text}</p>
              <ul className="mt-6 space-y-3">
                {row.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="text-navy-700">{b}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative">
                <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-teal-400/15 via-sky-400/10 to-transparent blur-2xl" />
                {row.visual}
              </div>
            </Reveal>
          </div>
        </div>
      ))}
    </section>
  )
}
