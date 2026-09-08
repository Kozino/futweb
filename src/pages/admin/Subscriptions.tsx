import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Modal, Select, Skeleton, Stat, Textarea, Toggle, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PLANS } from '@/lib/constants'
import { formatNGN, relativeTime } from '@/lib/utils'

interface SubRow {
  id: string; subscriber: string; plan_code: string
  status: 'trialing' | 'active' | 'past_due' | 'grace' | 'cancelled' | 'expired' | 'paused'
  current_period_end: string | null; trial_ends_at: string | null; seats_used: number
  account_type?: 'player' | 'club'
  orgName?: string; planName?: string; priceNgn?: number
}

const STATUS_TONE = {
  active: 'trust', past_due: 'warn', grace: 'gold', cancelled: 'neutral',
  expired: 'red', trialing: 'blue', paused: 'neutral',
} as const

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'grace', label: 'Grace period' },
  { value: 'past_due', label: 'Past due' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
]

type Action = 'status' | 'plan' | 'extend' | 'cancel_sched'

export default function Subscriptions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState<SubRow[]>([])
  const [selected, setSelected] = useState<SubRow | null>(null)
  const [action, setAction] = useState<Action>('status')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  // action payloads
  const [status, setStatus] = useState('active')
  const [plan, setPlan] = useState('')
  const [extendKind, setExtendKind] = useState<'grace' | 'trial'>('grace')
  const [extendDays, setExtendDays] = useState('7')
  const [cancelSched, setCancelSched] = useState(false)

  async function load() {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    setLoading(true)
    const { data: rows, error } = await client.from('subscriptions').select('*').order('created_at', { ascending: false })
    if (error) { toast({ tone: 'error', title: 'Could not load subscriptions', description: error.message }); setLoading(false); return }
    const list = rows ?? []
    const subscriberIds = [...new Set(list.map(s => s.subscriber))]
    const planCodes = [...new Set(list.map(s => s.plan_code))]
    const [profilesRes, plansRes, clubsRes] = await Promise.all([
      subscriberIds.length ? client.from('profiles').select('id, full_name, account_type').in('id', subscriberIds) : Promise.resolve({ data: [] as { id: string; full_name: string; account_type: 'player' | 'club' }[] }),
      planCodes.length ? client.from('plans').select('code, name, price_ngn').in('code', planCodes) : Promise.resolve({ data: [] as { code: string; name: string; price_ngn: number }[] }),
      client.from('clubs').select('name, owner_id'),
    ])
    const clubNameByOwner = Object.fromEntries((clubsRes.data ?? []).map(c => [c.owner_id, c.name]))
    const orgById = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, clubNameByOwner[p.id] ?? p.full_name]))
    const typeById = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.account_type]))
    const planByCode = Object.fromEntries((plansRes.data ?? []).map(p => [p.code, p]))
    setSubs(list.map(s => ({
      ...s,
      account_type: typeById[s.subscriber] ?? undefined,
      orgName: orgById[s.subscriber] ?? 'Unknown account',
      planName: planByCode[s.plan_code]?.name ?? s.plan_code,
      priceNgn: planByCode[s.plan_code]?.price_ngn ?? 0,
    })))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const mrr = useMemo(() => subs
    .filter(s => s.status === 'active' || s.status === 'trialing')
    .reduce((sum, s) => sum + (s.priceNgn ?? 0), 0), [subs])

  function openManage(s: SubRow) {
    setSelected(s)
    setAction('status')
    setStatus(s.status)
    setPlan(s.plan_code)
    setExtendKind('grace'); setExtendDays('7')
    setCancelSched(s.status === 'cancelled')
    setReason('')
  }

  async function runAction() {
    if (!supabase || !selected) return
    const client = supabase
    setBusy(true)
    let rpc: string
    let params: Record<string, unknown>
    const subscriber = selected.subscriber
    const audience = selected.account_type ?? 'player'
    const allowedPlanCodes = audience === 'club'
      ? ['club_academy', 'club_pro', 'club_enterprise']
      : ['player_scout', 'player_pro', 'player_elite']
    if (action === 'status') {
      rpc = 'admin_set_subscription_status'; params = { p_subscriber: subscriber, p_status: status, p_reason: reason || null }
    } else if (action === 'plan') {
      if (!plan || !allowedPlanCodes.includes(plan)) {
        setBusy(false); toast({ tone: 'error', title: 'Pick a valid plan for this account type' }); return
      }
      rpc = 'admin_change_plan'; params = { p_subscriber: subscriber, p_plan_code: plan }
    } else if (action === 'extend') {
      const days = Math.max(1, Math.min(365, Number(extendDays) || 0))
      if (!days) { setBusy(false); toast({ tone: 'error', title: 'Enter a day count (1–365)' }); return }
      rpc = 'admin_extend_period'; params = { p_subscriber: subscriber, p_kind: extendKind, p_days: days, p_reason: reason || null }
    } else {
      rpc = 'admin_cancel_at_period_end'; params = { p_subscriber: subscriber, p_cancel: cancelSched }
    }
    const { error } = await client.rpc(rpc, params)
    setBusy(false)
    if (error) {
      toast({ tone: 'error', title: 'Action failed', description: error.message })
      return
    }
    toast({ tone: 'success', title: 'Subscription updated' })
    setSelected(null)
    void load()
  }

  const selectedPlans = selected
    ? (selected.account_type ?? 'player') === 'club'
      ? PLANS.filter(p => p.audience === 'club')
      : PLANS.filter(p => p.audience === 'player')
    : []

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="card" title="Subscriptions"
        subtitle="Change plans, force status, extend grace/trial, or schedule cancellation. Money actions (refund) run through the deployed refund function." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={formatNGN(mrr, { compact: true })} icon="card" tone="trust" />
        <Stat label="Active subscriptions" value={subs.filter(s => s.status === 'active').length} icon="check" />
        <Stat label="Past due" value={subs.filter(s => s.status === 'past_due').length} icon="alert" tone="red" />
        <Stat label="Grace period" value={subs.filter(s => s.status === 'grace').length} icon="alert" tone="gold" />
      </div>

      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Account', 'Type', 'Plan', 'Status', 'MRR', 'Renews', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {subs.map(s => (
              <tr key={s.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-semibold">{s.orgName}</td>
                <td className="px-4 py-3"><Badge tone={s.account_type === 'club' ? 'blue' : 'neutral'} size="sm">{s.account_type ?? '—'}</Badge></td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{s.planName}</Badge></td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.status]} size="sm">{s.status.replace('_', ' ')}</Badge></td>
                <td className="tnum px-4 py-3 font-bold">
                  {(s.status === 'active' || s.status === 'trialing') && s.priceNgn ? formatNGN(s.priceNgn) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-ink-500">
                  {relativeTime(s.status === 'trialing' ? (s.trial_ends_at ?? s.current_period_end ?? '') : (s.current_period_end ?? ''))}
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" onClick={() => openManage(s)}>Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg"
        title={`Manage — ${selected?.orgName ?? ''}`}
        description={selected ? `${selected.account_type ?? 'account'} · ${selected.planName} · ${selected.status.replace('_', ' ')}` : undefined}
        footer={<>
          <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          <Button loading={busy} onClick={() => void runAction()}
            icon={action === 'cancel_sched' ? 'check' : 'check'}>Apply</Button>
        </>}>
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">Action</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['status', 'Change status'], ['plan', 'Change plan'],
                  ['extend', 'Extend grace/trial'], ['cancel_sched', 'Cancel at period end'],
                ] as [Action, string][]).map(([a, l]) => (
                  <button key={a} type="button"
                    onClick={() => setAction(a)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${action === a ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {action === 'status' && (
              <Select label="New status" value={status} onChange={e => setStatus(e.target.value)} options={STATUS_OPTIONS} />
            )}
            {action === 'plan' && (
              <Select label={`New plan (${selected.account_type ?? 'player'})`} value={plan} onChange={e => setPlan(e.target.value)}
                options={selectedPlans.map(p => ({ value: p.code, label: `${p.name} — ${formatNGN(p.price_ngn)}/mo` }))} />
            )}
            {action === 'extend' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Extend" value={extendKind} onChange={e => setExtendKind(e.target.value as 'grace' | 'trial')}
                  options={[{ value: 'grace', label: 'Grace period' }, { value: 'trial', label: 'Trial' }]} />
                <Select label="Days" value={extendDays} onChange={e => setExtendDays(e.target.value)}
                  options={[7, 14, 21, 30, 60, 90].map(d => ({ value: String(d), label: `${d} days` }))} />
              </div>
            )}
            {action === 'cancel_sched' && (
              <Toggle checked={cancelSched} onChange={setCancelSched} label="Cancel at period end"
                description="Retains access until the current period ends, then the status is set to cancelled." />
            )}
            {(action === 'status' || action === 'extend') && (
              <Textarea label="Reason (recorded in audit log)" value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder="Optional note for the audit trail" />
            )}
            {action === 'status' && status === 'cancelled' && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Setting status to <b>cancelled</b> immediately withdraws paid access at the database (sub_status changes), matching the access-withdrawal policy.
              </p>
            )}
            <p className="text-xs text-ink-400">Actor: {user?.email ?? user?.id?.slice(0, 8)} — every change is audit-logged.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
