/**
 * Weekly progress / "record your lessons" reminder email.
 *
 * Runs on a schedule from GitHub Actions (see .github/workflows/weekly-reminders.yml).
 * Reads every user's Firestore data with the Firebase Admin SDK, computes their
 * weekly progress, and emails a personalised nudge via SendGrid.
 *
 * Required env:
 *   FIREBASE_SERVICE_ACCOUNT   JSON of a service-account key (Firestore read access)
 *   RESEND_API_KEY             Resend API key
 *   EMAIL_FROM                 verified sender address on your Resend domain, e.g. hello@daywise.au
 * Optional env:
 *   EMAIL_FROM_NAME            sender display name (default "daywise")
 *   APP_URL                    app base URL (default https://lachlan-odea.github.io/daywise)
 *   DRY_RUN                    "1" to log emails instead of sending
 *   TEST_EMAIL                 send every message to this address instead of the real users
 *   REQUIRE_VERIFIED_EMAIL     "1" to skip users whose email address is unverified
 */
import admin from 'firebase-admin'

const {
  FIREBASE_SERVICE_ACCOUNT,
  RESEND_API_KEY,
  EMAIL_FROM,
  EMAIL_FROM_NAME = 'daywise',
  APP_URL = 'https://lachlan-odea.github.io/daywise',
  DRY_RUN,
  TEST_EMAIL,
  REQUIRE_VERIFIED_EMAIL,
} = process.env

// Dry run must be an EXPLICIT choice. Deriving it from a missing API key made the
// job fail open: a rotated or renamed secret silently turned a real send into a
// "success" that printed the entire user list and exited 0, so nobody noticed
// reminders had stopped.
const dryRun = DRY_RUN === '1'
const requireVerified = REQUIRE_VERIFIED_EMAIL === '1'

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT. Aborting.')
  process.exit(1)
}
if (!dryRun && !RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY (and DRY_RUN is not set). Aborting.')
  process.exit(1)
}
if (!dryRun && !EMAIL_FROM) {
  console.error('Missing EMAIL_FROM. Aborting.')
  process.exit(1)
}

// Basic shape check so a mistyped workflow input can't be used to point daywise's
// verified sending domain at something unintended.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/
if (TEST_EMAIL && !EMAIL_RE.test(TEST_EMAIL)) {
  console.error('TEST_EMAIL is not a valid email address. Aborting.')
  process.exit(1)
}

/** Escape a value for safe interpolation into the email's HTML body. */
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * First name for the greeting, clamped to a conservative charset.
 *
 * displayName is user-controlled free text with no validation, and it lands in the
 * HTML body of a DKIM-signed email from our own domain — an ideal phishing surface.
 * Note that splitting on whitespace is NOT a sufficient guard on its own: HTML5
 * accepts "/" as an attribute separator, so `<a/href="https://evil">Click</a>` has
 * no spaces. Anything that isn't plausibly a name falls back to "there".
 */
const safeFirstName = (displayName) => {
  const first = String(displayName ?? '').trim().split(/\s+/)[0] ?? ''
  return /^[\p{L}\p{M}'’-]{1,40}$/u.test(first) ? first : 'there'
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) })
const db = admin.firestore()

const FROM = EMAIL_FROM_NAME ? `${EMAIL_FROM_NAME} <${EMAIL_FROM}>` : EMAIL_FROM
const UNSUB_URL = `${APP_URL}/app/unsubscribe`

/** Send one email via the Resend HTTP API. */
async function sendEmail(to, subject, html, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      text,
      headers: { 'List-Unsubscribe': `<${UNSUB_URL}>` },
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`)
  }
}

/** Numbered teaching periods (1, Period 1, P1, Lesson 1…) — not roll call/breaks. */
const isTeachingPeriod = (label) => /^(period\s*|p\s*|lesson\s*)?\d+$/i.test((label || '').trim())

const isoDaysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Count distinct classes in a timetable's teaching-period cells. */
function classCount(tt) {
  if (!tt?.periods || !tt?.cells) return 0
  const teaching = new Set(tt.periods.filter((p) => isTeachingPeriod(p.label)).map((p) => p.id))
  const seen = new Set()
  for (const [key, cell] of Object.entries(tt.cells)) {
    const periodId = key.split('__')[1]
    if (!teaching.has(periodId) || !cell) continue
    seen.add(`${(cell.subject || '').toLowerCase()}|${(cell.className || '').toLowerCase()}`)
  }
  return seen.size
}

/* ---- minimal timetable date helpers (mirror src/lib/timetable.ts) ---- */
const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mondayOf = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const termIndex = (tt, date) => {
  const iso = toISODate(date)
  const terms = tt?.terms ?? []
  for (let i = 0; i < terms.length; i++) if (terms[i]?.start && terms[i]?.end && iso >= terms[i].start && iso <= terms[i].end) return i
  return -1
}
const weekAB = (tt, date) => {
  if (!tt?.fortnightly) return 'A'
  const idx = termIndex(tt, date)
  if (idx >= 0 && tt.terms?.[idx]?.start) {
    const [y, m, d] = tt.terms[idx].start.split('-').map(Number)
    const start = mondayOf(new Date(y, (m || 1) - 1, d || 1))
    const w = Math.round((mondayOf(date).getTime() - start.getTime()) / (7 * 86_400_000))
    const off = tt.termStartWeek === 'B' ? 1 : 0
    return (((w + off) % 2) + 2) % 2 === 0 ? 'A' : 'B'
  }
  return 'A'
}

/**
 * Current recording streak: consecutive teaching days (most recent first) that
 * have a recorded lesson. Missed lessons and days the teacher marked themselves
 * away (illness, leave — users/{uid}/awayDays) are neutral and don't break it;
 * today is given grace if nothing's recorded yet.
 */
function computeStreak(recorded, missed, away, tt) {
  if (!tt?.periods?.length) return 0
  const teachingIds = new Set(tt.periods.filter((p) => isTeachingPeriod(p.label)).map((p) => p.id))
  const hasCalendar = (tt.terms ?? []).some((t) => t?.start && t?.end)
  const scheduled = (d) => {
    const wd = (d.getDay() + 6) % 7
    if (wd > 4) return false
    if (hasCalendar && termIndex(tt, d) < 0) return false
    const week = weekAB(tt, d)
    for (const p of tt.periods) {
      if (!teachingIds.has(p.id)) continue
      if (tt.cells?.[`${week}__${p.id}__${wd}`]) return true
    }
    return false
  }
  const todayISO = toISODate(new Date())
  let streak = 0
  const d = new Date()
  for (let i = 0; i < 140; i++) {
    if (scheduled(d)) {
      const iso = toISODate(d)
      if (away.has(iso)) {
        /* neutral — the day wasn't theirs to teach */
      } else if (recorded.has(iso)) streak++
      else if (missed.has(iso)) {
        /* neutral */
      } else if (iso === todayISO) {
        /* grace — today may not be finished */
      } else break
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function buildEmail({ firstName, lessonsThisWeek, totalLessons, classes, hasProgram, streak = 0 }) {
  const recordUrl = `${APP_URL}/app/record`
  const dashUrl = `${APP_URL}/app`

  const subject =
    lessonsThisWeek === 0
      ? 'Your teaching week — ready to record? 📝'
      : `Nice work — ${lessonsThisWeek} lesson${lessonsThisWeek === 1 ? '' : 's'} recorded this week`

  // firstName is already charset-clamped by safeFirstName(), and escaped again here
  // so the HTML body stays safe even if that clamp is ever loosened. The plain-text
  // part below uses the unescaped value.
  const headline =
    lessonsThisWeek === 0
      ? `Hi ${esc(firstName)}, let’s capture this week’s teaching.`
      : `Hi ${esc(firstName)}, here’s your week at a glance.`
  const headlineText =
    lessonsThisWeek === 0
      ? `Hi ${firstName}, let’s capture this week’s teaching.`
      : `Hi ${firstName}, here’s your week at a glance.`

  const nudge = !hasProgram
    ? `Upload a teaching program and daywise can turn each recording into professional evidence automatically.`
    : lessonsThisWeek === 0
      ? `You haven’t recorded any lessons this week yet. A quick voice note after class is all it takes — daywise writes the evidence for you.`
      : `Keep the momentum going — record any lessons you haven’t captured yet while they’re fresh.`

  const unsubUrl = UNSUB_URL

  const streakRow =
    streak >= 2
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
              <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:700;color:#9a3412;">
                &#128293; ${streak}-day recording streak — keep it going!
              </td>
            </tr></table>`
      : ''

  const stat = (value, label, accent) => `
                <td width="33%" valign="top" style="padding:0 4px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td align="center" style="background:${accent ? '#f0fdfa' : '#f5f7fc'};border-radius:12px;padding:16px 6px;">
                      <div style="font-size:26px;font-weight:800;line-height:1;color:${accent ? '#0d9488' : '#132145'};">${value}</div>
                      <div style="margin-top:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#5b6b8c;">${label}</div>
                    </td>
                  </tr></table>
                </td>`

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef2fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2fb;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
          <tr><td style="background:#132145;border-radius:16px 16px 0 0;padding:26px 30px;text-align:center;">
            <img src="${APP_URL}/brand-wordmark-white.png" alt="daywise" height="24" style="height:24px;width:auto;display:inline-block;border:0;" />
            <div style="margin-top:8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5dd2b1;">Teach. Talk. Done.</div>
          </td></tr>
          <tr><td style="background:#ffffff;border-left:1px solid #e6eaf3;border-right:1px solid #e6eaf3;padding:30px 30px 8px;">
            <h1 style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#132145;">${headline}</h1>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4a577a;">${nudge}</p>
            ${streakRow}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              ${stat(lessonsThisWeek, 'This week', true)}
              ${stat(totalLessons, 'Total recorded', false)}
              ${stat(classes, 'Classes', false)}
            </tr></table>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 6px;">
              <tr><td align="center" style="border-radius:999px;background:#14b8a6;">
                <a href="${recordUrl}" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">Record a lesson &rarr;</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;border:1px solid #e6eaf3;border-top:0;padding:18px 30px 26px;text-align:center;">
            <div style="border-top:1px solid #eef2fb;padding-top:18px;font-size:12px;line-height:1.7;color:#8894b0;">
              You&rsquo;re receiving this because you use daywise.<br/>
              <a href="${dashUrl}" style="color:#0d9488;text-decoration:none;font-weight:600;">Open daywise</a>
              &nbsp;&middot;&nbsp;
              <a href="${unsubUrl}" style="color:#8894b0;text-decoration:underline;">Unsubscribe</a>
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const text = `${headlineText}\n\n${nudge}\n${streak >= 2 ? `\n🔥 ${streak}-day recording streak — keep it going!\n` : ''}\nThis week: ${lessonsThisWeek} · Total recorded: ${totalLessons} · Classes: ${classes}\n\nRecord a lesson: ${recordUrl}\n\nUnsubscribe: ${unsubUrl}`

  return { subject, html, text }
}

async function run() {
  console.log(`Weekly reminders — ${dryRun ? 'DRY RUN' : 'LIVE'}${TEST_EMAIL ? ' (test mode)' : ''}`)
  const cutoff = isoDaysAgo(7)
  const usersSnap = await db.collection('users').get()
  let sent = 0
  let failed = 0
  let skipped = 0
  let unverified = 0
  let lastError = ''

  for (const doc of usersSnap.docs) {
    const p = doc.data()
    const uid = doc.id

    if (p.emailReminders === false) {
      skipped++
      continue
    }

    // Resolve the recipient from the Firebase Auth record, NOT from the Firestore
    // profile document. The profile doc is writable by its owner, so trusting
    // p.email let any signed-up user point daywise's verified sending domain at an
    // arbitrary third party. Auth email changes require ownership of the new
    // address, so this is the trustworthy source.
    let email = TEST_EMAIL
    if (!email) {
      let authUser
      try {
        authUser = await admin.auth().getUser(uid)
      } catch {
        skipped++ // no Auth record (deleted user with an orphaned profile doc)
        continue
      }
      if (!authUser.email) {
        skipped++
        continue
      }
      if (!authUser.emailVerified) {
        unverified++
        // Opt-in strict mode. Off by default because this codebase has not
        // historically sent verification emails, so most existing accounts are
        // unverified and would silently stop receiving reminders.
        if (requireVerified) {
          skipped++
          continue
        }
      }
      email = authUser.email
    }

    const base = db.collection('users').doc(uid)
    const [totalAgg, progAgg, ttSnap, recentSnap, awaySnap] = await Promise.all([
      base.collection('entries').count().get(),
      base.collection('programs').count().get(),
      base.collection('timetable').doc('main').get(),
      base.collection('entries').where('date', '>=', isoDaysAgo(140)).get(),
      base.collection('awayDays').where('date', '>=', isoDaysAgo(140)).get(),
    ])

    // Recent entries → this-week count (recorded only) + streak date sets.
    const recorded = new Set()
    const missed = new Set()
    let lessonsThisWeek = 0
    recentSnap.forEach((d) => {
      const e = d.data()
      if (!e.date) return
      if (e.missed) {
        missed.add(e.date)
        return
      }
      recorded.add(e.date)
      if (e.date >= cutoff) lessonsThisWeek++
    })

    // Days marked away — neutral for the streak, so illness or leave doesn't cost it.
    // The doc id is the date, but the field is read so the range query above can index.
    const away = new Set()
    awaySnap.forEach((d) => away.add(d.data()?.date || d.id))

    const totalLessons = totalAgg.data().count
    const hasProgram = progAgg.data().count > 0
    const classes = classCount(ttSnap.data())
    const streak = computeStreak(recorded, missed, away, ttSnap.data())

    const firstName = safeFirstName(p.displayName)
    const { subject, html, text } = buildEmail({ firstName, lessonsThisWeek, totalLessons, classes, hasProgram, streak })

    // This repo is public, which makes Actions logs world-readable. Log an opaque
    // uid prefix rather than the address so a run cannot be scraped for the full
    // roster of registered teachers.
    const ref = uid.slice(0, 6)

    if (dryRun) {
      console.log(`• ${ref} — "${subject}" (week ${lessonsThisWeek}, total ${totalLessons}, classes ${classes}, streak ${streak})`)
      sent++
      if (TEST_EMAIL) break
      continue
    }

    try {
      await sendEmail(email, subject, html, text)
      sent++
      console.log(`✓ ${ref}`)
    } catch (e) {
      failed++
      lastError = e.message
      console.error(`✗ ${ref}:`, e.message)
    }
    if (TEST_EMAIL) break
  }

  console.log(
    `Done. Sent/queued: ${sent}, failed: ${failed}, skipped: ${skipped}, unverified recipients: ${unverified}${
      requireVerified ? ' (skipped — strict mode)' : ' (not skipped — set REQUIRE_VERIFIED_EMAIL=1 to skip)'
    }.`,
  )

  // Exit non-zero when nothing got through despite having recipients. Otherwise a
  // systemic fault — expired API key, unverified sending domain, Resend outage —
  // produces a green CI run and reminders stop without anyone noticing. Partial
  // failures are surfaced loudly but don't fail the job, since one hard-bouncing
  // address shouldn't block everyone else's reminder.
  if (failed > 0 && sent === 0) {
    console.error(
      `\nEvery send failed (${failed}/${failed}). This looks like a configuration problem, ` +
        `not bad addresses.\nLast error: ${lastError}`,
    )
    process.exit(1)
  }
  if (failed > 0) {
    console.warn(`\nWARNING: ${failed} of ${failed + sent} sends failed. Last error: ${lastError}`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
