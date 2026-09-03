import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, Icon, ProgressBar, Stat, type IconName } from '@/components/ui'
import { VerificationBadge } from '@/components/trust'
import { DEMO_CLUBS, DEMO_PLAYERS, DEMO_TRIALS, enrichPlayer } from '@/data/mock'
import { computeTrustScore } from '@/lib/ratings'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export default function ClubDashboard() {
  const club = DEMO_CLUBS[0]
  const squad = useMemo(() => DEMO_PLAYERS.slice(0, 8).map(enrichPlayer), [])
  const avgScore = Math.round(squad.reduce((s, p) => s + p.score.current, 0) / squad.length)

  const trust = computeTrustScore({
    emailVerified: true, phoneVerified: true, identityVerified: true, entityVerified: true,
    videoVerified: true, referencesVerified: true, paymentVerified: true, tenureDays: 400, disputesUpheld: 0})

  const squadTrend = [
    { m: 'Apr', v: 62 }, { m: 'May', v: 63 }, { m: 'Jun', v: 64 },
    { m: 'Jul', v: 66 }, { m: 'Aug', v: 68 }, { m: 'Sep', v: avgScore },
  ]

  const avgAge = (squad.reduce((s, p) => s + p.age, 0) / squad.length).toFixed(1)

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" title={club.name}
        subtitle={`${club.league?.toUpperCase()} · ${club.city}, ${club.state}`}
        actions={
          <>
            <VerificationBadge trust={trust} showScore />
            <Link to="/club/squad"><Button variant="outline" icon="users">Manage squad</Button></Link>
            <Link to="/club/discovery"><Button icon="search">Find players</Button></Link>
          </>
        } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Squad size" value={squad.length} icon="users" sub={`${club.players} of 250 seats used`} />
        <Stat label="Average score" value={avgScore} icon="radar" tone="red" trend={4} sub="Up 4 points this season" />
        <Stat label="Average age" value={avgAge} icon="calendar" sub={`${squad.filter(p => p.age < 21).length} under 21`} />
        <Stat label="Active trials" value={DEMO_TRIALS.filter(t => t.status === 'open').length} icon="target" tone="trust" sub="214 applications" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Squad development" subtitle="Average FutWeb Score across your registered players"
            action={<Badge tone="trust" icon="trending">+6 this season</Badge>} />
          <div className="px-2 pb-4 pt-5">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={squadTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#6B7896' }} axisLine={false} tickLine={false} />
                <YAxis domain={[55, 80]} tick={{ fontSize: 11, fill: '#94A0BC' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E4E8F1', fontSize: 12 }} />
                <Line type="monotone" dataKey="v" stroke="#E4002B" strokeWidth={2.5} dot={{ r: 3, fill: '#E4002B' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Squad by position" subtitle="Where your depth sits" />
          <div className="space-y-3 px-5 py-4">
            {[['GK', 1], ['DF', 2], ['MF', 3], ['FW', 2]].map(([pos, n]) => (
              <div key={pos as string} className="flex items-center gap-3">
                <span className="w-7 shrink-0 text-xs font-bold text-ink-700">{pos as string}</span>
                <div className="flex-1"><ProgressBar value={(n as number) * 20} /></div>
                <span className="tnum w-5 shrink-0 text-right text-xs font-bold">{n as number}</span>
              </div>
            ))}
            <div className="mt-4 rounded-xl bg-ink-50 p-3">
              <p className="text-2xs leading-relaxed text-ink-600">
                You are light at goalkeeper. Two verified GKs in your state match your criteria.
              </p>
              <Link to="/club/discovery?pos=GK" className="mt-1.5 inline-block text-2xs font-bold text-red-600 hover:underline">
                View goalkeepers →
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top rated in your squad"
            action={<Link to="/club/squad"><Button size="sm" variant="ghost">All</Button></Link>} />
          <div className="divide-y divide-ink-100">
            {[...squad].sort((a, b) => b.score.current - a.score.current).slice(0, 5).map(p => (
              <Link key={p.id} to={`/club/player/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                  {p.position_primary}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{p.first_name} {p.last_name}</p>
                  <p className="text-2xs text-ink-500">{p.age} yrs · {p.score.ratingTier} · {p.confidence.label} confidence</p>
                </div>
                <div className="text-right">
                  <p className="tnum font-display text-lg text-red-500">{p.score.current}</p>
                  <p className="text-2xs text-ink-400">{p.score.potential} pot</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Across your staff accounts" />
          <div className="divide-y divide-ink-100">
            {[
              { icon: 'list' as IconName, t: 'Ibrahim Yakubu added to GK shortlist', d: '2 hours ago', tone: 'text-blue-500' },
              { icon: 'doc' as IconName, t: 'Scout report filed on Tunde Adeyemi', d: 'Yesterday', tone: 'text-gold-500' },
              { icon: 'target' as IconName, t: 'U23 trial posting went live', d: '5 days ago', tone: 'text-trust-500' },
              { icon: 'offline' as IconName, t: '14 offline ratings synced from Kano', d: '1 week ago', tone: 'text-ink-500' },
            ].map(a => (
              <div key={a.t} className="flex items-center gap-3 px-5 py-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 ${a.tone}`}>
                  <Icon name={a.icon} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{a.t}</p>
                  <p className="text-2xs text-ink-400">{a.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
