import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface ConversationSummary {
  id: string
  player_id: string
  club_id: string
  club_name: string
  player_name: string
  other_name: string
  other_role: 'player' | 'club'
  last_message: string | null
  last_message_at: string
  unread: number
}

export interface Message {
  id: string
  sender_id: string
  sender_role: 'player' | 'club'
  body: string
  read_at: string | null
  created_at: string
}

/** Open (or return) a conversation between a player and an entity-verified club. */
export async function openConversation(playerId: string, clubId: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('open_conversation', {
    p_player_id: playerId,
    p_club_id: clubId,
  })
  if (error) throw error
  return data as string
}

export async function sendMessage(conversationId: string, body: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: body,
  })
  if (error) throw error
  return data as string
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })
  if (error) throw error
}

export async function getMyConversations(): Promise<ConversationSummary[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('my_conversations')
  if (error) throw error
  return (data as ConversationSummary[] | null) ?? []
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('conversation_messages', {
    p_conversation_id: conversationId,
  })
  if (error) throw error
  return (data as Message[] | null) ?? []
}

/** Best-known "other party" (non-self) display name from a summary. */
export function otherPartyDisplay(c: ConversationSummary): { name: string; role: 'player' | 'club' } {
  return { name: c.other_name, role: c.other_role }
}

/** Format an ISO timestamp into a compact local time / date string. */
export function messageTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
