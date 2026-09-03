import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Input, Skeleton, toast } from '@/components/ui'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { hasSupabase, supabase } from '@/lib/supabase'
import {
  getMyVerificationRequests,
  submitVerificationCheck,
} from '@/lib/supabase/verification'

const FEDERATIONS = [
  'NPFL — Nigeria Professional Football League',
  'NFF — Nigeria Football Federation',
  'State FA (choose your state below)',
  'NLO — Nationwide League One',
  'NWFL — Nigeria Women Football League',
  'Academy (grassroots — no league affiliation yet)',
]

export default function ClubVerify() {
  const { club } = useClub()
  const { user } = useAuth()

  const [status, setStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [cacNumber, setCacNumber] = useState('')
  const [federation, setFederation] = useState(FEDERATIONS[0])
  const [stateFa, setStateFa] = useState('')
  const [cacFile, setCacFile] = useState<File | null>(null)
  const [faFile, setFaFile] = useState<File | null>(null)

  useEffect(() => {
    if (!club) { setCacNumber(''); return }
    setCacNumber(club.cac_number ?? '')
    setStateFa('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !user) { setLoading(false); return }
      try {
        if (club?.entity_verified) {
          if (!cancelled) setStatus('verified')
        } else {
          const rows = await getMyVerificationRequests(user.id)
          const entity = rows.find(r => r.kind === 'entity')
          if (!cancelled) {
            setStatus(entity ? (entity.status === 'rejected' ? 'rejected' : 'pending') : 'none')
            if (entity?.status === 'rejected') toast({ tone: 'warning', title: 'Rejected', description: entity.reviewer_note ?? 'Please correct your details and resubmit.' })
          }
        }
      } catch { /* non-fatal */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.entity_verified, user?.id])

  async function submit() {
    if (!user || !club) return
    if (!/^\d+$/.test(cacNumber.replace(/\s/g, ''))) {
      toast({ tone: 'error', title: 'Invalid CAC number', description: 'Enter the CAC registration number for your business (digits).' })
      return
    }
    if (!cacFile) { toast({ tone: 'error', title: 'Certificate required', description: 'Upload your CAC certificate of incorporation.' }); return }
    setSaving(true)
    try {
      // Persist CAC / FA details on the club record (owner may edit).
      if (supabase) {
        const { error } = await supabase.from('clubs').update({
          cac_number: cacNumber.trim(),
          nff_affiliation: federation.includes('State FA') && stateFa ? `State FA — ${stateFa}` : federation,
        }).eq('id', club.id)
        if (error) throw error
      }

      const files: Array<{ kind: string; file: File }> = [{ kind: 'cac_cert', file: cacFile }]
      if (faFile) files.push({ kind: 'fa_letter', file: faFile })

      await submitVerificationCheck({
        subjectId: user.id,
        kind: 'entity',
        payload: { cac_number: cacNumber.trim(), federation, state_fa: stateFa || null },
        files,
      })

      // Reflect pending state.
      setStatus('pending')
      toast({ tone: 'success', title: 'Entity verification submitted', description: 'A moderator will confirm your registration.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not submit', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSaving(false) }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const badgeTone = status === 'verified' ? 'trust' : status === 'pending' ? 'gold' : status === 'rejected' ? 'red' : 'blue'
  const badgeLabel = status === 'verified' ? 'Entity verified' : status === 'pending' ? 'Pending review' : status === 'rejected' ? 'Needs changes' : 'Not verified'

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="building" title="Club verification"
        subtitle="Prove your club is a real organisation so players can trust your trials."
        actions={<Badge tone={badgeTone as 'trust' | 'gold' | 'red' | 'blue'} icon={status === 'verified' ? 'shield' : undefined}>{badgeLabel}</Badge>} />

      {!hasSupabase ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the app to Supabase to submit your club verification.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-6">
            <h3 className="text-sm font-bold">Your registration details</h3>
            <p className="mt-1 text-xs text-ink-500">These are checked against official records by a moderator.</p>

            <div className="mt-5 space-y-4">
              <Input label="CAC registration number" placeholder="e.g. 1234567"
                hint="Your Certificate of Incorporation / registration number."
                value={cacNumber} onChange={e => setCacNumber(e.target.value)} />

              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-700">NFF / state FA affiliation</p>
                <div className="flex flex-wrap gap-1.5">
                  {FEDERATIONS.map(f => (
                    <button key={f} type="button"
                      onClick={() => setFederation(f)}
                      className={federation === f
                        ? 'rounded-lg bg-ink-900 px-3 py-1.5 text-left text-2xs font-bold text-white'
                        : 'rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-left text-2xs font-semibold text-ink-600 hover:bg-ink-50'}>
                      {f}
                    </button>
                  ))}
                </div>
                {federation.includes('State FA') && (
                  <Input className="mt-3" placeholder="State, e.g. Lagos State FA" value={stateFa} onChange={e => setStateFa(e.target.value)} />
                )}
              </div>

              <FileInput label="CAC certificate / registration (image or PDF)" file={cacFile} onPick={setCacFile} />
              <FileInput label="Optional — NFF / state FA letter or confirmation" file={faFile} onPick={setFaFile} />

              <div className="rounded-xl bg-ink-50 p-3.5 text-2xs leading-relaxed text-ink-600">
                <p className="flex items-center gap-1.5 font-semibold text-ink-800"><Icon name="lock" size={13} /> Private & protected</p>
                Documents are stored privately, seen only by FutWeb moderators, and auto-purged after 90 days under the Nigeria Data Protection Act 2023.
              </div>

              <div className="flex justify-end">
                <Button icon="building" loading={saving} disabled={status === 'verified'}
                  onClick={() => void submit()}>
                  {status === 'verified' ? 'Already verified' : 'Submit for review'}
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-bold">Club: {club?.name ?? '—'}</h3>
              <div className="mt-3 space-y-2 text-xs text-ink-600">
                <p className="flex justify-between"><span className="text-ink-400">CAC on file</span><span className="font-semibold">{club?.cac_number ?? '—'}</span></p>
                <p className="flex justify-between"><span className="text-ink-400">Affiliation</span><span className="font-semibold">{club?.nff_affiliation ?? '—'}</span></p>
                <p className="flex justify-between"><span className="text-ink-400">Status</span><Badge tone={badgeTone as 'trust' | 'gold' | 'red' | 'blue'}>{badgeLabel}</Badge></p>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-bold">Why it matters</h3>
              <ul className="mt-3 space-y-2.5 text-xs text-ink-600">
                {[
                  ['Players trust your trials', 'Verified clubs get ~6x more applications.'],
                  ['No phantom organisations', 'Your CAC + FA records are confirmed.'],
                  ['Higher discovery ranking', 'Verified clubs rank above unverified ones.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-2">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-trust-500" />
                    <span><span className="font-semibold text-ink-800">{t}</span> — {d}</span>
                  </li>
                ))}
              </ul>
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
      <input type="file" className="hidden" accept="image/*,application/pdf"
        onChange={e => onPick(e.target.files?.[0] ?? null)} />
    </label>
  )
}
