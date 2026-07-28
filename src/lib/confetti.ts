/**
 * A subtle one-shot confetti burst on a throwaway full-screen canvas.
 * Self-contained (no library), respects reduced-motion, and cleans itself up.
 */
const COLORS = ['#14b8a6', '#2fba93', '#5dd2b1', '#3654a8', '#f59e0b', '#fbbf24']

export function burstConfetti() {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '70',
  } as CSSStyleDeclaration)
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }
  ctx.scale(dpr, dpr)

  // Origin near the toast (bottom-right); particles fan up and out, then fall.
  const ox = w - 120
  const oy = h - 120
  const N = 70
  const particles = Array.from({ length: N }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2 // mostly upward, spread left/up
    const speed = 4 + Math.random() * 7
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed - 1.5,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[i % COLORS.length],
      life: 1,
    }
  })

  const gravity = 0.22
  const drag = 0.99
  let raf = 0
  const start = performance.now()

  const frame = (t: number) => {
    const elapsed = t - start
    ctx.clearRect(0, 0, w, h)
    let alive = false
    for (const p of particles) {
      p.vx *= drag
      p.vy = p.vy * drag + gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      p.life = Math.max(0, 1 - elapsed / 1500)
      if (p.life > 0 && p.y < h + 20) {
        alive = true
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
    }
    if (alive) {
      raf = requestAnimationFrame(frame)
    } else {
      cancelAnimationFrame(raf)
      canvas.remove()
    }
  }
  raf = requestAnimationFrame(frame)
}
