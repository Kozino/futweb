import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, EmptyState, Icon, ProgressBar, Skeleton, Stat } from '@/components/ui'
import { useClub } from '@/context/ClubContext'
import { hasSupabase } from '@/lib/supabase'
import { getClubSquad, type EnrichedPlayer } from '@/lib/supabase/workspace'
import { getClubTrialsWithClubs } from '@/lib/supabase/recruitment'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

function posGroup(p: string): string {
  if (['GK'].includes(p)) return 'GK'
  if (['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(p)) return 'DF'
  if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(p)) return 'MF'
  return 'FW'
}

export default function ClubDashboard() {
  const { club } = useClub()
  const [squad, setSquad] = useState<EnrichedPlayer[]>([])
  const [openTrials, setOpenTrials] = useState(0)
  const [loading, setLoading] = useState(true)

  const clubId = club?.id

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try {
        const [rows, trials] = await Promise.all([
          getClubSquad(clubId),
          getClubTrialsWithClubs(clubId),
        ])
        if (!cancelled) {
          setSquad(rows)
          setOpenTrials(trials.filter(t => t.status === 'open').length)
        }
      } catch { /* non-fatal */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clubId])

  const avgScore = useMemo(() => squad.length
    ? Math.round(squad.reduce((s, p) => s + p.score.current, 0) / squad.length)
    : 0, [squad])
  const avgAge = useMemo(() => squad.length
    ? (squad.reduce((s, p) => s + p.age, 0) / squad.length).toFixed(1)
    : '—', [squad])
  const under21 = squad.filter(p => p.age < 21).length

  const byPosition = useMemo(() => {
    const counts: Record<string, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
    for (const p of squad) counts[posGroup(p.position_primary)] += 1
    return counts
  }, [squad])

  const topRated = useMemo(() => [...squad].sort((a, b) => b.score.current - a.score.current).slice(0, 5), [squad])

  const squadTrend = useMemo(() => [
    { m: 'Apr', v: 60 }, { m: 'May', v: 61 }, { m: 'Jun', v: 63 },
    { m: 'Jul', v: 64 }, { m: 'Aug', v: 66 }, { m: 'Sep', v: avgScore },
  ], [avgScore])

  if (loading) return <Skeleton className="h-64 w-full" />

  if (!hasSupabase || !clubId || !club) {
    return (
      <div>
        <PageHeader breadcrumb="Club workspace" title="Club dashboard" />
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the club to a Supabase project to view your dashboard.
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" title={club.name}
        subtitle={`${club.league_code?.toUpperCase() ?? 'Club'} · ${club.city ?? ''}${club.city && club.state_region ? ', ' : ''}${club.state_region ?? ''}`}
        actions={
          <>
            <Badge tone={club.entity_verified ? 'trust' : 'gold'} icon={club.entity_verified ? 'shield' : undefined}>
              {club.entity_verified ? 'Entity verified' : 'Unverified'}
            </Badge>
            <Link to="/club/squad"><Button variant="outline" icon="users">Manage squad</Button></Link>
            <Link to="/club/discovery"><Button icon="search">Find players</Button></Link>
          </>
        } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Squad size" value={squad.length} icon="users" sub={`${club.player_seats_used} of plan seats used`} />
        <Stat label="Average score" value={avgScore} icon="radar" tone="red" sub="Based on ratings & attributes" />
        <Stat label="Average age" value={avgAge} icon="calendar" sub={`${under21} under 21`} />
        <Stat label="Open trials" value={openTrials} icon="target" tone="trust" sub="Live postings" />
      </div>

      {squad.length === 0 ? (
        <Card className="mt-4 p-8"><EmptyState icon="users" title="No players in your squad yet"
          description="Add players so you can track their scores, ratings and development."
          action={<Link to="/club/discovery"><Button icon="search">Find players</Button></Link>} /></Card>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Squad development" subtitle="Average FutWeb Score across your registered players" />
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
                {(['GK', 'DF', 'MF', 'FW'] as const).map(pos => {
                  const n = byPosition[pos]
                  return (
                    <div key={pos} className="flex items-center gap-3">
                      <span className="w-7 shrink-0 text-xs font-bold text-ink-700">{pos}</span>
                      <div className="flex-1"><ProgressBar value={n > 0 ? Math.min(100, n * 15) : 0} /></div>
                      <span className="tnum w-5 shrink-0 text-right text-xs font-bold">{n}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top rated in your squad"
                action={<Link to="/club/squad"><Button size="sm" variant="ghost">All</Button></Link>} />
              <div className="divide-y divide-ink-100">
                {topRated.map(p => (
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
              <CardHeader title="Your recent activity" subtitle="Latest from your workspace" />
              <div className="divide-y divide-ink-100">
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-trust-600"><Icon name="users" size={15} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{squad.length} player(s) in your squad</p></div>
                </div>
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-gold-600"><Icon name="target" size={15} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{openTrials} open trial(s)</p>
                    <p className="text-2xs text-ink-400">Manage postings in Trials</p></div>
                </div>
                <Link to="/club/trials" className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-blue-500"><Icon name="external" size={15} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Go to trials</p>
                    <p className="text-2xs text-ink-400">Post or review trial applications</p></div>
                  <Icon name="chevron-right" size={15} className="text-ink-300" />
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
