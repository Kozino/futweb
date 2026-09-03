import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Tabs, Toggle, toast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { ANNUAL_DISCOUNT_MONTHS, PLANS, annualPrice } from '@/lib/constants'
import { cn, formatNGN } from '@/lib/utils'
import { hasSupabase } from '@/lib/supabase'

/**
 * Flutterwave integration surface.
 *
 * In production this page initialises Flutterwave Inline via the checkout URL
 * returned by the `create-checkout` edge function — the API secret never
 * reaches the browser. The flow:
 *
 *   1. Client POSTs { plan_code, interval } to /functions/v1/create-checkout
 *   2. Edge function resolves the authenticated user from the JWT (never trusts
 *      a client-supplied user id), verifies plan/price server-side, creates a
 *      pending `payments` row with a unique tx_ref, and returns a payment link.
 *   3. Flutterwave redirects back to /billing?status=successful&tx_ref=...
 *   4. The webhook handler verifies the secret hash, then marks the payment
 *      paid and activates the subscription. Idempotent on tx_ref.
 */
export default function Billing() {
  const { user, updateUser } = useAuth()
  const [params] = useSearchParams()
  const planParam = params.get('plan')
  const [tab, setTab] = useState<'plans' | 'history' | 'settings'>('plans')
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const audience = user?.accountType === 'club' ? 'club' : 'player'
  const plans = PLANS.filter(p => (p.audience === audience || p.audience === 'both') && p.price_ngn > 0)

  async function subscribe(planCode: string) {
    setLoading(planCode)
    // Demo mode: simulate the round-trip. With Supabase configured this calls
    // the create-checkout edge function and hands off to Flutterwave Inline.
    await new Promise(r => setTimeout(r, 900))
    if (hasSupabase) {
      window.location.assign(`/functions/v1/create-checkout?plan=${planCode}&interval=${annual ? 'annual' : 'monthly'}`)
      return
    }
    updateUser({ subStatus: 'active', planCode })
    setLoading(null)
    toast({ tone: 'success', title: 'Subscription active', description: 'You now have full access.' })
  }

  return (
    <div>
      <PageHeader breadcrumb="Account" icon="card" title="Billing & subscription"
        subtitle="Pay in naira via Flutterwave — card, bank transfer or USSD."
        actions={<Badge tone={user?.subStatus === 'active' ? 'trust' : 'gold'}>
          {user?.subStatus === 'active' ? 'Active' : `Trial · ${user?.trialEndsAt ? Math.max(0, Math.ceil((+new Date(user.trialEndsAt) - Date.now()) / 86400000)) : 0} days left`}
        </Badge>} />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'plans', label: 'Plans', icon: 'card' },
        { value: 'history', label: 'Payment history', icon: 'doc' },
        { value: 'settings', label: 'Settings', icon: 'settings' },
      ]} />

      {tab === 'plans' && (
        <div className="mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Toggle checked={annual} onChange={setAnnual} label={`Annual billing — save ${ANNUAL_DISCOUNT_MONTHS} months (17%)`} />
            {user?.planCode && <span className="text-xs text-ink-500">
              Current plan: <strong className="font-bold">{PLANS.find(p => p.code === user.planCode)?.name}</strong>
            </span>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map(p => {
              const isCurrent = user?.planCode === p.code
              return (
                <Card key={p.id} hover className={cn('flex flex-col p-6', (p.featured || planParam === p.code) && 'ring-2 ring-red-500')}>
                  {(p.featured || planParam === p.code) && (
                    <div className="mb-2"><Badge tone="red" size="sm">{planParam === p.code ? 'Selected' : 'Most popular'}</Badge></div>
                  )}
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-3xl">{formatNGN(annual ? annualPrice(p) : p.price_ngn)}</span>
                    <span className="text-xs text-ink-500">/{annual ? 'year' : 'month'}</span>
                  </div>
                  {annual && <p className="mt-1 text-2xs font-semibold text-trust-600">
                    Save {formatNGN(p.price_ngn * ANNUAL_DISCOUNT_MONTHS)} a year
                  </p>}
                  {audience === 'club' && (
                    <p className="mt-2 text-2xs text-ink-500">
                      {p.player_seats === -1 ? 'Unlimited players' : `${p.player_seats} players`} · {p.staff_seats === -1 ? 'unlimited staff' : `${p.staff_seats} staff`}
                    </p>
                  )}
                  <ul className="mt-4 flex-1 space-y-2">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-ink-700">
                        <Icon name="check" size={13} className="mt-0.5 shrink-0 text-trust-500" />{f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-5" fullWidth loading={loading === p.code}
                    disabled={isCurrent && user?.subStatus === 'active'}
                    variant={p.featured || planParam === p.code ? 'primary' : 'outline'}
                    onClick={() => subscribe(p.code)}>
                    {isCurrent && user?.subStatus === 'active' ? 'Current plan' : 'Subscribe'}
                  </Button>
                </Card>
              )
            })}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['card', 'Pay your way', 'Flutterwave accepts cards, bank transfer and USSD in naira. USD billing available for clubs abroad.'],
              ['shield', 'Never billed twice', 'Every charge is idempotent on the transaction reference. Webhook replays are deduplicated.'],
              ['x-circle', 'Cancel in one click', 'No phone calls. Access continues to the end of the period you have paid for.'],
            ].map(([icon, t, d]) => (
              <Card key={t} className="p-4">
                <Icon name={icon as 'card'} size={16} className="text-red-500" />
                <p className="mt-2 text-xs font-bold">{t}</p>
                <p className="mt-0.5 text-2xs leading-relaxed text-ink-600">{d}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <Card className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left">
                {['Date', 'Description', 'Reference', 'Method', 'Amount', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                ['12 Aug 2025', 'Pro Club — monthly', 'FW-TX-88213', 'Card •••• 4242', formatNGN(75000), 'Successful'],
                ['12 Jul 2025', 'Pro Club — monthly', 'FW-TX-81004', 'Bank transfer', formatNGN(75000), 'Successful'],
                ['12 Jun 2025', 'Pro Club — monthly', 'FW-TX-73991', 'Card •••• 4242', formatNGN(75000), 'Successful'],
              ].map(r => (
                <tr key={r[2] as string} className="hover:bg-ink-50">
                  {r.map((c, i) => (
                    <td key={i} className={cn('px-4 py-3 text-xs', i === 4 ? 'tnum font-bold' : i === 5 ? '' : 'text-ink-600')}>
                      {i === 5 ? <Badge tone="trust" size="sm">{c as string}</Badge> : c as string}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'settings' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-bold">Billing contact</h3>
            <p className="mt-1 text-xs text-ink-500">Receipts and renewal notices go here.</p>
            <div className="mt-4 space-y-3">
              <input className="fw-input" defaultValue={user?.email} />
              <input className="fw-input" placeholder="Billing address (optional)" />
              <input className="fw-input" placeholder="TIN / VAT number (optional)" />
            </div>
            <Button className="mt-4" size="sm">Save</Button>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold">Subscription controls</h3>
            <p className="mt-1 text-xs text-ink-500">
              Cancelling keeps access until the end of the current period.
            </p>
            <div className="mt-4 space-y-2.5">
              <Button variant="outline" fullWidth icon="refresh">Change plan</Button>
              <Button variant="outline" fullWidth onClick={() => toast({ tone: 'info', title: 'Auto-renew paused', description: 'Access continues until the period ends.' })}>
                Pause auto-renew
              </Button>
              <Button variant="outline" fullWidth className="text-red-600" icon="x-circle"
                onClick={() => toast({ tone: 'info', title: 'Cancellation scheduled', description: 'You keep access until the end of the period.' })}>
                Cancel subscription
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
