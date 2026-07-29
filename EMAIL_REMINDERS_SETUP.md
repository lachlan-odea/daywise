# Weekly reminder emails — setup

daywise sends a **weekly progress email** every **Friday afternoon (AU time)** nudging teachers to
record their lessons. It runs as a GitHub Actions cron job (`.github/workflows/weekly-reminders.yml`)
that reads Firestore with the Firebase Admin SDK and sends via **Resend**. No Firebase Blaze plan
or server is required.

Users are opted in by default. The **Unsubscribe** link in any email (also sent as a
`List-Unsubscribe` header) opens `/app/unsubscribe`, which turns off `emailReminders` in one tap
for the signed-in user (with a "re-enable" option). They can also toggle it in
**Settings → Notifications**.

## One-time setup

### 1. Resend
1. Create a [Resend](https://resend.com) account.
2. **Add & verify your domain** (*Domains → Add Domain* → e.g. `daywise.au`) by adding the DNS
   records Resend shows (SPF/DKIM/DMARC) at your DNS host. Verification massively improves
   deliverability and is required to send from `…@daywise.au`.
3. Create an **API key** (*API Keys → Create*) — copy it (starts with `re_`).
4. Choose your **from address** on the verified domain, e.g. `hello@daywise.au`.

### 2. Firebase service account
1. Firebase console → *Project settings → Service accounts → Generate new private key*.
2. This downloads a JSON file. You'll paste its **entire contents** into a GitHub secret.

### 3. GitHub repository secrets
Repo → *Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | the full JSON from step 2 |
| `RESEND_API_KEY` | your Resend API key (`re_…`) |
| `EMAIL_FROM` | your verified sender, e.g. `hello@daywise.au` |

## Testing before it goes live
Repo → *Actions → Weekly reminders → Run workflow*:
- Tick **dry_run** to log what *would* be sent without sending anything.
- Or set **test_email** to your own address to send yourself a single sample.

Locally you can also run:
```bash
DRY_RUN=1 FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)" npm run reminders
```

## Schedule
`cron: '0 6 * * 5'` — Fridays 06:00 UTC (≈ 4pm AEST / 5pm AEDT). Adjust the cron in
`.github/workflows/weekly-reminders.yml` to change the time. (GitHub cron is always UTC; the
Australian send time shifts by an hour across daylight saving.)

## What the email contains
Per-teacher: lessons recorded **this week**, **total** lessons recorded, number of **classes** in
their timetable, a **recording streak** (consecutive teaching days recorded, shown at 2+), and a
context-aware nudge (upload a program / record your first lesson / keep it up), with a **Record a
lesson** button and an unsubscribe link.
