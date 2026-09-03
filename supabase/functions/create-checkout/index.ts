/**
 * FutWeb — Create Flutterwave checkout
 * ====================================
 * Deploy:  supabase functions deploy create-checkout
 * Env:     SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *          FLW_SECRET_KEY, FLW_PUBLIC_KEY, APP_URL
 *
 * Why this is a server function and not a client call:
 *   * The Flutterwave SECRET key must never reach a browser.
 *   * Prices are resolved from the `plans` table, not from the request, so a
 *     tampered client cannot set its own amount.
 *   * The user is derived from the verified JWT, never from the body.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { json, corsHeaders } from '../_shared/cors.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FLW_SECRET = Deno.env.get('FLW_SECRET_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://futweb.app'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Our own tx_ref: deterministic-ish, unguessable, and validated by the webhook. */
function makeTxRef(userId: string): string {
  const rand = crypto.getRandomValues(new Uint8Array(5))
  const suffix = Array.from(rand).map(b => b.toString(36).toUpperCase().padStart(2, '0')).join('').slice(0, 6)
  return `FW-${suffix}-${Date.now()}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  /* ---- 1. Authenticate from the JWT (never from the body) ---- */
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  /* ---- 2. Rate limit per user and per IP ---- */
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const [byUser, byIp] = await Promise.all([
    rateLimit(`checkout:u:${user.id}`, 10, 3600),
    rateLimit(`checkout:i:${ip}`, 30, 3600),
  ])
  if (!byUser.ok || !byIp.ok) {
    return json({ error: 'Too many attempts. Try again shortly.' }, 429)
  }

  /* ---- 3. Validate input ---- */
  let body: { plan_code?: string; interval?: string; currency?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const planCode = String(body.plan_code ?? '')
  const interval = body.interval === 'annual' ? 'annual' : 'monthly'
  if (!/^[a-z_]{3,40}$/.test(planCode)) return json({ error: 'Invalid plan' }, 400)

  /* ---- 4. Resolve the plan SERVER-SIDE (price is never client-supplied) ---- */
  const { data: plan, error: planErr } = await admin
    .from('plans').select('*').eq('code', planCode).eq('active', true).maybeSingle()
  if (planErr || !plan) return json({ error: 'Plan not found' }, 404)

  // Audience check: a player cannot buy a club plan and vice versa.
  const { data: profile } = await admin
    .from('profiles').select('account_type, email, full_name, sub_status')
    .eq('id', user.id).maybeSingle()
  if (!profile) return json({ error: 'Profile not found' }, 404)
  if (plan.audience !== 'both' && plan.audience !== profile.account_type) {
    return json({ error: 'This plan is not available for your account type' }, 400)
  }

  // Currency is a display/payment-rail choice only — never trusted for price.
  // Whichever currency the client picks, the amount is still resolved
  // exclusively from the server-side `plans` row immediately below.
  const requestedCurrency = String(body.currency ?? 'NGN').toUpperCase()
  const currency = requestedCurrency === 'USD' ? 'USD' : 'NGN'
  const months = interval === 'annual' ? 10 : 1   // annual bills 10 months (2 free)
  const amount = (currency === 'NGN' ? plan.price_ngn : plan.price_usd) * months
  if (amount <= 0) return json({ error: 'This plan is free — no checkout required' }, 400)

  /* ---- 5. Create the pending payment row (idempotency anchor) ---- */
  const txRef = makeTxRef(user.id)
  const { error: payErr } = await admin.from('payments').insert({
    tx_ref: txRef,
    subscriber: user.id,
    plan_code: plan.code,
    amount,
    currency,
    status: 'pending',
  })
  if (payErr) return json({ error: 'Could not initialise payment' }, 500)

  /* ---- 6. Initialise the Flutterwave transaction ---- */
  const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: `${APP_URL}/billing?status=successful&tx_ref=${txRef}`,
      payment_options: 'card,banktransfer,ussd,account,mobilemoney',
      customer: {
        email: profile.email,
        name: profile.full_name,
      },
      customizations: {
        title: 'FutWeb',
        description: `${plan.name} — ${interval === 'annual' ? 'annual' : 'monthly'} subscription`,
        logo: `${APP_URL}/logo.png`,
      },
      meta: {
        // Metadata only. The webhook never trusts this; it resolves the
        // subscriber from the payments row keyed on tx_ref.
        user_id: user.id,
        plan_code: plan.code,
        interval,
      },
    }),
  })

  const flw = await flwRes.json()
  if (!flwRes.ok || flw.status !== 'success') {
    await admin.from('payments').update({ status: 'failed', raw: flw, settled_at: new Date().toISOString() })
      .eq('tx_ref', txRef).eq('status', 'pending')
    console.error('Flutterwave init failed', flw)
    return json({ error: 'Payment provider unavailable. Please try again.' }, 502)
  }

  await admin.from('audit_log').insert({
    actor_id: user.id, actor_role: 'authenticated',
    action: 'checkout.created', entity_type: 'payment',
    metadata: { tx_ref: txRef, plan: plan.code, amount, currency, interval },
  })

  return json({
    tx_ref: txRef,
    amount,
    currency,
    plan: plan.code,
    payment_link: flw.data.link,
  })
})
