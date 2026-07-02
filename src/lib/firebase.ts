import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True when the Firebase env vars have actually been provided. */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

// Only initialize Firebase when configured. Calling getAuth() with an empty
// config throws (auth/invalid-api-key), which would crash the whole app — so we
// guard here and let the UI show a friendly "not configured yet" message.
let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
} else {
  console.warn(
    '[Project Daybook] Firebase is not configured. Add your VITE_FIREBASE_* values ' +
      '(.env locally, GitHub secrets in CI). See FIREBASE_SETUP.md.',
  )
}

export { app, auth, db }

// Providers don't require config to instantiate.
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export const microsoftProvider = new OAuthProvider('microsoft.com')
microsoftProvider.setCustomParameters({ prompt: 'select_account' })

export default app
