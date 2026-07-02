import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Reports', href: '#reports' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? 'border-b border-navy-100/70 bg-white/80 backdrop-blur-xl shadow-soft'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav className="container-page flex h-[68px] items-center justify-between">
          <a href="#top" className="flex items-center" aria-label="Project Daybook home">
            <Logo markSize={38} />
          </a>

          <div className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy-900"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <a href="#" className="rounded-full px-4 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900">
              Sign in
            </a>
            <a href="#cta" className="btn-primary text-sm">
              Start free trial
            </a>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy-200 text-navy-800 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden"
          >
            <div className="container-page pb-4">
              <div className="card overflow-hidden p-2">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="mt-2 grid grid-cols-2 gap-2 p-2">
                  <a href="#" className="btn-ghost text-sm" onClick={() => setOpen(false)}>
                    Sign in
                  </a>
                  <a href="#cta" className="btn-primary text-sm" onClick={() => setOpen(false)}>
                    Start free
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
