import { LayoutDashboard, Mic, BookOpen, History, BarChart3, BrainCircuit } from 'lucide-react'
import Reveal from '../components/Reveal'

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    text: "Start every day with your live timetable, the lesson happening now, and AI-suggested next activities that build on what you've already taught.",
    accent: 'text-navy-700 bg-navy-50',
  },
  {
    icon: Mic,
    title: 'Record Lesson',
    text: 'Capture a lesson in seconds by voice or text. No forms, no templates — just say what happened and move on with your day.',
    accent: 'text-teal-600 bg-teal-50',
  },
  {
    icon: BrainCircuit,
    title: 'Curriculum Intelligence',
    text: 'The engine that reads your programs, extracts every lesson and outcome, and matches your recordings to exactly what you taught.',
    accent: 'text-sky-600 bg-sky-50',
  },
  {
    icon: BookOpen,
    title: 'Programs',
    text: 'Upload and manage teaching programs in any format. Daybook keeps them structured, searchable and linked to your classes.',
    accent: 'text-teal-600 bg-teal-50',
  },
  {
    icon: History,
    title: 'History',
    text: 'A complete teaching diary — every lesson, reflection and piece of evidence you have ever recorded, in one searchable timeline.',
    accent: 'text-navy-700 bg-navy-50',
  },
  {
    icon: BarChart3,
    title: 'Data & Reports',
    text: 'Generate reports instantly by subject, class, student, outcome, assessment evidence or date range — export-ready in a click.',
    accent: 'text-sky-600 bg-sky-50',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">The platform</span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            One AI teaching assistant. <span className="text-gradient-teal">Everything you need.</span>
          </h2>
          <p className="mt-4 text-lg text-navy-600">
            Every part of Project Daybook works together — from the moment you upload a program to the instant you export
            a report.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <div className="group h-full rounded-3xl border border-navy-100 bg-white p-7 transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-card">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${f.accent}`}>
                  <f.icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
