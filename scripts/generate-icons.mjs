// Generates PWA icons, favicons and a tight square brand mark from the daywise logo.
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = join(__dirname, '..', 'public')
const brandSrc = join(__dirname, '..', 'brand-src')
const SOURCE = join(brandSrc, 'daywise logos_Logo.png')

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }

// Trim the transparent margin, then pad to a centred square so framing is consistent.
const trimmed = await sharp(SOURCE).trim().toBuffer()
const tm = await sharp(trimmed).metadata()
const side = Math.max(tm.width, tm.height)
const squareMark = await sharp({ create: { width: side, height: side, channels: 4, background: CLEAR } })
  .composite([{ input: trimmed, gravity: 'center' }])
  .png()
  .toBuffer()

// A crisp, tightly-framed square mark for use in the UI (<img> in the Logo component).
await sharp(squareMark).resize(512, 512).png().toFile(join(pub, 'brand-mark.png'))
console.log('wrote brand-mark.png')

// Clean, space-free copies of the wordmark and combination lockups.
await sharp(join(brandSrc, 'daywise logos_Word Mark.png')).trim().png().toFile(join(pub, 'brand-wordmark.png'))
await sharp(join(brandSrc, 'daywise logos_Word Mark_white.png')).trim().png().toFile(join(pub, 'brand-wordmark-white.png'))
await sharp(join(brandSrc, 'daywise logos_Combination.png')).trim().png().toFile(join(pub, 'brand-combination.png'))
console.log('wrote brand-wordmark.png, brand-wordmark-white.png, brand-combination.png')

const roundedMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(
      size * 0.22,
    )}" ry="${Math.round(size * 0.22)}"/></svg>`,
  )

async function makeIcon({ size, bg, pad, round, file }) {
  const content = Math.round(size * (1 - 2 * pad))
  const mark = await sharp(squareMark)
    .resize(content, content, { fit: 'contain', background: CLEAR })
    .toBuffer()
  let buf = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
  if (round) {
    buf = await sharp(buf)
      .composite([{ input: roundedMask(size), blend: 'dest-in' }])
      .png()
      .toBuffer()
  }
  await sharp(buf).toFile(join(pub, file))
  console.log('wrote', file, `(${size}px)`)
}

// App icons on white (the mark's navy page contrasts; white page is defined by its teal outline).
await makeIcon({ size: 192, bg: WHITE, pad: 0.12, round: true, file: 'pwa-192.png' })
await makeIcon({ size: 512, bg: WHITE, pad: 0.12, round: true, file: 'pwa-512.png' })
await makeIcon({ size: 512, bg: WHITE, pad: 0.18, round: false, file: 'pwa-maskable-512.png' })
await makeIcon({ size: 180, bg: WHITE, pad: 0.1, round: false, file: 'apple-touch-icon.png' })

// Favicons — transparent so they sit on any browser tab colour.
await makeIcon({ size: 32, bg: CLEAR, pad: 0.02, round: false, file: 'favicon-32.png' })
await makeIcon({ size: 16, bg: CLEAR, pad: 0.02, round: false, file: 'favicon-16.png' })
