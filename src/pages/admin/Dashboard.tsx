import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, Icon, ProgressBar, Stat } from '@/components/ui'
import { Link } from 'react-router-dom'
import { DEMO_CLUBS} from '@/data/mock'
import { formatNGN} from '@/lib/utils'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from 'recharts'

const MRR_TREND = [
  { m: 'Apr', v: 1240000 }, { m: 'May', v: 1490000 }, { m: 'Jun', v: 1680000 },
  { m: 'Jul', v: 2010000 }, { m: 'Aug', v: 2380000 }, { m: 'Sep', v: 2740000 },
]
const SIGNUPS = [
  { m: 'Apr', clubs: 12, players: 184 }, { m: 'May', clubs: 18, players: 262 },
  { m: 'Jun', clubs: 24, players: 341 }, { m: 'Jul', clubs: 31, players: 498 },
  { m: 'Aug', clubs: 44, players: 672 }, { m: 'Sep', clubs: 52, players: 815 },
]

export default function AdminDashboard() {
  const pendingVerification = DEMO_CLUBS.filter(c => c.verification_status === 'pending').length

  return (
    <div>
      <PageHeader breadcrumb="Admin console" title="Platform overview"
        subtitle="Everything happening across FutWeb, in real time."
        actions={
          <>
            <Link to="/admin/verification"><Button variant="outline" icon="shield">
              Verification queue
              {pendingVerification > 0 && <Badge tone="red" size="sm" className="ml-1.5">{pendingVerification}</Badge>}
            </Button></Link>
            <Link to="/admin/audit"><Button icon="doc">Audit log</Button></Link>
          </>
        } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={formatNGN(2740000, { compact: true })} icon="card" tone="trust" trend={15} sub="274 paid subscriptions" />
        <Stat label="Registered clubs" value={52} icon="building" trend={18} sub={`${DEMO_CLUBS.length} awaiting review`} />
        <Stat label="Registered players" value="4,182" icon="users" trend={21} sub="68% completed their CV" />
        <Stat label="Open disputes" value={3} icon="alert" tone="red" sub="1 escalated to NFF" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recurring revenue" subtitle="Last six months, naira" />
          <div className="px-2 pb-4 pt-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={MRR_TREND}>
                <defs>
                  <linearGradient id="mrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00B67A" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#00B67A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#6B7896' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A0BC' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₦${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E4E8F1', fontSize: 12 }}
                  formatter={(v: number) => formatNGN(v)} />
                <Area type="monotone" dataKey="v" stroke="#00B67A" strokeWidth={2.5} fill="url(#mrr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Signups" subtitle="Clubs vs players" />
          <div className="px-2 pb-4 pt-5">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={SIGNUPS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#6B7896' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A0BC' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E4E8F1', fontSize: 12 }} />
                <Line type="monotone" dataKey="players" stroke="#E4002B" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="clubs" stroke="#0A0F1C" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Verification queue" action={<Badge tone="red" size="sm">{DEMO_CLUBS.length} pending</Badge>} />
          <div className="divide-y divide-ink-100">
            {DEMO_CLUBS.slice(0, 4).map(c => (
              <Link key={c.id} to="/admin/verification" className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                  {c.short_name}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{c.name}</p>
                  <p className="text-2xs text-ink-500">{c.state} · trust {c.trust}</p>
                </div>
                <Badge tone={c.verification_status === 'verified' ? 'trust' : c.verification_status === 'pending' ? 'gold' : 'neutral'} size="sm">
                  {c.verification_status}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Health checks" />
          <div className="space-y-3 px-5 py-4">
            {[
              { l: 'Verified clubs', v: 78, tone: 'trust' as const },
              { l: 'Players with video', v: 64, tone: 'gold' as const },
              { l: 'High-confidence ratings', v: 41, tone: 'red' as const },
              { l: 'Guardian consent (U18)', v: 96, tone: 'trust' as const },
            ].map(x => (
              <div key={x.l}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-ink-600">{x.l}</span>
                  <span className="tnum text-xs font-bold">{x.v}%</span>
                </div>
                <ProgressBar value={x.v} tone={x.tone} size="sm" />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent audit events" />
          <div className="divide-y divide-ink-100">
            {[
              { a: 'club.verification.approved', who: 'admin@futweb.app', when: '4 min ago' },
              { a: 'dispute.opened', who: 'system', when: '22 min ago' },
              { a: 'subscription.created', who: 'billing', when: '1 hour ago' },
              { a: 'scout_report.created', who: 'scout.m@riversunited.ng', when: '2 hours ago' },
            ].map(e => (
              <div key={e.a} className="flex items-center gap-2.5 px-5 py-2.5">
                <Icon name="doc" size={13} className="shrink-0 text-ink-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-2xs font-semibold text-ink-800">{e.a}</p>
                  <p className="truncate text-2xs text-ink-400">{e.who} · {e.when}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
