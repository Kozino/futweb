import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Modal, Skeleton, Textarea, toast } from '@/components/ui'
import { NoFeeGuarantee } from '@/components/trust'
import { useClub } from '@/context/ClubContext'
import {
  getClubTrialsWithClubs,
  createTrialPosting,
  type TrialWithClub,
} from '@/lib/supabase/recruitment'
import { hasSupabase } from '@/lib/supabase'
import { formatDate, relativeTime } from '@/lib/utils'

const POSITIONS = ['GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST', 'CF']

interface FormState {
  title: string
  description: string
  positions: string[]
  ageMin: string
  ageMax: string
  location: string
  trialDate: string
  fee: string
}

const EMPTY: FormState = {
  title: '', description: '', positions: [], ageMin: '16', ageMax: '25',
  location: '', trialDate: '', fee: '0',
}

export default function ClubTrials() {
  const { club } = useClub()
  const [trials, setTrials] = useState<TrialWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const clubId = club?.id

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try {
        const rows = await getClubTrialsWithClubs(clubId)
        if (!cancelled) setTrials(rows)
      } catch (err) {
        if (!cancelled) toast({ tone: 'error', title: 'Could not load trials', description: err instanceof Error ? err.message : 'Please try again.' })
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clubId])

  const feeNum = Number(form.fee) || 0
  const blocked = feeNum > 0
  const canSubmit =
    !saving && !blocked && !!form.title.trim() && !!form.description.trim() &&
    form.positions.length > 0 && !!form.location.trim() && !!form.trialDate

  function togglePosition(pos: string) {
    setForm(f => ({ ...f, positions: f.positions.includes(pos)
      ? f.positions.filter(x => x !== pos) : [...f.positions, pos] }))
  }

  async function submitTrial() {
    if (!clubId) {
      toast({ tone: 'error', title: 'No club on this account', description: 'Set up your club profile first.' })
      return
    }
    if (!hasSupabase) {
      setOpen(false)
      setForm(EMPTY)
      toast({ tone: 'success', title: 'Trial submitted', description: 'In demo mode this is simulated locally.' })
      return
    }
    setSaving(true)
    try {
      await createTrialPosting({
        club_id: clubId,
        title: form.title,
        description: form.description,
        positions: form.positions,
        age_min: Number(form.ageMin) || 16,
        age_max: Number(form.ageMax) || 25,
        location: form.location,
        trial_date: form.trialDate,
      })
      setOpen(false)
      setForm(EMPTY)
      setTrials(await getClubTrialsWithClubs(clubId))
      toast({ tone: 'success', title: 'Trial submitted', description: 'Verification usually completes within one working day.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not post trial', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="target" title="Trials"
        subtitle="Post trials that players can trust. Verified postings receive far more applications."
        actions={<Button icon="plus" onClick={() => setOpen(true)} disabled={!hasSupabase || !clubId}>Post a trial</Button>} />

      {!hasSupabase || !clubId ? (
        <Card className="mt-5 p-8 text-center text-sm text-ink-500">
          Connect the club to a Supabase project to manage trials from this workspace.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {trials.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm font-bold text-ink-700">No trials posted yet</p>
                <p className="mt-1 text-xs text-ink-500">Post your first open trial for players to discover.</p>
              </Card>
            ) : trials.map(t => (
              <Card key={t.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold">{t.title}</h3>
                        {t.verified
                          ? <Badge tone="trust" icon="shield" size="sm">Verified</Badge>
                          : <Badge tone="gold" icon="clock" size="sm">Pending verification</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">posted {relativeTime(t.created_at)}</p>
                    </div>
                    <Badge tone={t.status === 'open' ? 'trust' : 'gold'} size="sm">{t.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.positions.map(p => <Badge key={p} tone="neutral" size="sm">{p}</Badge>)}
                    <Badge tone="blue" size="sm">{t.age_min}–{t.age_max} yrs</Badge>
                    <Badge tone="neutral" size="sm" icon="calendar">{formatDate(t.trial_date)}</Badge>
                    <Badge tone="trust" size="sm">Fee to player ₦0</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-700">{t.description}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <NoFeeGuarantee />
            <Card className="p-5">
              <h3 className="text-sm font-bold">Why verification matters here</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                Players have been burned by phantom trials. A verified badge tells them FutWeb
                confirmed your CAC registration and your NFF or state FA affiliation — and that you
                are not charging them a fee.
              </p>
            </Card>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Post a trial"
        description="Trials go live once verification confirms your club details."
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!canSubmit} icon="check" loading={saving} onClick={() => void submitTrial()}>
            Submit for verification
          </Button>
        </>}>
        <div className="space-y-4">
          <Input label="Trial title" placeholder="Open trials — U23 attacking players"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Age from" type="number" value={form.ageMin} onChange={e => setForm({ ...form, ageMin: e.target.value })} />
            <Input label="Age to" type="number" value={form.ageMax} onChange={e => setForm({ ...form, ageMax: e.target.value })} />
            <Input label="Trial date" type="date" value={form.trialDate} onChange={e => setForm({ ...form, trialDate: e.target.value })} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Positions wanted</p>
            <div className="flex flex-wrap gap-1.5">
              {POSITIONS.map(p => {
                const on = form.positions.includes(p)
                return (
                  <button key={p} type="button"
                    onClick={() => togglePosition(p)}
                    className={on
                      ? 'rounded-lg bg-ink-900 px-2.5 py-1 text-2xs font-bold text-white'
                      : 'rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-2xs font-semibold text-ink-600 hover:bg-ink-50'}>
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
          <Input label="Location" placeholder="Port Harcourt, Rivers State" icon="map"
            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <Textarea label="Description" maxChars={1200}
            hint="Say clearly what is provided — transport, accommodation, kit — and what players should bring."
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div>
            <Input label="Fee charged to players (₦)" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })}
              inputMode="numeric" error={blocked ? 'FutWeb does not permit fees to players. Set this to 0.' : undefined}
              hint="Must be 0. Charging players for trials is a violation of platform policy." />
            {blocked && <div className="mt-2"><NoFeeGuarantee variant="danger" /></div>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
