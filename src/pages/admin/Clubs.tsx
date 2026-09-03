import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Select, toast } from '@/components/ui'
import { VerificationBadge } from '@/components/trust'
import { DEMO_CLUBS } from '@/data/mock'
import { computeTrustScore } from '@/lib/ratings'
import { formatDate } from '@/lib/utils'

export default function AdminClubs() {
  const [q, setQ] = useState('')
  const [tier, setTier] = useState('')
  const rows = DEMO_CLUBS.filter(c =>
    (!q || c.name.toLowerCase().includes(q.toLowerCase())) && (!tier || c.verification_tier === tier))

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="users" title="Clubs"
        subtitle={`${DEMO_CLUBS.length} registered organisations`}
        actions={<Button variant="outline" icon="download">Export CSV</Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" icon="search" placeholder="Search clubs…" value={q} onChange={e => setQ(e.target.value)} />
        <Select className="max-w-[200px]" value={tier} onChange={e => setTier(e.target.value)}
          placeholder="All verification tiers"
          options={[
            { value: 'gold', label: 'Gold verified' }, { value: 'entity', label: 'Entity verified' },
            { value: 'identity', label: 'Identity verified' }, { value: 'unverified', label: 'Unverified' },
          ]} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Club', 'League', 'Location', 'Trust', 'Players', 'Staff', 'Plan', 'Joined', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(c => {
              const trust = computeTrustScore({
                emailVerified: true, phoneVerified: true,
                identityVerified: ['identity', 'entity', 'gold'].includes(c.verification_tier),
                entityVerified: ['entity', 'gold'].includes(c.verification_tier),
                videoVerified: c.verification_tier === 'gold',
                referencesVerified: c.verification_tier !== 'unverified',
                paymentVerified: true, tenureDays: 300, disputesUpheld: 0})
              return (
                <tr key={c.id} className="hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                        {c.short_name}
                      </span>
                      <span>
                        <span className="block font-semibold">{c.name}</span>
                        <span className="block text-2xs text-ink-400">{c.cac_number ?? 'No CAC on file'}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge tone="neutral" size="sm">{c.league?.toUpperCase()}</Badge></td>
                  <td className="px-4 py-3 text-xs text-ink-600">{c.city}, {c.state}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <VerificationBadge trust={trust} size="sm" showScore />
                    </div>
                  </td>
                  <td className="tnum px-4 py-3">{c.players}</td>
                  <td className="tnum px-4 py-3">{c.staff}</td>
                  <td className="px-4 py-3"><Badge tone="trust" size="sm">Pro Club</Badge></td>
                  <td className="px-4 py-3 text-xs text-ink-500">{formatDate(c.created_at, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" icon="more"
                      onClick={() => toast({ tone: 'info', title: 'Club actions', description: 'Suspend, impersonate or message this account.' })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
