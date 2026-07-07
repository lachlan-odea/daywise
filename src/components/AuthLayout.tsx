import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Mic, Sparkles } from 'lucide-react'
import { LogoMark } from './Logo'

const highlights = [
  { icon: Mic, text: 'Record a lesson in 30 seconds by voice or text' },
  { icon: Sparkles, text: 'AI writes your annotations, evidence & reflections' },
  { icon: CheckCircle2, text: 'Instant reports by student, class or outcome' },
]

/** Split-screen shell used by the Login and Signup pages. */
export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-navy-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(600px circle at 20% 15%, #17a085, transparent 55%), radial-gradient(600px circle at 85% 90%, #3491f0, transparent 55%)',
          }}
        />
        <Link to="/" className="relative flex items-center gap-2.5">
          <LogoMark size={40} />
          <span className="flex items-baseline text-xl font-extrabold lowercase tracking-tight">
            <span className="text-white">day</span>
            <span className="text-teal-400">wise</span>
          </span>
        </Link>

        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight">
            Turn everyday teaching into <span className="text-teal-300">professional evidence</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {highlights.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-navy-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <h.icon size={18} className="text-teal-300" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-teal-400">
          Teach. Talk. Done.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-cloud px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark size={36} />
            <span className="flex items-baseline text-lg font-extrabold lowercase tracking-tight">
              <span className="text-navy-800">day</span>
              <span className="text-teal-500">wise</span>
            </span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-navy-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
