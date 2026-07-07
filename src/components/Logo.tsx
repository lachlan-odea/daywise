interface LogoProps {
  className?: string
  markSize?: number
  showWordmark?: boolean
  variant?: 'dark' | 'light'
}

/** The daywise book-and-calendar mark (brand artwork). */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand-mark.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="shrink-0 object-contain"
    />
  )
}

/** The daywise wordmark image. Uses the white variant on dark backgrounds. */
export function Wordmark({ height = 22, variant = 'dark' }: { height?: number; variant?: 'dark' | 'light' }) {
  const file = variant === 'light' ? 'brand-wordmark-white.png' : 'brand-wordmark.png'
  return (
    <img
      src={`${import.meta.env.BASE_URL}${file}`}
      alt="daywise"
      style={{ height }}
      className="w-auto object-contain"
    />
  )
}

export default function Logo({
  className = '',
  markSize = 40,
  showWordmark = true,
  variant = 'dark',
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={markSize} />
      {showWordmark && <Wordmark height={Math.round(markSize * 0.5)} variant={variant} />}
    </span>
  )
}
