import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Modal, Skeleton, Tabs, Textarea, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, formatDate, relativeTime } from '@/lib/utils'
import {
  adminVerifyTrial,
  adminRejectTrial,
  getTrialReviewQueue,
  type TrialReviewRow,
} from '@/lib/supabase/admin'
import { publishEligiblePendingTrials } from '@/lib/supabase/recruitment'

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

  // Pending trial postings awaiting a moderator decision.
  const [trialLoading, setTrialLoading] = useState(true)
  const [trialQueue, setTrialQueue] = useState<TrialReviewRow[]>([])
  const [trialAction, setTrialAction] = useState<'approve' | 'reject' | null>(null)
  const [trialTarget, setTrialTarget] = useState<TrialReviewRow | null>(null)
  const [trialNote, setTrialNote] = useState('')
  const [trialSaving, setTrialSaving] = useState(false)

  async function loadTrials() {
    if (!supabase) { setTrialLoading(false); return }
    setTrialLoading(true)
    try {
      setTrialQueue(await getTrialReviewQueue())
    } catch { /* non-fatal — queue is a convenience */ } finally {
      setTrialLoading(false)
    }
  }

  useEffect(() => { loadTrials() }, [])

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
      // Once entity-verified, publish that club's now-eligible pending trials.
      try { await publishEligiblePendingTrials(r.club_id) } catch { /* best effort */ }
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

  async function decideTrial(approve: boolean) {
    if (!trialTarget) return
    setTrialSaving(true)
    try {
      if (approve) await adminVerifyTrial(trialTarget.id, trialNote.trim() || undefined)
      else await adminRejectTrial(trialTarget.id, trialNote.trim() || undefined)
      toast({
        tone: approve ? 'success' : 'info',
        title: approve ? 'Trial published' : 'Trial rejected',
        description: approve
          ? `“${trialTarget.title}” is now open + verified and visible to players.`
          : 'The club has been notified with your reason.',
      })
      setTrialAction(null); setTrialTarget(null); setTrialNote('')
      await loadTrials()
    } catch (err) {
      toast({ tone: 'error', title: 'Could not update trial', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setTrialSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="shield" title="Verification queue"
        subtitle="Review identity/entity checks and trial postings awaiting publication." />

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-5">
          <div>
            <h3 className="text-sm font-bold">Trial postings awaiting publication</h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Clubs that cannot auto-publish land here. Approve to make the trial open + verified so
              players can see and apply to it, or reject with a reason.
            </p>
          </div>
          <Badge tone={trialQueue.length ? 'gold' : 'trust'} size="sm" icon={trialQueue.length ? 'clock' : 'check-circle'}>
            {trialQueue.length} pending
          </Badge>
        </div>

        {trialLoading ? (
          <div className="p-5"><Skeleton className="h-24 w-full" /></div>
        ) : trialQueue.length === 0 ? (
          <div className="p-5">
            <EmptyState icon="check-circle" title="No trials waiting"
              description="Every posting that auto-published is already live. Nothing needs a decision." />
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {trialQueue.map(t => (
              <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold">{t.title}</p>
                    <Badge tone="blue" size="sm" icon="building">{t.club_name}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {t.positions.join(' · ') || 'All positions'} · {t.age_min}–{t.age_max} yrs · {t.location} · {formatDate(t.trial_date)}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-600">{t.description}</p>
                  <p className="mt-1 text-2xs text-ink-400">posted {relativeTime(t.created_at)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="danger" icon="x"
                    onClick={() => { setTrialTarget(t); setTrialAction('reject'); setTrialNote('') }}>
                    Reject
                  </Button>
                  <Button size="sm" icon="check"
                    onClick={() => { setTrialTarget(t); setTrialAction('approve'); setTrialNote('') }}>
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

      <Modal open={!!trialTarget} onClose={() => { if (!trialSaving) { setTrialTarget(null); setTrialAction(null) } }} size="lg"
        title={trialAction === 'approve' ? 'Approve & publish this trial?' : 'Reject this trial?'}
        description={trialTarget
          ? `“${trialTarget.title}” — ${trialTarget.club_name}. ${trialAction === 'approve'
              ? 'It will become open + verified and players will be able to see and apply to it.'
              : 'It will be cancelled and stay invisible to players until the club edits and resubmits.'}`
          : undefined}
        footer={
          <>
            <Button variant="outline" disabled={trialSaving} onClick={() => { setTrialTarget(null); setTrialAction(null) }}>Cancel</Button>
            <Button
              variant={trialAction === 'approve' ? 'primary' : 'danger'}
              icon={trialAction === 'approve' ? 'check' : 'x'}
              loading={trialSaving}
              disabled={trialAction === 'reject' && !trialNote.trim()}
              onClick={() => trialTarget && void decideTrial(trialAction === 'approve')}>
              {trialAction === 'approve' ? 'Publish trial' : 'Reject trial'}
            </Button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Positions', trialTarget?.positions.join(' · ') || '—'],
              ['Ages', trialTarget ? `${trialTarget.age_min}–${trialTarget.age_max}` : '—'],
              ['Date', trialTarget ? formatDate(trialTarget.trial_date) : '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-ink-50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                <p className="mt-0.5 text-sm font-bold">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-ink-600">{trialTarget?.description}</p>
          <Textarea
            label={trialAction === 'approve' ? 'Note to the club (optional)' : 'Reason for rejection (shown to the club)'}
            value={trialNote}
            maxChars={500}
            onChange={e => setTrialNote(e.target.value)}
            placeholder={trialAction === 'approve'
              ? 'e.g. CAC + NFF confirmed; approved as a trusted posting.'
              : 'e.g. Contact details do not match CAC records. Please correct and repost.'} />
        </div>
      </Modal>
    </div>
  )
}
