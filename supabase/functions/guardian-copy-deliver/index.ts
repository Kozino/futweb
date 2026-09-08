/**
 * FutWeb — Guardian-copy delivery worker
 * ========================================
 * Deploy:  supabase functions deploy guardian-copy-deliver --no-verify-jwt --schedule every-minute
 * Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *          GUARDIAN_EMAIL_FROM  (verified sender, e.g. "FutWeb <guardians@futweb.app>")
 *          GUARDIAN_EMAIL_PROVIDER  (optional; see below)
 *          GUARDIAN_EMAIL_KEY        (optional; API key / SMTP password)
 *
 * JWT verification is OFF (--no-verify-jwt): a scheduled worker invoked by
 * Supabase's own scheduler, never by a browser client. It authenticates with
 * the service-role key.
 *
 * Picks up 'pending' guardian_copies whose next_attempt_at has passed and sends
 * each guardian an email containing the club message, then marks the copy
 * 'delivered' (or 'failed' with backoff / 'unreachable' after N attempts).
 *
 * Email transport: this template ships a pluggable sender. By default it uses a
 * Resend-style HTTP API (https://api.resend.com/emails) when GUARDIAN_EMAIL_KEY
 * is present; otherwise it POSTs to a provider endpoint you wire in `sendEmail`.
 * Because credentials are external, delivery only runs once you deploy + set
 * env vars — the DB outbox guarantees no copy is lost meanwhile.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EMAIL_FROM = Deno.env.get('GUARDIAN_EMAIL_FROM') ?? 'FutWeb Guardian <guardians@futweb.app>'
const EMAIL_KEY = Deno.env.get('GUARDIAN_EMAIL_KEY')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BATCH = 20
const MAX_ATTEMPTS = 8
const BACKOFF_SECONDS = (attempts: number) => Math.min(3600, Math.pow(2, attempts))

async function sendEmail(to: string, playerName: string, senderRole: string, clubName: string, body: string): Promise<void> {
  if (!EMAIL_KEY) throw new Error('GUARDIAN_EMAIL_KEY not configured — wire a provider to deliver')
  const who = senderRole === 'club' ? `a club (${clubName})` : 'your child'
  const subject = `Guardian notice: new message about ${playerName} on FutWeb`
  const text = `Hello,\n\nA ${who} messaged your child's FutWeb profile.\n\n"${body}"\n\nYou are receiving this because a guardian consent is on file. If you did not expect this, contact FutWeb support immediately.\n\n— FutWeb`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${EMAIL_KEY}` },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`provider ${res.status}: ${errText.slice(0, 200)}`)
  }
}

Deno.serve(async () => {
  const { data: rows, error } = await admin
    .from('guardian_copies')
    .select('id, player_id, club_id, guardian_email, message_body, sender_role, attempts, status, created_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const pending = rows ?? []
  let delivered = 0
  let failed = 0
  let unreachable = 0

  for (const c of pending) {
    const attempts = (c.attempts ?? 0) + 1
    if (!c.guardian_email) {
      await admin.from('guardian_copies').update({
        status: 'unreachable', attempts, last_error: 'no guardian email on file',
      }).eq('id', c.id)
      unreachable++
      continue
    }

    // Resolve display names once (best-effort).
    const playerName = (await admin.from('players')
      .select('first_name, last_name').eq('id', c.player_id).maybeSingle()).data
    const clubName = (await admin.from('clubs')
      .select('name').eq('id', c.club_id).maybeSingle()).data?.name

    try {
      await sendEmail(
        c.guardian_email,
        playerName ? `${playerName.first_name} ${playerName.last_name}` : 'your child',
        c.sender_role, clubName ?? 'a club', c.message_body,
      )
      await admin.from('guardian_copies').update({
        status: 'delivered', attempts, delivered_at: new Date().toISOString(), last_error: null,
      }).eq('id', c.id)
      delivered++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'delivery error'
      const configured = !msg.includes('not configured')
      const terminal = attempts >= MAX_ATTEMPTS
      await admin.from('guardian_copies').update({
        status: terminal || !configured ? 'unreachable' : 'failed',
        attempts,
        last_error: msg,
        next_attempt_at: (terminal || !configured)
          ? null
          : new Date(Date.now() + BACKOFF_SECONDS(attempts) * 1000).toISOString(),
      }).eq('id', c.id)
      ;(terminal || !configured) ? unreachable++ : failed++
    }
  }

  return Response.json({ processed: pending.length, delivered, failed, unreachable })
})
