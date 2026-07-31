/**
 * Admin allow-list. Only these accounts can publish announcements, read other
 * users' data, and see the hidden admin page. Must be kept in sync with isAdmin()
 * in firestore.rules, which enforces all of this server-side — this module only
 * decides what UI to show.
 *
 * Keyed on UID, not email address. An email allow-list was exploitable: these
 * values ship in the public JS bundle, signup is open, and Firebase sets
 * token.email for password accounts whether or not the address is verified — so a
 * stranger could register an allow-listed address and inherit admin. A UID is
 * assigned by Firebase and cannot be claimed by registering an address, so
 * publishing it here is harmless.
 *
 * NOTE: UIDs are per-account. Deleting and recreating an admin account issues a new
 * UID, which must be updated here AND in firestore.rules.
 */
export const ADMIN_UIDS = ['kaOBMwgr7CTVyJSH3YAdfycWctW2', '1k4WK8VOojgUpH9IFNAG9CGAWoj2']

/** The addresses behind ADMIN_UIDS — reference only, never used for authorization. */
export const ADMIN_EMAILS = ['lachlan.odea@outlook.com', 'buddy@projectdaybook.com']

export function isAdmin(user: { uid?: string | null } | null | undefined): boolean {
  const uid = user?.uid
  return !!uid && ADMIN_UIDS.includes(uid)
}
