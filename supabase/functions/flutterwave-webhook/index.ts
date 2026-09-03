/**
 * FutWeb — Flutterwave payment webhook
 * =====================================
 * Deploy:  supabase functions deploy flutterwave-webhook --no-verify-jwt
 * Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLW_SECRET_HASH
 *
 * Security properties this handler must maintain:
 *
 *  1. SIGNATURE VERIFICATION. Flutterwave signs the raw request body with
 *     HMAC-SHA512 using the secret hash set in the dashboard. We recompute it
 *     and compare in constant time. Without this, anyone could POST
 *     "payment successful" and get a free subscription.
 *
 *  2. IDEMPOTENCY. Flutterwave retries until it sees a 2xx. We key everything
 *     on tx_ref and let the database reject illegal state transitions, so a
 *     replay can never double-activate or double-charge.
 *
 *  3. AMOUNT VERIFICATION. The amount on the webhook is checked against the
 *     plan price inside `activate_subscription`. A tampered client cannot buy
 *     a ₦300,000 plan for ₦3,500.
 *
 *  4. NO TRUST IN THE CLIENT. We never read a user id from the request body.
 *     The subscriber is resolved from the pending payment row we created.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { json, corsHeaders } from '../_shared/cors.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SECRET_HASH = Deno.env.get('FLW_SECRET_HASH')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/* ------------------------- constant-time compare ------------------------- */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifySignature(rawBody: string, provided: string | null): Promise<boolean> {
  if (!provided) return false
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SECRET_HASH),
    { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(computed, provided.toLowerCase())
}

/* --------------------------------- audit --------------------------------- */
async function audit(action: string, entityId: string | null, metadata: Record<string, unknown>) {
  await admin.from('audit_log').insert({
    actor_id: null, actor_role: 'system',
    action, entity_type: 'payment', entity_id: entityId, metadata,
  })
}

/* -------------------------------- handler -------------------------------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Rate limit per source IP — cheap protection against replay floods.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`flw:${ip}`, 60, 60)
  if (!rl.ok) {
    await audit('webhook.rate_limited', null, { ip })
    return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' })
  }

  // The signature covers the EXACT raw bytes. Read the body once, as text.
  const raw = await req.text()

  const provided =
    req.headers.get('verif-hash') ??
    req.headers.get('x-flutterwave-signature') ??
    req.headers.get('x-futweb-signature')

  if (!(await verifySignature(raw, provided))) {
    await audit('webhook.signature_invalid', null, { ip, hadHeader: Boolean(provided) })
    // 401 with no detail: do not tell an attacker why verification failed.
    return json({ error: 'Unauthorized' }, 401)
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const eventType = String(event.event ?? event['event.type'] ?? '')
  // Flutterwave sends either { event, data } or { "event.type", ... }
  const data = (event.data ?? event) as Record<string, unknown>

  if (!/charge\.completed|transfer\.completed/.test(eventType) && eventType !== '') {
    // Acknowledge anything we do not act on, so Flutterwave stops retrying.
    return json({ status: 'ignored', event: eventType })
  }

  const txRef = String(data.tx_ref ?? '')
  if (!txRef) return json({ error: 'Missing tx_ref' }, 400)

  const status = String(data.status ?? '').toLowerCase()
  const flwId = data.id != null ? String(data.id) : null
  const amount = Number(data.amount ?? 0)
  const currency = String(data.currency ?? 'NGN')
  const channel = String(data.payment_type ?? data.auth_model ?? 'unknown')

  // Only our own reference format ever gets processed.
  if (!/^FW-[A-Z0-9]{6,}-\d{6,}$/.test(txRef)) {
    await audit('webhook.unknown_tx_ref', null, { tx_ref: txRef })
    return json({ status: 'ignored' })
  }

  /* ---- success path ---- */
  if (status === 'successful') {
    const { data: sub, error } = await admin.rpc('activate_subscription', {
      p_tx_ref: txRef,
      p_flw_id: flwId,
      p_amount: Math.round(amount),
      p_currency: currency,
      p_channel: channel,
      p_raw: event,
    })

    if (error) {
      // Idempotency violation / amount mismatch / unknown plan.
      await audit('webhook.activation_rejected', null, { tx_ref: txRef, reason: error.message })
      // 200 so Flutterwave stops retrying a permanently invalid event.
      return json({ status: 'rejected', reason: 'activation_failed' })
    }

    await audit('webhook.payment_successful', typeof sub === 'string' ? sub : null, {
      tx_ref: txRef, amount, currency,
    })
    return json({ status: 'ok', subscription: sub })
  }

  /* ---- failure paths ---- */
  if (status === 'failed' || status === 'cancelled') {
    await admin
      .from('payments')
      .update({ status: status === 'failed' ? 'failed' : 'cancelled', raw: event, settled_at: new Date().toISOString() })
      .eq('tx_ref', txRef)
      .in('status', ['pending'])     // never resurrect a settled payment
    await audit('webhook.payment_failed', null, { tx_ref: txRef, status })
    return json({ status: 'recorded' })
  }

  return json({ status: 'ignored', payment_status: status })
})
