/**
 * Guard rails for user-supplied document uploads.
 *
 * Timetable and program files are parsed entirely in the browser by xlsx, mammoth
 * and pdf.js. Those parsers are handed the raw bytes of whatever the user picked, so
 * a malformed or hostile file is a denial-of-service (and, for `xlsx@0.18.5`, a
 * prototype-pollution) risk against the uploader's own tab. Two cheap checks remove
 * most of that surface:
 *
 *   1. A size cap, so a multi-hundred-megabyte file can't hang or OOM the tab.
 *      There was previously no `file.size` check anywhere in the upload path.
 *   2. A magic-byte check, so dispatch doesn't rely solely on the filename
 *      extension. `accept="..."` on the input is only a picker hint and is bypassed
 *      entirely by drag-and-drop.
 */

/** Largest upload we'll attempt to parse. Real timetables/programs are far smaller. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

const humanMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/** Signatures for the container formats we accept. CSV is plain text, so it has none. */
const SIGNATURES: { magic: number[]; label: string }[] = [
  { magic: [0x50, 0x4b, 0x03, 0x04], label: 'zip' }, // .xlsx / .docx (OOXML)
  { magic: [0x25, 0x50, 0x44, 0x46], label: 'pdf' }, // %PDF
  { magic: [0xd0, 0xcf, 0x11, 0xe0], label: 'ole' }, // legacy .xls / .doc
]

/**
 * Throws a user-facing Error if the file is too large, empty, or its bytes don't
 * match its extension. Call once before handing a file to any parser.
 */
export async function assertSafeUpload(file: File): Promise<void> {
  if (file.size === 0) {
    throw new Error('That file is empty. Please choose another file.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That file is ${humanMb(file.size)}. Please upload a file under ${humanMb(MAX_UPLOAD_BYTES)}.`,
    )
  }

  // A .csv is plain text with no signature to check — the size cap is the guard.
  if (file.name.toLowerCase().endsWith('.csv')) return

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const matched = SIGNATURES.some((s) => s.magic.every((b, i) => head[i] === b))
  if (!matched) {
    throw new Error(
      "That file doesn't look like a valid PDF, Word or Excel document — it may be renamed or corrupted.",
    )
  }
}
