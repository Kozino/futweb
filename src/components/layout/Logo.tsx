import { cn } from '@/lib/utils'

/** FutWeb mark: a shield (trust) formed from a football pitch arc + ball. */
export function Logo({ size = 32, className, wordmark = false, tone = 'default' }:
  { size?: number; className?: string; wordmark?: boolean; tone?: 'default' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="FutWeb">
        <defs>
          <linearGradient id="fw-logo-grad" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="#FF5A71" />
            <stop offset="100%" stopColor="#C2001F" />
          </linearGradient>
        </defs>
        {/* Shield */}
        <path d="M20 2.5 34.5 7v13.2c0 8.4-6 14.6-14.5 17.3C11.5 34.8 5.5 28.6 5.5 20.2V7L20 2.5Z"
          fill="url(#fw-logo-grad)" />
        {/* Pitch centre circle */}
        <circle cx="20" cy="19" r="9.4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
        {/* Ball — pentagon, evoking a classic Telstar panel */}
        <path d="M20 12.4l3.4 2.5-1.3 4.1h-4.2l-1.3-4.1L20 12.4Z" fill="#fff" />
        <path d="M20 25.6l-3.9 2.9M20 25.6l3.9 2.9M13.5 17.6l-3.2 2.3M26.5 17.6l3.2 2.3"
          stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {wordmark && (
        <span className={cn('font-display text-xl tracking-wide', tone === 'light' ? 'text-white' : 'text-ink-900')}>
          FUT<span className="text-red-500">WEB</span>
        </span>
      )}
    </span>
  )
}
