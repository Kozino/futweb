import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Modal, Select, Textarea, toast } from '@/components/ui'
import { NoFeeGuarantee, VerificationBadge } from '@/components/trust'
import { DEMO_CLUBS, DEMO_TRIALS } from '@/data/mock'
import { computeTrustScore } from '@/lib/ratings'
import { POSITION_LIST } from '@/lib/ratings'
import { formatDate, relativeTime } from '@/lib/utils'

export default function ClubTrials() {
  const [create, setCreate] = useState(false)
  const [fee, setFee] = useState('0')
  const trust = computeTrustScore({
    emailVerified: true, phoneVerified: true, identityVerified: true, entityVerified: true,
    videoVerified: true, referencesVerified: true, paymentVerified: true, tenureDays: 400, disputesUpheld: 0})

  const feeNum = Number(fee) || 0
  const blocked = feeNum > 0

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="target" title="Trials"
        subtitle="Post trials that players can trust. Verified postings receive far more applications."
        actions={<><VerificationBadge trust={trust} showScore /><Button icon="plus" onClick={() => setCreate(true)}>Post a trial</Button></>} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {DEMO_TRIALS.map(t => (
            <Card key={t.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold">{t.title}</h3>
                      {t.verified
                        ? <Badge tone="trust" icon="shield" size="sm">Verified</Badge>
                        : <Badge tone="warn" icon="alert" size="sm">Pending verification</Badge>}
                      {t.fee_charged_to_player > 0 && (
                        <Badge tone="red" icon="x-circle" size="sm">Fee blocked</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {DEMO_CLUBS.find(c => c.id === t.club_id)?.name} · {t.location} · posted {relativeTime(t.created_at)}
                    </p>
                  </div>
                  <Badge tone={t.status === 'open' ? 'trust' : 'gold'} size="sm">{t.status.replace('_', ' ')}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.positions.map(p => <Badge key={p} tone="neutral" size="sm">{p}</Badge>)}
                  <Badge tone="blue" size="sm">{t.age_min}–{t.age_max} yrs</Badge>
                  <Badge tone="neutral" size="sm" icon="calendar">{formatDate(t.trial_date)}</Badge>
                  <Badge tone={t.fee_charged_to_player > 0 ? 'red' : 'trust'} size="sm">
                    Fee to player: ₦{t.fee_charged_to_player.toLocaleString()}
                  </Badge>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink-700">{t.description}</p>

                <div className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-3">
                  <span className="text-xs font-semibold text-ink-600">
                    {t.applicant_count} applicant{t.applicant_count === 1 ? '' : 's'}
                  </span>
                  <Button size="sm" variant="outline" icon="users" className="ml-auto">Review applicants</Button>
                  <Button size="sm" variant="ghost" icon="edit">Edit</Button>
                </div>
              </div>

              {t.fee_charged_to_player > 0 && (
                <div className="border-t border-red-100 bg-red-50 p-4">
                  <NoFeeGuarantee variant="danger" />
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <NoFeeGuarantee />
          <Card className="p-5">
            <h3 className="text-sm font-bold">Why verification matters here</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              Players in this market have been burned by phantom trials. A verified badge tells them
              FutWeb confirmed your CAC registration and your NFF or state FA affiliation — and that
              you are not charging them a fee.
            </p>
            <div className="mt-4 space-y-2.5">
              {[
                ['Unverified postings', '~5% application rate'],
                ['Entity verified', '~30% application rate'],
                ['Gold verified', '~55% application rate'],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between border-b border-ink-100 pb-2 last:border-0">
                  <span className="text-xs text-ink-600">{l}</span>
                  <span className="text-xs font-bold">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={create} onClose={() => setCreate(false)} size="lg" title="Post a trial"
        description="Trials go live once verification confirms your club details."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreate(false)}>Cancel</Button>
            <Button disabled={blocked} icon="check" onClick={() => { setCreate(false)
              toast({ tone: 'success', title: 'Trial submitted', description: 'Verification usually completes within one working day.' }) }}>
              Submit for verification
            </Button>
          </>
        }>
        <div className="space-y-4">
          <Input label="Trial title" placeholder="Open trials — U23 attacking players" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Age from" options={['16', '17', '18', '20'].map(v => ({ value: v, label: v }))} />
            <Select label="Age to" options={['19', '21', '23', '25'].map(v => ({ value: v, label: v }))} />
            <Input label="Trial date" type="date" />
          </div>
          <Select label="Positions wanted" options={[...POSITION_LIST].map(p => ({ value: p, label: p }))} />
          <Input label="Location" placeholder="Port Harcourt, Rivers State" icon="map" />
          <Textarea label="Description" maxChars={1200}
            hint="Say clearly what is provided — transport, accommodation, kit — and what players should bring." />

          <div>
            <Input label="Fee charged to players (₦)" value={fee} onChange={e => setFee(e.target.value)}
              inputMode="numeric" error={blocked ? 'FutWeb does not permit fees to players. Set this to 0.' : undefined}
              hint="Must be 0. Charging players for trials is a violation of platform policy." />
            {blocked && <NoFeeGuarantee variant="danger" />}
          </div>
        </div>
      </Modal>
    </div>
  )
}
