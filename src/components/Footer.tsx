import { LogoMark } from './Logo'

const columns = [
  {
    title: 'Product',
    links: ['Dashboard', 'Record Lesson', 'Programs', 'History', 'Data & Reports', 'Curriculum Intelligence'],
  },
  {
    title: 'Company',
    links: ['About', 'Careers', 'Blog', 'Contact', 'Press kit'],
  },
  {
    title: 'Resources',
    links: ['Help centre', 'Getting started', 'For school leaders', 'Webinars', 'Status'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Data & security', 'Student data policy', 'Accessibility'],
  },
]

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-navy-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'radial-gradient(600px circle at 15% 0%, #17a085, transparent 55%), radial-gradient(600px circle at 85% 20%, #3491f0, transparent 55%)',
        }}
      />
      <div className="container-page relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <LogoMark size={40} />
              <span className="flex items-baseline text-xl font-extrabold tracking-tight">
                <span className="text-white">Project</span>
                <span className="ml-1.5 text-teal-400">Daybook</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-navy-300">
              The AI teaching assistant that turns everyday teaching into professional evidence — automatically.
            </p>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-teal-400">
              Teach. Record. Evidence. Automated.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-bold text-white">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-navy-300 transition-colors hover:text-teal-300">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-xs text-navy-400">
            © {2026} Project Daybook. All rights reserved. Built for teachers, by educators.
          </p>
          <div className="flex items-center gap-5 text-xs text-navy-400">
            <a href="#" className="hover:text-teal-300">
              Privacy
            </a>
            <a href="#" className="hover:text-teal-300">
              Terms
            </a>
            <a href="#" className="hover:text-teal-300">
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
