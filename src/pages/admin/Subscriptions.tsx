import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Skeleton, Stat, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatNGN, relativeTime } from '@/lib/utils'

interface SubRow {
  id: string; subscriber: string; plan_code: string
  status: 'trialing' | 'active' | 'past_due' | 'grace' | 'cancelled' | 'expired' | 'paused'
  current_period_end: string | null; trial_ends_at: string | null; seats_used: number
  orgName?: string; planName?: string; priceNgn?: number
}

const STATUS_TONE = {
  active: 'trust', past_due: 'warn', grace: 'gold', cancelled: 'neutral',
  expired: 'red', trialing: 'blue', paused: 'neutral',
} as const

export default function Subscriptions() {
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState<SubRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: rows, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false })
      if (error) { toast({ tone: 'error', title: 'Could not load subscriptions', description: error.message }); setLoading(false); return }
      const list = rows ?? []
      const subscriberIds = [...new Set(list.map(s => s.subscriber))]
      const planCodes = [...new Set(list.map(s => s.plan_code))]
      const [profilesRes, plansRes] = await Promise.all([
        subscriberIds.length ? supabase.from('profiles').select('id, full_name, club_name').in('id', subscriberIds) : Promise.resolve({ data: [] as { id: string; full_name: string; club_name: string | null }[] }),
        planCodes.length ? supabase.from('plans').select('code, name, price_ngn').in('code', planCodes) : Promise.resolve({ data: [] as { code: string; name: string; price_ngn: number }[] }),
      ])
      const orgById = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.club_name || p.full_name]))
      const planByCode = Object.fromEntries((plansRes.data ?? []).map(p => [p.code, p]))
      if (!cancelled) {
        setSubs(list.map(s => ({
          ...s,
          orgName: orgById[s.subscriber] ?? 'Unknown account',
          planName: planByCode[s.plan_code]?.name ?? s.plan_code,
          priceNgn: planByCode[s.plan_code]?.price_ngn ?? 0,
        })))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mrr = useMemo(() => subs
    .filter(s => s.status === 'active' || s.status === 'trialing')
    .reduce((sum, s) => sum + (s.priceNgn ?? 0), 0), [subs])

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="card" title="Subscriptions"
        subtitle="Billing runs through Flutterwave. Webhook events are idempotent and deduplicated." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={formatNGN(mrr, { compact: true })} icon="card" tone="trust" />
        <Stat label="Active subscriptions" value={subs.filter(s => s.status === 'active').length} icon="check" />
        <Stat label="Past due" value={subs.filter(s => s.status === 'past_due').length} icon="alert" tone="red" />
        <Stat label="Grace period" value={subs.filter(s => s.status === 'grace').length} icon="alert" tone="gold" />
      </div>

      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Account', 'Plan', 'Status', 'MRR', 'Seats used', 'Renews', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {subs.map(s => (
              <tr key={s.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-semibold">{s.orgName}</td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{s.planName}</Badge></td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.status]} size="sm">{s.status.replace('_', ' ')}</Badge></td>
                <td className="tnum px-4 py-3 font-bold">
                  {(s.status === 'active' || s.status === 'trialing') && s.priceNgn ? formatNGN(s.priceNgn) : '—'}
                </td>
                <td className="tnum px-4 py-3 text-xs text-ink-600">{s.seats_used}</td>
                <td className="px-4 py-3 text-xs text-ink-500">
                  {relativeTime(s.status === 'trialing' ? (s.trial_ends_at ?? s.current_period_end ?? '') : (s.current_period_end ?? ''))}
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost"
                    onClick={() => toast({ tone: 'info', title: 'Subscription actions', description: 'Refund, pause, change plan or extend grace — wire to your Flutterwave endpoints.' })}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
