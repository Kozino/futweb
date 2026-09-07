import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface ApiKeyRow {
  id: string
  club_id: string
  name: string
  key_prefix: string
  scope: string[]
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface WebhookEndpointRow {
  id: string
  club_id: string
  url: string
  secret: string | null
  events: string[]
  active: boolean
  created_at: string
}

export interface WebhookDeliveryRow {
  id: number
  endpoint_id: string
  event: string
  payload: unknown
  status: 'pending' | 'delivered' | 'failed' | 'dead'
  attempts: number
  last_error: string | null
  response_status: number | null
  created_at: string
}

export interface CustomRoleRow {
  id: string
  club_id: string
  name: string
  permissions: string[]
  created_at: string
}

export async function getMyApiKeys(): Promise<ApiKeyRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('api_keys').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ApiKeyRow[]
}

export async function createApiKey(name: string, scope: string[]): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_api_key', {
    p_name: name,
    p_scope: scope,
  })
  if (error) throw error
  return data as string
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('revoke_api_key', { p_key_id: keyId })
  if (error) throw error
}

export async function getMyWebhooks(): Promise<WebhookEndpointRow[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('webhook_endpoints').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WebhookEndpointRow[]
}

export async function registerWebhook(url: string, secret: string, events: string[]): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('register_webhook_endpoint', {
    p_url: url,
    p_secret: secret || null,
    p_events: events,
  })
  if (error) throw error
  return data as string
}

export async function removeWebhook(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('webhook_endpoints').delete().eq('id', id)
  if (error) throw error
}

export async function getWebhookDeliveries(): Promise<WebhookDeliveryRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as WebhookDeliveryRow[]
}

export async function getMyCustomRoles(): Promise<CustomRoleRow[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('club_custom_roles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CustomRoleRow[]
}

/** Named capabilities a custom role can grant (app-layer gating). */
export const PERMISSION_CATALOG: { key: string; label: string; desc: string }[] = [
  { key: 'manage_staff', label: 'Manage staff', desc: 'Add/remove staff and change roles.' },
  { key: 'manage_billing', label: 'Manage billing & plan', desc: 'View and change the club subscription.' },
  { key: 'manage_trials', label: 'Manage trials', desc: 'Post, edit and close trial postings.' },
  { key: 'view_audit', label: 'View audit log', desc: 'Read and export the club audit log.' },
  { key: 'view_reports', label: 'View scout reports', desc: 'Read internal scout reports.' },
  { key: 'scout_players', label: 'Scout / rate players', desc: 'Capture ratings and write reports.' },
  { key: 'manage_academies', label: 'Manage academies', desc: 'Link/unlink child academies (Federation).' },
]

export const WEBHOOK_EVENTS = [
  'trial.published',
  'trial.application',
  'player.rating_added',
  'scout_report.created',
  'subscription.changed',
]
