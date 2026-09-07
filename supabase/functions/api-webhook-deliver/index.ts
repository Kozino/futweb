/**
 * FutWeb — Webhook delivery worker (template)
 * ============================================
 * Deploy:  supabase functions deploy api-webhook-deliver
 * Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Schedule: run periodically (see README) e.g. every 60s:
 *     supabase functions deploy api-webhook-deliver --schedule "*/1 * * * *"
 *
 * Picks up 'pending' rows in webhook_deliveries whose next_attempt_at has
 * passed and POSTs them to the endpoint URL, HMAC-SHA256-signed with the
 * endpoint's secret (X-FutWeb-Signature: sha256=<hex>). Retries with backoff;
 * a delivery is marked 'dead' after too many attempts.
 *
 * This is scaffolding: wire the worker to an interval/schedule and add whatever
 * auth/rate you need for your Supabase plan.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BATCH = 25
const MAX_ATTEMPTS = 8
const BACKOFF_SECONDS = (attempts: number) => Math.min(3600, Math.pow(2, attempts))

async function deliver(row: any, endpoint: any) {
  const body = JSON.stringify({
    event: row.event,
    created_at: row.created_at,
    data: row.payload,
  })

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (endpoint.secret) {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(endpoint.secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
    headers['X-FutWeb-Signature'] = `sha256=${hex}`
  }

  const res = await fetch(endpoint.url, { method: 'POST', headers, body })
  return { ok: res.ok, status: res.status }
}

Deno.serve(async () => {
  const { data: rows, error } = await admin
    .from('webhook_deliveries')
    .select('id, endpoint_id, event, payload, created_at, attempts, status')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  const processed = rows ?? []

  let done = 0
  let failed = 0
  for (const row of processed) {
    const { data: endpoint } = await admin
      .from('webhook_endpoints').select('id, url, secret, active').eq('id', row.endpoint_id).maybeSingle()
    if (!endpoint || !endpoint.active) {
      await admin.from('webhook_deliveries').update({ status: 'dead', last_error: 'endpoint inactive' }).eq('id', row.id)
      continue
    }
    const attempts = (row.attempts ?? 0) + 1
    try {
      const { ok, status } = await deliver(row, endpoint)
      await admin.from('webhook_deliveries').update({
        status: ok ? 'delivered' : 'failed',
        attempts,
        response_status: status,
        next_attempt_at: ok ? null : new Date(Date.now() + BACKOFF_SECONDS(attempts) * 1000).toISOString(),
      }).eq('id', row.id)
      ok ? done++ : failed++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'delivery error'
      await admin.from('webhook_deliveries').update({
        status: attempts >= MAX_ATTEMPTS ? 'dead' : 'failed',
        attempts,
        last_error: msg,
        next_attempt_at: new Date(Date.now() + BACKOFF_SECONDS(attempts) * 1000).toISOString(),
      }).eq('id', row.id)
      failed++
    }
  }

  return Response.json({ processed: processed.length, done, failed })
})
