import { ArrowRight, Mic, Check } from 'lucide-react'
import Reveal from '../components/Reveal'

export default function CTA() {
  return (
    <section id="cta" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 px-6 py-16 text-center text-white sm:px-12 lg:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(600px circle at 15% 0%, #17a085, transparent 55%), radial-gradient(600px circle at 85% 100%, #3491f0, transparent 55%)',
            }}
          />
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-300">
              <Mic size={13} /> Teach. Record. Evidence. Automated.
            </span>
            <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Give yourself the time to just <span className="text-gradient-teal">teach</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-navy-200">
              Join the teachers turning everyday lessons into professional evidence — without the admin. Start free, no
              card required.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#" className="btn-primary text-base">
                Start your free trial <ArrowRight size={18} />
              </a>
              <a href="#" className="btn text-base border border-white/20 bg-white/5 px-6 py-3 text-white hover:bg-white/10">
                Book a demo
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-navy-300">
              {['Free forever plan', 'No credit card', 'Set up in minutes'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-teal-400" strokeWidth={3} /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
