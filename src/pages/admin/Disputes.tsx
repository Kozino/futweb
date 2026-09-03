import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Modal, Tabs, Textarea, toast } from '@/components/ui'
import { formatDate } from '@/lib/utils'

const DISPUTES = [
  { id: 'd1', type: 'fee', reporter: 'Chidi Okonkwo', against: 'Lagos Talent Hub', opened: new Date(Date.now() - 2 * 86400000).toISOString(),
    severity: 'high', status: 'open', summary: 'Club demanded ₦45,000 registration fee before allowing the player to attend a trial.' },
  { id: 'd2', type: 'impersonation', reporter: 'Musa Ibrahim', against: 'Unknown (WhatsApp)', opened: new Date(Date.now() - 5 * 86400000).toISOString(),
    severity: 'high', status: 'escalated', summary: 'Individual using Rivers United branding requested payment for a "contract processing" fee.' },
  { id: 'd3', type: 'minor', reporter: 'Guardian of Yusuf Danjuma', against: 'Unverified agent', opened: new Date(Date.now() - 9 * 86400000).toISOString(),
    severity: 'critical', status: 'escalated', summary: 'Agent approached a 16-year-old directly and offered a European trial without guardian involvement.' },
]

export default function Disputes() {
  const [tab, setTab] = useState<'open' | 'escalated' | 'resolved'>('open')
  const [selected, setSelected] = useState<typeof DISPUTES[0] | null>(null)
  const items = DISPUTES.filter(d => d.status === tab)

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="alert" title="Disputes & reports"
        subtitle="Every report is reviewed by a human. Critical cases escalate to the NFF and the EFCC." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'open', label: 'Open', count: DISPUTES.filter(d => d.status === 'open').length },
        { value: 'escalated', label: 'Escalated', count: DISPUTES.filter(d => d.status === 'escalated').length },
        { value: 'resolved', label: 'Resolved', count: 0 },
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
                    <Badge tone={d.severity === 'critical' ? 'red' : d.severity === 'high' ? 'warn' : 'neutral'} size="sm">
                      {d.severity}
                    </Badge>
                    <Badge tone="blue" size="sm">{d.type}</Badge>
                    <p className="text-sm font-bold">{d.reporter} vs {d.against}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{d.summary}</p>
                  <p className="mt-1 text-2xs text-ink-400">Opened {formatDate(d.opened)}</p>
                </div>
                <Button size="sm" onClick={() => setSelected(d)} icon="eye">Review</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg" title="Dispute review"
        description={selected ? `${selected.reporter} vs ${selected.against}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button variant="danger" icon="alert"
              onClick={() => { setSelected(null); toast({ tone: 'success', title: 'Escalated', description: 'NFF and EFCC have been notified with the audit trail.' }) }}>
              Escalate to NFF / EFCC
            </Button>
            <Button icon="check" onClick={() => { setSelected(null); toast({ tone: 'success', title: 'Dispute upheld', description: 'The account trust score has been reduced.' }) }}>
              Uphold & penalise
            </Button>
          </>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[['Type', selected.type], ['Severity', selected.severity], ['Opened', formatDate(selected.opened)]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                  <p className="mt-0.5 text-sm font-bold capitalize">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-ink-700">{selected.summary}</p>
            <Textarea label="Investigation notes" placeholder="What the audit trail shows, what you decided and why." />
            <div className="rounded-xl bg-ink-50 p-3.5">
              <p className="flex items-start gap-2 text-2xs text-ink-600">
                <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
                The reporter's identity is withheld from the accused party unless a formal complaint
                is filed. Every action here is written to the immutable audit log.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
