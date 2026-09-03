import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, Select, Stat, toast } from '@/components/ui'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { per90 } from '@/lib/ratings'
import { useOffline } from '@/context/OfflineContext'

export default function PlayerStats() {
  const me = useMemo(() => enrichPlayer(DEMO_PLAYERS[0]), [])
  const [season, setSeason] = useState('2024/25')
  const { enqueue, online } = useOffline()
  const p90 = per90(me.matchStats)

  const timeline = me.ratingSnapshots.map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString('en-NG', { month: 'short' }),
    score: s.futweb_score,
    confidence: s.confidence}))

  const radar = [
    { m: 'Goals', v: p90.goals }, { m: 'Assists', v: p90.assists },
    { m: 'Shots', v: p90.shots }, { m: 'Tackles', v: p90.tackles },
    { m: 'Interc.', v: p90.interceptions },
  ]

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="chart" title="Performance"
        subtitle="Match statistics and your development over time."
        actions={
          <>
            <Select className="w-36" value={season} onChange={e => setSeason(e.target.value)}
              options={[{ value: '2024/25', label: '2024/25' }, { value: '2023/24', label: '2023/24' }]} />
            <Button variant="outline" icon="plus" onClick={async () => {
              await enqueue('rating', { player_id: me.id, kind: 'match_stats', season })
              toast({ tone: online ? 'success' : 'info', title: online ? 'Match logged' : 'Saved offline' })
            }}>
              Log a match
            </Button>
          </>
        } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Appearances" value={me.matchStats.appearances} icon="calendar" sub={`${me.matchStats.minutes} minutes`} />
        <Stat label="Goals" value={me.matchStats.goals} icon="target" tone="red" sub={`${p90.goals} per 90`} />
        <Stat label="Assists" value={me.matchStats.assists} icon="share" sub={`${p90.assists} per 90`} />
        <Stat label="Pass accuracy" value={`${p90.passAccuracy}%`} icon="trending" tone="trust" sub={`${me.matchStats.pass_attempts} attempts`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Per-90 output" subtitle="Normalised so substitute appearances compare fairly" />
          <div className="px-2 pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={radar}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#6B7896' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A0BC' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(228,0,43,0.05)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E4E8F1', fontSize: 12 }} />
                <Bar dataKey="v" fill="#E4002B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Development timeline" subtitle="FutWeb Score across every rating on file" />
          <div className="px-2 pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E8F1" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7896' }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, 90]} tick={{ fontSize: 11, fill: '#94A0BC' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E4E8F1', fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#E4002B" strokeWidth={2.5}
                  dot={{ r: 3, fill: '#E4002B' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="confidence" stroke="#94A0BC" strokeWidth={1.5}
                  strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Full statistics" subtitle={`${season} · ${me.clubName}`}
          action={<Badge tone={me.visibility === 'public' ? 'trust' : 'neutral'}>
            {me.career[0]?.verified ? 'Federation verified' : 'Self-reported'}
          </Badge>} />
        <div className="grid gap-x-8 gap-y-0 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Appearances', me.matchStats.appearances], ['Minutes played', me.matchStats.minutes],
            ['Goals', me.matchStats.goals], ['Assists', me.matchStats.assists],
            ['Shots', me.matchStats.shots], ['Shots on target', me.matchStats.shots_on_target],
            ['Conversion rate', `${p90.conversion}%`], ['Minutes per goal', p90.minutesPerGoal ?? '—'],
            ['Pass accuracy', `${p90.passAccuracy}%`], ['Duels won', `${p90.duelSuccess}%`],
            ['Tackles', me.matchStats.tackles], ['Interceptions', me.matchStats.interceptions],
            ['Fouls committed', me.matchStats.fouls_committed],
            ['Yellow cards', me.matchStats.yellow_cards], ['Red cards', me.matchStats.red_cards],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between border-b border-ink-100 py-2.5 last:border-0">
              <span className="text-xs text-ink-600">{l as string}</span>
              <span className="tnum text-sm font-bold">{v as number}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
