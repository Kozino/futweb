import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, Input } from '@/components/ui'
import { Logo } from '@/components/layout/Logo'
import { hasSupabase, supabase } from '@/lib/supabase'

type Stage = 'checking' | 'ready' | 'invalid'

/**
 * Landing page for the "Add staff" invite email.
 *
 * Supabase's invite link verifies the token server-side and redirects here
 * with the session tokens in the URL fragment (#access_token=...&type=invite).
 * supabase-js (with the default detectSessionInUrl: true) picks those up
 * automatically and stores a real session before this component even
 * mounts — so by the time we check, the person is already authenticated.
 * What they don't have yet is a password, since inviteUserByEmail never
 * asks for one. This page's only job is to collect one and finish signup.
 *
 * The org_members row and role were already created by the handle_new_user
 * trigger the moment the invite was sent — this page doesn't need to (and
 * shouldn't) touch club membership at all.
 */
export default function AcceptInvite() {
  const nav = useNavigate()
  const [stage, setStage] = useState<Stage>('checking')
  const [clubName, setClubName] = useState<string | null>(null)
  const [roleLabel, setRoleLabel] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !supabase) { if (!cancelled) setStage('invalid'); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) { setStage('invalid'); return }

      const meta = session.user.user_metadata as { invited_club_id?: string; invited_role?: string }
      if (meta.invited_role) {
        setRoleLabel(
          meta.invited_role === 'club_admin' ? 'Administrator'
            : meta.invited_role === 'club_staff' ? 'Coach / Staff'
            : 'Scout'
        )
      }
      if (meta.invited_club_id) {
        const { data: club } = await supabase.from('clubs').select('name').eq('id', meta.invited_club_id).maybeSingle()
        if (!cancelled && club) setClubName(club.name)
      }

      if (!cancelled) setStage('ready')
    })()
    return () => { cancelled = true }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase!.auth.updateUser({ password })
      if (updateErr) throw updateErr
      nav('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set your password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size={28} wordmark />
        </div>

        {stage === 'checking' && (
          <p className="mt-10 text-center text-sm text-ink-500">Checking your invite…</p>
        )}

        {stage === 'invalid' && (
          <div className="mt-10 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <Icon name="alert" size={22} />
            </div>
            <h1 className="text-lg font-bold">This invite link isn't valid</h1>
            <p className="mt-2 text-sm text-ink-500">
              It may have expired or already been used. Ask whoever invited you to send a new one, or sign in if you already set a password.
            </p>
            <Button className="mt-5" onClick={() => nav('/login')}>Go to sign in</Button>
          </div>
        )}

        {stage === 'ready' && (
          <div className="mt-10">
            <h1 className="text-2xl font-extrabold tracking-tight">
              {clubName ? `Join ${clubName}` : 'Finish setting up your account'}
            </h1>
            <p className="mt-1.5 text-sm text-ink-600">
              {roleLabel ? `You're joining as ${roleLabel}. ` : ''}Set a password to finish setting up your account.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  <Icon name="alert" size={15} className="shrink-0" />{error}
                </div>
              )}
              <Input label="New password" type={show ? 'text' : 'password'} required icon="lock"
                placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password" hint="At least 8 characters."
                suffix={
                  <button type="button" onClick={() => setShow(s => !s)} className="text-ink-400 hover:text-ink-700">
                    <Icon name={show ? 'eye-off' : 'eye'} size={16} />
                  </button>
                } />
              <Input label="Confirm password" type={show ? 'text' : 'password'} required icon="lock"
                placeholder="••••••••••" value={confirm} onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password" />

              <Button type="submit" fullWidth size="lg" loading={saving} iconRight="arrow-right">
                Set password &amp; continue
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
