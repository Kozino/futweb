import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, Select, Skeleton, Tabs, toast } from '@/components/ui'
import { UpgradeCard } from '@/components/plan/FeatureGate'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { entitlementsFor } from '@/lib/entitlements'
import { hasSupabase, supabase } from '@/lib/supabase'
import {
  getMyApiKeys, createApiKey, revokeApiKey,
  getMyWebhooks, registerWebhook, removeWebhook, getWebhookDeliveries,
  getMyCustomRoles,
  PERMISSION_CATALOG, WEBHOOK_EVENTS,
  type ApiKeyRow, type WebhookEndpointRow, type WebhookDeliveryRow, type CustomRoleRow,
} from '@/lib/supabase/developer'
import { cn } from '@/lib/utils'

type Tab = 'keys' | 'webhooks' | 'roles'

export default function Integrations() {
  const { club } = useClub()
  const { user } = useAuth()

  const [tab, setTab] = useState<Tab>('keys')
  const [loading, setLoading] = useState(true)

  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [webhooks, setWebhooks] = useState<WebhookEndpointRow[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRow[]>([])
  const [roles, setRoles] = useState<CustomRoleRow[]>([])

  // Key modal
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [keyScope, setKeyScope] = useState('read')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState('')

  // Webhook modal
  const [whOpen, setWhOpen] = useState(false)
  const [whUrl, setWhUrl] = useState('')
  const [whSecret, setWhSecret] = useState('')
  const [whEvents, setWhEvents] = useState<string[]>(['trial.published'])

  // Role modal
  const [roleOpen, setRoleOpen] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [rolePerms, setRolePerms] = useState<string[]>([])

  const isFederation = entitlementsFor(user).level >= 2 || user?.role === 'admin'
  const clubId = club?.id

  async function load() {
    if (!hasSupabase || !clubId) { setLoading(false); return }
    setLoading(true)
    try {
      const [k, w, d, r] = await Promise.all([
        getMyApiKeys().catch(() => [] as ApiKeyRow[]),
        getMyWebhooks().catch(() => [] as WebhookEndpointRow[]),
        getWebhookDeliveries().catch(() => [] as WebhookDeliveryRow[]),
        getMyCustomRoles().catch(() => [] as CustomRoleRow[]),
      ])
      setKeys(k); setWebhooks(w); setDeliveries(d); setRoles(r)
    } catch {
      toast({ tone: 'error', title: 'Could not load developer tools', description: 'Ensure the developer-api migration is applied.' })
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [clubId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEvent(ev: string) {
    setWhEvents(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev])
  }
  function togglePerm(p: string) {
    setRolePerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function doCreateKey() {
    if (!keyName.trim()) { toast({ tone: 'error', title: 'Name the key' }); return }
    setBusy(true)
    try {
      const raw = await createApiKey(keyName.trim(), [keyScope])
      setNewKey(raw); setKeyName('')
      await load()
    } catch (err) { toast({ tone: 'error', title: 'Could not create key', description: err instanceof Error ? err.message : 'Federation plan required.' }) }
    finally { setBusy(false) }
  }

  async function doRegisterWebhook() {
    if (!whUrl.startsWith('https://')) { toast({ tone: 'error', title: 'URL must be https' }); return }
    setBusy(true)
    try {
      await registerWebhook(whUrl.trim(), whSecret.trim(), whEvents)
      setWhOpen(false); setWhUrl(''); setWhSecret(''); setWhEvents(['trial.published'])
      await load()
      toast({ tone: 'success', title: 'Webhook registered' })
    } catch (err) { toast({ tone: 'error', title: 'Could not register', description: err instanceof Error ? err.message : 'Federation plan required.' }) }
    finally { setBusy(false) }
  }

  async function saveCustomRole() {
    if (!roleName.trim() || !clubId) return
    setBusy(true)
    try {
      const { error } = await supabase!.from('club_custom_roles').insert({
        club_id: clubId, name: roleName.trim(), permissions: rolePerms,
      })
      if (error) throw error
      setRoleOpen(false); setRoleName(''); setRolePerms([])
      await load()
      toast({ tone: 'success', title: 'Custom role saved' })
    } catch (err) { toast({ tone: 'error', title: 'Could not save role', description: err instanceof Error ? err.message : 'Please try again.' }) }
    finally { setBusy(false) }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="zap" title="Developer & access"
        subtitle="API keys, webhooks and custom roles — Federation add-on capabilities."
      />

      {isFederation && (
        <div className="mt-5">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'keys', label: 'API keys' },
            { value: 'webhooks', label: 'Webhooks' },
            { value: 'roles', label: 'Custom roles' },
          ]} />
        </div>
      )}

      {!isFederation ? (
        <div className="mt-5">
          <UpgradeCard
            title="Available on Federation"
            description="API keys, webhook streams and custom roles are part of the Federation tier (arranged via your agreement)."
          />
        </div>
      ) : tab === 'keys' ? (
        <div className="mt-5 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">API keys</h3>
                <p className="text-xs text-ink-500">Authenticate programmatic access to FutWeb data on your behalf.</p>
              </div>
              <Button icon="plus" onClick={() => { setKeyOpen(true); setNewKey('') }}>Create key</Button>
            </div>
          </Card>
          {keys.length === 0 ? (
            <Card><EmptyState icon="zap" title="No API keys" description="Create a key to start integrating." /></Card>
          ) : keys.map(k => (
            <Card key={k.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink-900">{k.name}</p>
                    <Badge tone={k.revoked_at ? 'red' : 'trust'} size="sm">{k.revoked_at ? 'Revoked' : 'Active'}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-ink-500">{k.key_prefix}… · scope: {k.scope.join(', ')}</p>
                </div>
                {!k.revoked_at && (
                  <Button size="sm" variant="outline" icon="trash" onClick={() => void (async () => { await revokeApiKey(k.id).catch(() => {}); await load(); })()}>Revoke</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : tab === 'webhooks' ? (
        <div className="mt-5 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Webhook endpoints</h3>
                <p className="text-xs text-ink-500">Receive events like trial published or scout reports as they happen.</p>
              </div>
              <Button icon="plus" onClick={() => setWhOpen(true)}>Add endpoint</Button>
            </div>
          </Card>
          {webhooks.length === 0 ? (
            <Card><EmptyState icon="zap" title="No webhooks" description="Register an HTTPS endpoint to receive events." /></Card>
          ) : webhooks.map(w => (
            <Card key={w.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">{w.url}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{w.events.length ? w.events.join(', ') : 'all events'} · {w.active ? 'active' : 'paused'}</p>
                </div>
                <Button size="sm" variant="outline" icon="trash" onClick={() => void (async () => { await removeWebhook(w.id).catch(() => {}); await load(); })()}>Remove</Button>
              </div>
            </Card>
          ))}
          {deliveries.length > 0 && (
            <Card className="overflow-hidden">
              <p className="p-4 pb-2 text-sm font-bold">Recent deliveries</p>
              <div className="overflow-x-auto p-4 pt-1">
                <table className="w-full min-w-[420px] text-xs">
                  <thead><tr className="text-left text-ink-400">
                    <th className="py-1">Event</th><th className="py-1">Status</th><th className="py-1">Attempts</th><th className="py-1">Response</th>
                  </tr></thead>
                  <tbody>
                    {deliveries.slice(0, 12).map(d => (
                      <tr key={d.id} className="border-t border-ink-100">
                        <td className="py-1.5 font-semibold text-ink-700">{d.event}</td>
                        <td className="py-1.5"><Badge tone={d.status === 'delivered' ? 'trust' : d.status === 'dead' ? 'red' : 'gold'} size="sm">{d.status}</Badge></td>
                        <td className="py-1.5 text-ink-600">{d.attempts}</td>
                        <td className="py-1.5 text-ink-600">{d.response_status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <Card className="border-dashed p-5">
            <p className="text-sm font-bold text-ink-900">About custom roles</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Define named roles with a set of capabilities. These are enforced in the app's access
              controls. Note: platform security still keys off the built-in role on staff accounts;
              custom role names are an access-control layer on top.
            </p>
          </Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Role definitions</h3>
            <Button icon="plus" onClick={() => setRoleOpen(true)}>New role</Button>
          </div>
          {roles.length === 0 ? (
            <Card><EmptyState icon="shield" title="No custom roles" description="Create your first named role with a set of capabilities." /></Card>
          ) : roles.map(r => (
            <Card key={r.id} className="p-4">
              <p className="text-sm font-bold text-ink-900">{r.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.permissions.map(p => <Badge key={p} tone="neutral" size="sm">{PERMISSION_CATALOG.find(x => x.key === p)?.label ?? p}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create key modal */}
      <Modal open={keyOpen} onClose={() => setKeyOpen(false)} title="Create an API key"
        footer={newKey ? <Button onClick={() => { setKeyOpen(false); setNewKey('') }}>Done</Button> : <>
          <Button variant="outline" onClick={() => setKeyOpen(false)}>Cancel</Button>
          <Button loading={busy} onClick={() => void doCreateKey()}>Create</Button>
        </>}>
        {newKey ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Copy your key now — it will not be shown again:</p>
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 p-2.5">
              <code className="flex-1 break-all text-xs text-ink-800">{newKey}</code>
              <button onClick={() => { navigator.clipboard?.writeText(newKey); toast({ tone: 'success', title: 'Copied' }) }}
                className="shrink-0 rounded-lg p-1.5 text-ink-500 hover:bg-ink-200"><Icon name="copy" size={14} /></button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input label="Key name" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Production export" />
            <Select label="Scope" value={keyScope} onChange={e => setKeyScope(e.target.value)}
              options={[{ value: 'read', label: 'Read' }, { value: 'write', label: 'Write' }, { value: 'admin', label: 'Admin' }]} />
          </div>
        )}
      </Modal>

      {/* Register webhook modal */}
      <Modal open={whOpen} onClose={() => setWhOpen(false)} title="Register webhook endpoint"
        footer={<>
          <Button variant="outline" onClick={() => setWhOpen(false)}>Cancel</Button>
          <Button loading={busy} onClick={() => void doRegisterWebhook()}>Register</Button>
        </>}>
        <div className="space-y-3">
          <Input label="Endpoint URL (https)" value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://your-app.com/hooks/futweb" />
          <Input label="Secret (optional, for signature verification)" value={whSecret} onChange={e => setWhSecret(e.target.value)} />
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Events</p>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map(ev => {
                const on = whEvents.includes(ev)
                return (
                  <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                    className={cn('rounded-lg px-2.5 py-1 text-2xs font-semibold',
                      on ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50')}>
                    {ev}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Custom role modal */}
      <Modal open={roleOpen} onClose={() => setRoleOpen(false)} title="New custom role"
        footer={<>
          <Button variant="outline" onClick={() => setRoleOpen(false)}>Cancel</Button>
          <Button loading={busy} disabled={!roleName.trim()} onClick={() => void saveCustomRole()}>Save role</Button>
        </>}>
        <div className="space-y-3">
          <Input label="Role name" value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g. Head of Scouting" />
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Capabilities</p>
            <div className="flex flex-wrap gap-1.5">
              {PERMISSION_CATALOG.map(p => {
                const on = rolePerms.includes(p.key)
                return (
                  <button key={p.key} type="button" onClick={() => togglePerm(p.key)}
                    className={cn('rounded-lg px-2.5 py-1 text-2xs font-semibold',
                      on ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50')}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
