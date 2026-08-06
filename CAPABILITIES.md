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
- **Forgot password** (`/forgot-password`) — emails a reset link via Firebase’s hosted flow. The
  address typed on the sign-in form carries over. The confirmation is deliberately identical
  whether or not an account exists, so the page can’t be used to discover who has a daywise
  account.
- Protected `/app` area behind auth, inside a shared app shell (sidebar + topbar + profile menu).
- Firebase App Check (reCAPTCHA v3) protecting Gemini/Firestore/Auth.
- **Settings** (in the profile menu):
  - Profile — name, school/organisation, role, and **state/territory**.
  - Account & security — email display; change password (email/password accounts).
  - Subscription — current plan and status.
  - Danger zone — delete account (with re-authentication); **erases all the user's Firestore data**
    (every subcollection) and the auth account.
- Per-user profile stored in Firestore (`users/{uid}`).

### 3. Plans & entitlements
- Plans: **Starter** (free), **Teacher Pro**, **Faculty & School**, and **Perpetual**
  ("Founding Teacher" — complimentary lifetime access for pilot teachers).
- Plan set on the user's Firestore profile (`plan`), including `perpetual` for pilot users.
- Feature gating via an entitlements layer: **Starter = 1 program**; paid/perpetual = unlimited.
- Sidebar plan indicator (Starter shows "Upgrade"; Perpetual shows a crown "Founding Teacher" badge).

### 4. Timetable
- Weekly grid editor: periods (label + times) and per-cell classes (subject, class, room, colour).
- Each cell can be marked **Class** or **Meeting**; meetings show on the grid (tagged) but are
  **not recordable** — excluded from Record quick-pick, dashboard Record buttons, the diary's
  recordable rows/coverage, and consistency achievements.
- **12-colour palette**; colours auto-assigned on import (matching classes share a colour); a
  cell-editor option to apply a colour to all matching classes.
- **Fortnightly (Week A / Week B)** support with per-week editing.
- **Per-day bell-time exceptions** (a day can run different times to the period default).
- **Term calendar** — start/end dates for all four terms; the app derives the current term,
  teaching week, and holiday periods. Terms start on Week A by default, but a **"This week is:
  Week A / Week B"** control lets a school whose weeks don't reset each term flip the phase.
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
- **Class → program linking:** matching is scoped to the program(s) a *class* follows, not just
  its subject. The first time you record for a class, you confirm which program(s) it follows
  (pre-suggested by subject) and it's remembered (`users/{uid}/meta/classPrograms`); later
  recordings match only within that class's programs. Falls back to subject match if unlinked.
  Returned outcomes are constrained to the matched lesson so a code can't spread across lessons.
- Reviewable/editable before saving; gentle hints when reflection/next-steps come back empty.
- Can pre-fill subject/class/date when launched from the History day view.
- **Mark as missed** — record a class as a missed/cancelled lesson (optional reason). Missed lessons
  count toward **coverage** (so they don't break a Perfect Week/Month/Term/Year) but are **not**
  counted as taught lessons in milestones, program progress, or the reports. To set aside a *whole*
  day (illness, leave), mark the day as **away** from the Dashboard instead — see §13.
- Saves to the searchable diary (`users/{uid}/entries`).

### 7. Diary (teaching diary)
- Navigation label is **Diary** (route `/app/history`).
- **Planning notes** per class on any day (past or upcoming) — add/edit inline from the day view;
  shared with the dashboard's notes (same `users/{uid}/planning/{date}` store). A class's note also
  appears on its **diary entry page**, under "What you recorded" and above the teaching evidence.
- **Calendar** view with an evidence-coverage status pill per teaching day:
  green = all classes recorded, yellow = some, red = none. Holiday days are greyed with no pill.
- Click a day to see **that day's timetable** (correct A/B week; numbered teaching periods only —
  roll call/meetings/recess excluded) with each class's recorded evidence attached and viewable.
  Non-timetabled entries are listed separately.
- Overview text shows the **Program Annotation** (falls back to the raw note).
- Entry detail: the note plus full evidence; the matched lesson deep-links into its program.
- **Editable entries** — an entry can be edited after saving (date, subject/class/room, the note,
  outcomes, and all evidence fields).

### 8. Global search
- ⌘K / Ctrl+K command palette across **programs, lessons, timetable classes, and diary entries**;
  results deep-link (including straight to a specific lesson).

### 9. Feedback
- In-app **Feedback** button (topbar) capturing the current page/module, type, and message.
- Stored in Firestore and pushed to a **Google Sheet** (Apps Script), which creates a **Trello
  card** per submission.

### 10. Notifications & admin
- **In-app announcements** — a broadcast shown to every signed-in user in the header
  **notification bell** (unread badge, per-user "mark as read", newest first).
- **Weekly progress email** — a Friday-afternoon (AU) reminder emailing each teacher their
  week's stats (lessons this week, total recorded, classes) and a prompt to record. Runs as a
  GitHub Actions cron job → Firebase Admin SDK → Resend (no server/Blaze). Opt-out via
  **Settings → Notifications** (`emailReminders`) or the email's unsubscribe link (`List-Unsubscribe`).
  Setup steps in `EMAIL_REMINDERS_SETUP.md`.
- **Hidden admin page** (`/app/admin`, in the profile menu) for allow-listed admins. Gated
  client-side (`ADMIN_EMAILS`) and enforced by Firestore rules. Two tabs:
  - **Notifications** — compose, publish, hide/show, and delete announcements.
  - **App usage** — total users, how many have a program / a timetable, total lessons recorded,
    plus a per-user table (plan, school/state, joined, last active, program ✓, timetable ✓, lesson
    count). Uses server-side aggregate counts; admins have read access to all `/users/**`.
  - **View as user (read-only)** — a "View as" action per user opens the whole app reading that
    user's data (Dashboard, Timetable, Programs, Diary, Reports, Achievements) with a persistent
    "Viewing as … — read only" banner and an Exit button. Writes are blocked (Firestore rules +
    Settings gating); no backend/impersonation tokens involved. For beta diagnosis.

### 11. Progressive Web App
- Installable PWA scoped to the app (`/app`) — launches into the dashboard, with app icons and an
  offline service worker.

### 12. Data & Reports (Teaching Overview)
- **Teaching Overview** dashboard with a **This Term / Year to Date** toggle.
- **KPI cards:** lessons taught, days remaining in term, evidence entries, programs active, lessons
  this week, outcomes covered, classes taught, last recorded.
- **Program Snapshot** table: per-program progress (bar + %), lessons taught / total, last lesson,
  next lesson (or "Complete"); rows link to the program.
- **Teaching Timeline:** bar chart of lessons recorded per week across the current term.
- **Upcoming Focus:** flags programs needing attention (no recent lesson, nearing completion,
  complete).
- **Quick Reports:** Evidence Register (CSV), Program Report (CSV), and Term Summary (print).
- All figures derive from recorded diary entries, programs and the term calendar.

### 13. Dashboard
- Time-of-day greeting; term/week (or "Holidays") pill linking to the timetable.
- Today's timetable (live A/B week) showing **all periods** including breaks/free periods;
  the current period is highlighted "Now".
- Classes that have **started/passed** show a **Record** button (numbered teaching periods only)
  that opens Record Lesson pre-filled; once recorded it shows "Recorded".
- **Planning notes** — add/edit a quick planning note per class on today's timetable (saved per
  day, `users/{uid}/planning/{date}`); a saved note shows inline under the class.
- **Mark a day away** — one click in the daybook header marks the whole day as away (sick leave,
  carer's leave, personal/other leave, professional learning, other, plus an optional note),
  stored one doc per date at `users/{uid}/awayDays/{yyyy-mm-dd}`. An away day is treated exactly
  like a holiday: it can't break the **teaching streak**, and it drops out of the weekly figures
  and the Week Complete / Perfect Month / Term / Year coverage badges. The day shows an "Away"
  banner, its classes swap the amber "Not recorded" nudge for a muted "Away" chip (still
  recordable, e.g. what a relief teacher covered), and the weekly snapshot adds a "Days away" row.
  Unmarking is a single click ("I wasn't away"). Also honoured by the Diary calendar (violet dot
  instead of a red "none recorded") and by the weekly reminder email's streak line.
- Suggested next steps (from the last entry) and running stats.
- "Upload your first program" prompt shown only until a program exists.

---

### 14. Achievements (gamification)
- **Achievement Badges** page (profile menu) that awards badges automatically from teaching
  activity, across categories: Consistency (streaks, week/month/term/year completeness),
  Milestones (10→1000 lessons), Programs (started/completed/five/outcome coverage), Evidence
  (first/100/500, accreditation-ready), Features & Feedback (data explorer, first report, feedback
  champion), and Special (Founding Teacher, Beta Pioneer).
- Locked badges show progress where relevant; a few (community sharing, bug-fixed) unlock as those
  features arrive. Lightweight event flags (`users/{uid}/meta/achievements`) record report/dashboard
  usage.
- **Admins can grant any badge** to a user from the admin usage table (grant-only, never revokes);
  granted badges count as earned alongside auto-awarded ones.
- **"Achievement unlocked" toast** pops when a new badge is earned (each shown once; seeds silently
  on first run; suppressed while an admin is viewing as another user), with a subtle **confetti
  burst** (respects reduced-motion). A matching entry is also added to the **notification bell**
  (per-user notifications, `users/{uid}/notifications`).

### 15. Classes
- **My Classes** page (`/app/classes`, nav item between Timetable and Programs) — set up each class
  you teach: name, subject, class code, year group, room, colour and icon (the icon is picked
  automatically from the subject, or choose your own).
- Classes are identified by the same **subject + class code key** used everywhere else
  (`classKey`), so a class page automatically lines up with its timetable cells, diary entries and
  the `meta/classPrograms` links. Stored at `users/{uid}/classes`.
- **Timetable-aware:** classes on your timetable that don't have a page yet are suggested for
  one-click setup (pre-filled subject/code/room/colour, with a guessed year group), and each class
  shows its weekly schedule (e.g. "Mon 1, Tue 2"; fortnightly slots get a Wk A/B suffix).
- **Class page** (`/app/classes/:id`) with Overview / Programs / Notes tabs (Analytics and
  Resources marked *Soon*; a Shared-with-Me tab on the list page is also *Soon*):
  - **Overview** — current program with progress bar (distinct recorded lessons ÷ lesson count),
    a class details card, a curriculum card (syllabus linking marked *Soon*), analytics tiles
    scoped to the current term (lessons
    recorded, program coverage, distinct outcomes, reflections), a **learning timeline** ticking
    off the current program's lessons as they're recorded, and quick actions (assign program,
    record lesson, add note, view data).
  - **Programs** — assign/unassign the program(s) the class follows; writes the same
    `meta/classPrograms` map Record Lesson uses for matching.
  - **Notes** — freeform per-class notes saved on the class doc.
- Deleting a class removes only the class page — timetable, diary entries and programs are
  untouched (if the class was shared, sharing is torn down too).
- **Class sharing (Phase 1 — read-only collaboration):** a class can be shared with other
  teachers from its page ("Share" → invite by email).
  - Shared classes live in a top-level `/sharedClasses` collection (the owner's private class doc
    keeps a `sharedClassId` pointer and stays the source of truth; edits and notes are written
    through to the mirror). Assigned programs are copied in as a **snapshot** at share time —
    later program edits are not synced yet.
  - **Invites** (`/classInvites`, id `<classId>__<email>`) are addressed to an email and can only
    be read/accepted by a signed-in user with a **verified** matching token email (same
    trust-model reasoning as the admin/email rules). Accepting joins the class and consumes the
    invite in one atomic batch; invites can be revoked (owner) or declined (invitee).
  - The **Shared with Me** tab lists pending invites (accept/decline, badge count) and joined
    classes; each opens a read-only view (`/app/shared/:id`) with class details, teachers, notes
    and expandable program snapshots. Members can leave; owners can remove members or stop
    sharing (which deletes the mirror, snapshots and open invites).
  - Security rules force `memberUids` (queryable list) and `members` (uid → role/name map) to
    move together; invitees can only ever add themselves, members only remove themselves.
  - **Privacy:** diary entries, evidence and timetables are never shared.
  - Not yet: contributing/co-teaching (member writes), shared analytics from multiple teachers'
    recordings, ownership transfer when an owner deletes their account.

## Planned / not yet built
- Student-level records and reporting (the class page's Students tab is deliberately not built yet).
- Class sharing Phase 2+: member contribution (shared notes/details edits), an activity feed of
  sanitized lesson summaries, multi-teacher class analytics, live program sync, and ownership
  transfer / cleanup of shared classes when the owning account is deleted.
- Billing/subscription management (plans are display-only today).
- AI backend option for the toughest PDF/Word extractions (currently client-side Gemini + heuristics).

---

## Changelog (closed beta, pre-v0.1)

_Newest first. Each entry corresponds to work pushed to `main`._

### 2026-08-05
- **Forgot password now works** — the link on the sign-in screen was a dead `href="#"`. It now
  opens a `/forgot-password` page that emails a Firebase reset link, carrying over whatever
  address was already typed on the sign-in form. Unknown addresses get exactly the same
  confirmation as known ones, so the page can’t be used to work out who has a daywise account.
- **Mark a whole day as away** — from the Dashboard daybook header, mark a day as away (sick leave,
  carer's leave, personal/other leave, professional learning, other + optional note). Away days are
  treated like holidays everywhere the app judges consistency: the **teaching streak** steps over
  them instead of resetting, they leave the weekly scheduled/remaining counts, and they don't cost
  a Week Complete / Perfect Month / Perfect Term / Perfect Year badge. The day gets an "Away"
  banner and muted (still clickable) "Away" chips in place of "Not recorded", the weekly snapshot
  gains a "Days away" row, the Diary calendar shows a violet "Away" dot instead of a red "none
  recorded" one, and the weekly reminder email's streak line agrees with the app. Stored one doc
  per date at `users/{uid}/awayDays/{yyyy-mm-dd}` — no `firestore.rules` change needed (the
  existing recursive wildcard under `/users/{uid}` already covers it).

### 2026-08-04 (later)
- **Class sharing, Phase 1 (read-only)** — share a class with other teachers by email invite.
  Shared classes live in a new top-level `/sharedClasses` collection with a program **snapshot**;
  invites (`/classInvites`) require a verified matching sign-in email and are consumed atomically
  on accept. The "Shared with Me" tab is now live (invites + joined classes), with a read-only
  shared-class view at `/app/shared/:id` (details, teachers, notes, expandable programs). Owners
  manage members/invites and can stop sharing; members can leave. Diary entries, evidence and
  timetables are never shared. ⚠ Requires deploying the updated `firestore.rules`.

### 2026-08-04
- New **Classes** section — a "My Classes" page to set up each class you teach (name, subject,
  code, year group, room, colour, icon — auto-picked from the subject but customisable), with
  one-click suggestions pulled from the timetable. Each
  class gets its own page: overview (current program + progress, term analytics, learning
  timeline, quick actions), program assignment (backed by the existing `meta/classPrograms`
  matching map) and per-class notes. Analytics/Resources tabs, class sharing and
  curriculum/syllabus linking are stubbed as "Soon"; a Students tab is deliberately not included
  yet.

### 2026-07-28
- **Account deletion now erases all Firestore data** — previously only the profile doc + auth user
  were removed, orphaning subcollections (timetable, programs/lessons, entries, planning,
  notifications, meta, feedback). Now cascades through every subcollection first.
- Weekly email: added a **recording-streak** line and a proper **one-tap unsubscribe** page
  (`/app/unsubscribe`) — clicking Unsubscribe now turns off reminders instantly (with re-enable),
  instead of sending users to Settings.
- Polished the **weekly email design** — branded navy header with the daywise wordmark + tagline,
  table-based layout (robust in Outlook/Gmail), tidier stat tiles and a bulletproof CTA button.
- Weekly reminder email now sends via **Resend** (was SendGrid) using the Resend HTTP API; dropped
  the `@sendgrid/mail` dependency. Secrets: `RESEND_API_KEY`, `EMAIL_FROM`.
- Record Lesson: **Mark as missed** — a missed/cancelled lesson counts for coverage (doesn't break a
  Perfect Week) but isn't counted as a taught lesson in milestones, program progress or reports;
  shown as "Missed" in the diary.
- Fixed **voice recording duplicating words on mobile** — speech recognition now runs
  non-continuous with auto-restart (one clean final per utterance) instead of concatenating the
  whole results array, which Android Chrome re-emitted as growing partial finals.
- Timetable cell editor: mark a cell as **Class or Meeting**; meetings are shown but non-recordable
  everywhere (Record, dashboard, diary, achievements).
- Achievement unlocks now also add a **notification-bell entry** (per-user notifications) and fire a
  subtle **confetti burst** alongside the toast.
- Added an **"Achievement unlocked" toast** that fires when a badge is newly earned (toast system +
  background watcher; one-time per badge, seeded silently, off during view-as).
- Admin can **grant achievement badges** to a user (grant-only) from the App usage table; scoped
  Firestore rule lets admins write the `meta/achievements` doc.
- Timetable: added a **"This week is: Week A / Week B"** control (shown when term dates are set) so
  schools whose A/B doesn't reset each term can correct the phase — previously the week was locked
  to "each term starts on Week A" (`termStartWeek` field).

### 2026-07-27
- Admin **View as user** — read-only whole-app impersonation for diagnosing beta issues (effective
  uid routes all data reads; persistent banner; writes blocked by rules + Settings gating).
- Added an **Achievements** page (profile menu) — auto-awarded badges across consistency,
  milestones, programs, evidence, features/feedback and special categories, to gamify usage.
- Shipped the **Data & Reports** section — Teaching Overview (KPI cards, program snapshot, weekly
  timeline, upcoming focus) with This Term / Year-to-Date toggle and CSV/print quick reports.
  Enabled the nav item (removed "Soon").

### 2026-07-22
- Diary entries are now **editable** after saving (note, class details, outcomes, evidence).
- Coming-soon page: added the app dashboard mockup with floating badges (app.daywise.au).
- Record Lesson now matches against the **program(s) a class follows** (class → program link set
  at record time), instead of any program sharing the subject — fixes outcomes/lessons bleeding
  across classes. Outcomes are also constrained to the matched lesson.
- **Fixed the diary attaching one entry to two classes** that share a subject (e.g. SEMa269 and
  SEMa268): entry↔class matching now requires the class name to match, not just the subject.

### 2026-07-15
- **Weekly progress reminder emails** (Fridays, AU) via GitHub Actions + SendGrid; Settings toggle
  + unsubscribe. Added `emailReminders` profile flag; setup in `EMAIL_REMINDERS_SETUP.md`.
- Admin: **App usage** dashboard — total users, program/timetable adoption, lessons recorded, and
  a per-user table (plan, school/state, joined, last active, program ✓, timetable ✓, lessons).
  Added an admin read rule for `/users/**`.
- **In-app announcements**: header notification bell + hidden admin page (`/app/admin`) to
  broadcast a message to all users. New `announcements` Firestore collection + rules (admins only).
- Reordered the app nav: Dashboard, Diary, Record Lesson, Timetable, Programs, Data & Reports.
- Renamed the **History** nav item to **Diary**.
- Diary: **planning notes** per class on any day (past/upcoming), shared with the dashboard;
  a class's note also shows on its **diary entry page** (above the teaching evidence).
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
