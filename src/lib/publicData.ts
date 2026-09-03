import { supabase, hasSupabase } from '@/lib/supabase'

export interface PublicPlayerRow {
  // Note: exact date of birth is intentionally not exposed by the public
  // directory view — only the derived `age`. See supabase/migrations/0005.
  id: string; slug: string; first_name: string; last_name: string; age: number
  nationality: string; state_of_origin?: string; position_primary: string; position_secondary: string[]
  foot: 'left' | 'right' | 'both'; height_cm: number; weight_kg: number; bio?: string
  availability: 'available' | 'trial_only' | 'under_contract' | 'not_looking'
  futweb_score?: number; potential?: number; confidence?: number; visibility: 'public' | 'verified_only' | 'private'
  is_minor: boolean; managed_by_club_id?: string; avatar_url?: string
  club_id?: string; club_name?: string; club_short_name?: string; club_city?: string; club_state?: string
  club_league?: string; club_logo_url?: string; club_entity_verified?: boolean
}

export interface PublicClubRow {
  id: string; slug: string; name: string; short_name: string; country: string; state_region?: string
  city?: string; league_code?: string; stadium?: string; founded_year?: number; logo_url?: string
  entity_verified: boolean; entity_verified_at?: string; cac_number?: string; nff_affiliation?: string
}

export async function getPublicPlayers() {
  if (!hasSupabase || !supabase) return null
  const { data, error } = await supabase.from('public_player_profiles').select('*').order('futweb_score', { ascending: false })
  if (error) throw error
  return (data ?? []) as PublicPlayerRow[]
}

export async function getPublicClubs() {
  if (!hasSupabase || !supabase) return null
  const { data, error } = await supabase.from('public_clubs').select('*').order('name')
  if (error) throw error
  return (data ?? []) as PublicClubRow[]
}

export async function getPublicPlayer(slug: string) {
  if (!hasSupabase || !supabase) return null
  const { data: player, error } = await supabase.from('public_player_profiles').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  if (!player) return null
  const [career, stats, attributes] = await Promise.all([
    supabase.from('public_player_career').select('*').eq('player_id', player.id).order('season', { ascending: false }),
    supabase.from('public_player_stats').select('*').eq('player_id', player.id).order('season', { ascending: false }),
    supabase.from('public_player_attributes').select('*').eq('player_id', player.id).maybeSingle(),
  ])
  if (career.error) throw career.error
  if (stats.error) throw stats.error
  if (attributes.error) throw attributes.error
  return { player: player as PublicPlayerRow, career: career.data ?? [], stats: stats.data ?? [], attributes: attributes.data ?? null }
}
