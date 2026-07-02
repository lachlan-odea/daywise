import { Upload, CalendarClock, Mic, Sparkles } from 'lucide-react'
import Reveal from '../components/Reveal'

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload your programs',
    text: 'Drop in your teaching programs as PDFs or Word docs. The Curriculum Intelligence engine reads every lesson, outcome, learning intention, activity, resource and keyword — then structures it into a database.',
    color: 'from-navy-700 to-navy-900',
  },
  {
    icon: CalendarClock,
    step: '02',
    title: 'Link your timetable',
    text: 'Connect your classes and periods to the right programs. Now Daybook knows what you teach, when you teach it, and to whom — all term long.',
    color: 'from-sky-500 to-sky-700',
  },
  {
    icon: Mic,
    step: '03',
    title: 'Record what happened',
    text: 'After a lesson, speak or type a quick note. The AI cross-references your timetable, lesson database and curriculum to identify exactly which lesson you most likely taught.',
    color: 'from-teal-500 to-teal-700',
  },
  {
    icon: Sparkles,
    step: '04',
    title: 'Get professional evidence',
    text: 'Daybook writes your annotations, assessment evidence, differentiation, reflections and next-lesson actions — stored in a searchable database, ready to report on instantly.',
    color: 'from-teal-400 to-sky-500',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-navy-950 py-20 text-white lg:py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(700px circle at 10% 10%, #17a085, transparent 50%), radial-gradient(700px circle at 90% 90%, #3491f0, transparent 50%)',
        }}
      />
      <div className="container-page relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-300">
            How it works
          </span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Four steps. Then it runs itself.
          </h2>
          <p className="mt-4 text-lg text-navy-200">
            Set up once at the start of term. After that, every lesson you teach becomes evidence in the time it takes to
            pack up the room.
          </p>
        </Reveal>

        <div className="relative mt-16 grid gap-6 lg:grid-cols-4">
          {/* connecting line */}
          <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-white/20 to-transparent lg:block" />

          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 0.1}>
              <div className="relative h-full rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:border-teal-400/40">
                <div
                  className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} shadow-glow-navy`}
                >
                  <s.icon size={24} />
                </div>
                <span className="mt-5 block text-xs font-bold tracking-widest text-teal-300">STEP {s.step}</span>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-200">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
