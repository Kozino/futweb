import { supabase } from '@/lib/supabase'
import type {
  PlayerAttributes,
  MatchStats,
} from '@/types'
import { ageFrom,
  computeConfidence,
  computeFutWebScore,
  type FutWebScore,
  type ConfidenceBreakdown,
} from '@/lib/ratings'

/**
 * Club-workspace enrichment.
 *
 * The club screens (Squad, Discovery, Shortlists, Dashboard, PlayerDetail,
 * Reports) all consume one "enriched player" object that the demo mode built
 * via `enrichPlayer(DEMO_PLAYERS)`. This module rebuilds that exact shape from
 * the real Supabase tables so the pages can stop using demo data.
 */

export interface WorkspaceMedia {
  id: string
  player_id: string
  kind: 'highlight' | 'full_match' | 'photo'
  storage_path: string
  title: string
  recorded_at: string | null
  recorded_location: string | null
  verified: boolean
  uploaded_at: string
  url?: string
}

export interface EnrichedPlayer {
  id: string
  user_id: string
  first_name: string
  last_name: string
  dob: string
  age: number
  nationality: string
  state_of_origin: string | null
  position_primary: string
  position_secondary: string[]
  foot: string
  height_cm: number
  weight_kg: number
  availability: string
  visibility: string
  is_minor: boolean
  guardian_name: string | null
  clubName: string | null
  club_id: string | null
  score: FutWebScore
  confidence: ConfidenceBreakdown
  attributes: PlayerAttributes
  matchStats: MatchStats
  media: WorkspaceMedia[]
  career: Array<{ id: string; club_name: string; season: string; appearances: number; goals: number; verified: boolean }>
  ratingSnapshots: Array<{ id: string; recorded_at: string; futweb_score: number; rated_by: string }>
}

const ATTR_KEYS: (keyof PlayerAttributes)[] = [
  'finishing', 'passing', 'dribbling', 'first_touch', 'crossing', 'technique', 'heading',
  'acceleration', 'sprint_speed', 'agility', 'stamina', 'strength', 'jumping', 'balance',
  'vision', 'positioning', 'decision_making', 'work_rate', 'composure', 'aggression', 'leadership',
  'marking', 'tackling', 'interceptions', 'aerial_duels',
  'reflexes', 'handling', 'gk_distribution', 'shot_stopping',
]

function zeroStats(): MatchStats {
  return {
    appearances: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shots_on_target: 0,
    pass_attempts: 0, passes_completed: 0, duels: 0, duels_won: 0, tackles: 0,
    interceptions: 0, fouls_committed: 0, yellow_cards: 0, red_cards: 0,
    clean_sheets: 0, goals_conceded: 0, saves: 0,
  }
}

function attrsFromRecord(record: Record<string, unknown> | null | undefined): PlayerAttributes {
  const attrs = {} as PlayerAttributes
  for (const k of ATTR_KEYS) {
    const v = record?.[k]
    attrs[k] = typeof v === 'number' ? v : 0
  }
  return attrs
}

function sumStats(list: Array<Partial<Record<string, unknown>>>): MatchStats {
  const out = zeroStats()
  for (const s of list) {
    for (const key of Object.keys(out) as (keyof MatchStats)[]) {
      const v = s[key]
      if (typeof v === 'number') (out[key] as number) += v
    }
  }
  return out
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

/**
 * Enrich a set of players given only their base `players` rows (plus their
 * related rows and a name lookup for the managed club).
 */
export async function enrichPlayers(
  playerRows: Array<{
    id: string
    user_id: string
    first_name: string
    last_name: string
    dob: string
    nationality: string
    state_of_origin: string | null
    position_primary: string
    position_secondary: string[]
    foot?: string | null
    height_cm?: number | null
    weight_kg?: number | null
    availability: string
    visibility: string
    is_minor?: boolean
    guardian_name?: string | null
    managed_by_club_id?: string | null
  }>,
): Promise<EnrichedPlayer[]> {
  if (!playerRows.length) return []
  const client = requireSupabase()
  const ids = playerRows.map(p => p.id)

  const [
    { data: attrs },
    { data: stats },
    { data: mediaRows },
    { data: careerRows },
    { data: snapshots },
  ] = await Promise.all([
    client.from('player_attributes').select('*').in('player_id', ids),
    client.from('match_stats').select('*').in('player_id', ids),
    client.from('media_assets').select('*').in('player_id', ids),
    client.from('career_entries').select('*').in('player_id', ids).order('season', { ascending: false }),
    client.from('rating_snapshots').select('*').in('player_id', ids).order('created_at', { ascending: false }),
  ])

  // Media signed URLs for anything of kind photo/video.
  const mediaWithUrl: WorkspaceMedia[] = []
  for (const a of (mediaRows ?? []) as WorkspaceMedia[]) {
    let row = a
    if (supabase) {
      const { data: signed } = await supabase.storage.from('media').createSignedUrl(a.storage_path, 60 * 60).catch(() => ({ data: null }))
      if (signed) row = { ...a, url: signed.signedUrl }
    }
    mediaWithUrl.push(row)
  }
  const mediaByPlayer = new Map<string, WorkspaceMedia[]>()
  for (const m of mediaWithUrl) {
    const arr = mediaByPlayer.get(m.player_id) ?? []
    arr.push(m)
    mediaByPlayer.set(m.player_id, arr)
  }

  const group = <T extends Record<string, unknown>>(rows: T[], key: string) => {
    const map = new Map<string, T[]>()
    for (const r of rows) {
      const k = String(r[key])
      const arr = map.get(k) ?? []
      arr.push(r)
      map.set(k, arr)
    }
    return map
  }

  const attrsByPlayer = group((attrs ?? []) as Record<string, unknown>[], 'player_id')
  const statsByPlayer = group((stats ?? []) as Record<string, unknown>[], 'player_id')
  const careerByPlayer = group((careerRows ?? []) as Record<string, unknown>[], 'player_id')
  const snapByPlayer = group((snapshots ?? []) as Record<string, unknown>[], 'player_id')

  // Club names for managed players.
  const clubIds = [...new Set(playerRows.map(p => p.managed_by_club_id).filter(Boolean))] as string[]
  const clubName = new Map<string, string>()
  if (clubIds.length) {
    const { data: clubs } = await client.from('clubs').select('id, name').in('id', clubIds)
    ;(clubs ?? []).forEach((c: { id: string; name: string }) => clubName.set(c.id, c.name))
  }

  // Rater names for snapshot display.
  const raterIds = [...new Set((snapshots ?? []).map(s => s.rated_by as string).filter(Boolean))] as string[]
  const raterName = new Map<string, string>()
  if (raterIds.length) {
    const { data: profs } = await client.from('profiles').select('id, full_name').in('id', raterIds)
    ;(profs ?? []).forEach((p: { id: string; full_name: string }) => raterName.set(p.id, p.full_name))
  }

  const out: EnrichedPlayer[] = []

  for (const p of playerRows) {
    const age = ageFrom(p.dob)
    const attrRows = attrsByPlayer.get(p.id) ?? []
    const latestAttrsRow = attrRows[0]
    // Fall back to the newest snapshot's attributes if no dedicated row exists.
    const snapRows = snapByPlayer.get(p.id) ?? []
    const snapAttrs = (snapRows[0]?.attributes as Record<string, unknown> | undefined) ?? null
    const attributes = attrsFromRecord(latestAttrsRow ?? snapAttrs)

    const statsRows = statsByPlayer.get(p.id) ?? []
    const matchStats = sumStats(statsRows)

    const media = mediaByPlayer.get(p.id) ?? []
    const careerList = (careerByPlayer.get(p.id) ?? []).map(c => ({
      id: c.id as string,
      club_name: c.club_name as string,
      season: c.season as string,
      appearances: (c.appearances as number) ?? 0,
      goals: (c.goals as number) ?? 0,
      verified: Boolean(c.verified),
    }))

    const ratingSnapshots = snapRows.map(s => ({
      id: s.id as string,
      recorded_at: s.recorded_at as string,
      futweb_score: (s.futweb_score as number) ?? 0,
      rated_by: raterName.get(s.rated_by as string) ?? 'Coach',
    }))

    // Confidence signals (mirrors demo enrichPlayer).
    const independentRaters = new Set(snapRows.map(s => s.rated_by as string).filter(Boolean)).size
    const verifiedRaters = snapRows.filter(s =>
      ['coach', 'scout', 'analyst', 'academy'].includes(s.rated_by_role as string)).length
    const matchesObserved = snapRows.filter(s => s.context === 'match').length
    const confidence = computeConfidence({
      ratingCount: snapRows.length,
      independentRaters,
      verifiedRaters,
      matchesObserved,
      hasVideo: media.some(m => m.kind === 'highlight'),
      hasVerifiedStats: statsRows.some(s => s.verified),
    })

    const score = computeFutWebScore({
      attributes,
      position: p.position_primary,
      age,
      confidence: confidence.score,
    })

    out.push({
      id: p.id,
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      dob: p.dob,
      age,
      nationality: p.nationality,
      state_of_origin: p.state_of_origin ?? null,
      position_primary: p.position_primary,
      position_secondary: p.position_secondary ?? [],
      foot: p.foot ?? 'right',
      height_cm: p.height_cm ?? 0,
      weight_kg: p.weight_kg ?? 0,
      availability: p.availability,
      visibility: p.visibility,
      is_minor: Boolean(p.is_minor),
      guardian_name: p.guardian_name ?? null,
      clubName: p.managed_by_club_id ? (clubName.get(p.managed_by_club_id) ?? null) : null,
      club_id: p.managed_by_club_id ?? null,
      score,
      confidence,
      attributes,
      matchStats,
      media,
      career: careerList,
      ratingSnapshots,
    })
  }

  return out
}

/** Full squad of a club, enriched. */
export async function getClubSquad(clubId: string): Promise<EnrichedPlayer[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('players')
    .select('*')
    .eq('managed_by_club_id', clubId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return enrichPlayers((data ?? []) as never[])
}

/** Player visible to this club by id, enriched. */
export async function getPlayerDetail(playerId: string): Promise<EnrichedPlayer | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('players').select('*').eq('id', playerId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [enriched] = await enrichPlayers([data as never])
  return enriched ?? null
}

/** Discovery index: every player this club may view (RLS-gated), enriched. */
export async function getDiscoverablePlayers(): Promise<EnrichedPlayer[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('players')
    .select('*')
    .order('futweb_score', { ascending: false, nullsFirst: false })
    .limit(200)
  if (error) throw error
  return enrichPlayers((data ?? []) as never[])
}
