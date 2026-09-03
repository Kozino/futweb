import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Card, Icon, Select, Toggle, toast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useOffline } from '@/context/OfflineContext'

export default function Settings() {
  const { user } = useAuth()
  const { dataSaver, toggleDataSaver, pending, syncNow, syncing, clearSynced } = useOffline()
  const [twoFa, setTwoFa] = useState(true)
  const [notify, setNotify] = useState({ trial: true, message: true, report: true, digest: false })
  const unsynced = pending.filter(p => !p.synced).length

  return (
    <div>
      <PageHeader breadcrumb="Account" icon="settings" title="Settings"
        subtitle="Security, notifications and data preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-bold">Account</h3>
          <div className="mt-4 space-y-3">
            <div>
              <label className="fw-label">Full name</label>
              <input className="fw-input" defaultValue={user?.fullName} />
            </div>
            <div>
              <label className="fw-label">Email</label>
              <input className="fw-input" defaultValue={user?.email} disabled />
            </div>
            <div>
              <label className="fw-label">Language</label>
              <Select options={[
                { value: 'en', label: 'English' },
                { value: 'pidgin', label: 'Nigerian Pidgin (beta)' },
                { value: 'ha', label: 'Hausa (beta)' },
                { value: 'ig', label: 'Igbo (beta)' },
                { value: 'yo', label: 'Yoruba (beta)' },
              ]} />
            </div>
            <Button size="sm" onClick={() => toast({ tone: 'success', title: 'Saved' })}>Save changes</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold">Security</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Two-factor authentication</p>
                <p className="text-2xs text-ink-500">Required for admin and staff accounts.</p>
              </div>
              <Toggle checked={twoFa} onChange={v => { setTwoFa(v)
                toast({ tone: v ? 'success' : 'warning', title: v ? '2FA enabled' : '2FA disabled' }) }} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Password</p>
                <p className="text-2xs text-ink-500">Last changed 3 months ago.</p>
              </div>
              <Button size="sm" variant="outline">Change</Button>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">Active sessions</p>
                <p className="text-2xs text-ink-500">2 devices signed in.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast({ tone: 'info', title: 'Other sessions revoked' })}>
                Revoke all
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
                <Toggle checked={notify[k]} onChange={v => setNotify(n => ({ ...n, [k]: v }))} />
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
            <Button variant="outline" icon="download"
              onClick={() => toast({ tone: 'success', title: 'Export started', description: 'You will receive a download link by email.' })}>
              Export my data
            </Button>
            <Button variant="outline" icon="doc">Download processing record</Button>
            <Button variant="outline" className="text-red-600" icon="trash"
              onClick={() => toast({ tone: 'warning', title: 'Deletion requested', description: 'Our team will confirm within 30 days.' })}>
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
    </div>
  )
}
