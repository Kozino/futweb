import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface FederationTreeRow {
  parent_id: string
  parent_name: string
  academy_id: string
  academy_name: string
  academy_state: string | null
  academy_verified: boolean
  player_count: number
  linked_at: string
}

export interface ApiKeyAdminRow {
  key_id: string
  club_name: string
  key_name: string
  key_prefix: string
  scope: string[]
  created_by: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface WebhookHealthRow {
  club_name: string
  endpoint_url: string
  event: string
  status: string
  attempts: number
  last_error: string | null
  response_status: number | null
  created_at: string
}

export interface PlatformMonitor {
  clubs_total: number
  clubs_federation: number
  api_keys_active: number
  webhook_endpoints: number
  deliveries_pending: number
  deliveries_failed: number
  deliveries_dead: number
  enterprise_new: number
}

export async function getFederationTree(): Promise<FederationTreeRow[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_federation_tree')
  if (error) throw error
  return (data ?? []) as FederationTreeRow[]
}

export async function getAdminApiKeys(): Promise<ApiKeyAdminRow[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_api_keys_view')
  if (error) throw error
  return (data ?? []) as ApiKeyAdminRow[]
}

export async function getWebhookHealth(limit = 40): Promise<WebhookHealthRow[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_webhook_health', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as WebhookHealthRow[]
}

export interface AtRiskClub {
  club_id: string
  club_name: string
  owner_sub_status: string
  open_verified_trials: number
  academy_links: number
  active_api_keys: number
  active_webhooks: number
}

export async function getPlatformMonitor(): Promise<PlatformMonitor> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_platform_monitor')
  if (error) throw error
  return (data?.[0] ?? {}) as PlatformMonitor
}

export async function getAtRiskClubs(): Promise<AtRiskClub[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_at_risk_clubs')
  if (error) throw error
  return (data ?? []) as AtRiskClub[]
}

