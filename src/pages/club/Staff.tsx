import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, Badge, Button, Card, Icon, Modal, Select, toast } from '@/components/ui'

const ROLES = [
  { value: 'club_admin', label: 'Administrator', desc: 'Full access including billing and staff management' },
  { value: 'club_staff', label: 'Coach / Staff', desc: 'Manage squad, file reports, view analytics' },
  { value: 'scout', label: 'Scout', desc: 'Capture ratings and reports. Cannot see billing or staff' },
]

const MEMBERS = [
  { id: '1', name: 'Ibrahim Danjuma', email: 'ibrahim@riversunited.ng', role: 'club_admin', last: 'Active now', mfa: true },
  { id: '2', name: 'Scout M. Danjuma', email: 'scout.m@riversunited.ng', role: 'scout', last: '2 hours ago', mfa: false },
  { id: '3', name: 'Coach A. Bello', email: 'coach.bello@riversunited.ng', role: 'club_staff', last: '1 day ago', mfa: true },
  { id: '4', name: 'Analyst K. Obi', email: 'analyst@riversunited.ng', role: 'club_staff', last: '3 days ago', mfa: false },
]

export default function Staff() {
  const [invite, setInvite] = useState(false)
  const [role, setRole] = useState('scout')
  const [members, setMembers] = useState(MEMBERS)

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="shield" title="Staff & permissions"
        subtitle="Ten seats on your plan. Every action is attributed to a named account in the audit log."
        actions={<Button icon="plus" onClick={() => setInvite(true)}>Invite staff</Button>} />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="divide-y divide-ink-100">
            {members.map(m => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{m.name}</p>
                    {m.mfa && <Badge tone="trust" size="sm" icon="shield">2FA</Badge>}
                  </div>
                  <p className="truncate text-2xs text-ink-500">{m.email} · last active {m.last}</p>
                </div>
                <Select className="w-40" value={m.role} onChange={e => {
                  setMembers(ms => ms.map(x => x.id === m.id ? { ...x, role: e.target.value } : x))
                  toast({ tone: 'success', title: 'Role updated', description: 'The change has been logged.' })
                }} options={ROLES.map(r => ({ value: r.value, label: r.label }))} />
                <Button size="sm" variant="ghost" icon="trash" className="text-red-500"
                  onClick={() => { setMembers(ms => ms.filter(x => x.id !== m.id))
                    toast({ tone: 'info', title: 'Access revoked' }) }} />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold">What each role can do</h3>
            <div className="mt-3 space-y-3">
              {ROLES.map(r => (
                <div key={r.value} className="rounded-xl border border-ink-100 p-3">
                  <p className="text-xs font-bold">{r.label}</p>
                  <p className="mt-0.5 text-2xs text-ink-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold">Security recommendations</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                { t: 'Require 2FA for all staff', d: 'Two accounts have it disabled.', tone: 'warn' },
                { t: 'Review the audit log monthly', d: 'Last review was 40 days ago.', tone: 'warn' },
                { t: 'Remove inactive accounts', d: 'No dormant accounts found.', tone: 'ok' },
              ].map(x => (
                <li key={x.t} className="flex items-start gap-2">
                  <Icon name={x.tone === 'ok' ? 'check-circle' : 'alert'} size={14}
                    className={x.tone === 'ok' ? 'mt-0.5 shrink-0 text-trust-500' : 'mt-0.5 shrink-0 text-amber-500'} />
                  <span className="text-xs">
                    <span className="font-semibold text-ink-800">{x.t}</span>
                    <span className="block text-ink-500">{x.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={invite} onClose={() => setInvite(false)} size="sm" title="Invite staff"
        description="They will receive a secure link to set their own password."
        footer={
          <>
            <Button variant="outline" onClick={() => setInvite(false)}>Cancel</Button>
            <Button icon="mail" onClick={() => { setInvite(false); toast({ tone: 'success', title: 'Invitation sent' }) }}>
              Send invite
            </Button>
          </>
        }>
        <div className="space-y-4">
          <input className="fw-input" placeholder="Full name" />
          <input className="fw-input" placeholder="Email address" type="email" />
          <Select value={role} onChange={e => setRole(e.target.value)} options={ROLES.map(r => ({ value: r.value, label: r.label }))} />
          <div className="rounded-xl bg-ink-50 p-3.5">
            <p className="text-2xs leading-relaxed text-ink-600">
              Invitations expire after 7 days. Staff are scoped to your club only and cannot see
              data belonging to other organisations.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
