import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Select, Skeleton, toast } from '@/components/ui'
import { VerificationBadge } from '@/components/trust'
import { supabase } from '@/lib/supabase'
import { computeTrustScore } from '@/lib/ratings'
import { formatDate } from '@/lib/utils'

interface ClubRow {
  id: string; name: string; short_name: string; league_code: string | null
  city: string | null; state_region: string | null; entity_verified: boolean
  player_seats_used: number; staff_seats_used: number; created_at: string; cac_number: string | null
}

export default function AdminClubs() {
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [q, setQ] = useState('')
  const [verified, setVerified] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('clubs').select('*').order('created_at', { ascending: false })
      if (!cancelled) {
        if (error) toast({ tone: 'error', title: 'Could not load clubs', description: error.message })
        setClubs(data ?? [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => clubs.filter(c =>
    (!q || c.name.toLowerCase().includes(q.toLowerCase())) &&
    (!verified || (verified === 'verified' ? c.entity_verified : !c.entity_verified))
  ), [clubs, q, verified])

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="users" title="Clubs"
        subtitle={`${clubs.length} registered organisations`}
        actions={<Button variant="outline" icon="download">Export CSV</Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" icon="search" placeholder="Search clubs…" value={q} onChange={e => setQ(e.target.value)} />
        <Select className="max-w-[200px]" value={verified} onChange={e => setVerified(e.target.value)}
          placeholder="All verification states"
          options={[{ value: 'verified', label: 'Verified' }, { value: 'unverified', label: 'Unverified' }]} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Club', 'League', 'Location', 'Verification', 'Players', 'Staff', 'Joined', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(c => {
              const trust = computeTrustScore({
                emailVerified: true, phoneVerified: true,
                identityVerified: c.entity_verified, entityVerified: c.entity_verified,
                videoVerified: false, referencesVerified: c.entity_verified,
                paymentVerified: true, tenureDays: 300, disputesUpheld: 0,
              })
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
                  <td className="px-4 py-3"><Badge tone="neutral" size="sm">{c.league_code?.toUpperCase() ?? '—'}</Badge></td>
                  <td className="px-4 py-3 text-xs text-ink-600">{c.city ?? '—'}, {c.state_region ?? '—'}</td>
                  <td className="px-4 py-3"><VerificationBadge trust={trust} size="sm" showScore /></td>
                  <td className="tnum px-4 py-3">{c.player_seats_used}</td>
                  <td className="tnum px-4 py-3">{c.staff_seats_used}</td>
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
