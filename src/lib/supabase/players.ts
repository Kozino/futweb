import { supabase } from '@/lib/supabase'

export interface PlayerProfileRow {
  id: string
  user_id: string
  managed_by_club_id: string | null
  slug: string
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
      p_guardian_consent: input.guardianConsent ?? false,
    },
  )

  if (error) throw error

  return data as PlayerProfileRow
}
