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

/**
 * Force a value to be treated as text by Google Sheets / Excel.
 *
 * The Apps Script endpoint is public and unauthenticated (its URL ships in the JS
 * bundle), so anyone can post rows. A leading =, +, -, @, tab or CR would otherwise
 * be evaluated as a formula when the sheet is opened.
 */
const sheetSafe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)

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
      name: sheetSafe(p.name),
      email: sheetSafe(p.email),
      uid: p.uid,
      page: sheetSafe(p.page),
      module: sheetSafe(p.module),
      type: sheetSafe(p.type),
      message: sheetSafe(p.message),
      userAgent: sheetSafe(userAgent),
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
