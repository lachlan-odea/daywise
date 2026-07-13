import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/** Google Apps Script Web App URL that appends feedback rows to the sheet. */
const ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT || ''

export interface FeedbackPayload {
  uid: string
  name: string
  email: string
  page: string
  module: string
  type: string
  message: string
}

export async function submitFeedback(p: FeedbackPayload) {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  // Always keep a copy in Firestore so feedback is never lost.
  if (db) {
    try {
      await addDoc(collection(db, 'users', p.uid, 'feedback'), { ...p, userAgent, createdAt: serverTimestamp() })
    } catch {
      /* non-fatal */
    }
  }

  // Send to the Google Sheet via the Apps Script web app (if configured).
  if (ENDPOINT) {
    const body = new URLSearchParams({
      timestamp: new Date().toISOString(),
      name: p.name,
      email: p.email,
      uid: p.uid,
      page: p.page,
      module: p.module,
      type: p.type,
      message: p.message,
      userAgent,
    })
    // Apps Script web apps don't send CORS headers; no-cors makes a simple,
    // preflight-free request. The response is opaque but the row is written.
    await fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } else if (!db) {
    throw new Error('Feedback is not configured yet.')
  }
}
