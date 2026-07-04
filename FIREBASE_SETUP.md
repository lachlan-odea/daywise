# Firebase setup guide

Project Daybook uses **Firebase Authentication** (email/password + Google + Microsoft) and
**Cloud Firestore** (for user profiles and, later, your teaching data). Follow these steps once
to get login working locally and in production.

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it (e.g. `project-daybook`), accept the terms, and create it. Google Analytics is optional.

## 2. Register a Web app + get your config

1. In the project, click the **Web** icon (`</>`) to add an app. Nickname it `Project Daybook Web`.
2. You **don't** need Firebase Hosting (we deploy on GitHub Pages).
3. Copy the `firebaseConfig` values shown — you'll need `apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, and `appId`.

## 3. Enable the sign-in methods

**Build → Authentication → Get started → Sign-in method**, then enable:

- **Email/Password** → toggle on → Save.
- **Google** → toggle on, pick a support email → Save.
- **Microsoft** → toggle on. This requires an Azure app registration:
  1. In the [Azure Portal](https://portal.azure.com) → **App registrations → New registration**.
  2. Set the redirect URI (Web) to the one Firebase shows on the Microsoft provider screen
     (looks like `https://<your-project>.firebaseapp.com/__/auth/handler`).
  3. Copy the **Application (client) ID** and create a **client secret** (Certificates & secrets),
     then paste both back into Firebase's Microsoft provider dialog → Save.

> Don't want Microsoft yet? Leave it disabled — the button will simply show a friendly
> "this sign-in method isn't enabled" message until you turn it on.

## 4. Authorize your domains

**Authentication → Settings → Authorized domains → Add domain** and add:

- `lachlan-odea.github.io`  (your live GitHub Pages site)
- `localhost` is already there for local development.

## 5. Create the Firestore database

**Build → Firestore Database → Create database** → start in **production mode** → choose a region.

Then set security rules so each user can only read/write their own data —
including subcollections like their timetable (**Firestore → Rules**, paste this, Publish).
The same rules live in [`firestore.rules`](firestore.rules) in this repo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

> The `/{document=**}` wildcard is important — without it, rules don’t apply to
> subcollections and saving your timetable (stored at `users/{uid}/timetable/main`)
> would be denied.

## 6. Configure the app locally

Create a `.env` file in the project root (copy from `.env.example`) and paste your values:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

Then run `npm run dev` and try signing up at <http://localhost:5173/project-daybook-website/signup>.

## 7. Configure the app in production (GitHub Actions)

The deploy workflow reads the same variables from **GitHub repository secrets** at build time.
Add them with the GitHub CLI (run once):

```bash
gh secret set VITE_FIREBASE_API_KEY -b"AIza..."
gh secret set VITE_FIREBASE_AUTH_DOMAIN -b"your-project.firebaseapp.com"
gh secret set VITE_FIREBASE_PROJECT_ID -b"your-project"
gh secret set VITE_FIREBASE_STORAGE_BUCKET -b"your-project.appspot.com"
gh secret set VITE_FIREBASE_MESSAGING_SENDER_ID -b"1234567890"
gh secret set VITE_FIREBASE_APP_ID -b"1:1234567890:web:abcdef"
```

(Or add them in the repo UI: **Settings → Secrets and variables → Actions → New repository secret**.)

Push to `main` (or re-run the workflow) and the live site will have working authentication.

---

### Notes

- The Firebase web config is **not secret** — it's meant to ship in client code. Security is
  enforced by your Authentication settings and Firestore rules, not by hiding these values.
- Until config is provided, the login/signup pages render but show a "Firebase isn't configured
  yet" message when you try to authenticate — so the site never crashes.

## Granting complimentary / perpetual access (pilot teachers)

To give a teacher free lifetime access (shown in the app as **"Founding Teacher · Free forever"**):

1. Firebase console → **Firestore Database** → `users` collection.
2. Open the teacher's document (its ID is their Firebase Auth `uid` — you can find it under
   **Authentication → Users**).
3. Set the **`plan`** field to `perpetual` (string). Add the field if it isn't there.

That's it — next time they open **Settings → Subscription** they'll see the complimentary plan with
no upgrade or billing prompts. Sign-in never overwrites `plan`, so it sticks. Valid values are
`starter`, `pro`, `school`, `perpetual`.
