import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Tabs, toast } from '@/components/ui'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { per90 } from '@/lib/ratings'

const STAGES = ['watching', 'shortlisted', 'trial_invited', 'signed', 'rejected'] as const
type Stage = typeof STAGES[number]

const STAGE_TONE: Record<Stage, 'neutral' | 'blue' | 'trust' | 'gold' | 'red'> = {
  watching: 'neutral', shortlisted: 'blue', trial_invited: 'trust', signed: 'gold', rejected: 'red'}

export default function Shortlists() {
  const all = useMemo(() => DEMO_PLAYERS.map(enrichPlayer), [])
  const [stage, setStage] = useState<Stage>('shortlisted')
  const [board, setBoard] = useState<Record<string, Stage>>(
    Object.fromEntries(DEMO_PLAYERS.slice(0, 7).map((p, i) => [p.id, STAGES[[0, 1, 1, 2, 1, 3, 4][i]]])),
  )

  const inStage = all.filter(p => board[p.id] === stage)

  const move = (id: string, to: Stage) => {
    setBoard(b => ({ ...b, [id]: to }))
    toast({ tone: 'success', title: `Moved to ${to.replace('_', ' ')}` })
  }

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="list" title="Shortlists"
        subtitle="Move players through your recruitment pipeline. Every move is logged." />

      <Tabs value={stage} onChange={setStage} tabs={STAGES.map(s => ({
        value: s, label: s.replace('_', ' '), count: all.filter(p => board[p.id] === s).length}))} />

      {inStage.length === 0 ? (
        <Card className="mt-5"><EmptyState icon="list" title={`No players in ${stage.replace('_', ' ')}`}
          description="Add players from Discovery to start building this stage."
          action={<Link to="/club/discovery"><Button icon="search">Go to discovery</Button></Link>} /></Card>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {inStage.map(p => {
            const p90 = per90(p.matchStats)
            return (
              <Card key={p.id} hover className="p-4">
                <div className="flex items-start gap-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-xs font-bold text-white">
                    {p.position_primary}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/club/player/${p.id}`} className="truncate text-sm font-bold hover:underline">
                        {p.first_name} {p.last_name}
                      </Link>
                      <Badge tone={STAGE_TONE[board[p.id]]} size="sm">{board[p.id].replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {p.age} yrs · {p.clubName} · {p.state_of_origin}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-3 text-2xs">
                      <span><span className="text-ink-400">Score </span><span className="tnum font-bold text-red-600">{p.score.current}</span></span>
                      <span><span className="text-ink-400">Pot </span><span className="tnum font-bold">{p.score.potential}</span></span>
                      <span><span className="text-ink-400">G/90 </span><span className="tnum font-bold">{p90.goals}</span></span>
                      <span><span className="text-ink-400">Conf </span><span className="tnum font-bold">{p.confidence.score}%</span></span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                  {STAGES.filter(s => s !== board[p.id]).map(s => (
                    <Button key={s} size="sm" variant="ghost" onClick={() => move(p.id, s)}>
                      {s.replace('_', ' ')}
                    </Button>
                  ))}
                  <button onClick={() => { const { [p.id]: _, ...rest } = board; setBoard(rest)
                    toast({ tone: 'info', title: 'Removed from pipeline' }) }}
                    className="ml-auto rounded-lg px-2 py-1 text-2xs font-semibold text-red-500 hover:bg-red-50">
                    Remove
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
