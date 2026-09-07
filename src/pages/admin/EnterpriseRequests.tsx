import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Select, Skeleton, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatDate, relativeTime } from '@/lib/utils'

interface RequestRow {
  id: string
  requester_id: string
  organisation: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  needs: string | null
  message: string | null
  status: 'new' | 'contacted' | 'approved' | 'declined'
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
]

const STATUS_META: Record<string, { label: string; tone: 'gold' | 'blue' | 'trust' | 'red' }> = {
  new: { label: 'New', tone: 'gold' },
  contacted: { label: 'Contacted', tone: 'blue' },
  approved: { label: 'Approved', tone: 'trust' },
  declined: { label: 'Declined', tone: 'red' },
}

export default function EnterpriseRequests() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RequestRow[]>([])
  const [filter, setFilter] = useState('all')

  async function load() {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('enterprise_requests').select('*').order('created_at', { ascending: false })
    if (error) { toast({ tone: 'error', title: 'Could not load requests', description: error.message }); setLoading(false); return }
    setRows((data ?? []) as RequestRow[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function setStatus(id: string, status: RequestRow['status']) {
    if (!supabase) return
    const { error } = await supabase.from('enterprise_requests').update({ status }).eq('id', id)
    if (error) { toast({ tone: 'error', title: 'Update failed', description: error.message }); return }
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    toast({ tone: 'success', title: 'Updated', description: `Marked ${STATUS_META[status].label.toLowerCase()}.` })
  }

  const filtered = useMemo(() => rows.filter(r => filter === 'all' || r.status === filter), [rows, filter])
  const counts = useMemo(() => ({ new: rows.filter(r => r.status === 'new').length, total: rows.length }), [rows])

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="building" title="Enterprise requests"
        subtitle={`${counts.new} new of ${counts.total} total Federation / enterprise inquiries`} />

      <div className="mt-5 flex items-center justify-between">
        <Select className="max-w-[200px]" value={filter} onChange={e => setFilter(e.target.value)}
          options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS]} />
        <Button variant="outline" size="sm" icon="refresh" onClick={() => void load()}>Refresh</Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-3"><EmptyState icon="building" title="No requests" description="Federation / enterprise inquiries will appear here." /></Card>
      ) : (
        <div className="mt-3 space-y-3">
          {filtered.map(r => {
            const meta = STATUS_META[r.status]
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink-900">{r.organisation}</p>
                      <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {r.contact_name} · <a className="text-red-500 underline" href={`mailto:${r.contact_email}`}>{r.contact_email}</a>
                      {r.contact_phone ? ` · ${r.contact_phone}` : ''} · requested {relativeTime(r.created_at)}
                    </p>
                  </div>
                  <Select className="max-w-[160px]" value={r.status}
                    onChange={e => void setStatus(r.id, e.target.value as RequestRow['status'])}
                    options={STATUS_OPTIONS} />
                </div>
                {r.needs && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.needs.split(',').map((n, i) => n.trim() ? <Badge key={i} tone="neutral" size="sm">{n.trim()}</Badge> : null)}
                  </div>
                )}
                {r.message && <p className="mt-3 text-sm leading-relaxed text-ink-600">{r.message}</p>}
                <p className="mt-2 text-2xs text-ink-300">submitted {formatDate(r.created_at)}</p>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
