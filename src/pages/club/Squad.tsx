import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, ProgressBar, Select, Skeleton, Tabs, toast } from '@/components/ui'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { hasSupabase, supabase } from '@/lib/supabase'
import { getClubSquad, getDiscoverablePlayers, type EnrichedPlayer } from '@/lib/supabase/workspace'

export default function Squad() {
  const { club } = useClub()
  const { user } = useAuth()
  const [squad, setSquad] = useState<EnrichedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState('')
  const [tab, setTab] = useState<'grid' | 'table'>('grid')

  // Add-player modal state
  const [addOpen, setAddOpen] = useState(false)
  const [candidates, setCandidates] = useState<EnrichedPlayer[]>([])
  const [candidateQuery, setCandidateQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [claiming, setClaiming] = useState(false)

  const clubId = club?.id

  const loadSquad = async () => {
    if (!hasSupabase || !clubId) return []
    return getClubSquad(clubId)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try {
        const rows = await loadSquad()
        if (!cancelled) setSquad(rows)
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId])

  const rows = squad.filter(p =>
    (!q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())) &&
    (!pos || p.position_primary === pos))

  async function openAdd() {
    setAddOpen(true)
    setCandidateQuery('')
    if (!hasSupabase || !supabase) return
    setSearching(true)
    try {
      // Candidates = players this club can view that aren't already in the squad.
      const all = await getDiscoverablePlayers()
      const inSquad = new Set(squad.map(s => s.id))
      setCandidates(all.filter(p => !inSquad.has(p.id)))
    } catch (err) {
      toast({ tone: 'error', title: 'Could not load players', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSearching(false)
    }
  }

  async function claimPlayer(player: EnrichedPlayer) {
    if (!supabase || !clubId) return
    setClaiming(true)
    try {
      const { error } = await supabase.rpc('club_claim_player', { p_player_id: player.id })
      if (error) throw error
      setSquad(await loadSquad())
      setCandidates(c => c.filter(x => x.id !== player.id))
      toast({ tone: 'success', title: `${player.first_name} added to squad`, description: 'Their profile is now managed by your club.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not add player', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setClaiming(false)
    }
  }

  const shownCandidates = candidates.filter(p =>
    !candidateQuery || `${p.first_name} ${p.last_name}`.toLowerCase().includes(candidateQuery.toLowerCase()))
  const isVerifiedClub = club?.entity_verified ?? false

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="users" title="Squad"
        subtitle={`${squad.length} registered player${squad.length === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="outline" icon="upload">Import CSV</Button>
            <Button icon="plus" onClick={() => void openAdd()}>Add player</Button>
          </>
        } />

      {!hasSupabase || !clubId ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the club to a Supabase project to manage your squad.
        </Card>
      ) : squad.length === 0 ? (
        <Card className="p-8"><EmptyState icon="users" title="No players yet"
          description="Add a registered player to your squad to start tracking attributes, stats and development."
          action={<Button icon="plus" onClick={() => void openAdd()}>Add player</Button>} /></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-xs" icon="search" placeholder="Search squad…" value={q} onChange={e => setQ(e.target.value)} />
            <Select className="max-w-[180px]" value={pos} onChange={e => setPos(e.target.value)} placeholder="All positions"
              options={['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'].map(p => ({ value: p, label: p }))} />
            <div className="ml-auto">
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'grid', label: 'Grid', icon: 'grid' }, { value: 'table', label: 'Table', icon: 'list' },
              ]} />
            </div>
          </div>

          {tab === 'grid' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map(p => (
                <Link key={p.id} to={`/club/player/${p.id}`}>
                  <Card hover className="overflow-hidden">
                    <div className="relative h-20 bg-gradient-to-br from-ink-900 to-ink-750">
                      <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
                      <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-white/15 text-2xs font-bold text-white backdrop-blur">
                        {p.position_primary}
                      </span>
                    </div>
                    <div className="px-4 pb-4">
                      <div className="-mt-6 mb-2 grid h-12 w-12 place-items-center rounded-xl border-4 border-white bg-gradient-to-br from-red-500 to-red-700 text-sm font-bold text-white">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <p className="truncate text-sm font-bold">{p.first_name} {p.last_name}</p>
                      <p className="text-2xs text-ink-500">{p.age} yrs · {p.height_cm}cm · {p.foot} foot</p>

                      <div className="mt-3 flex items-center gap-2">
                        <span className="tnum font-display text-2xl text-red-500">{p.score.current}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-2xs text-ink-400">
                            <span>Potential</span><span className="tnum font-bold text-ink-700">{p.score.potential}</span>
                          </div>
                          <ProgressBar value={p.score.current} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <Badge tone={p.confidence.score >= 65 ? 'trust' : p.confidence.score >= 40 ? 'gold' : 'red'} size="sm">
                          {p.confidence.label} confidence
                        </Badge>
                        <span className="text-2xs text-ink-400">{p.media.filter(m => m.kind === 'highlight').length} clips</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    {['Player', 'Pos', 'Age', 'Score', 'Pot', 'Confidence', 'Apps', 'Availability', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map(p => (
                    <tr key={p.id} className="hover:bg-ink-50">
                      <td className="px-4 py-3">
                        <Link to={`/club/player/${p.id}`} className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                            {p.first_name[0]}{p.last_name[0]}
                          </span>
                          <span>
                            <span className="block font-semibold">{p.first_name} {p.last_name}</span>
                            <span className="block text-2xs text-ink-400">{p.state_of_origin ?? '—'}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><Badge tone="neutral" size="sm">{p.position_primary}</Badge></td>
                      <td className="tnum px-4 py-3">{p.age}</td>
                      <td className="tnum px-4 py-3 font-bold text-red-600">{p.score.current}</td>
                      <td className="tnum px-4 py-3">{p.score.potential}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14"><ProgressBar value={p.confidence.score} size="sm"
                            tone={p.confidence.score >= 65 ? 'trust' : 'gold'} /></div>
                          <span className="tnum text-2xs">{p.confidence.score}%</span>
                        </div>
                      </td>
                      <td className="tnum px-4 py-3">{p.matchStats.appearances}</td>
                      <td className="px-4 py-3">
                        <Badge tone={p.availability === 'available' ? 'trust' : 'neutral'} size="sm">
                          {p.availability.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><Icon name="chevron-right" size={15} className="text-ink-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} size="lg" title="Add a player to your squad"
        description="Choose a registered player your club can view who isn't attached to another club.">
        {!isVerifiedClub && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 p-3 text-xs text-gold-800">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            <span>Your club must be <strong>entity verified</strong> to add players. Complete it in the Verification tab first.</span>
          </div>
        )}

        <Input className="mb-3" icon="search" placeholder="Search by name…" value={candidateQuery}
          onChange={e => setCandidateQuery(e.target.value)} />

        <div className="fw-scroll max-h-[380px] space-y-2 overflow-y-auto pr-1">
          {searching ? (
            <Skeleton className="h-24 w-full" />
          ) : shownCandidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              {candidateQuery ? 'No players match that name.' : 'No unattached players are currently visible to your club.'}
            </p>
          ) : shownCandidates.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                {p.position_primary}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{p.first_name} {p.last_name}</p>
                <p className="text-2xs text-ink-500">{p.age} yrs · {p.position_primary} · {p.state_of_origin ?? '—'}</p>
              </div>
              <div className="text-right">
                <p className="tnum text-sm font-bold text-red-600">{p.score.current}</p>
                <p className="text-2xs text-ink-400">{p.score.potential} pot</p>
              </div>
              <Button size="sm" variant="outline" icon="plus" loading={claiming}
                disabled={!isVerifiedClub || !user} onClick={() => void claimPlayer(p)}>
                Add
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
