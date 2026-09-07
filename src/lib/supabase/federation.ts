import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface AcademyChild {
  id: string
  name: string
  short_name: string | null
  state_region: string | null
  player_count: number
  staff_count: number
  entity_verified: boolean
  linked_at: string
}

export interface AcademyPlayer {
  id: string
  first_name: string
  last_name: string
  position_primary: string
  age: number
  futweb_score: number | null
  visibility: string
}

export async function getFederationChildren(parentClubId: string): Promise<AcademyChild[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('federation_children', {
    p_parent_club_id: parentClubId,
  })
  if (error) throw error
  return (data as AcademyChild[] | null) ?? []
}

export async function linkAcademy(parentClubId: string, childClubId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('link_academy', {
    p_parent_club_id: parentClubId,
    p_child_club_id: childClubId,
  })
  if (error) throw error
}

export async function unlinkAcademy(parentClubId: string, childClubId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('unlink_academy', {
    p_parent_club_id: parentClubId,
    p_child_club_id: childClubId,
  })
  if (error) throw error
}

export async function getAcademySquad(childClubId: string): Promise<AcademyPlayer[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('federation_academy_squad', {
    p_child_club_id: childClubId,
  })
  if (error) throw error
  return (data as AcademyPlayer[] | null) ?? []
}

export interface EnterpriseRequestInput {
  organisation: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  needs?: string
  message?: string
}

export async function submitEnterpriseRequest(input: EnterpriseRequestInput): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('submit_enterprise_request', {
    p_organisation: input.organisation,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone || null,
    p_needs: input.needs || null,
    p_message: input.message || null,
  })
  if (error) throw error
  return data as string
}
