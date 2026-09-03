import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  Input,
  Select,
  Tabs,
  Textarea,
  toast,
} from '@/components/ui'
import { MinorProtectionNotice } from '@/components/trust'
import { usePlayer } from '@/context/PlayerContext'
import { NIGERIAN_STATES } from '@/lib/utils'
import { POSITION_LIST } from '@/lib/ratings'

type ProfileForm = {
  first_name: string
  last_name: string
  dob: string
  nationality: string
  state_of_origin: string
  position_primary: string
  position_secondary: string
  foot: 'left' | 'right' | 'both'
  height_cm: string
  weight_kg: string
  bio: string
  availability: 'available' | 'trial_only' | 'under_contract' | 'not_looking'
  visibility: 'public' | 'verified_only' | 'private'
  contract_expiry: string
}

type CareerRow = {
  id: string
  club_name: string
  season: string
  league: string | null
  appearances: number | null
  goals: number | null
  verified: boolean
}

function calculateAge(dob: string) {
  if (!dob) return null

  const birthDate = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()

  const monthDifference = today.getMonth() - birthDate.getMonth()

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function formFromPlayer(player: NonNullable<ReturnType<typeof usePlayer>['player']>): ProfileForm {
  return {
    first_name: player.first_name,
    last_name: player.last_name,
    dob: player.dob,
    nationality: player.nationality,
    state_of_origin: player.state_of_origin ?? '',
    position_primary: player.position_primary,
    position_secondary: player.position_secondary?.join(', ') ?? '',
    foot: player.foot,
    height_cm: player.height_cm == null ? '' : String(player.height_cm),
    weight_kg: player.weight_kg == null ? '' : String(player.weight_kg),
    bio: player.bio ?? '',
    availability: player.availability,
    visibility: player.visibility,
    contract_expiry: player.contract_expiry ?? '',
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase()
}

export default function PlayerProfile() {
  const {
    player,
    career,
    loading,
    error,
    updateProfile,
  } = usePlayer()

  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (player) {
      setForm(formFromPlayer(player))
    }
  }, [player])

  const age = useMemo(
    () => (form ? calculateAge(form.dob) : null),
    [form],
  )

  const typedCareer = useMemo(
    () => career as CareerRow[],
    [career],
  )

  const setField = <K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) => {
    setForm(current => (
      current
        ? { ...current, [key]: value }
        : current
    ))
  }

  const save = async () => {
    if (!form || !player) return

    const firstName = form.first_name.trim()
    const lastName = form.last_name.trim()
    const nationality = form.nationality.trim()
    const positionPrimary = form.position_primary.trim()

    if (!firstName || !lastName || !form.dob || !nationality || !positionPrimary) {
      toast({
        tone: 'error',
        title: 'Complete your required fields',
        description: 'First name, surname, date of birth, nationality and position are required.',
      })
      return
    }

    const height = form.height_cm.trim() === ''
      ? null
      : Number(form.height_cm)

    const weight = form.weight_kg.trim() === ''
      ? null
      : Number(form.weight_kg)

    if (height !== null && (!Number.isFinite(height) || height < 100 || height > 250)) {
      toast({
        tone: 'error',
        title: 'Invalid height',
        description: 'Enter a height between 100 cm and 250 cm.',
      })
      return
    }

    if (weight !== null && (!Number.isFinite(weight) || weight < 25 || weight > 200)) {
      toast({
        tone: 'error',
        title: 'Invalid weight',
        description: 'Enter a weight between 25 kg and 200 kg.',
      })
      return
    }

    const secondaryPositions = form.position_secondary
      .split(',')
      .map(position => position.trim().toUpperCase())
      .filter(Boolean)
      .filter(position => position !== positionPrimary.toUpperCase())

    setSaving(true)

  try {
  await updateProfile({
    first_name: firstName,
    last_name: lastName,
    dob: form.dob,
    nationality,
    state_of_origin: form.state_of_origin || null,
    position_primary: positionPrimary,
    position_secondary: secondaryPositions,
    foot: form.foot,
    height_cm: height,
    weight_kg: weight,
    bio: form.bio.trim() || null,
    availability: form.availability,
    visibility: form.visibility,
  contract_expiry: form.contract_expiry,
  })

  toast({
    tone: 'success',
    title: 'Profile saved',
    description: 'Your player profile has been updated.',
  })
} catch (err) {
  toast({
    tone: 'error',
    title: 'Could not save profile',
    description:
      err instanceof Error ? err.message : 'Please try again.',
  })
} finally {
  setSaving(false)
}
  }

  if (loading && !player) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="user"
          title="My CV"
          subtitle="Loading your player profile…"
        />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-5">
            <div className="space-y-4">
              <div className="fw-skeleton h-5 w-32 rounded" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="fw-skeleton h-11 rounded-xl" />
                <div className="fw-skeleton h-11 rounded-xl" />
                <div className="fw-skeleton h-11 rounded-xl" />
                <div className="fw-skeleton h-11 rounded-xl" />
              </div>
              <div className="fw-skeleton h-28 rounded-xl" />
            </div>
          </Card>
          <Card className="p-5">
            <div className="space-y-4">
              <div className="fw-skeleton h-5 w-32 rounded" />
              <div className="fw-skeleton h-32 rounded-xl" />
              <div className="fw-skeleton h-20 rounded-xl" />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!player || !form) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="user"
          title="My CV"
          subtitle="Your real player profile will appear here once onboarding is complete."
        />

        <Card className="p-8">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-500">
              <Icon name="user" size={24} />
            </div>

            <h2 className="mt-4 text-lg font-bold text-ink-900">
              No player profile found
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {error
                ? error
                : 'Complete player onboarding to create your real FutWeb player profile.'}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const fullName = `${form.first_name} ${form.last_name}`.trim()
  const secondaryPositions = form.position_secondary
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  const profileCompleteness = [
    form.first_name,
    form.last_name,
    form.dob,
    form.nationality,
    form.position_primary,
    form.height_cm,
    form.weight_kg,
    form.bio,
    form.state_of_origin,
  ].filter(Boolean).length

  const completeness = Math.round((profileCompleteness / 9) * 100)

  return (
    <div>
      <PageHeader
        breadcrumb="Player workspace"
        icon="user"
        title="My CV"
        subtitle="This is your live FutWeb player profile. Changes are saved to your account."
        actions={
          <Button
            icon="check"
            loading={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'edit', label: 'Edit', icon: 'edit' },
          { value: 'preview', label: 'Preview as club', icon: 'eye' },
        ]}
      />

      {tab === 'edit' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-bold">Personal details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  value={form.first_name}
                  onChange={event => setField('first_name', event.target.value)}
                  required
                />

                <Input
                  label="Surname"
                  value={form.last_name}
                  onChange={event => setField('last_name', event.target.value)}
                  required
                />

                <Input
                  label="Date of birth"
                  type="date"
                  value={form.dob}
                  onChange={event => setField('dob', event.target.value)}
                  hint={
                    player.is_minor
                      ? 'Under 18 — guardian protection applies.'
                      : undefined
                  }
                  required
                />

                <Select
                  label="Nationality"
                  value={form.nationality}
                  onChange={event => setField('nationality', event.target.value)}
                  options={[
                    { value: 'Nigeria', label: 'Nigeria' },
                    { value: 'Ghana', label: 'Ghana' },
                    { value: 'Cameroon', label: 'Cameroon' },
                    { value: 'Senegal', label: 'Senegal' },
                    { value: 'Ivory Coast', label: 'Ivory Coast' },
                    { value: 'South Africa', label: 'South Africa' },
                    { value: 'Other', label: 'Other' },
                  ]}
                  required
                />

                <Select
                  label="State of origin"
                  value={form.state_of_origin}
                  onChange={event => setField('state_of_origin', event.target.value)}
                  options={[
                    { value: '', label: 'Select…' },
                    ...NIGERIAN_STATES.map(state => ({
                      value: state,
                      label: state,
                    })),
                  ]}
                />

                <Select
                  label="Preferred foot"
                  value={form.foot}
                  onChange={event => {
                    setField(
                      'foot',
                      event.target.value as ProfileForm['foot'],
                    )
                  }}
                  options={[
                    { value: 'right', label: 'Right' },
                    { value: 'left', label: 'Left' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              </div>

              <Textarea
                className="mt-4"
                label="Short bio"
                maxChars={400}
                value={form.bio}
                onChange={event => setField('bio', event.target.value)}
                hint="Two or three sentences. Keep it factual."
              />
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-bold">Playing profile</h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Main position"
                  value={form.position_primary}
                  onChange={event => setField('position_primary', event.target.value)}
                  options={POSITION_LIST.map(position => ({
                    value: position,
                    label: position,
                  }))}
                  required
                />

                <Input
                  label="Other positions"
                  value={form.position_secondary}
                  onChange={event => setField('position_secondary', event.target.value)}
                  hint="Separate positions with commas."
                />

                <Input
                  label="Height"
                  type="number"
                  min="100"
                  max="250"
                  value={form.height_cm}
                  onChange={event => setField('height_cm', event.target.value)}
                  suffix="cm"
                />

                <Input
                  label="Weight"
                  type="number"
                  min="25"
                  max="200"
                  value={form.weight_kg}
                  onChange={event => setField('weight_kg', event.target.value)}
                  suffix="kg"
                />

                <Select
                  label="Availability"
                  value={form.availability}
                  onChange={event => {
                    setField(
                      'availability',
                      event.target.value as ProfileForm['availability'],
                    )
                  }}
                  options={[
                    { value: 'available', label: 'Available' },
                    { value: 'trial_only', label: 'Trials only' },
                    { value: 'under_contract', label: 'Under contract' },
                    { value: 'not_looking', label: 'Not looking' },
                  ]}
                />

                <Input
                  label="Contract expiry"
                  type="date"
                  value={form.contract_expiry}
                  onChange={event => setField('contract_expiry', event.target.value)}
                  hint="Leave blank if not under contract."
                />
              </div>
            </Card>

            <Card className="p-5">
              <CardHeader
                title="Career history"
                subtitle="Career records are stored separately from your profile."
              />

              <div className="mt-4">
                {typedCareer.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center">
                    <Icon
                      name="list"
                      size={22}
                      className="mx-auto text-ink-300"
                    />
                    <p className="mt-3 text-sm font-semibold text-ink-700">
                      No career entries yet
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      Your verified club history will appear here when entries are added.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {typedCareer.map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                        {initials(
  entry.club_name || 'Club',
  entry.club_name || 'Club',
)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink-900">
                            {entry.club_name || 'Club'}
                          </p>

                          <p className="text-2xs text-ink-500">
                            {entry.season || 'Season not specified'}
                            {' · '}
                            {entry.appearances ?? 0} apps
                            {' · '}
                            {entry.goals ?? 0} goals
                          </p>
                        </div>

                        {entry.verified ? (
                          <Badge tone="trust" icon="check" size="sm">
                            Verified
                          </Badge>
                        ) : (
                          <Badge tone="neutral" size="sm">
                            Unverified
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

                  <div className="space-y-4">
            {player.is_minor && (
              <MinorProtectionNotice guardianName={player.guardian_name ?? undefined} />
            )}

            <Card className="p-5">
              <CardHeader
                title="Profile status"
                subtitle="Information clubs can use when discovering you."
              />

              <div className="mt-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-extrabold text-ink-900">
                      {completeness}%
                    </p>
                    <p className="text-xs text-ink-500">
                      Profile completeness
                    </p>
                  </div>

                  <Badge
                    tone={completeness >= 80 ? 'trust' : 'warn'}
                    icon={completeness >= 80 ? 'check' : 'alert'}
                  >
                    {completeness >= 80 ? 'Strong profile' : 'Needs attention'}
                  </Badge>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-red-500 transition-[width]"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold">Visibility</h3>

              <p className="mb-3 text-xs leading-relaxed text-ink-500">
                Choose who can discover your player profile.
              </p>

              <Select
                value={form.visibility}
                onChange={event => {
                  setField(
                    'visibility',
                    event.target.value as ProfileForm['visibility'],
                  )
                }}
              options={[
  {
    value: 'public',
    label: 'Public — anyone on FutWeb',
    disabled: player.is_minor,
  },
  {
    value: 'verified_only',
    label: 'Verified clubs only',
  },
  {
    value: 'private',
    label: 'Private — invite only',
  },
]}
              />

              <div className="mt-3 rounded-xl bg-ink-50 p-3">
                <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-600">
                  <Icon
                    name="info"
                    size={12}
                    className="mt-0.5 shrink-0"
                  />
                  Verified clubs only is the safer default. If you are under 18,
                  FutWeb's database protection rules can restrict public visibility.
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold">Live player record</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-500">Profile ID</span>
                  <span className="max-w-[190px] truncate font-mono text-2xs text-ink-700">
                    {player.id}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-500">Slug</span>
                  <span className="max-w-[190px] truncate text-xs font-semibold text-ink-700">
                    {player.slug}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-500">Last updated</span>
                  <span className="text-xs font-semibold text-ink-700">
                    {formatDate(player.updated_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-500">Availability</span>
                  <Badge tone="neutral" size="sm">
                    {form.availability.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <div className="relative h-28 bg-gradient-to-br from-ink-900 via-ink-850 to-red-900">
              <div className="absolute inset-0 bg-pitch opacity-50" />
            </div>

            <div className="px-5 pb-5">
              <div className="-mt-10 flex items-end gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-white bg-red-600 font-display text-2xl text-white shadow-lg">
                  {initials(form.first_name, form.last_name)}
                </div>

                <div className="mb-1 min-w-0 flex-1">
                  <h2 className="truncate font-display text-2xl tracking-wide">
                    {fullName}
                  </h2>

                  <p className="text-xs text-ink-500">
                    {form.position_primary}
                    {age !== null ? ` · ${age} yrs` : ''}
                    {' · '}
                    {form.nationality}
                  </p>
                </div>

                {player.is_minor ? (
                  <Badge tone="warn" icon="shield" size="sm">
                    Protected
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm">
                    Player
                  </Badge>
                )}
              </div>

              {form.bio ? (
                <p className="mt-4 text-sm leading-relaxed text-ink-700">
                  {form.bio}
                </p>
              ) : (
                <p className="mt-4 text-sm italic text-ink-400">
                  No player bio has been added yet.
                </p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Height', form.height_cm ? `${form.height_cm} cm` : '—'],
                  ['Weight', form.weight_kg ? `${form.weight_kg} kg` : '—'],
                  ['Foot', form.foot],
                  ['State', form.state_of_origin || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-ink-50 p-3"
                  >
                    <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">
                      {label}
                    </p>

                    <p className="mt-0.5 text-sm font-bold capitalize text-ink-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {secondaryPositions.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-ink-400">
                    Other positions
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {secondaryPositions.map(position => (
                      <Badge key={position} tone="neutral" size="sm">
                        {position}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <CardHeader
                title="Availability"
                subtitle="Current player status"
              />

              <div className="mt-4">
                <Badge tone="green" icon="check">
                  {form.availability.replace('_', ' ')}
                </Badge>

                <p className="mt-3 text-sm leading-relaxed text-ink-600">
                  {form.availability === 'available'
                    ? 'Your profile indicates that you are currently open to club opportunities.'
                    : form.availability === 'trial_only'
                      ? 'Your profile indicates that you are primarily open to trial opportunities.'
                      : form.availability === 'under_contract'
                        ? 'Your profile indicates that you are currently under contract.'
                        : 'Your profile indicates that you are not currently looking for opportunities.'}
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <CardHeader
                title="Club visibility"
                subtitle="Current discovery setting"
              />

              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-600">
                  <Icon name="eye" size={18} />
                </div>

                <div>
                  <p className="text-sm font-bold capitalize text-ink-900">
                    {form.visibility.replace('_', ' ')}
                  </p>

                  <p className="text-xs text-ink-500">
                    This is the visibility setting stored on your live profile.
                  </p>
                </div>
              </div>
            </Card>

            {player.is_minor && (
              <Card className="p-5">
                <CardHeader
                  title="Minor protection"
                  subtitle="Guardian-controlled information"
                />

                <div className="mt-4 rounded-xl bg-amber-50 p-3">
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
                    <Icon
                      name="shield"
                      size={14}
                      className="mt-0.5 shrink-0"
                    />
                    This player is recorded as under 18. Guardian information
                    and consent are handled separately from the public player CV.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
