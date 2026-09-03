import { supabase } from '@/lib/supabase'

export interface ClubRow {
  id: string
  owner_id: string
  slug: string
  name: string
  short_name: string | null
  country: string
  state_region: string | null
  city: string | null
  league_code: string | null
  stadium: string | null
  founded_year: number | null
  logo_url: string | null
  website: string | null
  cac_number: string | null
  nff_affiliation: string | null
  entity_verified: boolean
  entity_verified_at: string | null
  player_seats_used: number
  staff_seats_used: number
  created_at: string
  updated_at: string
}

export interface ClubMembership {
  id: string
  club_id: string
  user_id: string
  role: 'club_admin' | 'club_staff' | 'scout'
  invited_by: string | null
  invited_at: string
  accepted_at: string | null
  revoked_at: string | null
}

export async function getMyClub(userId: string): Promise<ClubRow | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  // Owner is the primary relationship for the club account.
  const { data: ownedClub, error: ownerError } = await supabase
    .from('clubs')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownerError) throw ownerError
  if (ownedClub) return ownedClub as ClubRow

  // Staff/scout accounts are connected through org_members.
  const { data: membership, error: membershipError } = await supabase
    .from('org_members')
    .select('club_id, role, accepted_at, revoked_at')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership) return null

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', membership.club_id)
    .single()

  if (clubError) throw clubError

  return club as ClubRow
}

export async function getClubById(clubId: string): Promise<ClubRow | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', clubId)
    .maybeSingle()

  if (error) throw error

  return data as ClubRow | null
}

export async function getMyClubMembership(
  userId: string,
): Promise<ClubMembership | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('org_members')
    .select('*')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as ClubMembership | null
}

export async function updateMyClubProfile(
  clubId: string,
  input: {
    name: string
    short_name?: string | null
    country: string
    state_region?: string | null
    city?: string | null
    league_code?: string | null
    stadium?: string | null
    founded_year?: number | null
    website?: string | null
  },
): Promise<ClubRow> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('clubs')
    .update({
      name: input.name.trim(),
      short_name: input.short_name?.trim() || null,
      country: input.country,
      state_region: input.state_region ?? null,
      city: input.city ?? null,
      league_code: input.league_code ?? null,
      stadium: input.stadium ?? null,
      founded_year: input.founded_year ?? null,
      website: input.website ?? null,
    })
    .eq('id', clubId)
    .select('*')
    .single()

  if (error) throw error

  return data as ClubRow
}

