import { Star, Quote } from 'lucide-react'
import Reveal from '../components/Reveal'

const testimonials = [
  {
    quote:
      "I record a voice note as my students pack up, and by the time I reach the staffroom my annotations and reflection are written. It's given me my evenings back.",
    name: 'Sarah M.',
    role: 'Head Teacher Science',
    initials: 'SM',
    color: '#17a085',
  },
  {
    quote:
      'Accreditation used to mean a weekend of digging through old files. Now the evidence is already there, mapped to outcomes. I filtered by student and exported it in one click.',
    name: 'David T.',
    role: 'Stage 3 Teacher',
    initials: 'DT',
    color: '#3491f0',
  },
  {
    quote:
      'The curriculum matching genuinely surprised me. It knew which lesson I taught from a rushed 20-second note. It reads like something I would have written myself.',
    name: 'Priya K.',
    role: 'English Teacher',
    initials: 'PK',
    color: '#20336c',
  },
  {
    quote:
      'As a graduate teacher this is the mentor I wish I had. It suggests my next lesson, keeps my evidence organised, and I never fall behind on documentation.',
    name: 'Liam O.',
    role: 'Graduate Teacher',
    initials: 'LO',
    color: '#2fba93',
  },
  {
    quote:
      'Across the faculty, documentation is finally consistent and complete. Reporting on outcome coverage for a whole class now takes seconds, not an afternoon.',
    name: 'Rebecca H.',
    role: 'Deputy Principal',
    initials: 'RH',
    color: '#1f72d6',
  },
]

export default function Testimonials() {
  return (
    <section className="bg-cloud py-20 lg:py-28">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Loved by educators</span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Time back where it belongs
          </h2>
          <p className="mt-4 text-lg text-navy-600">
            Teachers use Project Daybook to spend less time documenting and more time doing what they do best.
          </p>
        </Reveal>

        <div className="mt-14 columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={(i % 3) * 0.08}>
              <figure className="break-inside-avoid rounded-3xl border border-navy-100 bg-white p-6 shadow-soft">
                <Quote size={26} className="text-teal-300" />
                <blockquote className="mt-3 text-[15px] leading-relaxed text-navy-700">"{t.quote}"</blockquote>
                <div className="mt-5 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <figcaption className="text-sm font-bold text-navy-900">{t.name}</figcaption>
                    <p className="text-xs text-navy-500">{t.role}</p>
                  </div>
                  <div className="ml-auto flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} size={13} fill="currentColor" />
                    ))}
                  </div>
                </div>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
