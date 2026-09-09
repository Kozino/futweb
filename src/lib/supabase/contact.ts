import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export type ContactTopic = 'sales' | 'player' | 'trust' | 'press' | 'other'
export type ContactStatus = 'new' | 'read' | 'replied' | 'archived'

export interface ContactMessageInput {
  fullName: string
  email: string
  topic: ContactTopic
  organisation?: string
  message: string
}

export interface ContactMessageRow {
  id: string
  full_name: string
  email: string
  topic: ContactTopic
  organisation: string | null
  message: string
  status: ContactStatus
  created_at: string
}

/** Submits the public /contact form. Anyone can call this, signed in or not. */
export async function submitContactMessage(input: ContactMessageInput): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('contact_messages').insert({
    full_name: input.fullName,
    email: input.email,
    topic: input.topic,
    organisation: input.organisation || null,
    message: input.message,
  })
  if (error) throw error
}

/** Admin-only: list all contact submissions, newest first. */
export async function listContactMessages(): Promise<ContactMessageRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContactMessageRow[]
}

/** Admin-only: update a submission's status (new / read / replied / archived). */
export async function setContactMessageStatus(id: string, status: ContactStatus): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('contact_messages').update({ status }).eq('id', id)
  if (error) throw error
}
