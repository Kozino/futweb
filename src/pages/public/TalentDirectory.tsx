import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Icon, Input, Select } from '@/components/ui'
import { DEMO_CLUBS, DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { LEAGUES } from '@/lib/constants'
import { POSITION_LIST } from '@/lib/ratings'
import { cn } from '@/lib/utils'
import { hasSupabase } from '@/lib/supabase'
import { getPublicClubs, getPublicPlayers, type PublicClubRow, type PublicPlayerRow } from '@/lib/publicData'

type Mode = 'players' | 'clubs'

export default function TalentDirectory() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const [mode, setMode] = useState<Mode>(() => pathname === '/clubs' ? 'clubs' : 'players')
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const [position, setPosition] = useState('')
  const [league, setLeague] = useState('')
  const [availability, setAvailability] = useState('')

  const demoPlayers = useMemo(() => DEMO_PLAYERS.map(enrichPlayer), [])
  const [remotePlayers, setRemotePlayers] = useState<PublicPlayerRow[] | null>(null)
  const [remoteClubs, setRemoteClubs] = useState<PublicClubRow[] | null>(null)
  const [loading, setLoading] = useState(hasSupabase)

  useEffect(() => {
    if (!hasSupabase) return
    Promise.all([getPublicPlayers(), getPublicClubs()])
      .then(([ps, cs]) => { setRemotePlayers(ps); setRemoteClubs(cs) })
      .catch(() => { /* Demo fallback keeps the directory usable during a transient API failure. */ })
      .finally(() => setLoading(false))
  }, [])

  const players = useMemo(() => remotePlayers
    ? remotePlayers.map(p => ({ ...p, clubName: p.club_name ?? 'Unattached', score: { current: p.futweb_score ?? 0, potential: p.potential ?? p.futweb_score ?? 0 }, confidence: { score: p.confidence ?? 0 } }))
    : demoPlayers, [remotePlayers, demoPlayers])
  const clubs = remoteClubs ?? DEMO_CLUBS
  const playerResults = useMemo(() => players.filter(p => {
    const needle = q.trim().toLowerCase()
    if (needle && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(needle)
      && !p.clubName.toLowerCase().includes(needle)
      && !(p.state_of_origin ?? '').toLowerCase().includes(needle)
      && !p.position_primary.toLowerCase().includes(needle)) return false
    if (position && p.position_primary !== position && !p.position_secondary.includes(position)) return false
    if (league && (('league' in p ? p.league : p.club_league) !== league)) return false
    if (availability && p.availability !== availability) return false
    if (p.visibility !== 'public') return false
    return true
  }), [players, q, position, league, availability])

  const clubResults = useMemo(() => clubs.filter(c => {
    const needle = q.trim().toLowerCase()
    if (needle && !`${c.name} ${c.city ?? ''} ${c.state ?? ''}`.toLowerCase().includes(needle)) return false
    if (league && (('league_code' in c ? c.league_code : c.league) !== league)) return false
    return 'entity_verified' in c ? c.entity_verified : c.verification_status === 'verified'
  }), [clubs, q, league])

  const clear = () => { setQ(''); setPosition(''); setLeague(''); setAvailability('') }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('/images/pitch-aerial.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/40" />
        <div className="fw-container relative py-12 sm:py-16">
          <Badge tone="red" icon="search">Open talent directory</Badge>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Find the player. Check the record. <span className="text-red-400">Then make the call.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-ink-300">
            Anyone can browse public FutWeb profiles without registering. Search by player name, club,
            position, competition or location — then open the full CV before deciding who to watch.
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-xl sm:p-4">
            <div className="flex gap-2 border-b border-white/10 pb-3">
              {(['players', 'clubs'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); clear() }}
                  className={cn('rounded-xl px-4 py-2 text-sm font-bold capitalize transition-colors',
                    mode === m ? 'bg-white text-ink-900' : 'text-ink-300 hover:bg-white/10 hover:text-white')}>
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <Input className="md:col-span-2" icon="search" value={q} onChange={e => setQ(e.target.value)}
                placeholder={mode === 'players' ? 'Search player, club, state or position…' : 'Search club, city or state…'} />
              {mode === 'players' && (
                <Select value={position} onChange={e => setPosition(e.target.value)} placeholder="Any position"
                  options={[...POSITION_LIST].map(p => ({ value: p, label: p }))} />
              )}
              <Select value={league} onChange={e => setLeague(e.target.value)} placeholder="Any competition"
                options={LEAGUES.map(l => ({ value: l.value, label: l.label }))} />
              {mode === 'players' && (
                <Select value={availability} onChange={e => setAvailability(e.target.value)} placeholder="Any availability"
                  options={[{ value: 'available', label: 'Available' }, { value: 'trial_only', label: 'Trials only' }, { value: 'under_contract', label: 'Under contract' }]} />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-400">
              <span>{mode === 'players' ? `${playerResults.length} public player${playerResults.length === 1 ? '' : 's'}` : `${clubResults.length} verified club${clubResults.length === 1 ? '' : 's'}`}</span>
              {(q || position || league || availability) && <button onClick={clear} className="font-semibold text-red-300 hover:text-white">Clear filters</button>}
            </div>
          </div>
        </div>
      </section>

      <section className="fw-container py-10 sm:py-12">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-ink-50" />)}</div>
        ) : mode === 'players' ? (
          playerResults.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {playerResults.map(p => (
                <Card key={p.id} hover className="overflow-hidden">
                  <div className="flex gap-4 p-4 sm:p-5">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ink-900 to-red-900 text-lg font-extrabold text-white">{p.first_name[0]}{p.last_name[0]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/players/${p.slug}`} className="text-base font-extrabold hover:text-red-600">{p.first_name} {p.last_name}</Link>
                        {p.availability === 'available' && <Badge tone="trust" size="sm">Available</Badge>}
                        {p.confidence.score >= 65 && <Badge tone="blue" size="sm" icon="check">High confidence</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-ink-500">{p.position_primary} · {p.age} yrs · {p.clubName} · {p.state_of_origin}</p>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <div><p className="text-2xs uppercase tracking-wider text-ink-400">Score</p><p className="font-display text-xl text-red-600">{p.score.current}</p></div>
                        <div><p className="text-2xs uppercase tracking-wider text-ink-400">Potential</p><p className="font-display text-xl">{p.score.potential}</p></div>
                        <div><p className="text-2xs uppercase tracking-wider text-ink-400">Confidence</p><p className="font-display text-xl text-trust-600">{p.confidence.score}%</p></div>
                      </div>
                    </div>
                    <Link to={`/players/${p.slug}`} className="hidden shrink-0 sm:block"><Button size="sm" variant="outline" iconRight="arrow-right">View CV</Button></Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : <Card><EmptyState icon="search" title="No public players found" description="Try a broader search or remove one of the filters." /></Card>
        ) : (
          clubResults.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clubResults.map(c => (
                <Card key={c.id} hover className="p-5">
                  <div className="flex items-start justify-between gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-xs font-extrabold text-white">{c.short_name}</div><Badge tone="trust" icon="shield" size="sm">Verified</Badge></div>
                  <Link to={`/clubs/${c.slug}`} className="mt-4 block text-base font-extrabold hover:text-red-600">{c.name}</Link>
                  <p className="mt-1 text-xs text-ink-500">{c.city ?? ('state_region' in c ? c.state_region : c.state) ?? c.country} · {LEAGUES.find(l => l.value === ('league_code' in c ? c.league_code : c.league))?.label ?? ('league_code' in c ? c.league_code : c.league) ?? 'Football club'}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-ink-50 p-3"><p className="text-2xs uppercase tracking-wider text-ink-400">Verified</p><p className="font-display text-xl text-trust-600">Yes</p></div><div className="rounded-xl bg-ink-50 p-3"><p className="text-2xs uppercase tracking-wider text-ink-400">Founded</p><p className="font-display text-xl">{c.founded_year ?? '—'}</p></div></div>
                  <Link to={`/clubs/${c.slug}`} className="mt-4 block"><Button fullWidth variant="outline" size="sm" iconRight="arrow-right">View club</Button></Link>
                </Card>
              ))}
            </div>
          ) : <Card><EmptyState icon="building" title="No verified clubs found" description="Try a broader club or competition search." /></Card>
        )}
      </section>
    </div>
  )
}
