import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, toast } from '@/components/ui'
import { useClub } from '@/context/ClubContext'
import { hasSupabase, supabase } from '@/lib/supabase'
import { enrichPlayers, type EnrichedPlayer } from '@/lib/supabase/workspace'
import { per90 } from '@/lib/ratings'

const STAGES = ['watching', 'shortlisted', 'trial_invited', 'signed', 'rejected'] as const
type Stage = typeof STAGES[number]

const STAGE_TONE: Record<Stage, 'neutral' | 'blue' | 'trust' | 'gold' | 'red'> = {
  watching: 'neutral', shortlisted: 'blue', trial_invited: 'trust', signed: 'gold', rejected: 'red'}

interface BoardItem {
  id: string
  stage: Stage
  player: EnrichedPlayer | null
}

export default function Shortlists() {
  const { club } = useClub()
  const [board, setBoard] = useState<BoardItem[]>([])
  const [stage, setStage] = useState<Stage>('shortlisted')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const clubId = club?.id

  const load = async () => {
    if (!hasSupabase || !clubId) return
    const { data } = await supabase!.from('shortlists').select('id, player_id, stage').eq('club_id', clubId).order('updated_at', { ascending: false })
    const rows = data ?? []
    const playerIds = [...new Set(rows.map(r => r.player_id))] as string[]
    let players: EnrichedPlayer[] = []
    if (playerIds.length) {
      const { data: p } = await supabase!.from('players').select('*').in('id', playerIds)
      players = await enrichPlayers((p ?? []) as never[])
    }
    const map = new Map(players.map(x => [x.id, x]))
    setBoard(rows.map(r => ({ id: r.id, stage: r.stage as Stage, player: map.get(r.player_id) ?? null })))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try { await load() } catch { if (!cancelled) toast({ tone: 'error', title: 'Could not load shortlists' }) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId])

  async function move(id: string, to: Stage) {
    setBusy(true)
    try {
      await supabase!.from('shortlists').update({ stage: to, updated_at: new Date().toISOString() }).eq('id', id)
      setBoard(b => b.map(x => x.id === id ? { ...x, stage: to } : x))
      toast({ tone: 'success', title: `Moved to ${to.replace('_', ' ')}` })
    } catch (err) { toast({ tone: 'error', title: 'Could not move', description: err instanceof Error ? err.message : 'Try again.' }) }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await supabase!.from('shortlists').delete().eq('id', id)
      setBoard(b => b.filter(x => x.id !== id))
      toast({ tone: 'info', title: 'Removed from pipeline' })
    } catch { toast({ tone: 'error', title: 'Could not remove' }) } finally { setBusy(false) }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const inStage = board.filter(b => b.stage === stage)

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="list" title="Shortlists"
        subtitle="Move players through your recruitment pipeline. Every move is logged." />

      {!hasSupabase || !clubId ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the club to a Supabase project to manage your shortlists.
        </Card>
      ) : (
        <>
          <Tabs value={stage} onChange={setStage} tabs={STAGES.map(s => ({
            value: s, label: s.replace('_', ' '), count: board.filter(b => b.stage === s).length}))} />

          {inStage.length === 0 ? (
            <Card className="mt-5"><EmptyState icon="list" title={`No players in ${stage.replace('_', ' ')}`}
              description="Add players from Discovery to start building this stage."
              action={<Link to="/club/discovery"><Button icon="search">Go to discovery</Button></Link>} /></Card>
          ) : (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {inStage.map(({ id, player, stage: st }) => {
                if (!player) return null
                const p90 = per90(player.matchStats)
                return (
                  <Card key={id} hover className="p-4">
                    <div className="flex items-start gap-3.5">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-xs font-bold text-white">
                        {player.position_primary}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link to={`/club/player/${player.id}`} className="truncate text-sm font-bold hover:underline">
                            {player.first_name} {player.last_name}
                          </Link>
                          <Badge tone={STAGE_TONE[st]} size="sm">{st.replace('_', ' ')}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-500">
                          {player.age} yrs · {player.clubName ?? 'Unattached'} · {player.state_of_origin ?? '—'}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-3 text-2xs">
                          <span><span className="text-ink-400">Score </span><span className="tnum font-bold text-red-600">{player.score.current}</span></span>
                          <span><span className="text-ink-400">Pot </span><span className="tnum font-bold">{player.score.potential}</span></span>
                          <span><span className="text-ink-400">G/90 </span><span className="tnum font-bold">{p90.goals}</span></span>
                          <span><span className="text-ink-400">Conf </span><span className="tnum font-bold">{player.confidence.score}%</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                      {STAGES.filter(s => s !== st).map(s => (
                        <Button key={s} size="sm" variant="ghost" disabled={busy} onClick={() => void move(id, s)}>
                          {s.replace('_', ' ')}
                        </Button>
                      ))}
                      <button onClick={() => void remove(id)} disabled={busy}
                        className="ml-auto rounded-lg px-2 py-1 text-2xs font-semibold text-red-500 hover:bg-red-50">
                        Remove
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
