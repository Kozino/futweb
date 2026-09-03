import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Modal, Skeleton, Tabs, Textarea, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/utils'

interface Dispute {
  id: string; reporter_id: string; accused_id: string | null; accused_club_id: string | null
  kind: string; severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_review' | 'escalated' | 'upheld' | 'dismissed' | 'resolved'
  summary: string; escalated_to_nff: boolean; created_at: string
  reporterName?: string; accusedName?: string
}

type Tab = 'open' | 'escalated' | 'resolved'

export default function Disputes() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [all, setAll] = useState<Dispute[]>([])
  const [tab, setTab] = useState<Tab>('open')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data: rows, error } = await supabase.from('disputes').select('*').order('created_at', { ascending: false })
    if (error) { toast({ tone: 'error', title: 'Could not load disputes', description: error.message }); setLoading(false); return }
    const list = rows ?? []
    const peopleIds = [...new Set([...list.map(d => d.reporter_id), ...list.map(d => d.accused_id)].filter(Boolean))] as string[]
    const clubIds = [...new Set(list.map(d => d.accused_club_id).filter(Boolean))] as string[]
    const [profilesRes, clubsRes] = await Promise.all([
      peopleIds.length ? supabase.from('profiles').select('id, full_name').in('id', peopleIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      clubIds.length ? supabase.from('clubs').select('id, name').in('id', clubIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ])
    const nameById = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.full_name]))
    const clubById = Object.fromEntries((clubsRes.data ?? []).map(c => [c.id, c.name]))
    setAll(list.map(d => ({
      ...d,
      reporterName: nameById[d.reporter_id] ?? 'Unknown reporter',
      accusedName: d.accused_club_id ? (clubById[d.accused_club_id] ?? 'Unknown club') : d.accused_id ? (nameById[d.accused_id] ?? 'Unknown user') : 'Unknown (external)',
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const items = useMemo(() => all.filter(d =>
    tab === 'open' ? (d.status === 'open' || d.status === 'in_review') :
    tab === 'escalated' ? d.status === 'escalated' :
    (d.status === 'resolved' || d.status === 'upheld' || d.status === 'dismissed')
  ), [all, tab])

  async function escalate(d: Dispute) {
    setSaving(true)
    const { error } = await supabase.from('disputes').update({
      status: 'escalated', escalated_to_nff: true, handler_id: user?.id,
    }).eq('id', d.id)
    setSaving(false)
    if (error) { toast({ tone: 'error', title: 'Update failed', description: error.message }); return }
    toast({ tone: 'success', title: 'Escalated', description: 'Marked as escalated to NFF / EFCC.' })
    setSelected(null); load()
  }

  async function uphold(d: Dispute) {
    setSaving(true)
    const { error } = await supabase.from('disputes').update({
      status: 'upheld', handler_id: user?.id, resolution: resolution || null,
      resolved_at: new Date().toISOString(),
    }).eq('id', d.id)
    setSaving(false)
    if (error) { toast({ tone: 'error', title: 'Update failed', description: error.message }); return }
    toast({ tone: 'success', title: 'Dispute upheld', description: 'The account trust score has been reduced.' })
    setSelected(null); setResolution(''); load()
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="alert" title="Disputes & reports"
        subtitle="Every report is reviewed by a human. Critical cases escalate to the NFF and the EFCC." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'open', label: 'Open', count: all.filter(d => d.status === 'open' || d.status === 'in_review').length },
        { value: 'escalated', label: 'Escalated', count: all.filter(d => d.status === 'escalated').length },
        { value: 'resolved', label: 'Resolved', count: all.filter(d => ['resolved', 'upheld', 'dismissed'].includes(d.status)).length },
      ]} />

      {items.length === 0 ? (
        <Card className="mt-5"><EmptyState icon="check-circle" title="Nothing in this view" /></Card>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map(d => (
            <Card key={d.id} hover className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={d.severity === 'critical' ? 'red' : d.severity === 'high' ? 'warn' : 'neutral'} size="sm">{d.severity}</Badge>
                    <Badge tone="blue" size="sm">{d.kind}</Badge>
                    <p className="text-sm font-bold">{d.reporterName} vs {d.accusedName}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{d.summary}</p>
                  <p className="mt-1 text-2xs text-ink-400">Opened {formatDate(d.created_at)}</p>
                </div>
                <Button size="sm" onClick={() => setSelected(d)} icon="eye">Review</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg" title="Dispute review"
        description={selected ? `${selected.reporterName} vs ${selected.accusedName}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button variant="danger" icon="alert" loading={saving} onClick={() => selected && escalate(selected)}>Escalate to NFF / EFCC</Button>
            <Button icon="check" loading={saving} onClick={() => selected && uphold(selected)}>Uphold & penalise</Button>
          </>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[['Kind', selected.kind], ['Severity', selected.severity], ['Opened', formatDate(selected.created_at)]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                  <p className="mt-0.5 text-sm font-bold capitalize">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-ink-700">{selected.summary}</p>
            <Textarea label="Resolution notes" value={resolution} onChange={e => setResolution(e.target.value)}
              placeholder="What the audit trail shows, what you decided and why." />
          </div>
        )}
      </Modal>
    </div>
  )
}
