import { Clock, FileWarning, Repeat, HeartCrack, ArrowRight } from 'lucide-react'
import Reveal from '../components/Reveal'

const pains = [
  {
    icon: Clock,
    title: 'Hours lost after hours',
    text: 'Reflections, annotations and evidence pile up for evenings and weekends — long after the teaching is done.',
  },
  {
    icon: Repeat,
    title: 'The same story, retyped',
    text: 'You already taught the lesson. Now you re-describe it in three different documents for three different reasons.',
  },
  {
    icon: FileWarning,
    title: 'Evidence scattered everywhere',
    text: 'Accreditation and assessment evidence lives in emails, notebooks and memory — impossible to find when you need it.',
  },
  {
    icon: HeartCrack,
    title: 'Admin over teaching',
    text: 'Paperwork crowds out the reason you started: planning great lessons and supporting your students.',
  },
]

export default function Problem() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">The problem</span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Teachers didn't sign up to be <span className="text-gradient-teal">administrators</span>.
          </h2>
          <p className="mt-4 text-lg text-navy-600">
            Documentation is essential — but writing it by hand costs the profession millions of hours every year. Project
            Daybook gives that time back.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pains.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="group h-full rounded-3xl border border-navy-100 bg-white p-6 transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-700 transition-colors group-hover:bg-teal-50 group-hover:text-teal-600">
                  <p.icon size={22} />
                </div>
                <h3 className="mt-5 text-base font-bold text-navy-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-12 flex items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border border-teal-200 bg-teal-50 px-6 py-3 text-sm font-semibold text-teal-800">
              <span className="text-navy-500 line-through decoration-navy-300">Teach → then document it all yourself</span>
              <ArrowRight size={16} className="text-teal-600" />
              <span className="font-bold text-teal-700">Teach → record 30 seconds → done</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
