import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Skeleton, Tabs, Toggle, toast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { ANNUAL_DISCOUNT_MONTHS, PLANS, annualPrice } from '@/lib/constants'
import { cn, formatDate, formatNGN } from '@/lib/utils'
import { hasSupabase, supabase } from '@/lib/supabase'
import { getMyPayments, getMySubscription, type PaymentRow } from '@/lib/supabase/billing'

const CHANNEL_LABEL: Record<string, string> = {
  card: 'Card',
  banktransfer: 'Bank transfer',
  ussd: 'USSD',
  account: 'Account transfer',
  mobilemoney: 'Mobile money',
  payattitude: 'PayAttitude',
  unknown: '—',
}

function channelLabel(channel: string | null): string {
  if (!channel) return '—'
  return CHANNEL_LABEL[channel.toLowerCase()] ?? channel
}

export default function Billing() {
  const { user, updateUser, refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const planParam = params.get('plan')
  const [tab, setTab] = useState<'plans' | 'history' | 'settings'>('plans')
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  // Real payment history state
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const audience = user?.accountType === 'club' ? 'club' : 'player'
  const plans = PLANS.filter(p => (p.audience === audience || p.audience === 'both') && p.price_ngn > 0)

  function planName(code: string | null) {
    if (!code) return '—'
    return PLANS.find(p => p.code === code)?.name ?? code
  }

  // On mount (and when we come back from a checkout redirect) re-sync the real
  // subscription status from the DB and load real payment history.
  useEffect(() => {
    const txRef = params.get('tx_ref')
    const status = params.get('status')
    if (status === 'successful' && txRef) {
      toast({ tone: 'success', title: 'Payment received', description: 'Confirming your subscription…' })
      // Clean the query string so a refresh doesn't re-toast.
      const next = new URLSearchParams(params)
      next.delete('status'); next.delete('tx_ref')
      setParams(next, { replace: true })
    }
    void syncFromBackend()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncFromBackend() {
    if (!hasSupabase || !supabase || !user?.id) return
    setHistoryLoading(true)
    try {
      // Re-fetch profile so sub_status/plan reflect a just-settled webhook.
      await refreshProfile()
      const [pays, sub] = await Promise.all([
        getMyPayments(user.id),
        getMySubscription(user.id),
      ])
      setPayments(pays)
      // Keep local state consistent with the server subscription if present.
      if (sub) {
        const pl = PLANS.find(p => p.code === sub.plan_code)
        updateUser({
          subStatus: sub.status as never,
          planCode: sub.plan_code,
        })
        if (pl) updateUser({ planCode: pl.code })
      }
    } catch (err) {
      toast({ tone: 'error', title: 'Could not load billing data', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setHistoryLoading(false)
    }
  }

  async function subscribe(planCode: string) {
    setLoading(planCode)
    try {
      // Demo mode: simulate the round-trip locally.
      if (!hasSupabase || !supabase) {
        await new Promise(r => setTimeout(r, 900))
        updateUser({ subStatus: 'active', planCode })
        setLoading(null)
        toast({ tone: 'success', title: 'Subscription active', description: 'You now have full access.' })
        return
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan_code: planCode,
          interval: annual ? 'annual' : 'monthly',
          currency: 'NGN',
        },
      })

      if (error) {
        throw new Error(error.message || 'Could not start checkout.')
      }

      const paymentLink: string | undefined =
        (data as { payment_link?: string })?.payment_link

      if (!paymentLink) {
        const msg =
          (data as { error?: string })?.error ??
          'This plan is free — no checkout required.'
        if (msg.toLowerCase().includes('free')) {
          updateUser({ subStatus: 'active', planCode })
          toast({ tone: 'success', title: 'Plan activated', description: msg })
        } else {
          toast({ tone: 'error', title: 'Checkout failed', description: msg })
        }
        setLoading(null)
        return
      }

      // Redirect to Flutterwave's hosted checkout (card / transfer / USSD).
      window.location.href = paymentLink
    } catch (err) {
      setLoading(null)
      toast({
        tone: 'error',
        title: 'Could not start checkout',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  const isActive = user?.subStatus === 'active'

  return (
    <div>
      <PageHeader breadcrumb="Account" icon="card" title="Billing & subscription"
        subtitle="Pay in naira via Flutterwave — card, bank transfer or USSD."
        actions={
          <div className="flex items-center gap-2">
            {isActive && <Button size="sm" variant="ghost" icon="refresh" onClick={() => void syncFromBackend()} />}
            <Badge tone={isActive ? 'trust' : 'gold'}>
              {isActive ? 'Active' : `Trial · ${user?.trialEndsAt ? Math.max(0, Math.ceil((+new Date(user.trialEndsAt) - Date.now()) / 86400000)) : 0} days left`}
            </Badge>
          </div>
        } />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'plans', label: 'Plans', icon: 'card' },
        { value: 'history', label: 'Payment history', icon: 'doc' },
        { value: 'settings', label: 'Settings', icon: 'settings' },
      ]} />

      {tab === 'plans' && (
        <div className="mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Toggle checked={annual} onChange={setAnnual} label={`Annual billing — save ${ANNUAL_DISCOUNT_MONTHS} months (17%)`} />
            {user?.planCode && isActive && <span className="text-xs text-ink-500">
              Current plan: <strong className="font-bold">{planName(user.planCode)}</strong>
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
                    disabled={isCurrent && isActive}
                    variant={p.featured || planParam === p.code ? 'primary' : 'outline'}
                    onClick={() => subscribe(p.code)}>
                    {isCurrent && isActive ? 'Current plan' : 'Subscribe'}
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
          {!hasSupabase ? (
            <div className="p-8"><EmptyState icon="doc" title="Payment history unavailable in demo mode"
              description="Connect the app to Supabase to see your real payment history." /></div>
          ) : historyLoading ? (
            <div className="p-6"><Skeleton className="h-32 w-full" /></div>
          ) : payments.length === 0 ? (
            <div className="p-8"><EmptyState icon="doc" title="No payments yet"
              description="When you complete a checkout, your payments and subscription status will appear here." /></div>
          ) : (
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  {['Date', 'Plan', 'Reference', 'Method', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 text-xs text-ink-600">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-ink-800">{planName(p.plan_code)}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{p.tx_ref}</td>
                    <td className="px-4 py-3 text-xs text-ink-600">{channelLabel(p.channel)}</td>
                    <td className="tnum px-4 py-3 text-xs font-bold text-ink-900">{formatNGN(p.amount)} {p.currency}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.status === 'successful' ? 'trust' : p.status === 'pending' ? 'gold' : 'red'} size="sm">
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'settings' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-bold">Billing contact</h3>
            <p className="mt-1 text-xs text-ink-500">Receipts and renewal notices go here.</p>
            <div className="mt-4 space-y-3">
              <input className="fw-input" defaultValue={user?.email} />
            </div>
            <Button className="mt-4" size="sm">Save</Button>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold">Subscription controls</h3>
            <p className="mt-1 text-xs text-ink-500">
              {isActive
                ? `Your ${planName(user?.planCode ?? null)} plan is active.`
                : 'You are not on a paid plan yet.'}
            </p>
            <div className="mt-4 space-y-2.5">
              <Button variant="outline" fullWidth onClick={() => setTab('plans')}>Change plan</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
