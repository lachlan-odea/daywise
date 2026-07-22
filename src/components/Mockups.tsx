import {
  Mic,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  BarChart3,
  FileText,
  Search,
  Calendar,
  Waves,
} from 'lucide-react'
import type { ReactNode } from 'react'

/** A macOS-style browser/app chrome frame that wraps every product mockup. */
export function AppWindow({ children, label = 'app.daywise.au' }: { children: ReactNode; label?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50/70 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-md bg-white px-3 py-1 text-[11px] font-medium text-navy-400 ring-1 ring-navy-100">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            {label}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dashboard mockup — used in the hero                                 */
/* ------------------------------------------------------------------ */
export function DashboardMockup() {
  return (
    <AppWindow>
      <div className="grid grid-cols-[64px_1fr] bg-cloud">
        {/* rail */}
        <div className="flex flex-col items-center gap-4 border-r border-navy-100 bg-white py-5">
          {[Calendar, Mic, BookOpen, Clock, BarChart3].map((Icon, i) => (
            <div
              key={i}
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                i === 0 ? 'bg-navy-800 text-white' : 'text-navy-400'
              }`}
            >
              <Icon size={17} />
            </div>
          ))}
        </div>

        {/* main */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">Thursday, 2 July</p>
              <p className="text-lg font-bold text-navy-900">Good morning, Sarah</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-700 ring-1 ring-teal-200">
              <Sparkles size={12} /> 3 lessons ready
            </div>
          </div>

          {/* timetable */}
          <div className="mt-4 rounded-xl border border-navy-100 bg-white p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-navy-400">Today's timetable</p>
            <div className="space-y-2">
              {[
                { p: 'P1', t: '9:05', s: 'Year 9 Science', c: 'Forces & Motion', on: true },
                { p: 'P2', t: '10:00', s: 'Year 7 English', c: 'Persuasive writing', on: false },
                { p: 'P4', t: '12:30', s: 'Year 10 Maths', c: 'Quadratics', on: false },
              ].map((row) => (
                <div
                  key={row.p}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    row.on ? 'bg-navy-800 text-white' : 'bg-navy-50 text-navy-700'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${row.on ? 'text-teal-300' : 'text-navy-400'}`}>
                    {row.p} · {row.t}
                  </span>
                  <span className="text-xs font-semibold">{row.s}</span>
                  <span className={`ml-auto text-[11px] ${row.on ? 'text-navy-200' : 'text-navy-400'}`}>{row.c}</span>
                  {row.on && (
                    <span className="flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">
                      <Waves size={10} /> Now
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* two cards */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-3">
              <div className="flex items-center gap-2 text-teal-700">
                <Mic size={15} />
                <span className="text-xs font-bold">Record last lesson</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-navy-500">
                Tap to capture Year 9 Science by voice or text.
              </p>
              <div className="mt-2 h-6 w-full rounded-md bg-white/70 ring-1 ring-teal-100" />
            </div>
            <div className="rounded-xl border border-navy-100 bg-white p-3">
              <div className="flex items-center gap-2 text-sky-600">
                <Sparkles size={15} />
                <span className="text-xs font-bold text-navy-800">Suggested next</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-navy-500">
                Momentum & collisions — builds on today's Forces lesson.
              </p>
              <div className="mt-2 flex gap-1">
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">SC4-1</span>
                <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[9px] font-bold text-navy-600">Prac</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindow>
  )
}

/* ------------------------------------------------------------------ */
/* Record → Evidence mockup                                            */
/* ------------------------------------------------------------------ */
export function RecordMockup() {
  return (
    <AppWindow label="Record lesson">
      <div className="bg-cloud p-5">
        <div className="rounded-xl border border-navy-100 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-teal-500 text-white">
              <Mic size={18} />
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-400 opacity-40" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-navy-900">Recording — 0:38</p>
              <div className="mt-1.5 flex items-end gap-0.5">
                {[6, 12, 20, 14, 24, 10, 18, 28, 16, 22, 8, 16, 24, 12, 20, 14, 26, 10].map((h, i) => (
                  <span key={i} className="w-1 rounded-full bg-teal-400" style={{ height: `${h}px` }} />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-navy-50 p-3 text-xs leading-relaxed text-navy-600">
            "Ran the trolley-and-ramp prac for Year 9. Most students measured acceleration well. Jamal and Priya
            needed extra scaffolding on the results table, so I..."
          </p>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-bold text-teal-600">
          <Sparkles size={13} className="animate-pulse" />
          Curriculum Intelligence matched this to <span className="text-navy-800">Y9 Science · Forces & Motion</span>
        </div>

        <div className="mt-3 rounded-xl border border-teal-200 bg-gradient-to-br from-white to-teal-50/60 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-teal-600" />
            <span className="text-xs font-bold text-navy-900">Evidence generated</span>
          </div>
          <div className="space-y-2">
            {[
              { t: 'Program annotation', d: 'Lesson taught as programmed, prac extended by 10 min' },
              { t: 'Assessment evidence', d: 'Working scientifically — measuring & recording (SC4-6)' },
              { t: 'Differentiation', d: 'Scaffolded results table for 2 students' },
              { t: 'Next lesson action', d: 'Revisit graphing before momentum unit' },
            ].map((e) => (
              <div key={e.t} className="flex gap-2 rounded-lg bg-white p-2.5 ring-1 ring-navy-100">
                <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-teal-100 text-teal-600">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-navy-800">{e.t}</p>
                  <p className="text-[11px] leading-snug text-navy-500">{e.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  )
}

/* ------------------------------------------------------------------ */
/* Programs / Curriculum Intelligence mockup                           */
/* ------------------------------------------------------------------ */
export function ProgramsMockup() {
  return (
    <AppWindow label="Programs · Curriculum Intelligence">
      <div className="bg-cloud p-5">
        <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-4">
          <FileText size={22} className="text-teal-600" />
          <div className="flex-1">
            <p className="text-xs font-bold text-navy-900">Stage 4 Science Program.pdf</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-teal-100">
              <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-teal-500 to-sky-500" />
            </div>
          </div>
          <span className="text-[11px] font-bold text-teal-700">Analysing…</span>
        </div>

        <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-navy-400">Extracted by AI</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { n: '38', l: 'Lessons', c: 'text-navy-800' },
            { n: '112', l: 'Outcomes mapped', c: 'text-teal-600' },
            { n: '64', l: 'Activities', c: 'text-sky-600' },
            { n: '210', l: 'Keywords indexed', c: 'text-navy-800' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-navy-100 bg-white p-3">
              <p className={`text-xl font-extrabold ${s.c}`}>{s.n}</p>
              <p className="text-[11px] text-navy-500">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-navy-100 bg-white p-3">
          <p className="text-[11px] font-bold text-navy-800">Lesson 12 · Forces & Motion</p>
          <div className="mt-2 space-y-1.5">
            {[
              { k: 'Outcomes', v: 'SC4-10PW, SC4-6WS' },
              { k: 'Learning intention', v: 'Investigate how force affects motion' },
              { k: 'Resources', v: 'Trolley, ramp, timer, worksheet' },
            ].map((r) => (
              <div key={r.k} className="flex gap-2 text-[11px]">
                <span className="w-24 shrink-0 font-bold text-navy-400">{r.k}</span>
                <span className="text-navy-700">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  )
}

/* ------------------------------------------------------------------ */
/* Reports mockup                                                      */
/* ------------------------------------------------------------------ */
export function ReportsMockup() {
  return (
    <AppWindow label="Data & Reports">
      <div className="bg-cloud p-5">
        <div className="flex items-center gap-2 rounded-xl border border-navy-100 bg-white p-2.5">
          <Search size={15} className="text-navy-400" />
          <span className="text-xs text-navy-500">Show evidence for</span>
          <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">Emily R.</span>
          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">Term 2</span>
          <span className="ml-auto rounded-md bg-navy-800 px-2.5 py-1 text-[11px] font-bold text-white">Generate</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { n: '24', l: 'Lessons' },
            { n: '18', l: 'Outcomes met' },
            { n: '9', l: 'Assessments' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-navy-100 bg-white p-3 text-center">
              <p className="text-lg font-extrabold text-navy-800">{s.n}</p>
              <p className="text-[10px] text-navy-500">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-navy-100 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold text-navy-800">Outcome coverage</p>
            <BarChart3 size={14} className="text-teal-500" />
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 70 }}>
            {[40, 62, 34, 78, 52, 88, 46, 70, 58].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-navy-700 to-sky-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-teal-50 p-3 ring-1 ring-teal-200">
          <FileText size={16} className="text-teal-600" />
          <p className="text-[11px] font-semibold text-navy-700">
            Student evidence report · <span className="text-teal-700">ready to export as PDF</span>
          </p>
        </div>
      </div>
    </AppWindow>
  )
}
