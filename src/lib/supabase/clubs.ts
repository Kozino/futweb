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
  address: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
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

/** The club-assets bucket has the same 2 MB limit; validate before transferring. */
export const CLUB_LOGO_MAX_BYTES = 2 * 1024 * 1024

const CLUB_LOGO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

/**
 * Upload the crest/logo shown on a club's public profile and in club search
 * results. The object lives under the club's own folder in the public
 * `club-assets` bucket (see migration 0025) so it can be read by anyone —
 * including signed-out visitors browsing /clubs — while only the club owner
 * can write to it.
 */
export async function uploadClubLogo(
  clubId: string,
  file: File,
): Promise<ClubRow> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  if (!CLUB_LOGO_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG or WebP image for your club logo.')
  }

  if (file.size <= 0) {
    throw new Error('Choose an image file to upload.')
  }

  if (file.size > CLUB_LOGO_MAX_BYTES) {
    throw new Error('Club logos must be 2 MB or smaller.')
  }

  // A stable filename keeps one current logo per club. The version query
  // string lets browsers immediately show a replacement despite CDN cache.
  const storagePath = `${clubId}/logo`

  const { error: uploadError } = await supabase.storage
    .from('club-assets')
    .upload(storagePath, file, {
      cacheControl: '31536000',
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) throw uploadError

  const { data: publicUrlData } = supabase.storage
    .from('club-assets')
    .getPublicUrl(storagePath)

  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

  const { data, error } = await supabase
    .from('clubs')
    .update({ logo_url: logoUrl })
    .eq('id', clubId)
    .select('*')
    .single()

  if (error) throw error

  return data as ClubRow
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
