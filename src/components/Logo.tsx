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

export default function Logo({
  className = '',
  markSize = 40,
  showWordmark = true,
  variant = 'dark',
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} />
      {showWordmark && (
        <span className="flex items-baseline text-[1.4rem] font-extrabold lowercase leading-none tracking-tight">
          <span className={variant === 'dark' ? 'text-navy-800' : 'text-white'}>day</span>
          <span className="text-teal-500">wise</span>
        </span>
      )}
    </span>
  )
}
