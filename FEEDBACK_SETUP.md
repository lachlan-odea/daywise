# Feedback → Google Sheet setup

The in-app **Feedback** button (top bar) saves every submission to Firestore
(`users/{uid}/feedback`) and — once configured — also appends a row to a Google Sheet
via a Google Apps Script web app.

## 1. Create the sheet

1. Create a Google Sheet (any name, e.g. **daywise feedback**).
2. Add a header row in row 1:

   `Timestamp | Name | Email | UID | Page | Module | Type | Message | User Agent`

## 2. Add the Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Replace the default code with:

   ```javascript
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
     const p = e.parameter
     sheet.appendRow([
       p.timestamp || new Date().toISOString(),
       p.name || '',
       p.email || '',
       p.uid || '',
       p.page || '',
       p.module || '',
       p.type || '',
       p.message || '',
       p.userAgent || '',
     ])
     return ContentService.createTextOutput('ok')
   }
   ```

3. **Deploy → New deployment → Web app**.
   - Description: `daywise feedback`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/…/exec`).

## 3. Point the app at it

Add the URL as an env var (local `.env` and a GitHub Actions secret for production):

```
VITE_FEEDBACK_ENDPOINT=https://script.google.com/macros/s/XXXXXXXX/exec
```

```bash
gh secret set VITE_FEEDBACK_ENDPOINT -b"https://script.google.com/macros/s/XXXXXXXX/exec"
```

That's it — feedback will now append to the sheet. Until the endpoint is set, submissions are
still captured in Firestore under each user's `feedback` collection, so nothing is lost.

### Notes
- The app posts with `mode: 'no-cors'` (Apps Script doesn't send CORS headers), so the browser
  can't read the response — that's expected; the row is still written.
- Each submission includes the page the user was on plus the module they selected.
