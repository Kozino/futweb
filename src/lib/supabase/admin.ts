import { supabase } from '@/lib/supabase'

export type SuspendTargetType = 'profile' | 'club'

export interface AdminProfileRow {
  id: string
  full_name: string
  email: string
  role: string
  account_type: string
  verification_tier: string
  verification_status: string
  trust_score: number | null
  suspended_at: string | null
  suspended_reason: string | null
  sub_status: string
  plan_code: string | null
  phone: string | null
  country: string | null
  created_at: string
  last_seen_at: string | null
  disputes_upheld: number
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }
  return supabase
}

/** Fetch the account (profiles row) behind a player or club owner id. */
export async function fetchProfile(userId: string): Promise<AdminProfileRow | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as AdminProfileRow | null
}

export async function adminSuspendAccount(
  targetType: SuspendTargetType,
  targetId: string,
  reason: string,
) {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_set_suspension', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_suspended: true,
    p_reason: reason || null,
  })
  if (error) throw error
}

export async function adminReinstateAccount(
  targetType: SuspendTargetType,
  targetId: string,
) {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_set_suspension', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_suspended: false,
    p_reason: null,
  })
  if (error) throw error
}

/** Verify a person/player account to the given tier. */
export async function adminVerifyProfile(userId: string, tier: 'identity' | 'entity' | 'gold') {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_verify_profile', {
    p_user_id: userId,
    p_tier: tier,
  })
  if (error) throw error
}

/** Verify a club as a real entity (CAC + NFF/state FA). */
export async function adminVerifyClub(clubId: string) {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_verify_club', { p_club_id: clubId })
  if (error) throw error
}

/** Send an in-app platform message (admin -> user). */
export async function adminSendMessage(
  toUserId: string,
  title: string,
  body?: string,
  link?: string,
) {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_send_notification', {
    p_to_user: toUserId,
    p_title: title,
    p_body: body || null,
    p_link: link || null,
  })
  if (error) throw error
}
