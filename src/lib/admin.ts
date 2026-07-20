/**
 * Admin allow-list. Only these accounts can publish announcements and see the
 * hidden admin page. Must be kept in sync with the `announcements` write rule
 * in firestore.rules (which enforces this server-side).
 */
export const ADMIN_EMAILS = ['lachlan.odea@outlook.com','admin@projectdaybook.com','james.mcclelland7@det.nsw.edu.au']

export function isAdmin(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.toLowerCase()
  return !!email && ADMIN_EMAILS.includes(email)
}
