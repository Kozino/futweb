import { cn } from '@/lib/utils'

/** FutWeb mark: the football-badge icon, optionally paired with the wordmark lockup. */
export function Logo({ size = 32, className, wordmark = false, tone = 'default' }:
  { size?: number; className?: string; wordmark?: boolean; tone?: 'default' | 'light' }) {
  const img = wordmark ? (
    <img src="/logo-wordmark.png" alt="FutWeb" style={{ height: size }} className="w-auto" />
  ) : (
    <img src="/logo-icon.png" alt="FutWeb" width={size} height={size} className="shrink-0" />
  )

  // The wordmark art uses dark navy/black type, so on dark ("light" tone) backgrounds
  // it needs a light chip behind it to stay legible.
  if (wordmark && tone === 'light') {
    return (
      <span className={cn('inline-flex items-center rounded-lg bg-white px-2 py-1', className)}>
        {img}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center', className)}>
      {img}
    </span>
  )
}
