import { supabase } from '@/lib/supabase'

export interface PlayerProfileRow {
  id: string
  user_id: string
  managed_by_club_id: string | null
  slug: string
  /** Public CV headshot. The player row is RLS-protected with the CV itself. */
  avatar_url: string | null
  first_name: string
  last_name: string
  dob: string
  nationality: string
  state_of_origin: string | null
  position_primary: string
  position_secondary: string[]
  foot: 'left' | 'right' | 'both'
  height_cm: number | null
  weight_kg: number | null
  bio: string | null
  availability: 'available' | 'trial_only' | 'under_contract' | 'not_looking'
  visibility: 'public' | 'verified_only' | 'private'
  contract_expiry: string | null
  futweb_score: number | null
  potential: number | null
  confidence: number | null
  is_minor: boolean
  guardian_name: string | null
  guardian_phone: string | null
  guardian_email: string | null
  guardian_consent_at: string | null
  created_at: string
  updated_at: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

/** The avatars bucket has the same 2 MB limit; validate before transferring. */
export const PLAYER_PHOTO_MAX_BYTES = 2 * 1024 * 1024

const PLAYER_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

/**
 * Upload the single headshot used across a player's CV.
 *
 * The object lives under the authenticated user's folder in the existing
 * public `avatars` bucket. The database trigger in migration 0022 mirrors the
 * URL from profiles.avatar_url to players.avatar_url, so club/admin reads are
 * still governed by the existing player RLS policy.
 */
export async function uploadPlayerCvPhoto(
  userId: string,
  file: File,
): Promise<PlayerProfileRow> {
  const client = requireSupabase()

  if (!PLAYER_PHOTO_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG or WebP image for your profile photo.')
  }

  if (file.size <= 0) {
    throw new Error('Choose an image file to upload.')
  }

  if (file.size > PLAYER_PHOTO_MAX_BYTES) {
    throw new Error('Profile photos must be 2 MB or smaller.')
  }

  // A stable filename keeps one current CV photo per player. The version query
  // string below lets browsers immediately show a replacement despite CDN cache.
  const storagePath = `${userId}/player-cv`

  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(storagePath, file, {
      cacheControl: '31536000',
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) throw uploadError

  const { data: publicUrlData } = client.storage
    .from('avatars')
    .getPublicUrl(storagePath)

  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

  // The profile trigger performs the player-row sync and server-side active
  // subscription check atomically with this update.
  const { error: profileError } = await client
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)

  if (profileError) throw profileError

  const { data, error } = await client
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw error

  return data as PlayerProfileRow
}

export async function getMyPlayer(userId: string) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as PlayerProfileRow | null
}

export async function getPlayerById(playerId: string) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle()

  if (error) throw error
  return data as PlayerProfileRow | null
}

export async function getPlayerBySlug(slug: string) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('players')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data as PlayerProfileRow | null
}

export interface UpdateMyPlayerProfileInput {
  first_name?: string
  last_name?: string
  dob?: string
  nationality?: string
  state_of_origin?: string | null
  position_primary?: string
  position_secondary?: string[]
  foot?: 'left' | 'right' | 'both'
  height_cm?: number | null
  weight_kg?: number | null
  bio?: string | null
  availability?: 'available' | 'trial_only' | 'under_contract' | 'not_looking'
  visibility?: 'public' | 'verified_only' | 'private'
  contract_expiry?: string | null
}

export async function updateMyPlayerProfile(
  userId: string,
  input: UpdateMyPlayerProfileInput,
) {
  const client = requireSupabase()

  const allowed = {
    first_name: input.first_name,
    last_name: input.last_name,
    dob: input.dob,
    nationality: input.nationality,
    state_of_origin: input.state_of_origin,
    position_primary: input.position_primary,
    position_secondary: input.position_secondary,
    foot: input.foot,
    height_cm: input.height_cm,
    weight_kg: input.weight_kg,
    bio: input.bio,
    availability: input.availability,
    visibility: input.visibility,
   contract_expiry:
  input.contract_expiry === '' ? null : input.contract_expiry,
  }

  const update = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined),
  )

  if (Object.keys(update).length === 0) {
    const existing = await getMyPlayer(userId)

    if (!existing) {
      throw new Error('Player profile not found.')
    }

    return existing
  }

  const { data, error } = await client
    .from('players')
    .update(update)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data as PlayerProfileRow
}

export interface CompletePlayerOnboardingInput {
  firstName: string
  lastName: string
  dob: string
  positionPrimary: string
  positionSecondary?: string[]
  foot?: 'left' | 'right' | 'both'
  heightCm?: number | null
  weightKg?: number | null
  nationality?: string
  stateOfOrigin?: string | null
  bio?: string | null
  guardianName?: string | null
  guardianPhone?: string | null
  guardianEmail?: string | null
  guardianConsent?: boolean
}

export async function completePlayerOnboarding(
  input: CompletePlayerOnboardingInput,
) {
  const client = requireSupabase()

  const { data, error } = await client.rpc(
    'complete_player_onboarding',
    {
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_dob: input.dob,
      p_position_primary: input.positionPrimary,
      p_position_secondary: input.positionSecondary ?? [],
      p_foot: input.foot ?? 'right',
      p_height_cm: input.heightCm ?? null,
      p_weight_kg: input.weightKg ?? null,
      p_nationality: input.nationality ?? 'Nigeria',
      p_state_of_origin: input.stateOfOrigin ?? null,
      p_bio: input.bio ?? null,
      p_guardian_name: input.guardianName ?? null,
      p_guardian_phone: input.guardianPhone ?? null,
      p_guardian_email: input.guardianEmail ?? null,
    p_guardian_consent_at: input.guardianConsent ? new Date().toISOString() : null,
    },
  )

  if (error) throw error

  return data as PlayerProfileRow
}
