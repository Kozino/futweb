import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, toast } from '@/components/ui'
import { NoFeeGuarantee } from '@/components/trust'
import { usePlayer } from '@/context/PlayerContext'
import { useOffline } from '@/context/OfflineContext'
import {
  getOpenTrialsWithClubs,
  getMyApplicationsWithTrials,
  applyForTrial,
  type TrialWithClub,
  type MyTrialApplication,
} from '@/lib/supabase/recruitment'
import { hasSupabase } from '@/lib/supabase'
import { formatDate, relativeTime } from '@/lib/utils'

export default function PlayerTrials() {
  const { player } = usePlayer()
  const { enqueue } = useOffline()
  const [tab, setTab] = useState<'open' | 'applied'>('open')

  const [open, setOpen] = useState<TrialWithClub[]>([])
  const [apps, setApps] = useState<MyTrialApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase) { setLoading(false); return }
      try {
        const [openTrials, myApps] = await Promise.all([
          getOpenTrialsWithClubs(),
          player?.id ? getMyApplicationsWithTrials(player.id) : Promise.resolve([] as MyTrialApplication[]),
        ])
        if (cancelled) return
        setOpen(openTrials)
        setApps(myApps)
      } catch (err) {
        if (!cancelled) toast({ tone: 'error', title: 'Could not load trials', description: err instanceof Error ? err.message : 'Please try again.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [player?.id])

  const appliedIds = new Set(apps.map(a => a.trial_id))

  async function apply(trial: TrialWithClub) {
    if (!hasSupabase) {
      await enqueue('trial', { trial_id: trial.id, action: 'apply' })
      setApps(a => [...a, {
        id: `local-${trial.id}`, trial_id: trial.id, status: 'applied', message: null,
        created_at: new Date().toISOString(), trial,
      }])
      toast({ tone: 'success', title: 'Application submitted', description: `${trial.club_name} will review your CV.` })
      return
    }
    if (!player) {
      toast({ tone: 'error', title: 'No player profile yet', description: 'Finish your player onboarding first.' })
      return
    }
    setApplying(trial.id)
    try {
      await applyForTrial(trial.id, player.id)
      setApps(await getMyApplicationsWithTrials(player.id))
      toast({ tone: 'success', title: 'Application submitted', description: `${trial.club_name} will review your CV.` })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not apply', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setApplying(null)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const invitations = apps.filter(a => ['shortlisted', 'invited', 'accepted'].includes(a.status))

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="target" title="Trials & offers"
        subtitle="Every posting here is from a club on FutWeb. None may charge you a fee." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'open', label: 'Open trials', count: open.length },
        { value: 'applied', label: 'Applications', count: apps.length },
      ]} />

      {tab === 'open' && (
        <div className="mt-5 space-y-4">
          {open.length === 0 ? (
            <Card className="mt-5"><EmptyState icon="target" title="No open trials right now"
              description="When a verified club posts a trial you qualify for, it appears here." /></Card>
          ) : open.map(t => {
            const isApplied = appliedIds.has(t.id)
            return (
              <Card key={t.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{t.title}</p>
                      {t.club_verified && <Badge tone="trust" icon="shield" size="sm">Verified club</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">{t.club_name} · {t.location} · posted {relativeTime(t.created_at)}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {t.positions.map(p => <Badge key={p} tone="neutral" size="sm">{p}</Badge>)}
                      <Badge tone="blue" size="sm">{t.age_min}–{t.age_max} yrs</Badge>
                      <Badge tone="trust" size="sm" icon="calendar">{formatDate(t.trial_date)}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-700">{t.description}</p>
                  </div>
                  <div className="shrink-0">
                    <Button loading={applying === t.id} disabled={isApplied} icon={isApplied ? 'check' : 'arrow-right'}
                      onClick={() => void apply(t)}>
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

      {tab === 'applied' && (
        apps.length === 0
          ? <Card className="mt-5"><EmptyState icon="doc" title="No applications yet"
              description="Apply to an open trial and it will appear here with its status."
              action={<Button onClick={() => setTab('open')}>Browse open trials</Button>} /></Card>
          : <div className="mt-5 space-y-3">
              {apps.map(a => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{a.trial?.title ?? 'Trial'}</p>
                      {a.trial && <p className="text-2xs text-ink-500">{a.trial.club_name} · {a.trial.location}</p>}
                      <p className="text-2xs text-ink-400">Applied {relativeTime(a.created_at)}</p>
                    </div>
                    <Badge tone={a.status === 'accepted' || a.status === 'invited' || a.status === 'shortlisted' ? 'trust' : a.status === 'declined' ? 'red' : 'gold'} size="sm">
                      {a.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </Card>
              ))}
              {invitations.length > 0 && (
                <div className="rounded-xl bg-trust-50 px-4 py-3 text-2xs font-semibold text-trust-700">
                  Some clubs have invited you — confirm in your notifications inbox.
                </div>
              )}
            </div>
      )}
    </div>
  )
}
