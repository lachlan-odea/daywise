# Firebase AI Logic setup (timetable AI import)

The timetable importer can use **Gemini** (via **Firebase AI Logic**) to read messy
PDF/Word/Excel timetables and turn them into structured data. It's called straight from
the browser using your existing Firebase config — there's no server to deploy.

If this isn't set up, the importer automatically falls back to the manual column-mapping flow.

## 1. Enable Firebase AI Logic

1. Firebase console → your project (`daybook-f5bab`) → in the left nav under **Build**, open
   **AI Logic** (may appear as "Gemini in Firebase" / "Build with Gemini").
2. Click **Get started**.
3. When asked which API to use, choose the **Gemini Developer API** (Google AI).
   - It has a **free tier**, so you can start **without** enabling billing (Blaze).
   - (The alternative, *Vertex AI*, requires the Blaze plan. The app uses the Gemini
     Developer API backend, so pick that one.)
4. Firebase will enable the required API and provision a Gemini API key that the SDK uses
   automatically — you **don't** need to copy or paste anything.

That's all that's strictly required for it to work in development.

## 2. (Recommended) Protect it with App Check

Because the call originates in the browser, enable **App Check** so only your app can use your
Gemini quota:

1. Firebase console → **Build → App Check**.
2. Register your **Web app** with the **reCAPTCHA v3** provider (create a reCAPTCHA v3 site key
   at <https://www.google.com/recaptcha/admin>).
3. Turn on **enforcement** for the **AI Logic / Gemini** API.

If you'd like, tell me once you've created the reCAPTCHA site key and I'll wire App Check into
the app (`initializeAppCheck` in `src/lib/firebase.ts`).

## 3. Nothing to change in code or env

The feature uses the same `VITE_FIREBASE_*` config you've already set. Once AI Logic is enabled
in the console, uploading a timetable will show **"AI will read it for you"** and produce a
reviewable result. No `.env` or GitHub secret changes are needed.

## Notes

- Model used: `gemini-2.5-flash` (fast, low cost, strong at structured extraction).
- The file is parsed to text in your browser; only the **text** is sent to Gemini, never the raw file.
- Free-tier quotas are limited — for production traffic, enable Blaze and App Check.
