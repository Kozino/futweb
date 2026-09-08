import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Card, EmptyState, Icon, ProgressBar, Skeleton } from '@/components/ui'
import { AttributeRadar } from '@/components/player/Radar'
import { AttributeBars, ConfidenceMeter, PositionFitBar, ScoreRing } from '@/components/player/Attributes'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import {
  ATTRIBUTE_GROUPS,
  computeConfidence,
  computeFutWebScore,
  groupForPosition,
  per90,
  type ConfidenceBreakdown,
  type FutWebScore,
} from '@/lib/ratings'
import { LEAGUES } from '@/lib/constants'
import { hasSupabase } from '@/lib/supabase'
import { getPublicPlayer, type PublicPlayerRow } from '@/lib/publicData'
import type { MatchStats, PlayerAttributes } from '@/types'

type PublicCareer = {
  id: string
  club_name: string
  season: string
  competition: string | null
  appearances: number
  goals: number
  assists: number
  verified: boolean
}

type PublicCvPlayer = {
  id: string
  slug: string
  first_name: string
  last_name: string
  age: number
  nationality: string
  state_of_origin: string | null
  position_primary: string
  position_secondary: string[]
  foot: 'left' | 'right' | 'both'
  height_cm: number | null
  weight_kg: number | null
  bio: string | null
  availability: 'available' | 'trial_only' | 'under_contract' | 'not_looking'
  avatar_url: string | undefined
  clubName: string
  league: string | null
  attributes: PlayerAttributes
  matchStats: MatchStats
  career: PublicCareer[]
  score: FutWebScore
  confidence: ConfidenceBreakdown
}

const ATTRIBUTE_KEYS = [
  'finishing', 'passing', 'dribbling', 'first_touch', 'crossing', 'technique', 'heading',
  'acceleration', 'sprint_speed', 'agility', 'stamina', 'strength', 'jumping', 'balance',
  'vision', 'positioning', 'decision_making', 'work_rate', 'composure', 'aggression', 'leadership',
  'marking', 'tackling', 'interceptions', 'aerial_duels',
  'reflexes', 'handling', 'gk_distribution', 'shot_stopping',
] as const

const STAT_KEYS: Array<keyof MatchStats> = [
  'appearances', 'minutes', 'goals', 'assists', 'shots', 'shots_on_target',
  'pass_attempts', 'passes_completed', 'duels', 'duels_won', 'tackles',
  'interceptions', 'fouls_committed', 'yellow_cards', 'red_cards',
  'clean_sheets', 'goals_conceded', 'saves',
]

function numberValue(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function emptyStats(): MatchStats {
  return {
    appearances: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shots_on_target: 0,
    pass_attempts: 0, passes_completed: 0, duels: 0, duels_won: 0, tackles: 0,
    interceptions: 0, fouls_committed: 0, yellow_cards: 0, red_cards: 0,
    clean_sheets: 0, goals_conceded: 0, saves: 0,
  }
}

function publicAttributes(row: Record<string, unknown> | null): PlayerAttributes {
  const attributes = {} as PlayerAttributes
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = Math.max(0, Math.min(99, numberValue(row?.[key])))
  }
  return attributes
}

function aggregateStats(rows: Array<Record<string, unknown>>): MatchStats {
  const totals = emptyStats()
  for (const row of rows) {
    for (const key of STAT_KEYS) {
      totals[key] += numberValue(row[key])
    }
  }
  return totals
}

function confidenceLabel(score: number): ConfidenceBreakdown['label'] {
  if (score >= 85) return 'Very High'
  if (score >= 65) return 'High'
  if (score >= 40) return 'Moderate'
  if (score >= 20) return 'Low'
  return 'Very Low'
}

function ratingTierForScore(score: number): FutWebScore['ratingTier'] {
  if (score >= 82) return 'Elite'
  if (score >= 72) return 'High'
  if (score >= 60) return 'Solid'
  if (score >= 45) return 'Developing'
  return 'Raw'
}

function publicConfidence(
  score: number | null | undefined,
  hasAttributes: boolean,
  hasStats: boolean,
): ConfidenceBreakdown {
  const calculated = computeConfidence({
    ratingCount: hasAttributes ? 1 : 0,
    independentRaters: 0,
    verifiedRaters: 0,
    matchesObserved: hasStats ? 1 : 0,
    hasVideo: false,
    hasVerifiedStats: false,
  })
  const storedScore = score == null ? calculated.score : Math.max(0, Math.min(100, score))

  return {
    ...calculated,
    score: storedScore,
    label: confidenceLabel(storedScore),
  }
}

function publicCareer(rows: Array<Record<string, unknown>>): PublicCareer[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `${row.player_id ?? 'career'}-${index}`),
    club_name: String(row.club_name ?? 'Club not specified'),
    season: String(row.season ?? '—'),
    competition: typeof row.competition === 'string' ? row.competition : null,
    appearances: numberValue(row.appearances),
    goals: numberValue(row.goals),
    assists: numberValue(row.assists),
    verified: Boolean(row.verified),
  }))
}

function fromPublicData(data: {
  player: PublicPlayerRow
  career: Array<Record<string, unknown>>
  stats: Array<Record<string, unknown>>
  attributes: Record<string, unknown> | null
}): PublicCvPlayer {
  const { player, career, stats, attributes } = data
  const attributeValues = publicAttributes(attributes)
  const totals = aggregateStats(stats)
  const confidence = publicConfidence(player.confidence, attributes !== null, totals.appearances > 0)
  const calculatedScore = computeFutWebScore({
    attributes: attributeValues,
    position: player.position_primary,
    age: player.age,
    confidence: confidence.score,
  })
  const currentScore = player.futweb_score ?? calculatedScore.current
  const potential = player.potential ?? calculatedScore.potential

  return {
    id: player.id,
    slug: player.slug,
    first_name: player.first_name,
    last_name: player.last_name,
    age: player.age,
    nationality: player.nationality,
    state_of_origin: player.state_of_origin ?? null,
    position_primary: player.position_primary,
    position_secondary: player.position_secondary ?? [],
    foot: player.foot,
    height_cm: player.height_cm ?? null,
    weight_kg: player.weight_kg ?? null,
    bio: player.bio ?? null,
    availability: player.availability,
    avatar_url: player.avatar_url ?? undefined,
    clubName: player.club_name ?? 'Unattached',
    league: player.club_league ?? null,
    attributes: attributeValues,
    matchStats: totals,
    career: publicCareer(career),
    score: {
      ...calculatedScore,
      current: currentScore,
      potential,
      confidence: confidence.score,
      confidenceLabel: confidence.label,
      ratingTier: ratingTierForScore(currentScore),
    },
    confidence,
  }
}

function fromDemo(slug: string | undefined): PublicCvPlayer {
  const raw = DEMO_PLAYERS.find(player => player.slug === slug) ?? DEMO_PLAYERS[0]
  const player = enrichPlayer(raw)

  return {
    id: player.id,
    slug: player.slug,
    first_name: player.first_name,
    last_name: player.last_name,
    age: player.age,
    nationality: player.nationality,
    state_of_origin: player.state_of_origin ?? null,
    position_primary: player.position_primary,
    position_secondary: player.position_secondary,
    foot: player.foot,
    height_cm: player.height_cm,
    weight_kg: player.weight_kg,
    bio: player.bio ?? null,
    availability: player.availability,
    avatar_url: player.avatar_url ?? undefined,
    clubName: player.clubName,
    league: player.league,
    attributes: player.attributes,
    matchStats: player.matchStats,
    career: player.career.map(entry => ({
      id: entry.id,
      club_name: entry.club_name,
      season: entry.season,
      competition: entry.league,
      appearances: entry.appearances,
      goals: entry.goals,
      assists: entry.assists,
      verified: entry.verified,
    })),
    score: player.score,
    confidence: player.confidence,
  }
}

export default function PlayerPublicProfile() {
  const { slug } = useParams()
  const demoPlayer = useMemo(() => fromDemo(slug), [slug])
  const [remotePlayer, setRemotePlayer] = useState<PublicCvPlayer | null>(null)
  const [loading, setLoading] = useState(hasSupabase)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!hasSupabase) {
      setLoading(false)
      return () => { cancelled = true }
    }

    if (!slug) {
      setRemotePlayer(null)
      setUnavailable(true)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    setUnavailable(false)

    void getPublicPlayer(slug)
      .then(result => {
        if (cancelled) return
        if (!result) {
          setRemotePlayer(null)
          setUnavailable(true)
          return
        }

        setRemotePlayer(fromPublicData({
          player: result.player,
          career: result.career as Array<Record<string, unknown>>,
          stats: result.stats as Array<Record<string, unknown>>,
          attributes: result.attributes as Record<string, unknown> | null,
        }))
      })
      .catch(() => {
        if (!cancelled) {
          setRemotePlayer(null)
          setUnavailable(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [slug])

  const player = hasSupabase ? remotePlayer : demoPlayer
  const group = player
    ? (groupForPosition(player.position_primary) === 'GK'
      ? 'Goalkeeping'
      : groupForPosition(player.position_primary) === 'DF'
        ? 'Defending'
        : groupForPosition(player.position_primary) === 'MF'
          ? 'Mental'
          : 'Technical')
    : 'Technical'
  const p90 = useMemo(
    () => player ? per90(player.matchStats) : null,
    [player],
  )

  if (loading) {
    return (
      <main className="fw-container py-10 sm:py-14">
        <Skeleton className="h-48 w-full" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Skeleton className="h-[560px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </main>
    )
  }

  if (!player || unavailable) {
    return (
      <main className="fw-container py-10 sm:py-14">
        <Card>
          <EmptyState
            icon="user"
            title="Public player CV unavailable"
            description="This profile may be private, no longer active, or the link may be incorrect."
            action={<Link to="/players"><Button variant="outline" icon="search">Browse public players</Button></Link>}
          />
        </Card>
      </main>
    )
  }

  return (
    <div className="bg-ink-50/40">
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/hero-match.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-red-950/50" />
        <div className="fw-container relative py-8 sm:py-12">
          <Link to="/players" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-white"><Icon name="chevron-left" size={14} />Back to talent directory</Link>
          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4 sm:gap-5">
              <Avatar
                name={`${player.first_name} ${player.last_name}`}
                src={player.avatar_url}
                size={128}
                ring="ring-4 ring-white/10"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="trust" icon="check">Public CV</Badge>{player.availability === 'available' && <Badge tone="trust">Available</Badge>}</div>
                <h1 className="mt-2 truncate text-3xl font-extrabold tracking-tight sm:text-4xl">{player.first_name} {player.last_name}</h1>
                <p className="mt-1 text-sm text-ink-300">{player.position_primary} · {player.age} yrs · {player.clubName} · {player.state_of_origin ?? player.nationality}</p>
              </div>
            </div>
            <div className="flex gap-2"><Link to="/register"><Button size="lg" iconRight="arrow-right">Register to shortlist</Button></Link><Link to="/clubs"><Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white">Browse clubs</Button></Link></div>
          </div>
        </div>
      </section>

      <main className="fw-container py-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <Card className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <div><p className="fw-label">FutWeb score</p><ScoreRing score={player.score.current} size={86} confidence={player.confidence.score} label={player.score.ratingTier} sublabel={`Potential ${player.score.potential}`} /></div>
                <div className="sm:col-span-2"><p className="fw-label">Player summary</p><p className="text-sm leading-relaxed text-ink-600">{player.bio || 'This player has not added a profile summary yet.'}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Height', player.height_cm ? `${player.height_cm} cm` : '—'], ['Weight', player.weight_kg ? `${player.weight_kg} kg` : '—'], ['Foot', player.foot], ['Nationality', player.nationality]].map(([label, value]) => <div key={label} className="rounded-xl bg-ink-50 p-3"><p className="text-2xs uppercase tracking-wider text-ink-400">{label}</p><p className="mt-1 text-xs font-bold capitalize">{value}</p></div>)}</div></div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold">Attributes & position fit</h2><p className="text-xs text-ink-500">The same rating evidence available inside the player dashboard.</p></div><Badge tone="neutral">{group}</Badge></div>
              <div className="mt-5 grid items-center gap-5 lg:grid-cols-2"><AttributeRadar attributes={player.attributes} keys={[...ATTRIBUTE_GROUPS[group]]} size={270} /><div><p className="fw-label">Viable positions</p><div className="flex flex-wrap gap-1.5">{player.score.viablePositions.slice(0, 10).map(position => <Badge key={position} size="sm" tone={position === player.position_primary ? 'red' : 'neutral'}>{position}</Badge>)}</div><div className="mt-5"><p className="fw-label">Position fit</p><PositionFitBar fit={player.score.positionFit as unknown as Record<string, number>} primary={player.position_primary} /></div><div className="mt-5"><ConfidenceMeter score={player.confidence.score} label={player.confidence.label} factors={player.confidence.factors} /></div></div></div>
              <div className="mt-5 border-t border-ink-100 pt-5"><AttributeBars attributes={player.attributes} highlightGroup={group} /></div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-extrabold">Career history</h2><p className="text-xs text-ink-500">Club, competition and contribution history.</p></div><Badge tone="blue" icon="shield">Verification shown</Badge></div>
              {player.career.length === 0 ? (
                <p className="mt-4 text-sm text-ink-400">No club history has been added yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-ink-100 text-2xs uppercase tracking-wider text-ink-400"><th className="pb-2">Club</th><th className="pb-2">Season</th><th className="pb-2">Competition</th><th className="pb-2">Apps</th><th className="pb-2">Goals</th><th className="pb-2">Assists</th><th className="pb-2">Status</th></tr></thead><tbody>{player.career.map(entry => <tr key={entry.id} className="border-b border-ink-50"><td className="py-3 font-bold">{entry.club_name}</td><td className="py-3">{entry.season}</td><td className="py-3">{LEAGUES.find(league => league.value === entry.competition)?.label ?? entry.competition ?? '—'}</td><td className="py-3 tnum">{entry.appearances}</td><td className="py-3 tnum">{entry.goals}</td><td className="py-3 tnum">{entry.assists}</td><td className="py-3">{entry.verified ? <Badge tone="trust" size="sm">Verified</Badge> : <Badge tone="neutral" size="sm">Unverified</Badge>}</td></tr>)}</tbody></table></div>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <div><h2 className="text-base font-extrabold">Performance contributions</h2><p className="text-xs text-ink-500">Season totals and per-90 context.</p></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Appearances', player.matchStats.appearances], ['Minutes', player.matchStats.minutes], ['Goals', player.matchStats.goals], ['Assists', player.matchStats.assists]].map(([label, value]) => <div key={label} className="rounded-xl bg-ink-50 p-3"><p className="text-2xs uppercase tracking-wider text-ink-400">{label}</p><p className="font-display text-2xl">{value}</p></div>)}</div>
              {p90 && <div className="mt-4 grid gap-x-8 sm:grid-cols-2">{[['Goals / 90', p90.goals], ['Assists / 90', p90.assists], ['Pass accuracy', `${p90.passAccuracy}%`], ['Duel success', `${p90.duelSuccess}%`], ['Tackles / 90', p90.tackles], ['Interceptions / 90', p90.interceptions]].map(([label, value]) => <div key={label} className="flex justify-between border-b border-ink-100 py-2.5"><span className="text-xs text-ink-600">{label}</span><span className="tnum text-xs font-bold">{value}</span></div>)}</div>}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-5"><h3 className="text-sm font-extrabold">Recruitment snapshot</h3><div className="mt-4 space-y-3">{[['Primary position', player.position_primary], ['Secondary', player.position_secondary.join(', ') || '—'], ['Availability', player.availability.replace('_', ' ')], ['Club', player.clubName], ['Competition', LEAGUES.find(league => league.value === player.league)?.label ?? player.league ?? '—']].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-ink-100 pb-2.5"><span className="text-xs text-ink-500">{label}</span><span className="text-right text-xs font-bold capitalize">{value}</span></div>)}</div></Card>
            <Card className="p-5"><h3 className="text-sm font-extrabold">Data confidence</h3><p className="mt-1 text-xs text-ink-500">A number is more useful when clubs can see how much evidence supports it.</p><ProgressBar className="mt-4" value={player.confidence.score} tone={player.confidence.score >= 65 ? 'trust' : 'gold'} showLabel /><div className="mt-3 space-y-2">{player.confidence.factors.map(factor => <div key={factor.label} className="flex items-center justify-between text-xs"><span className="text-ink-600">{factor.label}</span><span className="font-bold">{factor.detail}</span></div>)}</div></Card>
            <Card className="overflow-hidden"><div className="relative aspect-[16/9] bg-ink-900"><img src="/images/academy-training.jpg" alt="Football training" className="h-full w-full object-cover opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 to-transparent" /><div className="absolute bottom-0 p-4 text-white"><p className="text-xs font-bold">Video-first CV</p><p className="mt-1 text-2xs text-white/70">Clubs can review highlights, full matches and media provenance.</p></div></div><div className="p-4"><Link to="/register"><Button fullWidth iconRight="arrow-right">Create an account to shortlist</Button></Link></div></Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
