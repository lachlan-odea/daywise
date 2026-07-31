/**
 * Audit — and optionally verify — the admin accounts.
 *
 * Written for the migration to email-verified admin access. It answers three
 * questions in one run:
 *
 *   1. Is each allow-listed admin address actually registered? An address that is
 *      NOT registered can be claimed by anyone via open signup, which under the old
 *      rules handed them admin. Claim any "NOT REGISTERED" address immediately.
 *   2. Does each account look legitimately yours? Check the creation date. An
 *      account you don't recognise may already have been claimed by someone else —
 *      do NOT verify it; investigate and delete it first.
 *   3. What is each account's UID? You need these to migrate firestore.rules from
 *      the email allow-list to a UID allow-list, which is the stronger fix: a UID
 *      cannot be guessed or claimed by registering an address.
 *
 * Usage (report only — makes no changes):
 *   FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)" node scripts/admin-accounts.mjs
 *
 * Usage (force emailVerified=true on every listed admin account):
 *   FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)" node scripts/admin-accounts.mjs --apply
 *
 * --apply marks the address verified WITHOUT the owner clicking a link. That is
 * acceptable only for accounts you have confirmed are yours (question 2 above),
 * and it is the only option when you don't control the mailbox. For any mailbox you
 * DO control, prefer the "Resend verification email" button in Settings, which is
 * the real verification flow.
 */
import admin from 'firebase-admin'

// Keep in sync with ADMIN_EMAILS in src/lib/admin.ts and isAdmin() in firestore.rules.
const ADMIN_EMAILS = ['lachlan.odea@outlook.com', 'buddy@projectdaybook.com']

const { FIREBASE_SERVICE_ACCOUNT } = process.env
const apply = process.argv.includes('--apply')

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT. Aborting.')
  process.exit(1)
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) })

const fmt = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '—')

console.log(`Admin account audit — ${apply ? 'APPLY (will set emailVerified)' : 'REPORT ONLY'}\n`)

let unregistered = 0
let verified = 0
let changed = 0

for (const email of ADMIN_EMAILS) {
  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      unregistered++
      console.log(`✗ ${email}`)
      console.log(`    NOT REGISTERED — anyone can claim this address via signup. Claim it now.\n`)
      continue
    }
    console.log(`! ${email} — lookup failed: ${e.message}\n`)
    continue
  }

  const providers = user.providerData.map((p) => p.providerId).join(', ') || 'none'
  console.log(`${user.emailVerified ? '✓' : '·'} ${email}`)
  console.log(`    uid:       ${user.uid}`)
  console.log(`    created:   ${fmt(user.metadata.creationTime)}`)
  console.log(`    lastLogin: ${fmt(user.metadata.lastSignInTime)}`)
  console.log(`    providers: ${providers}`)
  console.log(`    verified:  ${user.emailVerified}`)

  if (user.emailVerified) {
    verified++
  } else if (apply) {
    await admin.auth().updateUser(user.uid, { emailVerified: true })
    changed++
    console.log(`    -> set emailVerified = true`)
  } else {
    console.log(`    -> would set emailVerified = true (re-run with --apply)`)
  }
  console.log()
}

console.log('---')
console.log(`Registered & verified: ${verified}, updated: ${changed}, NOT registered: ${unregistered}`)

if (unregistered > 0) {
  console.log(
    `\nACTION REQUIRED: ${unregistered} admin address(es) are unregistered. Until every address\n` +
      `is either claimed by you or removed from the allow-list, a stranger can register one and\n` +
      `inherit admin under the current email-based rules.`,
  )
}

console.log(
  `\nNext: copy the uid values above into a UID allow-list in firestore.rules (see the\n` +
    `isAdminUid() stub). UIDs cannot be claimed by registering an address, so that removes\n` +
    `this whole class of problem and does not depend on email verification at all.`,
)

process.exit(0)
