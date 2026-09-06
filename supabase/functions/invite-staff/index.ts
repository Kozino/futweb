/**
 * FutWeb — Add / invite club staff
 * =================================
 * Deploy:  supabase functions deploy invite-staff
 * Env:     SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL
 *
 * Why this is a server function and not a client call:
 *   * Creating an auth user for someone who hasn't signed up requires the
 *     service role (`auth.admin.inviteUserByEmail`), which must never be
 *     shipped to the browser.
 *   * The caller's permission to manage this club (owner, or club_admin via
 *     org_members) is re-checked here from the verified JWT — never trusted
 *     from the request body — because RLS alone can't stop a crafted
 *     request from naming someone else's club_id.
 *   * The role granted is written into the invited user's own metadata so
 *     the `handle_new_user` trigger seats them directly into *this* club
 *     with *this* role, instead of the normal signup path that would spin
 *     up a brand-new club for a "club" account type.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { json, corsHeaders } from '../_shared/cors.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://futweb.app'

const ALLOWED_ROLES = new Set(['club_admin', 'club_staff', 'scout'])

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  /* ---- 1. Authenticate from the JWT ---- */
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user: caller }, error: authError } = await userClient.auth.getUser()
  if (authError || !caller) return json({ error: 'Unauthorized' }, 401)

  /* ---- 2. Rate limit (per caller) ---- */
  const limited = await rateLimit(`invite-staff:${caller.id}`, 20, 3600)
  if (!limited.ok) return json({ error: 'Too many invites sent. Try again later.' }, 429)

  /* ---- 3. Parse + validate body ---- */
  let body: { clubId?: string; email?: string; role?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid request body' }, 400) }

  const clubId = body.clubId?.trim()
  const email = body.email?.trim().toLowerCase()
  const role = body.role?.trim()

  if (!clubId || !email || !role) return json({ error: 'clubId, email and role are required' }, 400)
  if (!ALLOWED_ROLES.has(role)) return json({ error: 'Invalid role' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email address' }, 400)

  /* ---- 4. Authorise: caller must own the club or be its club_admin ---- */
  const { data: club, error: clubErr } = await admin
    .from('clubs').select('id, owner_id, name').eq('id', clubId).maybeSingle()
  if (clubErr) return json({ error: clubErr.message }, 500)
  if (!club) return json({ error: 'Club not found' }, 404)

  let authorised = club.owner_id === caller.id
  if (!authorised) {
    const { data: membership } = await admin
      .from('org_members').select('role').eq('club_id', clubId).eq('user_id', caller.id)
      .is('revoked_at', null).maybeSingle()
    authorised = membership?.role === 'club_admin'
  }
  if (!authorised) return json({ error: 'Only a club administrator can add staff.' }, 403)

  /* ---- 5. Existing account? Attach directly. ---- */
  const { data: existingProfile, error: profileErr } = await admin
    .from('profiles').select('id, full_name, email').eq('email', email).maybeSingle()
  if (profileErr) return json({ error: profileErr.message }, 500)

  if (existingProfile) {
    const { data: existingMember } = await admin
      .from('org_members').select('id, revoked_at').eq('club_id', clubId).eq('user_id', existingProfile.id)
      .maybeSingle()

    if (existingMember && !existingMember.revoked_at) {
      return json({ status: 'already_member', name: existingProfile.full_name })
    }

    if (existingMember) {
      const { error: updateErr } = await admin
        .from('org_members')
        .update({ role, invited_by: caller.id, revoked_at: null, accepted_at: new Date().toISOString() })
        .eq('id', existingMember.id)
      if (updateErr) return json({ error: updateErr.message }, 500)
    } else {
      const { error: insertErr } = await admin.from('org_members').insert({
        club_id: clubId, user_id: existingProfile.id, role, invited_by: caller.id,
        accepted_at: new Date().toISOString(),
      })
      if (insertErr) return json({ error: insertErr.message }, 500)
    }

    return json({ status: 'added', name: existingProfile.full_name, email: existingProfile.email })
  }

  /* ---- 6. No account yet: send a real invite that seats them on signup. ---- */
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
   redirectTo: `${APP_URL}/accept-invite`,
    data: {
      invited_club_id: clubId,
      invited_role: role,
      invited_by: caller.id,
      full_name: email.split('@')[0],
    },
  })
  if (inviteErr) return json({ error: inviteErr.message }, 500)

  return json({ status: 'invited', email, club: club.name })
})
