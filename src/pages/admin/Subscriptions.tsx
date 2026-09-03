import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Stat, toast } from '@/components/ui'
import { PLANS } from '@/lib/constants'
import { formatNGN, relativeTime } from '@/lib/utils'

const SUBS = [
  { id: '1', org: 'Rivers United FC', plan: 'club_pro', status: 'active', mrr: 75000, renews: new Date(Date.now() + 9 * 86400000).toISOString(), seats: '42 / 250' },
  { id: '2', org: 'Enyimba International', plan: 'club_enterprise', status: 'active', mrr: 300000, renews: new Date(Date.now() + 21 * 86400000).toISOString(), seats: '38 / ∞' },
  { id: '3', org: 'Kano Pillars FC', plan: 'club_academy', status: 'active', mrr: 25000, renews: new Date(Date.now() + 3 * 86400000).toISOString(), seats: '31 / 50' },
  { id: '4', org: 'Golden Boot Academy', plan: 'club_academy', status: 'past_due', mrr: 25000, renews: new Date(Date.now() - 2 * 86400000).toISOString(), seats: '64 / 50' },
  { id: '5', org: 'Lagos Talent Hub', plan: 'player_pro', status: 'cancelled', mrr: 0, renews: new Date(Date.now() - 14 * 86400000).toISOString(), seats: '—' },
]

const STATUS_TONE = { active: 'trust', past_due: 'warn', grace: 'gold', cancelled: 'neutral', expired: 'red', trialing: 'blue', paused: 'neutral' } as const

export default function Subscriptions() {
  const mrr = SUBS.reduce((s, x) => s + x.mrr, 0)

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="card" title="Subscriptions"
        subtitle="Billing runs through Flutterwave. Webhook events are idempotent and deduplicated." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={formatNGN(mrr, { compact: true })} icon="card" tone="trust" trend={15} />
        <Stat label="Active subscriptions" value={SUBS.filter(s => s.status === 'active').length} icon="check" />
        <Stat label="Past due" value={SUBS.filter(s => s.status === 'past_due').length} icon="alert" tone="red" />
        <Stat label="Churn (30d)" value="2.1%" icon="trending" tone="trust" />
      </div>

      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Organisation', 'Plan', 'Status', 'MRR', 'Seats used', 'Renews', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {SUBS.map(s => (
              <tr key={s.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-semibold">{s.org}</td>
                <td className="px-4 py-3">
                  <Badge tone="neutral" size="sm">{PLANS.find(p => p.code === s.plan)?.name ?? s.plan}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[s.status as keyof typeof STATUS_TONE]} size="sm">{s.status.replace('_', ' ')}</Badge>
                </td>
                <td className="tnum px-4 py-3 font-bold">{s.mrr ? formatNGN(s.mrr) : '—'}</td>
                <td className="tnum px-4 py-3 text-xs text-ink-600">{s.seats}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{relativeTime(s.renews)}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" onClick={() => toast({ tone: 'info', title: 'Subscription actions', description: 'Refund, pause, change plan or extend grace.' })}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Idempotent webhooks', 'Flutterwave retries are deduplicated by transaction reference, so a dropped response can never double-bill.'],
          ['Grace period', 'Failed payments enter a 7-day grace state before access is restricted. Players and clubs are notified daily.'],
          ['Local payment methods', 'Cards, bank transfer and USSD in naira. USD billing available for clubs abroad.'],
        ].map(([t, d]) => (
          <Card key={t} className="p-4">
            <p className="text-xs font-bold">{t}</p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-600">{d}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
