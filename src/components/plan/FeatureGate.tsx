import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { hasFeature, upgradeTarget, type EntitlementKey } from '@/lib/entitlements'
import { Card, Icon } from '@/components/ui'

/**
 * FeatureGate — render `children` only when the signed-in account's plan
 * entitles them to `feature`; otherwise render `fallback` (default: a small
 * upgrade card pointing at /billing). This is a UX convenience; RLS remains
 * the real security boundary.
 */
export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: EntitlementKey
  children: ReactNode
  fallback?: ReactNode
}) {
  const { user } = useAuth()
  if (hasFeature(user, feature)) return <>{children}</>
  if (fallback) return <>{fallback}</>
  return <UpgradeCard feature={feature} />
}

/** A compact lock + upgrade prompt shown in place of a gated feature. */
export function UpgradeCard({
  feature,
  title,
  description,
}: {
  feature?: EntitlementKey
  title?: string
  description?: string
}) {
  const target = feature ? upgradeTarget(feature) : 'a paid plan'
  return (
    <Card className="flex flex-col items-start gap-3 border-dashed p-5 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
        <Icon name="lock" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink-900">
          {title ?? `Available on ${target}`}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
          {description ?? `This feature is included with the ${target} plan. Upgrade to unlock it.`}
        </p>
      </div>
      <Link
        to="/billing"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700"
      >
        <Icon name="arrow-right" size={14} /> Upgrade
      </Link>
    </Card>
  )
}
