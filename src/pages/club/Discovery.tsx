import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Input, Select, toast } from '@/components/ui'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { per90 } from '@/lib/ratings'
import { LEAGUES } from '@/lib/constants'
import { POSITION_LIST } from '@/lib/ratings'
import { cn } from '@/lib/utils'
import { useOffline } from '@/context/OfflineContext'

export default function Discovery() {
  const all = useMemo(() => DEMO_PLAYERS.map(enrichPlayer), [])
  const [q, setQ] = useState('')
  const [pos, setPos] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [league, setLeague] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [shortlist, setShortlist] = useState<string[]>([])
  const { enqueue } = useOffline()

  const results = useMemo(() => all.filter(p => {
    if (q && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())
        && !p.clubName.toLowerCase().includes(q.toLowerCase())
        && !(p.state_of_origin ?? '').toLowerCase().includes(q.toLowerCase())) return false
    if (pos && p.position_primary !== pos && !p.position_secondary.includes(pos)) return false
    if (ageMax && p.age > Number(ageMax)) return false
    if (league && p.league !== league) return false
    if (p.score.current < minScore) return false
    if (verifiedOnly && p.confidence.score < 65) return false
    return true
  }), [all, q, pos, ageMax, league, minScore, verifiedOnly])

  const toggleShortlist = async (id: string) => {
    const isAdd = !shortlist.includes(id)
    setShortlist(s => isAdd ? [...s, id] : s.filter(x => x !== id))
    await enqueue('report', { player_id: id, action: isAdd ? 'shortlist' : 'unshortlist' })
    toast({ tone: 'success', title: isAdd ? 'Added to shortlist' : 'Removed from shortlist' })
  }

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="search" title="Discovery"
        subtitle="Search the full FutWeb index. Rankings account for position fit, age and data confidence."
        actions={<Badge tone="neutral">{results.length} match{results.length === 1 ? '' : 'es'}</Badge>} />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input className="lg:col-span-2" icon="search" placeholder="Name, club or state…"
            value={q} onChange={e => setQ(e.target.value)} />
          <Select value={pos} onChange={e => setPos(e.target.value)} placeholder="Any position"
            options={[...POSITION_LIST].map(p => ({ value: p, label: p }))} />
          <Select value={ageMax} onChange={e => setAgeMax(e.target.value)} placeholder="Any age"
            options={[
              { value: '17', label: 'Under 17' }, { value: '20', label: 'Under 20' },
              { value: '23', label: 'Under 23' }, { value: '26', label: 'Under 26' },
            ]} />
          <Select value={league} onChange={e => setLeague(e.target.value)} placeholder="Any competition"
            options={LEAGUES.map(l => ({ value: l.value, label: l.label }))} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-ink-100 pt-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-700">
            Min score
            <input type="range" min={0} max={90} value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="h-1 w-28 cursor-pointer accent-red-500" />
            <span className="tnum w-5 text-red-600">{minScore}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-700">
            <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-red-500 focus:ring-red-500" />
            High-confidence ratings only
          </label>
          {(q || pos || ageMax || league || minScore > 0 || verifiedOnly) && (
            <button onClick={() => { setQ(''); setPos(''); setAgeMax(''); setLeague(''); setMinScore(0); setVerifiedOnly(false) }}
              className="ml-auto text-xs font-semibold text-red-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {results.length === 0 ? (
        <Card><EmptyState icon="search" title="No players match those filters"
          description="Try widening the age range or lowering the minimum score." /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {results.map(p => {
            const p90 = per90(p.matchStats)
            const inList = shortlist.includes(p.id)
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
                      {p.is_minor && <Badge tone="blue" size="sm">U18</Badge>}
                      {p.availability === 'available' && <Badge tone="trust" size="sm">Available</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {p.age} yrs · {p.clubName} · {p.state_of_origin} · {p.height_cm}cm
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-3">
                      {[['Score', p.score.current], ['Pot', p.score.potential]].map(([l, v]) => (
                        <div key={l as string}>
                          <p className="text-2xs uppercase tracking-wide text-ink-400">{l as string}</p>
                          <p className="tnum text-sm font-bold text-red-600">{v as number}</p>
                        </div>
                      ))}
                      {!['GK'].includes(p.position_primary) && (
                        <>
                          <div><p className="text-2xs uppercase tracking-wide text-ink-400">G/90</p>
                            <p className="tnum text-sm font-bold">{p90.goals}</p></div>
                          <div><p className="text-2xs uppercase tracking-wide text-ink-400">A/90</p>
                            <p className="tnum text-sm font-bold">{p90.assists}</p></div>
                        </>
                      )}
                      <div>
                        <p className="text-2xs uppercase tracking-wide text-ink-400">Confidence</p>
                        <p className={cn('text-sm font-bold',
                          p.confidence.score >= 65 ? 'text-trust-600' : p.confidence.score >= 40 ? 'text-gold-600' : 'text-red-500')}>
                          {p.confidence.score}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button size="sm" variant={inList ? 'dark' : 'outline'}
                      icon={inList ? 'check' : 'plus'} onClick={() => toggleShortlist(p.id)}>
                      {inList ? 'Listed' : 'Shortlist'}
                    </Button>
                    <Link to={`/club/player/${p.id}`}>
                      <Button size="sm" variant="ghost" className="w-full">Profile</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
