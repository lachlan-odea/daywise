/**
 * Weekly progress / "record your lessons" reminder email.
 *
 * Runs on a schedule from GitHub Actions (see .github/workflows/weekly-reminders.yml).
 * Reads every user's Firestore data with the Firebase Admin SDK, computes their
 * weekly progress, and emails a personalised nudge via SendGrid.
 *
 * Required env:
 *   FIREBASE_SERVICE_ACCOUNT   JSON of a service-account key (Firestore read access)
 *   SENDGRID_API_KEY           SendGrid API key with Mail Send permission
 *   EMAIL_FROM                 verified sender address, e.g. hello@daywise.app
 * Optional env:
 *   EMAIL_FROM_NAME            sender display name (default "daywise")
 *   SENDGRID_UNSUB_GROUP_ID    SendGrid unsubscribe (ASM) group id — enables one-click unsubscribe
 *   APP_URL                    app base URL (default https://lachlan-odea.github.io/daywise)
 *   DRY_RUN                    "1" to log emails instead of sending
 *   TEST_EMAIL                 send every message to this address instead of the real users
 */
import admin from 'firebase-admin'
import sgMail from '@sendgrid/mail'

const {
  FIREBASE_SERVICE_ACCOUNT,
  SENDGRID_API_KEY,
  EMAIL_FROM,
  EMAIL_FROM_NAME = 'daywise',
  SENDGRID_UNSUB_GROUP_ID,
  APP_URL = 'https://lachlan-odea.github.io/daywise',
  DRY_RUN,
  TEST_EMAIL,
} = process.env

const dryRun = DRY_RUN === '1' || !SENDGRID_API_KEY

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
if (!dryRun) sgMail.setApiKey(SENDGRID_API_KEY)

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

  const unsubUrl = SENDGRID_UNSUB_GROUP_ID ? '<%asm_group_unsubscribe_raw_url%>' : `${APP_URL}/app/settings`

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2a4a">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:8px 0 20px">
      <span style="font-size:22px;font-weight:800;color:#132145;letter-spacing:-.5px">daywise</span>
    </div>
    <div style="background:#fff;border-radius:18px;padding:28px;border:1px solid #e6eaf3">
      <h1 style="margin:0 0 8px;font-size:20px;color:#132145">${headline}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4a577a">${nudge}</p>
      <div style="display:flex;gap:10px;text-align:center;margin:0 0 24px">
        <div style="flex:1;background:#f0fdfa;border-radius:12px;padding:14px 8px">
          <div style="font-size:24px;font-weight:800;color:#0d9488">${lessonsThisWeek}</div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#5b6b8c">This week</div>
        </div>
        <div style="flex:1;background:#f5f7fc;border-radius:12px;padding:14px 8px">
          <div style="font-size:24px;font-weight:800;color:#132145">${totalLessons}</div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#5b6b8c">Total recorded</div>
        </div>
        <div style="flex:1;background:#f5f7fc;border-radius:12px;padding:14px 8px">
          <div style="font-size:24px;font-weight:800;color:#132145">${classes}</div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#5b6b8c">Classes</div>
        </div>
      </div>
      <div style="text-align:center">
        <a href="${recordUrl}" style="display:inline-block;background:#14b8a6;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px">Record a lesson</a>
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#8894b0;margin:20px 0 0;line-height:1.5">
      You’re receiving this because you use daywise.
      <a href="${dashUrl}" style="color:#8894b0">Open daywise</a> ·
      <a href="${unsubUrl}" style="color:#8894b0">Unsubscribe</a>
    </p>
  </div></body></html>`

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

    const msg = {
      to: email,
      from: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
      subject,
      html,
      text,
    }
    if (SENDGRID_UNSUB_GROUP_ID) msg.asm = { groupId: Number(SENDGRID_UNSUB_GROUP_ID) }

    try {
      await sgMail.send(msg)
      sent++
      console.log(`✓ ${email}`)
    } catch (e) {
      console.error(`✗ ${email}:`, e?.response?.body?.errors || e.message)
    }
    if (TEST_EMAIL) break
  }

  console.log(`Done. Sent/queued: ${sent}, skipped: ${skipped}.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
