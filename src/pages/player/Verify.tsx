import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Input, Select, Skeleton, toast, type IconName } from '@/components/ui'
import { VerificationBadge } from '@/components/trust'
import { useAuth } from '@/context/AuthContext'
import { computeTrustScore } from '@/lib/ratings'
import { hasSupabase, supabase } from '@/lib/supabase'
import {
  getMyVerificationRequests,
  submitVerificationCheck,
  type VerificationRequestRow,
} from '@/lib/supabase/verification'

type StepKey = 'identity' | 'liveness' | 'references'

interface StepDef {
  key: StepKey
  icon: IconName
  title: string
  body: string
  points: number
}

const STEPS: StepDef[] = [
  { key: 'identity', icon: 'user', title: 'Identity (NIN or passport)', body: 'Matched to the name on your account. This is what defeats impersonation. BVN is not required.', points: 20 },
  { key: 'liveness', icon: 'video', title: 'Liveness check', body: 'A short selfie video. Proves you are a real person, not a stolen photo.', points: 10 },
  { key: 'references', icon: 'users', title: 'Football references', body: 'Two contacts who can confirm you play — a coach, academy or club official.', points: 10 },
]

type Status = 'none' | 'pending' | 'reviewed' | 'rejected'

export default function PlayerVerify() {
  const { user, updateUser } = useAuth()
  const [requests, setRequests] = useState<VerificationRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openStep, setOpenStep] = useState<StepKey | null>(null)

  // Identity form (NIN / passport)
  const [idType, setIdType] = useState('nin')
  const [idNumber, setIdNumber] = useState('')
  const [idFile, setIdFile] = useState<File | null>(null)

  // Liveness
  const [livenessFile, setLivenessFile] = useState<File | null>(null)

  // References
  const [refs, setRefs] = useState([
    { name: '', role: 'Coach', phone: '' },
    { name: '', role: 'Club / Academy official', phone: '' },
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !user) { setLoading(false); return }
      try {
        const rows = await getMyVerificationRequests(user.id)
        if (!cancelled) setRequests(rows)
      } catch { /* non-fatal */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user])

  const latest = useMemo(() => {
    const map = new Map<StepKey, VerificationRequestRow | undefined>()
    for (const k of ['identity', 'liveness', 'references'] as StepKey[]) {
      map.set(k, requests.find(r => r.kind === k))
    }
    return map
  }, [requests])

  function statusOf(key: StepKey): Status {
    const r = latest.get(key)
    if (!r) return 'none'
    if (r.status === 'rejected') return 'rejected'
    if (r.status === 'verified') return 'reviewed'
    return 'pending'
  }

  const doneCount = STEPS.filter(s => statusOf(s.key) === 'reviewed').length
  const submittedCount = STEPS.filter(s => statusOf(s.key) !== 'none').length

  const profileTier = user?.verificationTier
  const trust = computeTrustScore({
    emailVerified: true,
    phoneVerified: true,
    identityVerified: statusOf('identity') === 'reviewed' || profileTier !== 'unverified',
    entityVerified: profileTier === 'entity' || profileTier === 'gold',
    videoVerified: statusOf('liveness') === 'reviewed' || profileTier === 'gold',
    referencesVerified: statusOf('references') === 'reviewed',
    paymentVerified: user?.subStatus === 'active',
    tenureDays: 120,
    disputesUpheld: 0,
  })

  function refreshUser() {
    if (!supabase || !user) return
    void supabase.from('profiles').select('verification_tier, verification_status').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) updateUser({
          verificationTier: (data.verification_tier as never) ?? user.verificationTier,
          verificationStatus: (data.verification_status as never) ?? user.verificationStatus,
        })
      })
  }

  async function afterSubmit() {
    setRequests(await getMyVerificationRequests(user!.id))
    refreshUser()
  }

  async function submitIdentity() {
    if (!user) return
    if (idType === 'nin' && !/^\d{11}$/.test(idNumber.trim())) {
      toast({ tone: 'error', title: 'Invalid NIN', description: 'A Nigerian NIN is exactly 11 digits.' })
      return
    }
    if (idType === 'passport' && idNumber.trim().length < 6) {
      toast({ tone: 'error', title: 'Invalid passport number', description: 'Enter the passport number on your identity document.' })
      return
    }
    if (!idFile) { toast({ tone: 'error', title: 'Document required', description: 'Upload a scan/photo of your identity document.' }); return }
    setSaving(true)
    try {
      await submitVerificationCheck({
        subjectId: user.id, kind: 'identity',
        payload: { id_type: idType, id_number: idNumber.trim(), submitted_name: user.fullName },
        files: [{ kind: 'identity', file: idFile }],
      })
      setIdNumber(''); setIdFile(null)
      await afterSubmit()
      toast({ tone: 'success', title: 'Identity submitted', description: 'A moderator will verify it shortly.' })
      setOpenStep(null)
    } catch (err) {
      toast({ tone: 'error', title: 'Could not submit', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSaving(false) }
  }

  async function submitLiveness() {
    if (!user) return
    if (!livenessFile) { toast({ tone: 'error', title: 'Selfie required', description: 'Record/upload a short selfie clip.' }); return }
    setSaving(true)
    try {
      await submitVerificationCheck({
        subjectId: user.id, kind: 'liveness',
        payload: { captured_at: new Date().toISOString() },
        files: [{ kind: 'liveness', file: livenessFile }],
      })
      setLivenessFile(null)
      await afterSubmit()
      toast({ tone: 'success', title: 'Liveness submitted', description: 'A moderator will confirm it shortly.' })
      setOpenStep(null)
    } catch (err) {
      toast({ tone: 'error', title: 'Could not submit', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSaving(false) }
  }

  async function submitReferences() {
    if (!user) return
    const filled = refs.filter(r => r.name.trim() && r.phone.trim())
    if (filled.length < 2) {
      toast({ tone: 'error', title: 'Two references needed', description: 'Provide two contacts — a coach, academy or club official.' })
      return
    }
    setSaving(true)
    try {
      await submitVerificationCheck({
        subjectId: user.id, kind: 'references',
        payload: { refs: filled.map(r => ({ name: r.name.trim(), role: r.role, phone: r.phone.trim() })) },
      })
      setRefs([
        { name: '', role: 'Coach', phone: '' },
        { name: '', role: 'Club / Academy official', phone: '' },
      ])
      await afterSubmit()
      toast({ tone: 'success', title: 'References submitted', description: 'A moderator will contact them to confirm.' })
      setOpenStep(null)
    } catch (err) {
      toast({ tone: 'error', title: 'Could not submit', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSaving(false) }
  }

  const STATUS_BADGE: Record<Status, { tone: 'trust' | 'gold' | 'blue' | 'red'; label: string }> = {
    none: { tone: 'blue', label: 'Not started' },
    pending: { tone: 'gold', label: 'Pending review' },
    reviewed: { tone: 'trust', label: 'Verified' },
    rejected: { tone: 'red', label: 'Needs changes' },
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="shield" title="Verification"
        subtitle="Verification is what makes a club reply. Verified players get materially more views."
        actions={<VerificationBadge trust={trust} showScore />} />

      {!hasSupabase ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the app to Supabase to submit verification. Documents are stored privately and auto-purged after 90 days.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            {STEPS.map(s => {
              const st = statusOf(s.key)
              const open = openStep === s.key
              const badge = STATUS_BADGE[st]
              return (
                <Card key={s.key} className="p-5">
                  <button type="button" className="w-full text-left"
                    onClick={() => setOpenStep(open ? null : s.key)}>
                    <div className="flex items-start gap-3.5">
                      <span className={st === 'reviewed'
                        ? 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-trust-50 text-trust-600'
                        : 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500'}>
                        <Icon name={st === 'reviewed' ? 'check-circle' : s.icon} size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold">{s.title}</h3>
                          {st === 'none' ? <Badge tone="neutral" size="sm">+{s.points} points</Badge>
                            : <Badge tone={badge.tone} icon={st === 'reviewed' ? 'check' : undefined} size="sm">{badge.label}</Badge>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-600">{s.body}</p>
                        {st === 'rejected' && latest.get(s.key)?.reviewer_note && (
                          <p className="mt-1.5 text-xs font-medium text-red-600">Reason: {latest.get(s.key)?.reviewer_note}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-ink-400"><Icon name="chevron-down" size={16} /></span>
                    </div>
                  </button>

                  {open && (
                    <div className="mt-4 border-t border-ink-100 pt-4">
                      {st === 'pending' && !saving && (
                        <p className="mb-3 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-700">
                          Your submission is under review. You can resubmit corrected details below if the first attempt was rejected.
                        </p>
                      )}

                      {s.key === 'identity' && (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Select label="Document type" value={idType} onChange={e => setIdType(e.target.value)}
                              options={[
                                { value: 'nin', label: 'NIN (National ID) — 11 digits' },
                                { value: 'passport', label: 'International passport' },
                              ]} />
                            <Input label={idType === 'nin' ? 'NIN number' : 'Passport number'}
                              placeholder={idType === 'nin' ? 'e.g. 98765432101' : 'e.g. A01234567'}
                              value={idNumber} onChange={e => setIdNumber(e.target.value)} />
                          </div>
                          <FileInput label="Upload front of document (image or PDF)" file={idFile} onPick={setIdFile} />
                          <p className="text-2xs text-ink-400">Only the name matching your account is checked — BVN is never required.</p>
                          <div className="flex justify-end"><Button icon="shield" loading={saving} onClick={() => void submitIdentity()}>Submit identity</Button></div>
                        </div>
                      )}

                      {s.key === 'liveness' && (
                        <div className="space-y-3">
                          <FileInput label="Upload a short selfie clip (3s) or a clear selfie" file={livenessFile} onPick={setLivenessFile} />
                          <p className="text-2xs text-ink-400">You should be the only person visible. This proves you are real, not a stolen photo.</p>
                          <div className="flex justify-end"><Button icon="video" loading={saving} onClick={() => void submitLiveness()}>Submit liveness</Button></div>
                        </div>
                      )}

                      {s.key === 'references' && (
                        <div className="space-y-3">
                          {refs.map((r, i) => (
                            <div key={i} className="rounded-xl border border-ink-100 p-3">
                              <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">Reference {i + 1}</p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <Input label="Full name" value={r.name}
                                  onChange={e => setRefs(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                                <Select label="Relationship" value={r.role}
                                  onChange={e => setRefs(rs => rs.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                                  options={['Coach', 'Club / Academy official', 'Academy administrator'].map(v => ({ value: v, label: v }))} />
                                <Input label="Phone / email" value={r.phone}
                                  onChange={e => setRefs(rs => rs.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end"><Button icon="users" loading={saving} onClick={() => void submitReferences()}>Submit references</Button></div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          <div className="space-y-4">
            <VerificationBadge trust={trust} showScore />
            <Card className="p-5">
              <h3 className="text-sm font-bold">Progress</h3>
              <div className="mt-3 space-y-2.5">
                {STEPS.map(s => {
                  const st = statusOf(s.key)
                  return (
                    <div key={s.key} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <Icon name={st === 'reviewed' ? 'check-circle' : s.icon} size={14}
                          className={st === 'reviewed' ? 'text-trust-600' : 'text-ink-400'} />
                        {s.title}
                      </span>
                      <Badge tone={STATUS_BADGE[st].tone} size="sm">{STATUS_BADGE[st].label}</Badge>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 rounded-xl bg-ink-50 p-3.5 text-2xs leading-relaxed text-ink-600">
                {submittedCount === 0
                  ? 'You have not submitted any checks yet.'
                  : `${submittedCount} of 3 checks submitted. A moderator reviews each submission.`}
                {doneCount === 3 && <><br /><strong>All checks verified.</strong></>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function FileInput({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-700">{label}</span>
      <span className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-4 py-3 text-sm text-ink-600 hover:border-ink-400 hover:bg-ink-50">
        <Icon name="upload" size={16} />
        {file ? <span className="truncate font-semibold text-ink-900">{file.name}</span> : 'Choose file'}
      </span>
      <input type="file" className="hidden"
        accept="image/*,application/pdf,video/mp4,video/webm,video/quicktime"
        onChange={e => onPick(e.target.files?.[0] ?? null)} />
    </label>
  )
}
