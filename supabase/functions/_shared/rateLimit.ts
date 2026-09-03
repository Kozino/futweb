import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date()
  const { data: existing } = await admin
    .from('rate_limits').select('*').eq('key', key).maybeSingle()

  if (!existing) {
    await admin.from('rate_limits').insert({ key, count: 1, window_start: now.toISOString() })
    return { ok: true, remaining: limit - 1 }
  }

  const windowStart = new Date(existing.window_start)
  const elapsed = (now.getTime() - windowStart.getTime()) / 1000

  if (elapsed > windowSeconds) {
    await admin.from('rate_limits')
      .update({ count: 1, window_start: now.toISOString() }).eq('key', key)
    return { ok: true, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0 }
  }

  await admin.from('rate_limits')
    .update({ count: existing.count + 1 }).eq('key', key)
  return { ok: true, remaining: limit - existing.count - 1 }
}
