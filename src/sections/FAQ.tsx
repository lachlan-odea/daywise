import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import Reveal from '../components/Reveal'

const faqs = [
  {
    q: 'How does the AI know which lesson I taught?',
    a: 'When you record, Daybook cross-references your timetable, your linked teaching programs and the lesson database built by Curriculum Intelligence. It combines the time you recorded, the class, and the keywords in your note to identify the lesson you most likely taught — and you can always confirm or adjust the match.',
  },
  {
    q: 'What file types can I upload for my programs?',
    a: 'You can upload teaching programs as PDFs, Word documents and other common formats. The Curriculum Intelligence engine reads them and automatically extracts lessons, outcomes, learning intentions, activities, resources and keywords into a structured database.',
  },
  {
    q: 'Is my data — and my students’ data — safe?',
    a: 'Yes. Protecting teacher and student information is fundamental. Your data is encrypted in transit and at rest, is never sold, and is only ever used to generate your evidence. Enterprise plans include admin controls, SSO and data-handling agreements suited to school and system requirements.',
  },
  {
    q: 'Does the evidence sound like me, or like a robot?',
    a: 'Daybook writes in professional teaching language grounded in what you actually said and what your program specifies. The output reads like something you would have written yourself — and everything is fully editable before you save or export it.',
  },
  {
    q: 'Can I record by typing instead of speaking?',
    a: 'Absolutely. Record however suits the moment — speak a quick voice note as students pack up, or type a few lines later. Either way, the AI turns it into complete evidence.',
  },
  {
    q: 'What kinds of reports can I generate?',
    a: 'Instantly generate reports by subject, class, individual student, curriculum outcome, assessment evidence, date range and more. It is ideal for accreditation, parent-teacher meetings, faculty reviews and whole-school reporting — all exportable with a click.',
  },
  {
    q: 'Do I have to set everything up before I can start?',
    a: 'No. You can start recording straight away on the free plan. Uploading programs and linking your timetable unlocks the automatic lesson-matching and richer evidence, but you are never blocked from getting value on day one.',
  },
]

function Item({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-2xl border border-navy-100 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-bold text-navy-900">{q}</span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-600 transition-transform ${
            open ? 'rotate-45 bg-teal-100 text-teal-600' : ''
          }`}
        >
          <Plus size={16} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-[15px] leading-relaxed text-navy-600">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-24 py-20 lg:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <span className="eyebrow">FAQ</span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Questions, answered
          </h2>
          <p className="mt-4 text-lg text-navy-600">
            Everything you need to know about how Project Daybook fits into your teaching day.
          </p>
          <a href="#cta" className="btn-navy mt-6 text-sm">
            Still curious? Talk to us
          </a>
        </Reveal>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.04}>
              <Item q={f.q} a={f.a} defaultOpen={i === 0} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
