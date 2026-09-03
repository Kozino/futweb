import { TRUST_TIER_STYLES, type TrustScore } from '@/lib/ratings'
import { Badge, Card, Icon, ProgressBar, Tooltip, type IconName } from '@/components/ui'
import { cn } from '@/lib/utils'

const TIER_ICON: Record<TrustScore['tier'], IconName> = {
  gold: 'shield', entity: 'shield', identity: 'check-circle', unverified: 'alert',
}

/** The verification badge. Shown everywhere a club or agent appears, so a
 *  player can tell, at a glance, whether the person messaging them is real. */
export function VerificationBadge({ trust, size = 'md', showScore = false }:
  { trust: TrustScore; size?: 'sm' | 'md'; showScore?: boolean }) {
  const s = TRUST_TIER_STYLES[trust.tier]
  return (
    <Tooltip content={`${trust.label} — trust score ${trust.score}/100. ${trust.nextStep ?? 'All checks complete.'}`}>
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold ring-1',
        s.bg, s.text, s.ring,
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs')}>
        <Icon name={TIER_ICON[trust.tier]} size={size === 'sm' ? 10 : 12} />
        {trust.label}
        {showScore && <span className="tnum opacity-70">{trust.score}</span>}
      </span>
    </Tooltip>
  )
}

/** Full trust panel — the "why you can trust this account" breakdown. */
export function TrustPanel({ trust, entityName }: { trust: TrustScore; entityName: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 bg-gradient-to-br from-ink-50 to-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">Trust Profile</p>
            <h3 className="mt-1 truncate text-base font-bold text-ink-900">{entityName}</h3>
            <div className="mt-2">
              <VerificationBadge trust={trust} showScore />
            </div>
          </div>
          <div className="text-right">
            <div className={cn('font-display text-4xl leading-none',
              trust.score >= 80 ? 'text-trust-500' : trust.score >= 50 ? 'text-gold-500' : 'text-red-500')}>
              {trust.score}
            </div>
            <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">/ 100</div>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={trust.score} tone={trust.score >= 80 ? 'trust' : trust.score >= 50 ? 'gold' : 'red'} />
        </div>
      </div>

      <div className="divide-y divide-ink-100">
        {trust.checks.map(c => (
          <div key={c.label} className="flex items-center gap-3 px-5 py-2.5">
            <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full',
              c.passed ? 'bg-trust-400 text-white' : 'bg-ink-200 text-ink-400')}>
              {c.passed
                ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6 9 17l-5-5" /></svg>
                : <span className="text-[10px] font-bold">–</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xs font-semibold', c.passed ? 'text-ink-900' : 'text-ink-500')}>{c.label}</p>
              <p className="text-2xs text-ink-400">{c.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {trust.nextStep && (
        <div className="flex items-start gap-2 border-t border-ink-100 bg-ink-50/70 px-5 py-3">
          <Icon name="arrow-right" size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs text-ink-600">{trust.nextStep}</p>
        </div>
      )}
    </Card>
  )
}

/** Hard rule enforced across the product: players are NEVER charged for a
 *  trial. This banner appears on every trial posting that asks for money. */
export function NoFeeGuarantee({ variant = 'default' }: { variant?: 'default' | 'warning' | 'danger' }) {
  const styles = {
    default: { cls: 'bg-trust-50 border-trust-200 text-trust-700', icon: 'shield' as IconName,
      title: 'No-Fee Guarantee',
      body: 'FutWeb clubs may never charge a player for a trial. If anyone asks you for money to attend one, report them.' },
    warning: { cls: 'bg-amber-50 border-amber-200 text-amber-800', icon: 'alert' as IconName,
      title: 'This posting has not been verified',
      body: 'Do not send money or documents. FutWeb has not confirmed this organisation is a registered club or academy.' },
    danger: { cls: 'bg-red-50 border-red-200 text-red-700', icon: 'x-circle' as IconName,
      title: 'Blocked — fee demanded from players',
      body: 'This posting was rejected. Charging players for trials is a violation of FutWeb policy and has been logged.' },
  }[variant]

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-3.5', styles.cls)}>
      <Icon name={styles.icon} size={17} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-bold">{styles.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">{styles.body}</p>
      </div>
    </div>
  )
}

/** Guardian-safety notice shown wherever a minor's data is involved.
 *  Implements FIFA Art.19 spirit + Nigeria Data Protection Act 2023. */
export function MinorProtectionNotice({ guardianName }: { guardianName?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-blue-800">
      <Icon name="shield" size={17} className="mt-0.5 shrink-0" />
      <div className="text-xs">
        <p className="font-bold">Under-18 protected profile</p>
        <p className="mt-0.5 leading-relaxed opacity-90">
          Contact from clubs is copied to {guardianName ?? 'the registered guardian'}.
          No trial or transfer arrangement may be made directly with this player,
          in line with FIFA Article 19 on the protection of minors.
        </p>
      </div>
    </div>
  )
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 82 ? 'trust' : score >= 72 ? 'green' : score >= 60 ? 'gold' : score >= 45 ? 'warn' : 'red'
  return <Badge tone={tone}>{score}</Badge>
}
