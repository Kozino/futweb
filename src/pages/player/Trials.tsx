import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Tabs, toast } from '@/components/ui'
import { NoFeeGuarantee, VerificationBadge } from '@/components/trust'
import { DEMO_TRIALS } from '@/data/mock'
import { DEMO_CLUBS } from '@/data/mock'
import { computeTrustScore } from '@/lib/ratings'
import { formatDate, relativeTime } from '@/lib/utils'
import { useOffline } from '@/context/OfflineContext'

export default function PlayerTrials() {
  const [tab, setTab] = useState<'invited' | 'applied' | 'open'>('invited')
  const { enqueue } = useOffline()
  const [applied, setApplied] = useState<string[]>([])

  const trustFor = (clubId: string) => {
    const c = DEMO_CLUBS.find(x => x.id === clubId)!
    return computeTrustScore({
      emailVerified: true, phoneVerified: true,
      identityVerified: ['identity', 'entity', 'gold'].includes(c.verification_tier),
      entityVerified: ['entity', 'gold'].includes(c.verification_tier),
      videoVerified: c.verification_tier === 'gold',
      referencesVerified: c.verification_tier !== 'unverified',
      paymentVerified: true, tenureDays: 300, disputesUpheld: 0,
    })
  }

  const openTrials = DEMO_TRIALS.filter(t => t.status === 'open')

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="target" title="Trials & offers"
        subtitle="Every posting here is from a club FutWeb has checked. None may charge you a fee." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'invited', label: 'Invitations', count: 2 },
        { value: 'applied', label: 'Applications', count: applied.length },
        { value: 'open', label: 'Open trials', count: openTrials.length },
      ]} />

      {tab === 'invited' && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {DEMO_TRIALS.filter(t => t.verified).map(t => {
            const club = DEMO_CLUBS.find(c => c.id === t.club_id)!
            const trust = trustFor(t.club_id)
            return (
              <Card key={t.id} className="overflow-hidden">
                <div className="border-b border-ink-100 bg-gradient-to-br from-ink-50 to-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold">{t.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{club.name} · {t.location}</p>
                    </div>
                    <VerificationBadge trust={trust} size="sm" showScore />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.positions.map(p => <Badge key={p} tone="neutral" size="sm">{p}</Badge>)}
                    <Badge tone="blue" size="sm">{t.age_min}–{t.age_max} yrs</Badge>
                    <Badge tone="trust" size="sm" icon="calendar">{formatDate(t.trial_date)}</Badge>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm leading-relaxed text-ink-700">{t.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Button icon="check" onClick={() => toast({ tone: 'success', title: 'Application sent', description: `${club.name} has been notified.` })}>
                      Accept invitation
                    </Button>
                    <Button variant="outline" onClick={() => toast({ tone: 'info', title: 'Declined', description: 'The club has been informed.' })}>
                      Decline
                    </Button>
                  </div>
                </div>
                <div className="border-t border-ink-100 bg-trust-50/60 px-5 py-3">
                  <p className="flex items-center gap-1.5 text-2xs font-semibold text-trust-700">
                    <Icon name="shield" size={12} />
                    Verified posting · Fee to player ₦0 · {t.applicant_count} players applied
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'applied' && (
        applied.length === 0
          ? <Card className="mt-5"><EmptyState icon="target" title="No applications yet"
              description="Apply to an open trial and it will appear here with its status."
              action={<Button onClick={() => setTab('open')}>Browse open trials</Button>} /></Card>
          : <div className="mt-5 space-y-3">
              {applied.map(id => {
                const t = DEMO_TRIALS.find(x => x.id === id)!
                return <Card key={id} className="p-4"><p className="text-sm font-bold">{t.title}</p></Card>
              })}
            </div>
      )}

      {tab === 'open' && (
        <div className="mt-5 space-y-4">
          {openTrials.map(t => {
            const club = DEMO_CLUBS.find(c => c.id === t.club_id)!
            const trust = trustFor(t.club_id)
            const isApplied = applied.includes(t.id)
            return (
              <Card key={t.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{t.title}</p>
                      <VerificationBadge trust={trust} size="sm" />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">{club.name} · {t.location} · posted {relativeTime(t.created_at)}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {t.positions.map(p => <Badge key={p} tone="neutral" size="sm">{p}</Badge>)}
                      <Badge tone="blue" size="sm">{t.age_min}–{t.age_max} yrs</Badge>
                      <Badge tone="trust" size="sm" icon="calendar">{formatDate(t.trial_date)}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-700">{t.description}</p>
                  </div>
                  <div className="shrink-0">
                    <Button disabled={isApplied} icon={isApplied ? 'check' : 'arrow-right'}
                      onClick={async () => {
                        await enqueue('trial', { trial_id: t.id, action: 'apply' })
                        setApplied(a => [...a, t.id])
                        toast({ tone: 'success', title: 'Application submitted', description: `${club.name} will review your CV.` })
                      }}>
                      {isApplied ? 'Applied' : 'Apply'}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}

          <NoFeeGuarantee />
        </div>
      )}
    </div>
  )
}
