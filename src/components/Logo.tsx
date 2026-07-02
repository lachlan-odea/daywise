interface LogoProps {
  className?: string
  markSize?: number
  showWordmark?: boolean
  variant?: 'dark' | 'light'
}

/**
 * Project Daybook logo mark: an open book with a checklist on the left page,
 * a completed checkmark on the right, and a sparkle above — echoing the
 * supplied brand artwork. Pairs with the "Project Daybook" wordmark.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* back page shadows */}
      <path d="M32 20C26 16 18 15.5 12 17V47C18 45.5 26 46 32 50V20Z" fill="#8ecdff" />
      <path d="M32 20C38 16 46 15.5 52 17V47C46 45.5 38 46 32 50V20Z" fill="#96e5cd" />
      {/* left page */}
      <path d="M32 20C27 17 21 16.5 16 17.5V46C21 45 27 45.5 32 48.5V20Z" fill="#20336c" />
      {/* right page */}
      <path d="M32 20C37 17 43 16.5 48 17.5V46C43 45 37 45.5 32 48.5V20Z" fill="#17a085" />
      {/* checklist */}
      <circle cx="22.5" cy="26" r="1.7" fill="#5dd2b1" />
      <circle cx="22.5" cy="31.5" r="1.7" fill="#59b0fb" />
      <circle cx="22.5" cy="37" r="1.7" fill="#3491f0" />
      <rect x="25.5" y="25" width="4.5" height="2" rx="1" fill="#ffffff" />
      <rect x="25.5" y="30.5" width="4.5" height="2" rx="1" fill="#ffffff" />
      <rect x="25.5" y="36" width="4.5" height="2" rx="1" fill="#ffffff" />
      {/* checkmark */}
      <path
        d="M35 29.5l2.4 2.4 4.6-4.8"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="35" y="35" width="7" height="2" rx="1" fill="#ffffff" />
      {/* sparkles */}
      <path d="M32 6l1.1 2.7 2.7 1.1-2.7 1.1L32 13.6l-1.1-2.7-2.7-1.1 2.7-1.1L32 6z" fill="#2fba93" />
      <path d="M24 10l.7 1.7 1.7.7-1.7.7L24 14.8l-.7-1.7-1.7-.7 1.7-.7L24 10z" fill="#20336c" />
      <path d="M40 10l.7 1.7 1.7.7-1.7.7L40 14.8l-.7-1.7-1.7-.7 1.7-.7L40 10z" fill="#3491f0" />
    </svg>
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
        <span className="flex items-baseline text-[1.35rem] font-extrabold leading-none tracking-tight">
          <span className={variant === 'dark' ? 'text-navy-800' : 'text-white'}>Project</span>
          <span className="ml-1.5 text-teal-500">Daybook</span>
        </span>
      )}
    </span>
  )
}
