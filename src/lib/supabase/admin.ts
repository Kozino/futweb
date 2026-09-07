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

/* ------------------------------------------------------------------ *
 * Trial publication review — closes the "pending trial never goes live"
 * dead-end. See migration 0011_trial_review_pipeline.sql.
 * ------------------------------------------------------------------ */

/** Moderator approves a pending trial posting (manual override). */
export async function adminVerifyTrial(trialId: string, note?: string) {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_verify_trial', {
    p_trial_id: trialId,
    p_note: note || null,
  })
  if (error) throw error
}

/** Moderator rejects a pending trial posting, telling the club why. */
export async function adminRejectTrial(trialId: string, reason?: string) {
  const client = requireSupabase()
  const { error } = await client.rpc('admin_reject_trial', {
    p_trial_id: trialId,
    p_reason: reason || null,
  })
  if (error) throw error
}

/** A pending posting the platform is waiting on a moderator decision for. */
export interface TrialReviewRow {
  id: string
  club_id: string
  club_name: string
  title: string
  positions: string[]
  location: string
  trial_date: string
  description: string
  age_min: number
  age_max: number
  applicant_count: number
  created_at: string
}

/**
 * Fetch postings stuck in 'pending_verification' for moderator review, with the
 * owning club name and how many players have already applied (0, since pending
 * postings are not visible — kept for completeness).
 */
export async function getTrialReviewQueue(): Promise<TrialReviewRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('trial_postings')
    .select('*')
    .eq('status', 'pending_verification')
    .eq('verified', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = data ?? []
  if (!rows.length) return []

  const clubIds = [...new Set(rows.map(r => r.club_id as string))]
  const clubRes = await client.from('clubs').select('id, name').in('id', clubIds)
  const clubById = Object.fromEntries(
    (clubRes.data ?? []).map(c => [c.id, (c as { name: string }).name]),
  )

  const trialIds = rows.map(r => r.id as string)
  const appsRes = await client
    .from('trial_applications')
    .select('trial_id')
    .in('trial_id', trialIds)
  const countByTrial: Record<string, number> = {}
  for (const a of appsRes.data ?? []) {
    const tid = (a as { trial_id: string }).trial_id
    countByTrial[tid] = (countByTrial[tid] ?? 0) + 1
  }

  return rows.map(r => ({
    id: r.id as string,
    club_id: r.club_id as string,
    club_name: clubById[r.club_id as string] ?? 'Unknown club',
    title: r.title as string,
    positions: (r.positions as string[]) ?? [],
    location: r.location as string,
    trial_date: r.trial_date as string,
    description: r.description as string,
    age_min: r.age_min as number,
    age_max: r.age_max as number,
    applicant_count: countByTrial[r.id as string] ?? 0,
    created_at: r.created_at as string,
  }))
}
