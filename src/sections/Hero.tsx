import { motion } from 'framer-motion'
import { Sparkles, Mic, ArrowRight, ShieldCheck, Star } from 'lucide-react'
import { DashboardMockup } from '../components/Mockups'

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-cloud via-white to-white" />
        <div
          className="absolute inset-0 bg-grid-navy opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          style={{ backgroundSize: '44px 44px' }}
        />
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-teal-300/30 blur-[120px]" />
        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-sky-300/30 blur-[120px]" />
      </div>

      <div className="container-page grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        {/* copy */}
        <div>
          <motion.a
            href="#how"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="eyebrow"
          >
            <Sparkles size={13} />
            AI Curriculum Intelligence
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-navy-900 sm:text-5xl lg:text-6xl"
          >
            Turn everyday teaching into <span className="text-gradient">professional evidence</span> —
            automatically.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-navy-600"
          >
            Stop writing reflections, annotating programs and compiling evidence by hand. Just record what happened in
            class — by voice or text — and Project Daybook's AI does the rest.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.19 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <a href="#cta" className="btn-primary text-base">
              Start free trial <ArrowRight size={18} />
            </a>
            <a href="#how" className="btn-ghost text-base">
              <Mic size={18} /> See how it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-navy-500"
          >
            <span className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {['#17a085', '#3491f0', '#20336c', '#2fba93'].map((c) => (
                  <span key={c} className="h-6 w-6 rounded-full border-2 border-white" style={{ background: c }} />
                ))}
              </div>
              Loved by teachers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </span>
              4.9 average rating
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-teal-600" /> Student-data safe
            </span>
          </motion.div>
        </div>

        {/* visual */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-teal-400/20 via-sky-400/10 to-transparent blur-2xl" />
          <DashboardMockup />

          {/* floating chips */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-5 top-24 hidden rounded-2xl border border-navy-100 bg-white p-3 shadow-card sm:block"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white">
                <Mic size={15} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-navy-900">Lesson recorded</p>
                <p className="text-[10px] text-navy-400">38 seconds of voice</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute -right-4 bottom-16 hidden rounded-2xl border border-teal-200 bg-white p-3 shadow-card sm:block"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-teal-600" />
              <div>
                <p className="text-[11px] font-bold text-navy-900">Evidence written</p>
                <p className="text-[10px] text-navy-400">4 items · 0 admin</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
