import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  onAuthStateChanged,
  type User,
  type AuthProvider as FirebaseAuthProvider,
} from 'firebase/auth'
import { doc, deleteDoc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider, microsoftProvider } from '../lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithMicrosoft: () => Promise<void>
  logout: () => Promise<void>
  /** The primary sign-in provider id, e.g. 'password' | 'google.com' | 'microsoft.com'. */
  providerId: string | null
  updateDisplayName: (name: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  deleteAccount: (currentPassword?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Throws a clear error when an auth action is attempted before Firebase is configured. */
function requireAuth() {
  if (!auth) throw { code: 'auth/operation-not-allowed' }
  return auth
}

/** Creates (or updates) the user's profile document in Firestore. */
async function upsertUserProfile(user: User) {
  if (!db) return
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: user.providerData[0]?.providerId ?? 'password',
      ...(snap.exists() ? {} : { createdAt: serverTimestamp(), plan: 'starter' }),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Bumped to force a re-render when the User object mutates in place
  // (e.g. after updateProfile), since its reference stays the same.
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const refreshUser = async () => {
    if (auth?.currentUser) {
      await auth.currentUser.reload()
      setUser(auth.currentUser)
      setTick((t) => t + 1)
    }
  }

  /** Re-authenticates the current user — required before sensitive actions. */
  const reauthenticate = async (currentPassword?: string) => {
    const u = requireAuth().currentUser
    if (!u) throw { code: 'auth/no-current-user' }
    const provider = u.providerData[0]?.providerId
    if (provider === 'google.com') return void (await reauthenticateWithPopup(u, googleProvider))
    if (provider === 'microsoft.com') return void (await reauthenticateWithPopup(u, microsoftProvider))
    if (!currentPassword || !u.email) throw { code: 'auth/missing-password' }
    const cred = EmailAuthProvider.credential(u.email, currentPassword)
    await reauthenticateWithCredential(u, cred)
  }

  const updateDisplayName = async (name: string) => {
    const u = requireAuth().currentUser
    if (!u) throw { code: 'auth/no-current-user' }
    await updateProfile(u, { displayName: name })
    await refreshUser()
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const u = requireAuth().currentUser
    if (!u) throw { code: 'auth/no-current-user' }
    await reauthenticate(currentPassword)
    await updatePassword(u, newPassword)
  }

  const deleteAccount = async (currentPassword?: string) => {
    const u = requireAuth().currentUser
    if (!u) throw { code: 'auth/no-current-user' }
    await reauthenticate(currentPassword)
    if (db) await deleteDoc(doc(db, 'users', u.uid))
    await deleteUser(u)
  }

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(requireAuth(), email, password)
    if (name) await updateProfile(cred.user, { displayName: name })
    await upsertUserProfile(cred.user)
  }

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(requireAuth(), email, password)
    await upsertUserProfile(cred.user)
  }

  const signInWithProvider = async (provider: FirebaseAuthProvider) => {
    const cred = await signInWithPopup(requireAuth(), provider)
    await upsertUserProfile(cred.user)
  }

  const value: AuthContextValue = {
    user,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle: () => signInWithProvider(googleProvider),
    signInWithMicrosoft: () => signInWithProvider(microsoftProvider),
    logout: () => (auth ? signOut(auth) : Promise.resolve()),
    providerId: user?.providerData[0]?.providerId ?? null,
    updateDisplayName,
    changePassword,
    deleteAccount,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/** Converts a Firebase auth error code into a friendly message. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/email-already-in-use':
      return 'An account already exists with that email. Try signing in.'
    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.'
    case 'auth/account-exists-with-different-credential':
      return 'You’ve already signed up with a different method for this email.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t enabled yet in Firebase.'
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again before making this change.'
    case 'auth/missing-password':
      return 'Please enter your current password to confirm.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
