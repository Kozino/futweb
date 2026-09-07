import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Skeleton, Stat, Tabs, toast } from '@/components/ui'
import {
  getFederationTree, getAdminApiKeys, getWebhookHealth, getPlatformMonitor,
  type FederationTreeRow, type ApiKeyAdminRow, type WebhookHealthRow, type PlatformMonitor,
} from '@/lib/supabase/adminMonitor'
import { hasSupabase } from '@/lib/supabase'

type Tab = 'tree' | 'keys' | 'webhooks'

export default function FederationApi() {
  const [tab, setTab] = useState<Tab>('tree')
  const [loading, setLoading] = useState(true)

  const [mon, setMon] = useState<PlatformMonitor | null>(null)
  const [tree, setTree] = useState<FederationTreeRow[]>([])
  const [keys, setKeys] = useState<ApiKeyAdminRow[]>([])
  const [webhooks, setWebhooks] = useState<WebhookHealthRow[]>([])

  async function load() {
    if (!hasSupabase) { setLoading(false); return }
    setLoading(true)
    try {
      const [m, t, k, w] = await Promise.all([
        getPlatformMonitor().catch(() => null),
        getFederationTree().catch(() => [] as FederationTreeRow[]),
        getAdminApiKeys().catch(() => [] as ApiKeyAdminRow[]),
        getWebhookHealth(40).catch(() => [] as WebhookHealthRow[]),
      ])
      setMon(m); setTree(t); setKeys(k); setWebhooks(w)
    } catch (err) {
      toast({ tone: 'error', title: 'Could not load monitor', description: err instanceof Error ? err.message : 'Run migration 0018.' })
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  if (loading) return <Skeleton className="h-64 w-full" />

  const failingWebhooks = webhooks.filter(x => x.status === 'dead' || x.status === 'failed').length
  const pendingWebhooks = mon?.deliveries_pending ?? 0

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="globe" title="Federation & API"
        subtitle="Monitor multi-academy groups, developer keys and webhook delivery health."
        actions={<Button variant="outline" size="sm" icon="refresh" onClick={() => void load()}>Refresh</Button>}
      />

      {/* Stat tiles */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Federation groups" value={mon?.clubs_federation ?? '—'}
          sub={`of ${mon?.clubs_total ?? '—'} total clubs`} icon="building" tone="default" />
        <Stat label="Active API keys" value={mon?.api_keys_active ?? '—'}
          sub={`${mon?.webhook_endpoints ?? 0} webhook endpoints`} icon="zap" tone="trust" />
        <Stat label="Webhook deliveries pending" value={pendingWebhooks}
          sub={failingWebhooks > 0 ? `${failingWebhooks} failing / dead` : 'all clear'} icon="clock" tone={failingWebhooks ? 'gold' : 'default'} />
        <Stat label="Enterprise requests (new)" value={mon?.enterprise_new ?? '—'}
          sub="awaiting triage" icon="bell" tone="gold" />
      </div>

      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'tree', label: `Academy groups (${tree.length})` },
          { value: 'keys', label: `API keys (${keys.length})` },
          { value: 'webhooks', label: 'Webhook activity' },
        ]} />
      </div>

      {tab === 'tree' && (
        tree.length === 0 ? (
          <Card className="mt-4"><EmptyState icon="building" title="No academy groups"
            description="No clubs are currently linked under a Federation parent." /></Card>
        ) : (
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3">Parent group</th>
                    <th className="px-4 py-3">Academy</th>
                    <th className="px-4 py-3">Region</th>
                    <th className="px-4 py-3">Players</th>
                    <th className="px-4 py-3">Verified</th>
                    <th className="px-4 py-3">Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {tree.map(r => (
                    <tr key={`${r.parent_id}-${r.academy_id}`} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink-900">{r.parent_name}</td>
                      <td className="px-4 py-3 text-ink-700">{r.academy_name}</td>
                      <td className="px-4 py-3 text-ink-500">{r.academy_state ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-700">{r.player_count}</td>
                      <td className="px-4 py-3"><Badge tone={r.academy_verified ? 'trust' : 'neutral'} size="sm">{r.academy_verified ? 'Yes' : 'No'}</Badge></td>
                      <td className="px-4 py-3 text-xs text-ink-500">{new Date(r.linked_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === 'keys' && (
        keys.length === 0 ? (
          <Card className="mt-4"><EmptyState icon="zap" title="No API keys issued"
            description="Clubs create keys from Club → Developer (Federation)." /></Card>
        ) : (
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3">Club</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Created by</th>
                    <th className="px-4 py-3">Last used</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.key_id} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink-900">{k.club_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-600">{k.key_prefix}… <span className="text-ink-400">({k.key_name})</span></td>
                      <td className="px-4 py-3 text-ink-600">{k.scope.join(', ')}</td>
                      <td className="px-4 py-3 text-ink-500">{k.created_by}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'never'}</td>
                      <td className="px-4 py-3"><Badge tone={k.revoked_at ? 'red' : 'trust'} size="sm">{k.revoked_at ? 'Revoked' : 'Active'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === 'webhooks' && (
        webhooks.length === 0 ? (
          <Card className="mt-4"><EmptyState icon="clock" title="No webhook deliveries yet"
            description="Deliveries appear once clubs register endpoints and events are queued." /></Card>
        ) : (
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3">Club</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">HTTP</th>
                    <th className="px-4 py-3">Endpoint / error</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map(w => (
                    <tr key={`${w.endpoint_url}-${w.created_at}-${w.event}`} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink-900">{w.club_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-700">{w.event}</td>
                      <td className="px-4 py-3"><Badge tone={w.status === 'delivered' ? 'trust' : w.status === 'dead' ? 'red' : w.status === 'failed' ? 'gold' : 'neutral'} size="sm">{w.status}</Badge></td>
                      <td className="px-4 py-3 text-ink-600">{w.attempts}</td>
                      <td className="px-4 py-3 text-ink-600">{w.response_status ?? '—'}</td>
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate text-xs text-ink-500">{w.last_error ?? w.endpoint_url}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  )
}
