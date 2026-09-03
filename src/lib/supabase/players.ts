```ts
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

export async function getMyPlayer(userId: string): Promise<PlayerProfileRow | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return data as PlayerProfileRow | null
}

export async function getPlayerById(
  playerId: string,
): Promise<PlayerProfileRow | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle()

  if (error) throw error

  return data as PlayerProfileRow | null
}

export async function getPlayerBySlug(
  slug: string,
): Promise<PlayerProfileRow | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error

  return data as PlayerProfileRow | null
}

export interface UpdateMyPlayerProfileInput {
  first_name: string
  last_name: string
  dob: string
  nationality: string
  state_of_origin?: string | null
  position_primary: string
  position_secondary?: string[]
  foot: 'left' | 'right' | 'both'
  height_cm?: number | null
  weight_kg?: number | null
  bio?: string | null
  availability:
    | 'available'
    | 'trial_only'
    | 'under_contract'
    | 'not_looking'
  visibility: 'public' | 'verified_only' | 'private'
}

export async function updateMyPlayerProfile(
  userId: string,
  input: UpdateMyPlayerProfileInput,
): Promise<PlayerProfileRow> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('players')
    .update({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      dob: input.dob,
      nationality: input.nationality,
      state_of_origin: input.state_of_origin || null,
      position_primary: input.position_primary,
      position_secondary: input.position_secondary ?? [],
      foot: input.foot,
      height_cm: input.height_cm ?? null,
      weight_kg: input.weight_kg ?? null,
      bio: input.bio?.trim() || null,
      availability: input.availability,
      visibility: input.visibility,
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error

  return data as PlayerProfileRow
}

export interface CompletePlayerOnboardingInput {
  first_name: string
  last_name: string
  dob: string
  nationality?: string
  state_of_origin?: string | null
  position_primary: string
  position_secondary?: string[]
  foot?: 'left' | 'right' | 'both'
  height_cm?: number | null
  weight_kg?: number | null
}

export async function completePlayerOnboarding(
  input: CompletePlayerOnboardingInput,
): Promise<PlayerProfileRow> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.rpc(
    'complete_player_onboarding',
    {
      p_first_name: input.first_name.trim(),
      p_last_name: input.last_name.trim(),
      p_dob: input.dob,
      p_nationality: input.nationality ?? 'Nigeria',
      p_state_of_origin: input.state_of_origin ?? null,
      p_position_primary: input.position_primary,
      p_position_secondary: input.position_secondary ?? [],
      p_foot: input.foot ?? 'right',
      p_height_cm: input.height_cm ?? null,
      p_weight_kg: input.weight_kg ?? null,
    },
  )

  if (error) throw error

  return data as PlayerProfileRow
}
```
