# daywise — Capabilities & Beta Changelog

**Status:** Closed test beta · pre-v0.1
**Tagline:** Teach. Talk. Done.

This document is the single source of truth for what daywise can do. It has two parts:

1. **Capabilities** — a living inventory of every feature, grouped by area.
2. **Changelog** — a dated log of everything shipped, which will become the basis of the
   public update/release notes once we reach **v0.1**.

> **Maintenance rule (beta):** every change pushed to git must be reflected here — update the
> relevant capability bullet(s) **and** add a dated entry to the Changelog. The beta build
> version (`YYYY.MM.DD.NNN` in the header) is derived **automatically** from git at build time —
> no manual bump. Keep tracking everything until we cut **v0.1**, at which point this becomes
> formal release-notes input.

---

## Product overview

daywise turns everyday teaching into professional evidence — automatically. Teachers set up
their timetable and teaching programs once, then record what happened in a lesson by voice or
text. An AI **Curriculum Intelligence** engine matches the recording to the right lesson and
writes professional evidence (annotations, assessment, differentiation, reflection, next steps),
stored in a searchable teaching diary.

**Stack:** Vite + React + TypeScript + Tailwind CSS · Firebase (Auth, Firestore, App Check,
AI Logic/Gemini) · deployed to GitHub Pages via GitHub Actions. AI runs client-side via Firebase
AI Logic (Gemini 2.5 Flash); files are parsed in the browser and only extracted text is sent to
the model.

---

## Capabilities

### 1. Marketing website (public)
- Full landing page: hero, "built for real classrooms" trust bar, problem, how-it-works,
  feature grid, product showcases, stats, testimonials, pricing, FAQ, and CTA.
- Brand identity: daywise mark + wordmark (light/dark), "Teach. Talk. Done." tagline.
- Responsive, animated (Framer Motion), SEO/Open-Graph meta with a social preview image.
- CTAs route into sign-up.

### 2. Authentication & accounts
- Firebase Authentication: **email/password, Google, and Microsoft** sign-in.
- Branded Login / Sign-up pages; friendly error handling.
- Protected `/app` area behind auth, inside a shared app shell (sidebar + topbar + profile menu).
- Firebase App Check (reCAPTCHA v3) protecting Gemini/Firestore/Auth.
- **Settings** (in the profile menu):
  - Profile — name, school/organisation, role, and **state/territory**.
  - Account & security — email display; change password (email/password accounts).
  - Subscription — current plan and status.
  - Danger zone — delete account (with re-authentication).
- Per-user profile stored in Firestore (`users/{uid}`).

### 3. Plans & entitlements
- Plans: **Starter** (free), **Teacher Pro**, **Faculty & School**, and **Perpetual**
  ("Founding Teacher" — complimentary lifetime access for pilot teachers).
- Plan set on the user's Firestore profile (`plan`), including `perpetual` for pilot users.
- Feature gating via an entitlements layer: **Starter = 1 program**; paid/perpetual = unlimited.
- Sidebar plan indicator (Starter shows "Upgrade"; Perpetual shows a crown "Founding Teacher" badge).

### 4. Timetable
- Weekly grid editor: periods (label + times) and per-cell classes (subject, class, room, colour).
- **12-colour palette**; colours auto-assigned on import (matching classes share a colour); a
  cell-editor option to apply a colour to all matching classes.
- **Fortnightly (Week A / Week B)** support with per-week editing.
- **Per-day bell-time exceptions** (a day can run different times to the period default).
- **Term calendar** — start/end dates for all four terms; the app derives the current term,
  teaching week, and holiday periods. Each term starts on Week A.
- Drag-and-drop to move/swap classes while editing.
- **Import from PDF / Word / Excel**:
  - AI extraction (Gemini) is primary; a client-side heuristic parser + manual column mapping
    is the fallback. Everything is parsed in-browser.
  - **PDF uses hybrid image + text extraction** — each page is rendered to an image (for true
    2-D layout) and sent alongside the extracted text (for exact wording); Word/Excel use text.
  - Detects fortnightly Week A/B layouts, multi-line cells, and per-day times.
  - Review step with a **drag-and-drop editable preview** before import.

### 5. Programs (Curriculum Intelligence)
- Upload teaching programs (PDF / Word / Excel); AI extracts each lesson with outcomes,
  learning intentions, success criteria, activities, resources, keywords, and assessment.
- Program classification: **structure** (Lessons or Modules/Weeks) and **term** (full year or a
  single term), set at upload and editable later; UI terminology adapts (Lesson vs Module).
- Full-year programs are broken out and grouped by **term**.
- Program detail page: view + full edit (metadata, lessons, every section; add/remove/reorder
  lessons). URLs in lesson content are clickable.
- Programs list with grouped **views by Subject / Stage / Term** (defaults to Term).

### 6. Record Lesson (core loop)
- Capture a lesson by **voice** (browser speech-to-text) or **text**; quick-pick today's class
  from the timetable.
- AI matches the recording to the most likely program lesson and generates professional evidence
  using the **Curriculum Intelligence v2.0 "scribe, not witness"** prompt: program annotation,
  assessment evidence, differentiation, reflection, next-lesson actions, and outcomes, with a
  confidence rating.
- Student names are anonymised in evidence as **first name + surname initial** (e.g. "Lachlan O").
- Reviewable/editable before saving; gentle hints when reflection/next-steps come back empty.
- Can pre-fill subject/class/date when launched from the History day view.
- Saves to the searchable diary (`users/{uid}/entries`).

### 7. History (teaching diary)
- **Calendar** view with an evidence-coverage status pill per teaching day:
  green = all classes recorded, yellow = some, red = none. Holiday days are greyed with no pill.
- Click a day to see **that day's timetable** (correct A/B week; numbered teaching periods only —
  roll call/meetings/recess excluded) with each class's recorded evidence attached and viewable.
  Non-timetabled entries are listed separately.
- Overview text shows the **Program Annotation** (falls back to the raw note).
- Entry detail: the note plus full evidence; the matched lesson deep-links into its program.

### 8. Global search
- ⌘K / Ctrl+K command palette across **programs, lessons, timetable classes, and diary entries**;
  results deep-link (including straight to a specific lesson).

### 9. Feedback
- In-app **Feedback** button (topbar) capturing the current page/module, type, and message.
- Stored in Firestore and pushed to a **Google Sheet** (Apps Script), which creates a **Trello
  card** per submission.

### 10. Progressive Web App
- Installable PWA scoped to the app (`/app`) — launches into the dashboard, with app icons and an
  offline service worker.

### 11. Dashboard
- Time-of-day greeting; term/week (or "Holidays") pill linking to the timetable.
- Today's timetable (live A/B week) showing **all periods** including breaks/free periods;
  the current period is highlighted "Now".
- Classes that have **started/passed** show a **Record** button (numbered teaching periods only)
  that opens Record Lesson pre-filled; once recorded it shows "Recorded".
- **Planning notes** — add/edit a quick planning note per class on today's timetable (saved per
  day, `users/{uid}/planning/{date}`); a saved note shows inline under the class.
- Suggested next steps (from the last entry) and running stats.
- "Upload your first program" prompt shown only until a program exists.

---

## Planned / not yet built
- **Data & Reports** — instant reports by subject, class, student, outcome, assessment evidence,
  and date range (nav item shows "Soon").
- Student-level records and reporting.
- Billing/subscription management (plans are display-only today).
- AI backend option for the toughest PDF/Word extractions (currently client-side Gemini + heuristics).

---

## Changelog (closed beta, pre-v0.1)

_Newest first. Each entry corresponds to work pushed to `main`._

### 2026-07-15
- Dashboard: **planning notes** per class on today's timetable (add/edit inline, saved per day).
- Timetable import: user-facing copy now says **Curriculum Intelligence** instead of "AI".
- Beta build version is now **derived automatically** from git at build time (HEAD commit date +
  per-day commit count) — no manual bump; workflow checks out full history.
- Added a **beta build version badge** in the header (`YYYY.MM.DD.NNN`), starting at `2026.07.15.001`.
- Record Lesson: student names **anonymised** in generated evidence (first name + surname initial).
- PDF timetable import now uses **hybrid image + text** extraction (page image for layout +
  extracted text for exact wording) for better accuracy; Word/Excel remain text-only.
- Stopped period/time descriptors (am, Roll Call, recess/lunch, numbers, times) being imported
  as classes (prompt rule + safety-net filter).
- Dashboard today's timetable now shows **all periods** (breaks/free included).
- Dashboard: **Record** button on started/passed classes (numbered periods) → pre-filled Record
  Lesson; shows "Recorded" once done.

### 2026-07-14
- Timetable cell editor: option to **apply a colour to all matching classes**.
- **Auto-assign class colours on import** (matching classes share a colour).
- Programs page defaults to the **Term** grouped view.
- **Drag-and-drop** classes on the timetable import review grid (move/swap per week).

### 2026-07-13
- History: only **numbered teaching periods** are recordable (roll call/meetings/breaks excluded).
- History day panel respects the term calendar; **each term starts Week A**; Record pre-fills
  from the day view.
- Settings: replaced Phone with a **State/territory** selector.
- Removed Settings from the sidebar (kept in the profile menu).
- History calendar **greys out holiday days** (no status pill).
- Moved term setup to the Timetable page as a **full term calendar** (4 terms, start/end).
- Rendered feedback + search modals in a **portal** (fixed header-clipping).
- Added the **in-app feedback button** (Firestore + Google Sheet).
- Dashboard greeting is **time-of-day aware**.
- Added "first day of term" setup (later superseded by the term calendar).

### 2026-07-11
- Rebuilt **History as a calendar** with evidence-coverage status.
- Adopted the **Curriculum Intelligence v2.0** evidence prompt + empty-state hints.
- Added **grouped views** to the Programs page.
- Added program **structure (Lessons/Modules) and term** selectors.
- Expanded timetable class colours from 6 to **12**.

### 2026-07-07
- New daywise **brand mark, wordmark (light/dark) and icons**.
- Updated tagline to **"Teach. Talk. Done."**
- Renamed app to **daywise**; moved base path to `/daywise/` after repo rename.

### 2026-07-05
- Renamed brand across UI/docs; **branded confirmation dialogs**.
- Fixed voice recording **duplicating words on mobile**.
- Added **diary entries to global search**.
- Shipped the **Record Lesson core loop + History diary**.
- **Break full-year programs into terms**; clickable URLs in lessons.

### 2026-07-04
- **Perpetual (Founding Teacher)** plan + sidebar badge; **feature gating** by plan.
- Dashboard welcome banner only when no programs exist.
- **Global search** command palette; deep-link to the exact lesson.
- **Programs** section with AI Curriculum Intelligence + **editing** of extracted programs.
- **Drag-and-drop** timetable editing.
- Made the app an **installable PWA**; enabled **App Check** (reCAPTCHA v3).
- **AI timetable extraction** via Firebase AI Logic (Gemini).

### 2026-07-03
- **Timetable import** from PDF/Word/Excel; **Week A/B** detection; per-day bell-time exceptions;
  fortnightly support; account settings + editable weekly timetable. Fixes for import save and
  settings seeding.

### 2026-07-02
- **Firebase authentication** + protected app dashboard; graceful handling when Firebase isn't
  configured.

### 2026-07-01 → initial
- Initial daywise marketing website.
