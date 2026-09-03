import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Modal, Skeleton, Tabs, Textarea, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, formatDate, relativeTime } from '@/lib/utils'

interface VDoc { id: string; kind: string; storage_path: string; uploaded_at: string }
interface VRequest {
  id: string; subject_id: string; club_id: string | null; kind: string
  status: 'none' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'
  reviewer_note: string | null; submitted_at: string; decided_at: string | null
  subjectName?: string; clubName?: string; docs: VDoc[]
}

type Tab = 'pending' | 'verified' | 'rejected'

export default function Verification() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [all, setAll] = useState<VRequest[]>([])
  const [tab, setTab] = useState<Tab>('pending')
  const [selected, setSelected] = useState<VRequest | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    setLoading(true)
    const { data: reqs, error } = await client
      .from('verification_requests')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) { toast({ tone: 'error', title: 'Could not load verification queue', description: error.message }); setLoading(false); return }
    const rows = reqs ?? []

    const subjectIds = [...new Set(rows.map(r => r.subject_id))]
    const clubIds = [...new Set(rows.map(r => r.club_id).filter(Boolean))] as string[]
    const reqIds = rows.map(r => r.id)

    const [profilesRes, clubsRes, docsRes] = await Promise.all([
      subjectIds.length ? client.from('profiles').select('id, full_name').in('id', subjectIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      clubIds.length ? client.from('clubs').select('id, name').in('id', clubIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      reqIds.length ? client.from('verification_documents').select('*').in('request_id', reqIds) : Promise.resolve({ data: [] as (VDoc & { request_id: string })[] }),
    ])
    const nameById = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.full_name]))
    const clubById = Object.fromEntries((clubsRes.data ?? []).map(c => [c.id, c.name]))
    const docsByReq: Record<string, VDoc[]> = {}
    for (const d of (docsRes.data ?? [])) {
      const rid = (d as VDoc & { request_id: string }).request_id
      docsByReq[rid] = [...(docsByReq[rid] ?? []), d]
    }

    setAll(rows.map(r => ({
      ...r,
      subjectName: nameById[r.subject_id] ?? 'Unknown subject',
      clubName: r.club_id ? clubById[r.club_id] : undefined,
      docs: docsByReq[r.id] ?? [],
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const items = useMemo(() => all.filter(r =>
    tab === 'pending' ? (r.status === 'pending' || r.status === 'in_review') :
    tab === 'verified' ? r.status === 'verified' :
    r.status === 'rejected'
  ), [all, tab])

  async function decide(r: VRequest, approve: boolean) {
    if (!supabase) return
    setSaving(true)
    const { error } = await supabase.from('verification_requests').update({
      status: approve ? 'verified' : 'rejected',
      reviewer_id: user?.id,
      reviewer_note: note || null,
      decided_at: new Date().toISOString(),
    }).eq('id', r.id)

    if (error) {
      toast({ tone: 'error', title: 'Update failed', description: error.message })
      setSaving(false)
      return
    }

    if (approve && r.club_id) {
      await supabase.from('clubs').update({
        entity_verified: true, entity_verified_at: new Date().toISOString(),
      }).eq('id', r.club_id)
    }

    toast({
      tone: approve ? 'success' : 'info',
      title: approve ? `${r.subjectName ?? 'Request'} verified` : `${r.subjectName ?? 'Request'} rejected`,
      description: approve ? 'Their verification status has been updated.' : 'They have been notified with your note.',
    })
    setSelected(null); setNote(''); setSaving(false)
    load()
  }

  async function viewDoc(path: string) {
    if (!supabase) return
    const { data, error } = await supabase.storage.from('verification').createSignedUrl(path, 300)
    if (error || !data) { toast({ tone: 'error', title: 'Could not open document', description: error?.message ?? 'Unknown error' }); return }
    window.open(data.signedUrl, '_blank')
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="shield" title="Verification queue"
        subtitle="Every check is recorded. Decisions are appealable and traceable." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'pending', label: 'Pending', count: all.filter(r => r.status === 'pending' || r.status === 'in_review').length },
        { value: 'verified', label: 'Verified', count: all.filter(r => r.status === 'verified').length },
        { value: 'rejected', label: 'Rejected', count: all.filter(r => r.status === 'rejected').length },
      ]} />

      {items.length === 0 ? (
        <Card className="mt-5"><EmptyState icon="check-circle" title="Queue is clear" description="No items in this view." /></Card>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map(r => (
            <Card key={r.id} hover className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xs font-bold',
                    r.club_id ? 'bg-ink-900 text-white' : 'bg-red-500 text-white')}>
                    <Icon name={r.club_id ? 'building' : 'user'} size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{r.clubName ?? r.subjectName}</p>
                      <Badge tone="blue" size="sm">{r.kind}</Badge>
                    </div>
                    <p className="text-2xs text-ink-500">
                      submitted {relativeTime(r.submitted_at)} · {r.docs.length} document{r.docs.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setSelected(r)} icon="eye">Review</Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.docs.map(d => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-2xs font-medium text-ink-600">
                    <Icon name="doc" size={10} />{d.kind}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg"
        title={selected?.clubName ?? selected?.subjectName}
        description={selected?.club_id ? 'Club verification review' : 'Player verification review'}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="danger" icon="x" loading={saving} onClick={() => selected && decide(selected, false)}>Reject</Button>
            <Button icon="check" loading={saving} onClick={() => selected && decide(selected, true)}>Approve</Button>
          </>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Kind', selected.kind],
                ['Submitted', formatDate(selected.submitted_at)],
                ['Status', selected.status.replace('_', ' ')],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                  <p className="mt-0.5 text-sm font-bold capitalize">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="fw-label">Submitted documents</p>
              <div className="space-y-2">
                {selected.docs.length === 0 && <p className="text-xs text-ink-400">No documents attached.</p>}
                {selected.docs.map(d => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <Icon name="doc" size={16} className="shrink-0 text-ink-400" />
                    <span className="flex-1 text-xs font-medium">{d.kind}</span>
                    <Button size="sm" variant="ghost" icon="eye" onClick={() => viewDoc(d.storage_path)}>View</Button>
                  </div>
                ))}
              </div>
            </div>

            <Textarea label="Reviewer notes" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Record what you checked and why." />
          </div>
        )}
      </Modal>
    </div>
  )
}
