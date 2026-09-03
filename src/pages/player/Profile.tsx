import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, Icon, Input, Select, Tabs, Textarea, toast } from '@/components/ui'
import { AttributeBars, ScoreRing } from '@/components/player/Attributes'
import { ShareCardPreview, useShareCard } from '@/components/player/ShareCard'
import { MinorProtectionNotice } from '@/components/trust'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { useAuth } from '@/context/AuthContext'
import { LEAGUES } from '@/lib/constants'
import { NIGERIAN_STATES } from '@/lib/utils'
import { POSITION_LIST } from '@/lib/ratings'

export default function PlayerProfile() {
  const me = useMemo(() => enrichPlayer(DEMO_PLAYERS[0]), [])
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [saved, setSaved] = useState(false)
  const { user } = useAuth()
  const { download, busy } = useShareCard()

  const [form, setForm] = useState({
    first_name: me.first_name, last_name: me.last_name, dob: me.dob,
    nationality: me.nationality, state: me.state_of_origin ?? '',
    position: me.position_primary, foot: me.foot,
    height: String(me.height_cm), weight: String(me.weight_kg),
    bio: me.bio ?? '', availability: me.availability, visibility: me.visibility,
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value })); setSaved(false)
  }

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="user" title="My CV"
        subtitle="This is what clubs see. Keep it accurate — every field affects how you are found."
        actions={
          <>
            <Button variant="outline" icon="share" loading={busy}
              onClick={() => download({
                name: `${form.first_name} ${form.last_name}`, position: form.position, age: me.age,
                club: me.clubName, nationality: form.nationality, foot: form.foot,
                height: Number(form.height) || 0, weight: Number(form.weight) || 0,
                score: me.score.current, potential: me.score.potential,
                confidence: me.confidence.score, attributes: me.attributes, verified: true,
              }, user?.avatarUrl)}>
              Share card
            </Button>
            <Button icon={saved ? 'check' : 'download'} onClick={() => { setSaved(true); toast({ tone: 'success', title: 'Profile saved' }) }}>
              {saved ? 'Saved' : 'Save changes'}
            </Button>
          </>
        } />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'edit', label: 'Edit', icon: 'edit' },
        { value: 'preview', label: 'Preview as club', icon: 'eye' },
      ]} />

      {tab === 'edit' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-bold">Personal details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="First name" value={form.first_name} onChange={set('first_name')} required />
                <Input label="Surname" value={form.last_name} onChange={set('last_name')} required />
                <Input label="Date of birth" type="date" value={form.dob} onChange={set('dob')}
                  hint={me.is_minor ? 'Under 18 — guardian consent required' : undefined} />
                <Select label="Nationality" value={form.nationality} onChange={set('nationality')}
                  options={[{ value: 'Nigeria', label: 'Nigeria' }, { value: 'Ghana', label: 'Ghana' }, { value: 'Cameroon', label: 'Cameroon' }]} />
                <Select label="State of origin" value={form.state} onChange={set('state')}
                  options={[{ value: '', label: 'Select…' }, ...NIGERIAN_STATES.map(s => ({ value: s, label: s }))]} />
                <Select label="Preferred foot" value={form.foot} onChange={set('foot')}
                  options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }, { value: 'both', label: 'Both' }]} />
              </div>
              <Textarea className="mt-4" label="Short bio" maxChars={400} value={form.bio} onChange={set('bio')}
                hint="Two or three sentences. Clubs read this first." />
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-bold">Playing profile</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select label="Main position" value={form.position} onChange={set('position')}
                  options={[...POSITION_LIST].map(p => ({ value: p, label: p }))} />
                <Input label="Height (cm)" type="number" value={form.height} onChange={set('height')} />
                <Input label="Weight (kg)" type="number" value={form.weight} onChange={set('weight')} />
                <Select label="Availability" value={form.availability} onChange={set('availability')}
                  options={[
                    { value: 'available', label: 'Available' },
                    { value: 'trial_only', label: 'Trials only' },
                    { value: 'under_contract', label: 'Under contract' },
                    { value: 'not_looking', label: 'Not looking' },
                  ]} />
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-1 text-sm font-bold">Career history</h3>
              <p className="mb-4 text-xs text-ink-500">Clubs can confirm entries. Verified history carries more weight with scouts.</p>
              <div className="space-y-2.5">
                {me.career.map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                      {c.club_name.split(' ').slice(0, 2).map(w => w[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{c.club_name}</p>
                      <p className="text-2xs text-ink-500">
                        {c.season} · {LEAGUES.find(l => l.value === c.league)?.label ?? c.league} · {c.appearances} apps · {c.goals} goals
                      </p>
                    </div>
                    {c.verified
                      ? <Badge tone="trust" icon="check" size="sm">Verified</Badge>
                      : <Badge tone="neutral" size="sm">Unverified</Badge>}
                    <Button size="sm" variant="ghost" icon="edit" />
                  </div>
                ))}
              </div>
              <Button className="mt-3" size="sm" variant="outline" icon="plus">Add season</Button>
            </Card>
          </div>

          <div className="space-y-4">
            {me.is_minor && <MinorProtectionNotice guardianName={me.guardian_name} />}

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold">Your rating</h3>
              <ScoreRing score={me.score.current} size={80} confidence={me.confidence.score}
                label={`${me.score.ratingTier}`} sublabel={`Potential ${me.score.potential}`} />
              <div className="mt-4 border-t border-ink-100 pt-4">
                <AttributeBars attributes={me.attributes} compact highlightGroup={
                  me.score.group === 'GK' ? 'Goalkeeping' : me.score.group === 'DF' ? 'Defending' : me.score.group === 'MF' ? 'Mental' : 'Technical'
                } />
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-1 text-sm font-bold">Visibility</h3>
              <p className="mb-3 text-xs text-ink-500">Who can see your profile.</p>
              <Select value={form.visibility} onChange={set('visibility')}
                options={[
                  { value: 'public', label: 'Public — anyone on FutWeb' },
                  { value: 'verified_only', label: 'Verified clubs only' },
                  { value: 'private', label: 'Private — invite only' },
                ]} />
              <div className="mt-3 rounded-xl bg-ink-50 p-3">
                <p className="flex items-start gap-1.5 text-2xs text-ink-600">
                  <Icon name="info" size={12} className="mt-0.5 shrink-0" />
                  Verified clubs only is the recommended setting. It filters out unverified accounts
                  while keeping you visible to every real club.
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold">Share card preview</h3>
              <div className="mx-auto max-w-[220px]">
                <ShareCardPreview
                  avatarUrl={user?.avatarUrl}
                  data={{
                    name: `${form.first_name} ${form.last_name}`, position: form.position, age: me.age,
                    club: me.clubName, nationality: form.nationality, foot: form.foot,
                    height: Number(form.height) || 0, weight: Number(form.weight) || 0,
                    score: me.score.current, potential: me.score.potential,
                    confidence: me.confidence.score, attributes: me.attributes, verified: true,
                  }} />
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <ClubViewPreview me={me} form={form} />
      )}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ClubViewPreview({ me, form }: { me: any; form: any }) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card className="overflow-hidden">
        <div className="relative h-28 bg-gradient-to-br from-ink-900 via-ink-850 to-red-900">
          <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-red-500 to-red-700 font-display text-2xl text-white shadow-lg">
              {form.first_name[0]}{form.last_name[0]}
            </div>
            <div className="mb-1 min-w-0 flex-1">
              <h2 className="truncate font-display text-2xl tracking-wide">{form.first_name} {form.last_name}</h2>
              <p className="text-xs text-ink-500">{form.position} · {me.age} yrs · {form.nationality} 🇳🇬</p>
            </div>
            <div className="mb-1"><Badge tone="trust" icon="shield" size="sm">Verified</Badge></div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-700">{form.bio}</p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Height', `${form.height} cm`], ['Weight', `${form.weight} kg`], ['Foot', form.foot], ['State', form.state || '—']].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-ink-50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                <p className="mt-0.5 text-sm font-bold capitalize">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <CardHeader title="FutWeb Score" subtitle="Position-weighted, age-adjusted" />
          <div className="px-5 pb-5">
            <ScoreRing score={me.score.current} size={80} confidence={me.confidence.score}
              label={me.score.ratingTier} sublabel={`Potential ${me.score.potential} · ${me.confidence.label} confidence`} />
            <div className="mt-4">
              <AttributeBars attributes={me.attributes} compact />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold">Media</h3>
          <div className="grid grid-cols-2 gap-2">
            {me.media.map((m: any) => (
              <div key={m.id} className="relative aspect-video overflow-hidden rounded-lg bg-ink-900">
                <div className="grid h-full w-full place-items-center text-white/40">
                  <Icon name={m.kind === 'photo' ? 'video' : 'video'} size={20} />
                </div>
                <p className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-2xs font-semibold text-white">
                  {m.title}
                </p>
                {m.verified && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-trust-400 px-1 py-0.5 text-[8px] font-bold text-white">VERIFIED</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
