import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon, type IconName } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { PLANS } from '@/lib/constants'
import { cn, formatDate, formatNGN } from '@/lib/utils'

import { hasSupabase } from '@/lib/supabase'

export function Paywall({ reason = 'subscription' }: { reason?: 'subscription' | 'expired' | 'trial_ended' }) {
  const { user, updateUser } = useAuth()
  const audience = user?.accountType === 'club' ? 'club' : 'player'
  const plans = PLANS.filter(p => p.price_ngn > 0 && (p.audience === audience || p.audience === 'both'))

  const copy = {
    subscription: { title: 'Choose a plan to continue', body: 'Your trial is running. Pick a plan now to keep uninterrupted access when it ends.' },
    expired: { title: 'Your subscription has ended', body: 'Renew to restore full access to your dashboard, squad and scouting tools.' },
    trial_ended: { title: 'Your 14-day trial has ended', body: 'Everything you created is safe. Subscribe to pick up exactly where you left off.' },
  }[reason]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="text-center">
        <Badge tone="red" icon="lock">{audience === 'club' ? 'Club workspace locked' : 'Player workspace locked'}</Badge>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.title}</h1>
        <p className="mx-auto mt-2.5 max-w-lg text-ink-600">{copy.body}</p>
        {user?.trialEndsAt && reason !== 'expired' && (
          <p className="mt-2 text-sm font-semibold text-ink-500">
            Trial ends {formatDate(user.trialEndsAt)}
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map(p => (
          <Card key={p.id} hover className={cn('flex flex-col p-5', p.featured && 'ring-2 ring-red-500')}>
            {p.featured && <div className="mb-2"><Badge tone="red" size="sm">Most popular</Badge></div>}
            <h3 className="text-base font-bold">{p.name}</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-3xl">{formatNGN(p.price_ngn)}</span>
              <span className="text-xs text-ink-500">/month</span>
            </div>
            <ul className="mt-4 flex-1 space-y-2">
              {p.features.slice(0, 5).map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-ink-700">
                  <Icon name="check" size={13} className="mt-0.5 shrink-0 text-trust-500" />{f}
                </li>
              ))}
            </ul>
            <Link to={`/checkout?plan=${p.code}`} className="mt-5 block">
              <Button fullWidth variant={p.featured ? 'primary' : 'outline'} iconRight="arrow-right">
                Subscribe
              </Button>
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {([
          ['card', 'Pay your way', 'Flutterwave — card, bank transfer or USSD. Naira or USD.'],
          ['shield', 'Never billed twice', 'Payments are idempotent. Replayed webhooks are deduplicated.'],
          ['x-circle', 'Cancel in one click', 'No calls, no retention maze. Access runs to period end.'],
        ] as [IconName, string, string][]).map(([icon, t, d]) => (
          <div key={t} className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
            <Icon name={icon} size={16} className="text-red-500" />
            <p className="mt-2 text-xs font-bold">{t}</p>
            <p className="mt-0.5 text-2xs text-ink-500">{d}</p>
          </div>
        ))}
      </div>

      {!hasSupabase && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 p-4 text-center">
          <p className="text-xs text-ink-600">
            Demo mode — subscribe instantly to see the full workspace.
          </p>
          <Button className="mx-auto mt-3" size="sm" variant="dark"
            onClick={() => updateUser({ subStatus: 'active' })}>
            Activate demo subscription
          </Button>
        </div>
      )}
    </div>
  )
}

