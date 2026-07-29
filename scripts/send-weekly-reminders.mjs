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
} = process.env

const dryRun = DRY_RUN === '1' || !RESEND_API_KEY

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT. Aborting.')
  process.exit(1)
}
if (!dryRun && !EMAIL_FROM) {
  console.error('Missing EMAIL_FROM. Aborting.')
  process.exit(1)
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) })
const db = admin.firestore()

const FROM = EMAIL_FROM_NAME ? `${EMAIL_FROM_NAME} <${EMAIL_FROM}>` : EMAIL_FROM
const UNSUB_URL = `${APP_URL}/app/settings`

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

function buildEmail({ firstName, lessonsThisWeek, totalLessons, classes, hasProgram }) {
  const recordUrl = `${APP_URL}/app/record`
  const dashUrl = `${APP_URL}/app`

  const subject =
    lessonsThisWeek === 0
      ? 'Your teaching week — ready to record? 📝'
      : `Nice work — ${lessonsThisWeek} lesson${lessonsThisWeek === 1 ? '' : 's'} recorded this week`

  const headline =
    lessonsThisWeek === 0
      ? `Hi ${firstName}, let’s capture this week’s teaching.`
      : `Hi ${firstName}, here’s your week at a glance.`

  const nudge = !hasProgram
    ? `Upload a teaching program and daywise can turn each recording into professional evidence automatically.`
    : lessonsThisWeek === 0
      ? `You haven’t recorded any lessons this week yet. A quick voice note after class is all it takes — daywise writes the evidence for you.`
      : `Keep the momentum going — record any lessons you haven’t captured yet while they’re fresh.`

  const unsubUrl = UNSUB_URL

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

  const text = `${headline}\n\n${nudge}\n\nThis week: ${lessonsThisWeek} · Total recorded: ${totalLessons} · Classes: ${classes}\n\nRecord a lesson: ${recordUrl}\n\nUnsubscribe: ${unsubUrl}`

  return { subject, html, text }
}

async function run() {
  console.log(`Weekly reminders — ${dryRun ? 'DRY RUN' : 'LIVE'}${TEST_EMAIL ? ` (test → ${TEST_EMAIL})` : ''}`)
  const cutoff = isoDaysAgo(7)
  const usersSnap = await db.collection('users').get()
  let sent = 0
  let skipped = 0

  for (const doc of usersSnap.docs) {
    const p = doc.data()
    const uid = doc.id
    const email = TEST_EMAIL || p.email
    if (!email) {
      skipped++
      continue
    }
    if (p.emailReminders === false) {
      skipped++
      continue
    }

    const base = db.collection('users').doc(uid)
    const [weekAgg, totalAgg, progAgg, ttSnap] = await Promise.all([
      base.collection('entries').where('date', '>=', cutoff).count().get(),
      base.collection('entries').count().get(),
      base.collection('programs').count().get(),
      base.collection('timetable').doc('main').get(),
    ])

    const lessonsThisWeek = weekAgg.data().count
    const totalLessons = totalAgg.data().count
    const hasProgram = progAgg.data().count > 0
    const classes = classCount(ttSnap.data())

    const firstName = (p.displayName || '').split(' ')[0] || 'there'
    const { subject, html, text } = buildEmail({ firstName, lessonsThisWeek, totalLessons, classes, hasProgram })

    if (dryRun) {
      console.log(`• ${email} — "${subject}" (week ${lessonsThisWeek}, total ${totalLessons}, classes ${classes})`)
      sent++
      if (TEST_EMAIL) break
      continue
    }

    try {
      await sendEmail(email, subject, html, text)
      sent++
      console.log(`✓ ${email}`)
    } catch (e) {
      console.error(`✗ ${email}:`, e.message)
    }
    if (TEST_EMAIL) break
  }

  console.log(`Done. Sent/queued: ${sent}, skipped: ${skipped}.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
