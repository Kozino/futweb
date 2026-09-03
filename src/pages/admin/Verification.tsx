import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Modal, Tabs, Textarea, toast } from '@/components/ui'
import { cn, formatDate, relativeTime } from '@/lib/utils'

interface Review {
  id: string; name: string; type: 'club' | 'player'; cac?: string; nff?: string;
  state: string; submitted: string; docs: string[]; risk: 'low' | 'medium' | 'high'
}

const QUEUE: Review[] = [
  { id: 'r1', name: 'Lagos Talent Hub', type: 'club', state: 'Lagos', submitted: new Date(Date.now() - 3 * 3600000).toISOString(),
    docs: ['CAC certificate (RC204419)', 'State FA letter', 'NIN — account owner'], risk: 'high' },
  { id: 'r2', name: 'Golden Boot Academy', type: 'club', cac: 'RC204419', nff: 'NFF/KT/118', state: 'Katsina',
    submitted: new Date(Date.now() - 26 * 3600000).toISOString(),
    docs: ['CAC certificate (RC204419)', 'NFF affiliation', 'NIN — account owner', 'Two references'], risk: 'low' },
  { id: 'r3', name: 'Yusuf Danjuma', type: 'player', state: 'Katsina', submitted: new Date(Date.now() - 5 * 3600000).toISOString(),
    docs: ['NIN slip', 'Guardian consent form', 'School enrolment'], risk: 'medium' },
  { id: 'r4', name: 'Warri Wolves FC', type: 'club', cac: 'RC188201', nff: 'NFF/DL/088', state: 'Delta',
    submitted: new Date(Date.now() - 50 * 3600000).toISOString(),
    docs: ['CAC certificate (RC188201)', 'NFF affiliation', 'NIN — account owner'], risk: 'low' },
]

export default function Verification() {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [selected, setSelected] = useState<Review | null>(null)
  const [note, setNote] = useState('')
  const [queue, setQueue] = useState(QUEUE)

  const items = tab === 'pending' ? queue : tab === 'approved' ? [] : []

  const decide = (r: Review, approve: boolean) => {
    setQueue(q => q.filter(x => x.id !== r.id))
    setSelected(null); setNote('')
    toast({
      tone: approve ? 'success' : 'info',
      title: approve ? `${r.name} verified` : `${r.name} rejected`,
      description: approve ? 'Their trust score has been updated.' : 'They have been notified with your reason.'})
  }

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="shield" title="Verification queue"
        subtitle="Every check is recorded in the audit trail. Decisions are appealable and traceable." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'pending', label: 'Pending', count: queue.length },
        { value: 'approved', label: 'Approved', count: 0 },
        { value: 'rejected', label: 'Rejected', count: 0 },
      ]} />

      {items.length === 0 ? (
        <Card className="mt-5"><EmptyState icon="check-circle" title="Queue is clear"
          description="No items awaiting review in this view." /></Card>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            {items.map(r => (
              <Card key={r.id} hover className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xs font-bold',
                      r.type === 'club' ? 'bg-ink-900 text-white' : 'bg-red-500 text-white')}>
                      {r.type === 'club' ? <Icon name="building" size={18} /> : <Icon name="user" size={18} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold">{r.name}</p>
                        <Badge tone={r.risk === 'high' ? 'red' : r.risk === 'medium' ? 'gold' : 'trust'} size="sm">
                          {r.risk} risk
                        </Badge>
                      </div>
                      <p className="text-2xs text-ink-500">
                        {r.state} · submitted {relativeTime(r.submitted)} · {r.docs.length} documents
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setSelected(r)} icon="eye">Review</Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.docs.map(d => (
                    <span key={d} className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-2xs font-medium text-ink-600">
                      <Icon name="doc" size={10} />{d}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-bold">Review checklist</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                'Does the CAC number resolve to this exact entity?',
                'Is the NFF or state FA affiliation current?',
                'Does the account holder match the identity document?',
                'Did the liveness check pass?',
                'Have references confirmed independently?',
                'Any prior disputes against this account?',
                'Is the entity on any warning list?',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 text-red-500 focus:ring-red-500" />
                  <span className="text-xs text-ink-700">{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5">
              <p className="flex items-start gap-2 text-2xs font-medium text-red-800">
                <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                Approving an unverified entity exposes players to financial harm. When in doubt,
                reject and request clearer documentation.
              </p>
            </div>
          </Card>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg"
        title={selected?.name} description={`${selected?.type === 'club' ? 'Club' : 'Player'} verification review`}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="danger" icon="x" onClick={() => selected && decide(selected, false)}>Reject</Button>
            <Button icon="check" onClick={() => selected && decide(selected, true)}>Approve</Button>
          </>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Type', selected.type],
                ['State', selected.state],
                ['Submitted', formatDate(selected.submitted)],
                ...(selected.cac ? [['CAC number', selected.cac]] : []),
                ...(selected.nff ? [['NFF affiliation', selected.nff]] : []),
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l as string}</p>
                  <p className="mt-0.5 text-sm font-bold capitalize">{v as string}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="fw-label">Submitted documents</p>
              <div className="space-y-2">
                {selected.docs.map(d => (
                  <div key={d} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <Icon name="doc" size={16} className="shrink-0 text-ink-400" />
                    <span className="flex-1 text-xs font-medium">{d}</span>
                    <Button size="sm" variant="ghost" icon="eye">View</Button>
                    <Button size="sm" variant="ghost" icon="download" />
                  </div>
                ))}
              </div>
            </div>

            <Textarea label="Reviewer notes" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Record what you checked and why. This is appended to the immutable audit log." />

            {selected.risk === 'high' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                <p className="flex items-start gap-2 text-xs font-medium text-red-800">
                  <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                  High risk: this account was created recently, has no affiliation record and matches
                  a pattern associated with fraudulent trial postings.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
