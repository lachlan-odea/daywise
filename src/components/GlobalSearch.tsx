import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, BookOpen, CalendarClock, FileText, Loader2, CornerDownLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getProgramList, getProgram } from '../lib/programs'
import { getTimetableOnce } from '../lib/timetable'

type Item =
  | { type: 'program'; title: string; subtitle: string; text: string; to: string }
  | { type: 'lesson'; title: string; subtitle: string; text: string; to: string }
  | { type: 'class'; title: string; subtitle: string; text: string; to: string }

const TYPE_META = {
  program: { label: 'Programs', icon: BookOpen },
  lesson: { label: 'Lessons', icon: FileText },
  class: { label: 'Classes', icon: CalendarClock },
} as const

export default function GlobalSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [corpus, setCorpus] = useState<Item[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Build the search corpus once, when first opened
  useEffect(() => {
    if (!open || corpus || !user) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const items: Item[] = []
        const [list, tt] = await Promise.all([getProgramList(user.uid), getTimetableOnce(user.uid)])
        const fulls = await Promise.all(list.map((p) => (p.id ? getProgram(user.uid, p.id) : null)))
        for (const res of fulls) {
          if (!res) continue
          const { program, lessons } = res
          items.push({
            type: 'program',
            title: program.name,
            subtitle: [program.subject, program.stage].filter(Boolean).join(' · '),
            text: `${program.name} ${program.subject} ${program.stage} ${program.description ?? ''}`.toLowerCase(),
            to: `/app/programs/${program.id}`,
          })
          for (const l of lessons) {
            items.push({
              type: 'lesson',
              title: l.title,
              subtitle: program.name,
              text: `${l.title} ${l.outcomes.join(' ')} ${l.keywords.join(' ')} ${l.learningIntentions.join(
                ' ',
              )} ${l.activities.join(' ')} ${l.resources.join(' ')} ${l.assessment.join(' ')}`.toLowerCase(),
              to: `/app/programs/${program.id}${l.id ? `#lesson-${l.id}` : ''}`,
            })
          }
        }
        if (tt) {
          const seen = new Set<string>()
          for (const cell of Object.values(tt.cells)) {
            const key = `${cell.subject}|${cell.className}`
            if (seen.has(key)) continue
            seen.add(key)
            items.push({
              type: 'class',
              title: cell.subject || cell.className,
              subtitle: [cell.className, cell.room && `Room ${cell.room}`].filter(Boolean).join(' · '),
              text: `${cell.subject} ${cell.className} ${cell.room ?? ''}`.toLowerCase(),
              to: '/app/timetable',
            })
          }
        }
        if (alive) setCorpus(items)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, corpus, user])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20)
    else {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const results = useMemo(() => {
    if (!corpus) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    const tokens = q.split(/\s+/)
    const scored = corpus
      .filter((it) => tokens.every((t) => it.text.includes(t)))
      .map((it) => {
        const title = it.title.toLowerCase()
        const score = title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2
        return { it, score }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
    return scored.map((s) => s.it)
  }, [corpus, query])

  useEffect(() => setActive(0), [query])

  const go = (it: Item) => {
    navigate(it.to)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      go(results[active])
    }
  }

  return (
    <>
      {/* desktop trigger */}
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-navy-100 bg-cloud px-3 py-2 text-sm text-navy-400 transition-colors hover:border-navy-200 sm:flex sm:w-72"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-navy-400 ring-1 ring-navy-100">
          Ctrl K
        </kbd>
      </button>
      {/* mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-navy-500 hover:bg-navy-50 sm:hidden"
        aria-label="Search"
      >
        <Search size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center gap-3 border-b border-navy-100 px-4">
              <Search size={18} className="text-navy-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search programs, lessons, classes…"
                className="flex-1 bg-transparent py-4 text-navy-900 outline-none placeholder:text-navy-300"
              />
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-navy-400 hover:bg-navy-50"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-8 text-sm text-navy-400">
                  <Loader2 size={16} className="animate-spin" /> Building your search index…
                </div>
              ) : !query.trim() ? (
                <p className="px-3 py-8 text-center text-sm text-navy-400">
                  Search across your programs, lessons and timetable classes.
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-navy-400">No matches for “{query}”.</p>
              ) : (
                (['program', 'lesson', 'class'] as const).map((type) => {
                  const group = results.filter((r) => r.type === type)
                  if (!group.length) return null
                  const Meta = TYPE_META[type]
                  return (
                    <div key={type} className="mb-1">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-navy-400">
                        {Meta.label}
                      </p>
                      {group.map((it) => {
                        const idx = results.indexOf(it)
                        return (
                          <button
                            key={idx}
                            onClick={() => go(it)}
                            onMouseEnter={() => setActive(idx)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                              idx === active ? 'bg-teal-50' : 'hover:bg-navy-50'
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                idx === active ? 'bg-teal-100 text-teal-600' : 'bg-navy-50 text-navy-500'
                              }`}
                            >
                              <Meta.icon size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-navy-900">{it.title}</span>
                              {it.subtitle && <span className="block truncate text-xs text-navy-400">{it.subtitle}</span>}
                            </span>
                            {idx === active && <CornerDownLeft size={14} className="shrink-0 text-navy-300" />}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
