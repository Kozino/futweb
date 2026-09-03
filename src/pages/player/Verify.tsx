import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, type IconName } from '@/components/ui'
import { TrustPanel, VerificationBadge } from '@/components/trust'
import { useAuth } from '@/context/AuthContext'
import { computeTrustScore } from '@/lib/ratings'
import { toast } from '@/components/ui'
import { useState } from 'react'

const STEPS: { key: string; icon: IconName; title: string; body: string; cta: string; points: number }[] = [
  { key: 'email', icon: 'mail', title: 'Email address', body: 'Confirms you control the address trial invitations are sent to.', cta: 'Resend link', points: 10 },
  { key: 'phone', icon: 'phone', title: 'Phone number', body: 'One-time code to a Nigerian or international line.', cta: 'Verify', points: 10 },
  { key: 'identity', icon: 'user', title: 'Identity (NIN, BVN or passport)', body: 'Matched to the name on your account. This is what defeats impersonation.', cta: 'Start check', points: 20 },
  { key: 'liveness', icon: 'video', title: 'Liveness check', body: 'A three-second video selfie. Proves you are a real person, not a stolen photo.', cta: 'Record', points: 10 },
  { key: 'references', icon: 'users', title: 'Football references', body: 'Two contacts who can confirm you play — a coach, academy or club official.', cta: 'Add references', points: 10 },
]

export default function PlayerVerify() {
  const { user, updateUser } = useAuth()
  const [done, setDone] = useState<string[]>(['email', 'phone'])

  const trust = computeTrustScore({
    emailVerified: done.includes('email'),
    phoneVerified: done.includes('phone'),
    identityVerified: done.includes('identity'),
    entityVerified: false,
    videoVerified: done.includes('liveness'),
    referencesVerified: done.includes('references'),
    paymentVerified: user?.subStatus === 'active',
    tenureDays: 120,
    disputesUpheld: 0})

  function complete(key: string) {
    if (done.includes(key)) return
    setDone(d => [...d, key])
    if (key === 'identity') updateUser({ verificationTier: 'identity', verificationStatus: 'verified' })
    toast({ tone: 'success', title: 'Check complete', description: 'Your trust score has increased.' })
  }

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="shield" title="Verification"
        subtitle="Verification is what makes a club reply. Players with verified profiles get materially more views."
        actions={<VerificationBadge trust={trust} showScore />} />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {STEPS.map(s => {
            const isDone = done.includes(s.key)
            return (
              <Card key={s.key} className="p-5">
                <div className="flex items-start gap-3.5">
                  <span className={isDone
                    ? 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-trust-50 text-trust-600'
                    : 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500'}>
                    <Icon name={isDone ? 'check-circle' : s.icon} size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold">{s.title}</h3>
                      {isDone
                        ? <Badge tone="trust" size="sm" icon="check">Complete</Badge>
                        : <Badge tone="neutral" size="sm">+{s.points} points</Badge>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-600">{s.body}</p>
                  </div>
                  <div className="shrink-0">
                    <Button size="sm" variant={isDone ? 'ghost' : 'outline'} disabled={isDone}
                      onClick={() => complete(s.key)}>
                      {isDone ? 'Done' : s.cta}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="space-y-4">
          <TrustPanel trust={trust} entityName={user?.fullName ?? 'Your account'} />

          <Card className="p-5">
            <h3 className="text-sm font-bold">Who can see what</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                ['Your identity documents', 'Never shown to clubs. Used only for verification.'],
                ['Your verified badge', 'Visible to everyone.'],
                ['Your phone number', 'Visible only to clubs you accept contact from.'],
                ['Your date of birth', 'Visible as your age to verified clubs.'],
              ].map(([l, d]) => (
                <li key={l} className="flex items-start gap-2">
                  <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-ink-400" />
                  <span className="text-xs"><span className="font-semibold text-ink-800">{l}</span> — <span className="text-ink-500">{d}</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-ink-50 p-3.5">
              <p className="text-2xs leading-relaxed text-ink-600">
                Documents are encrypted at rest, access is logged in the audit trail, and they are
                deleted on request under the Nigeria Data Protection Act 2023.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
