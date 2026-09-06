import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Card, Icon, Input, Modal, Select, Toggle, toast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useOffline } from '@/context/OfflineContext'
import { hasSupabase, supabase } from '@/lib/supabase'

type NotifyKey = 'trial' | 'message' | 'report' | 'digest'
const DEFAULT_NOTIFY: Record<NotifyKey, boolean> = { trial: true, message: true, report: true, digest: false }

export default function Settings() {
  const { user, updateUser, refreshProfile } = useAuth()
  const { dataSaver, toggleDataSaver, pending, syncNow, syncing, clearSynced } = useOffline()

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [locale, setLocale] = useState('en')
  const [savingAccount, setSavingAccount] = useState(false)

  const [notify, setNotify] = useState<Record<NotifyKey, boolean>>(DEFAULT_NOTIFY)
  const [notifySaving, setNotifySaving] = useState<NotifyKey | null>(null)

  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const [revoking, setRevoking] = useState(false)
  const [requesting, setRequesting] = useState<'export' | 'deletion' | null>(null)

  const unsynced = pending.filter(p => !p.synced).length

  // Load whatever isn't already on the local session (locale + saved prefs).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !supabase || !user) return
      const { data } = await supabase.from('profiles').select('locale, notification_prefs').eq('id', user.id).maybeSingle()
      if (cancelled || !data) return
      if (data.locale) setLocale(String(data.locale).split('-')[0])
      if (data.notification_prefs) setNotify({ ...DEFAULT_NOTIFY, ...(data.notification_prefs as Record<NotifyKey, boolean>) })
    })()
    return () => { cancelled = true }
  }, [user?.id])

  async function saveAccount() {
    const trimmed = fullName.trim()
    if (trimmed.length < 2) { toast({ tone: 'error', title: 'Enter your full name' }); return }
    setSavingAccount(true)
    try {
      if (hasSupabase && supabase && user) {
        const { error } = await supabase.from('profiles')
          .update({ full_name: trimmed, locale: `${locale}-NG` }).eq('id', user.id)
        if (error) throw error
        await refreshProfile()
      } else {
        updateUser({ fullName: trimmed })
      }
      toast({ tone: 'success', title: 'Saved' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not save', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSavingAccount(false) }
  }

  async function toggleNotify(key: NotifyKey, value: boolean) {
    const next = { ...notify, [key]: value }
    setNotify(next)
    if (!hasSupabase || !supabase || !user) return
    setNotifySaving(key)
    try {
      const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id)
      if (error) throw error
    } catch (err) {
      setNotify(notify) // revert on failure
      toast({ tone: 'error', title: 'Could not update notification setting', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setNotifySaving(null) }
  }

  async function changePassword() {
    if (newPw.length < 8) { toast({ tone: 'error', title: 'Password too short', description: 'Use at least 8 characters.' }); return }
    if (newPw !== confirmPw) { toast({ tone: 'error', title: "Passwords don't match" }); return }
    if (!hasSupabase || !supabase || !user) {
      toast({ tone: 'error', title: 'Not available in demo mode' })
      return
    }
    setChangingPw(true)
    try {
      // Re-authenticate with the current password before allowing the change.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw })
      if (reauthErr) throw new Error('Current password is incorrect.')

      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error

      toast({ tone: 'success', title: 'Password changed' })
      setPwOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      toast({ tone: 'error', title: 'Could not change password', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setChangingPw(false) }
  }

  async function revokeOtherSessions() {
    if (!hasSupabase || !supabase) {
      toast({ tone: 'error', title: 'Not available in demo mode' })
      return
    }
    setRevoking(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw error
      toast({ tone: 'success', title: 'Other sessions revoked', description: 'Every other signed-in device has been logged out.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not revoke sessions', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setRevoking(false) }
  }

  async function requestData(kind: 'export' | 'deletion') {
    if (!hasSupabase || !supabase || !user) {
      toast({ tone: kind === 'export' ? 'success' : 'warning', title: kind === 'export' ? 'Export started' : 'Deletion requested' })
      return
    }
    setRequesting(kind)
    try {
      const { error } = await supabase.from('data_requests').insert({ user_id: user.id, kind })
      if (error) throw error
      toast({
        tone: kind === 'export' ? 'success' : 'warning',
        title: kind === 'export' ? 'Export requested' : 'Deletion requested',
        description: kind === 'export'
          ? 'You will receive a download link by email once it is ready.'
          : 'Our team will confirm within 30 days, per the Nigeria Data Protection Act 2023.',
      })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not submit request', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setRequesting(null) }
  }

  return (
    <div>
      <PageHeader breadcrumb="Account" icon="settings" title="Settings"
        subtitle="Security, notifications and data preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-bold">Account</h3>
          <div className="mt-4 space-y-3">
            <Input label="Full name" value={fullName} onChange={e => setFullName(e.target.value)} />
            <Input label="Email" defaultValue={user?.email} disabled />
            <Select label="Language" value={locale} onChange={e => setLocale(e.target.value)} options={[
              { value: 'en', label: 'English' },
              { value: 'pidgin', label: 'Nigerian Pidgin (beta)' },
              { value: 'ha', label: 'Hausa (beta)' },
              { value: 'ig', label: 'Igbo (beta)' },
              { value: 'yo', label: 'Yoruba (beta)' },
            ]} />
            <Button size="sm" loading={savingAccount} onClick={() => void saveAccount()}>Save changes</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold">Security</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Password</p>
                <p className="text-2xs text-ink-500">Change the password used to sign in.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPwOpen(true)}>Change</Button>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Active sessions</p>
                <p className="text-2xs text-ink-500">Sign out of every device except this one.</p>
              </div>
              <Button size="sm" variant="outline" loading={revoking} onClick={() => void revokeOtherSessions()}>
                Revoke all others
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold">Network & offline</h3>
          <p className="mt-1 text-xs text-ink-500">
            Built for unreliable connections. Nothing you enter is ever lost.
          </p>
          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Data saver</p>
                <p className="text-2xs text-ink-500">Compresses images and lowers video bitrate.</p>
              </div>
              <Toggle checked={dataSaver} onChange={toggleDataSaver} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Pending sync</p>
                <p className="text-2xs text-ink-500">
                  {unsynced > 0 ? `${unsynced} record${unsynced === 1 ? '' : 's'} captured offline` : 'Everything is synced'}
                </p>
              </div>
              <Button size="sm" variant="outline" icon="refresh" loading={syncing} disabled={unsynced === 0} onClick={syncNow}>
                Sync now
              </Button>
            </div>
            {pending.some(p => p.synced) && (
              <Button size="sm" variant="ghost" onClick={clearSynced}>Clear synced records</Button>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold">Notifications</h3>
          <div className="mt-4 space-y-3.5">
            {([
              ['trial', 'Trial invitations', 'When a verified club invites you to trial'],
              ['message', 'Club messages', 'Direct messages from verified clubs'],
              ['report', 'Trust & safety', 'Updates on reports you file'],
              ['digest', 'Weekly digest', 'A weekly summary of profile activity'],
            ] as const).map(([k, label, desc]) => (
              <div key={k} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-2xs text-ink-500">{desc}</p>
                </div>
                <Toggle checked={notify[k]} disabled={notifySaving === k} onChange={v => void toggleNotify(k, v)} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-bold">Your data</h3>
          <p className="mt-1 text-xs text-ink-500">
            Under the Nigeria Data Protection Act 2023 you may export or request deletion of your
            personal data at any time.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" icon="download" loading={requesting === 'export'} onClick={() => void requestData('export')}>
              Export my data
            </Button>
            <Button variant="outline" className="text-red-600" icon="trash" loading={requesting === 'deletion'} onClick={() => void requestData('deletion')}>
              Request deletion
            </Button>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 p-3.5">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-ink-400" />
            <p className="text-2xs leading-relaxed text-ink-600">
              Identity documents are encrypted at rest, visible only to the verification team, and
              deleted automatically once a check completes. Every access is written to the audit log.
            </p>
          </div>
        </Card>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password"
        description="You'll be asked for your current password to confirm it's really you."
        footer={
          <>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button loading={changingPw} onClick={() => void changePassword()}>Update password</Button>
          </>
        }>
        <div className="space-y-4">
          <Input label="Current password" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          <Input label="New password" type="password" hint="At least 8 characters." value={newPw} onChange={e => setNewPw(e.target.value)} />
          <Input label="Confirm new password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
