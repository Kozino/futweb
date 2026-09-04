import { supabase } from '@/lib/supabase'

export interface PaymentRow {
  id: string
  tx_ref: string
  plan_code: string
  amount: number
  currency: string
  status: string
  channel: string | null
  created_at: string
  settled_at: string | null
}

export interface SubscriptionRow {
  id: string
  subscriber: string
  plan_code: string
  status: string
  interval: string
  current_period_end: string | null
  current_period_start: string | null
  cancel_at_period_end: boolean
  created_at: string
}

export async function getMyPayments(subscriberId: string): Promise<PaymentRow[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('subscriber', subscriberId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PaymentRow[]
}

export async function getMySubscription(subscriberId: string): Promise<SubscriptionRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('subscriber', subscriberId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as SubscriptionRow | null
}
