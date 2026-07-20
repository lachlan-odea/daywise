# Weekly reminder emails — setup

daywise sends a **weekly progress email** every **Friday afternoon (AU time)** nudging teachers to
record their lessons. It runs as a GitHub Actions cron job (`.github/workflows/weekly-reminders.yml`)
that reads Firestore with the Firebase Admin SDK and sends via **SendGrid**. No Firebase Blaze plan
or server is required.

Users are opted in by default and can opt out via **Settings → Notifications** (the `emailReminders`
flag on their profile) or the **Unsubscribe** link in any email.

## One-time setup

### 1. SendGrid
1. Create a SendGrid account and a **Single Sender** or (recommended) authenticate your **domain**
   under *Settings → Sender Authentication*. Domain auth (SPF/DKIM DNS records) massively improves
   deliverability.
2. Create an **API key** with *Mail Send* permission (*Settings → API Keys*).
3. Create an **unsubscribe group** (*Settings → Suppressions → Unsubscribe Groups*), e.g.
   "Weekly progress emails". Note its **group ID** (a number). This gives one-click, compliant
   unsubscribe and auto-suppresses future sends.
4. Enable **Subscription Tracking** (*Settings → Mail Settings*) so the `Unsubscribe` link in the
   email body resolves.

### 2. Firebase service account
1. Firebase console → *Project settings → Service accounts → Generate new private key*.
2. This downloads a JSON file. You'll paste its **entire contents** into a GitHub secret.

### 3. GitHub repository secrets
Repo → *Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | the full JSON from step 2 |
| `SENDGRID_API_KEY` | your SendGrid API key |
| `EMAIL_FROM` | your verified sender, e.g. `hello@daywise.app` |
| `SENDGRID_UNSUB_GROUP_ID` | the unsubscribe group ID (number) |

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
their timetable, and a context-aware nudge (upload a program / record your first lesson / keep it up),
with a **Record a lesson** button and an unsubscribe link.
