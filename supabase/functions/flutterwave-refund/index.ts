/**
 * FutWeb — Flutterwave refund (money action for Admin → Subscriptions)
 * ======================================================================
 * Deploy:  supabase functions deploy flutterwave-refund
 * Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLW_SECRET_KEY, APP_URL
 *
 * JWT verification stays ON: this is called by an authenticated admin from the
 * browser. The function re-checks admin status from the verified JWT before
 * doing anything.
 *
 * Refunds money against a Flutterwave transaction id. Because this moves real
 * money it requires live Flutterwave API credentials, so it will only run once
 * you deploy + set FLW_SECRET_KEY. Until then the Admin UI shows refunds as
 * "needs the deployed refund function."
 *
 * This is deliberately a thin, audited wrapper: it records an audit row and
 * proxies to Flutterwave's /v3/transactions/:id/refund endpoint.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// CORS + JSON helpers inlined so this function is fully self-contained and can
// be deployed standalone (no relative import to ../_shared/cors.ts).
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-futweb-signature, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Auth from the JWT (the caller must be a site admin).
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return json({ error: 'unauthorized' }, 401)

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return json({ error: 'forbidden' }, 403)

  if (!FLW_SECRET_KEY) {
    return json({ error: 'Flutterwave refund function is not configured (missing FLW_SECRET_KEY).' }, 503)
  }

  let body: { tx_id?: string | number; subscriber?: string; reason?: string }
  try { body = await req.json() } catch { body = {} }
  const { tx_id, subscriber, reason } = body
  if (!tx_id) return json({ error: 'tx_id is required' }, 400)

  // Call Flutterwave.
  const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${tx_id}/refund`, {
    method: 'POST',
    headers: { authorization: `Bearer ${FLW_SECRET_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 0 }), // 0 => full refund
  })
  const flw = await flwRes.json().catch(() => ({}))
  const ok = flwRes.ok && flw?.status === 'success'

  // On success, mark the local payment row refunded (so we never double-refund)
  // by matching the Flutterwave tx id in payments.flw_id.
  if (ok) {
    await admin.from('payments').update({ status: 'refunded' })
      .eq('flw_id', String(tx_id))
  }

  // Audit regardless of outcome.
  await admin.from('audit_log').insert({
    actor_id: user.id, actor_role: 'admin',
    action: ok ? 'subscription.refunded' : 'subscription.refund_failed',
    entity_type: 'payment', entity_id: String(tx_id),
    metadata: { subscriber: subscriber ?? null, reason: reason ?? null, flw: flw?.data?.id ?? flw?.message ?? null },
  })

  if (!ok) {
    return json({ ok: false, error: flw?.message ?? 'refund failed', flw }, flwRes.ok ? 200 : 502)
  }
  return json({ ok: true, refund_id: flw?.data?.id, flw })
})
