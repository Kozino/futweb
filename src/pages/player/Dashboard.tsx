
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import {
  Button,
  Card,
  Icon,
  ProgressBar,
  Skeleton,
  Toaster,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { usePlayer } from '@/context/PlayerContext'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getAge(dob: string | null | undefined) {
  if (!dob) return null

  const birth = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()

  const month = today.getMonth() - birth.getMonth()

  if (
    month < 0 ||
    (month === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1
  }

  return age
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`
    .trim()
    .toUpperCase()
}

function getAttributeCount(attributes: Record<string, unknown> | null) {
  if (!attributes) return 0

  return Object.values(attributes).filter(
    (value) => typeof value === 'number'
  ).length
}

export default function PlayerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    player,
    attributes,
    stats,
    career,
    applications,
    loading,
    error,
    refresh,
  } = usePlayer()

  const displayName = useMemo(() => {
    if (!player) return user?.fullName || 'Player'

    return `${player.first_name} ${player.last_name}`.trim()
  }, [player, user?.fullName])

  const age = useMemo(
    () => getAge(player?.dob),
    [player?.dob],
  )

  const initials = useMemo(() => {
    if (!player) {
      const parts = (user?.fullName || 'Player').trim().split(/\s+/)

      return getInitials(
        parts[0] || 'P',
        parts.length > 1 ? parts[parts.length - 1] : '',
      )
    }

    return getInitials(player.first_name, player.last_name)
  }, [player, user?.fullName])

  const activeApplications = useMemo(() => {
    return applications.filter((application) =>
      ['pending', 'shortlisted', 'accepted'].includes(application.status),
    )
  }, [applications])

  const recentStats = useMemo(() => {
    return [...stats]
      .sort((a, b) => {
        const aSeason = String(a.season ?? '')
        const bSeason = String(b.season ?? '')

        return bSeason.localeCompare(aSeason)
      })
      .slice(0, 3)
  }, [stats])

  const attributeCount = useMemo(
    () => getAttributeCount(attributes),
    [attributes],
  )

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>

          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </AppShell>
    )
  }

  if (!player) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl py-16">
          <Card className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Icon name="user" size={28} />
            </div>

            <h1 className="text-xl font-semibold text-slate-900">
              Complete your player profile
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your account is authenticated, but your player profile has not
              been created yet. Complete onboarding to start building your
              FutWeb profile.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => navigate('/onboarding/player')}>
                Complete onboarding
              </Button>

              <Button
                variant="secondary"
                onClick={() => void refresh()}
              >
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Toaster />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Player workspace
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {player.first_name}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Keep your profile current and make it easy for clubs to evaluate
              you.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/player/profile')}
            >
              <Icon name="user" size={16} />
              Profile
            </Button>

            <Button onClick={() => navigate('/player/media')}>
              <Icon name="upload" size={16} />
              Add media
            </Button>
          </div>
        </div>

        {/* Player summary */}
        <Card className="overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
                  {initials}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-900">
                      {displayName}
                    </h2>

                    {player.is_minor && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                        Minor
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>{player.position_primary}</span>

                    {age !== null && <span>{age} years</span>}

                    {player.nationality && (
                      <span>{player.nationality}</span>
                    )}

                    {player.foot && (
                      <span>
                        {player.foot === 'both'
                          ? 'Both feet'
                          : `${player.foot} foot`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">FutWeb score</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {player.futweb_score ?? '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Potential</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {player.potential ?? '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Attributes</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {attributeCount}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Applications</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {activeApplications.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    player.visibility === 'public'
                      ? 'bg-emerald-500'
                      : player.visibility === 'verified_only'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                  }`}
                />

                <span className="font-medium text-slate-700">
                  {player.visibility === 'public'
                    ? 'Public profile'
                    : player.visibility === 'verified_only'
                      ? 'Verified clubs only'
                      : 'Private profile'}
                </span>
              </div>

              <Button
                variant="ghost"
                onClick={() => navigate('/player/profile')}
              >
                Manage visibility
              </Button>
            </div>
          </div>
        </Card>

        {/* Main dashboard grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile completeness */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Profile strength
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Complete your profile to give clubs a stronger picture of
                  your playing level.
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={() => navigate('/player/profile')}
              >
                Edit
              </Button>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  Profile completeness
                </span>

                <span className="font-semibold text-slate-900">
                  {calculateProfileCompleteness(player)}%
                </span>
              </div>

              <ProgressBar
                value={calculateProfileCompleteness(player)}
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ProfileCheck
                label="Personal details"
                complete={Boolean(
                  player.first_name &&
                    player.last_name &&
                    player.dob &&
                    player.nationality,
                )}
              />

              <ProfileCheck
                label="Football details"
                complete={Boolean(
                  player.position_primary &&
                    player.foot &&
                    player.height_cm &&
                    player.weight_kg,
                )}
              />

              <ProfileCheck
                label="Player bio"
                complete={Boolean(player.bio)}
              />

              <ProfileCheck
                label="Career history"
                complete={career.length > 0}
              />
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">
              Quick actions
            </h2>

            <div className="mt-4 space-y-2">
              <QuickAction
                icon="user"
                label="Update profile"
                onClick={() => navigate('/player/profile')}
              />

              <QuickAction
                icon="star"
                label="Update attributes"
                onClick={() => navigate('/player/attributes')}
              />

              <QuickAction
                icon="bar-chart"
                label="Log match stats"
                onClick={() => navigate('/player/stats')}
              />

              <QuickAction
                icon="play"
                label="Manage media"
                onClick={() => navigate('/player/media')}
              />

              <QuickAction
                icon="search"
                label="Find trials"
                onClick={() => navigate('/player/trials')}
              />
            </div>
          </Card>
        </div>

        {/* Football information */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Playing profile
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your core football information.
                </p>
              </div>

              <Button
                variant="ghost"
                onClick={() => navigate('/player/profile')}
              >
                Edit
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <InfoItem
                label="Primary position"
                value={player.position_primary}
              />

              <InfoItem
                label="Secondary positions"
                value={
                  player.position_secondary?.length
                    ? player.position_secondary.join(', ')
                    : 'None added'
                }
              />

              <InfoItem
                label="Preferred foot"
                value={
                  player.foot === 'both'
                    ? 'Both'
                    : player.foot
                      ? `${player.foot} foot`
                      : '—'
                }
              />

              <InfoItem
                label="Height"
                value={
                  player.height_cm
                    ? `${player.height_cm} cm`
                    : 'Not provided'
                }
              />

              <InfoItem
                label="Weight"
                value={
                  player.weight_kg
                    ? `${player.weight_kg} kg`
                    : 'Not provided'
                }
              />

              <InfoItem
                label="Availability"
                value={formatAvailability(player.availability)}
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Recent performance
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your latest recorded seasons.
                </p>
              </div>

              <Button
                variant="ghost"
                onClick={() => navigate('/player/stats')}
              >
                View all
              </Button>
            </div>

            {recentStats.length === 0 ? (
              <EmptyState
                title="No match statistics yet"
                description="Add your first season statistics to start building your performance history."
                actionLabel="Add stats"
                onAction={() => navigate('/player/stats')}
              />
            ) : (
              <div className="mt-5 space-y-3">
                {recentStats.map((stat) => (
                  <div
                    key={stat.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {stat.season}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {stat.competition || 'Competition not specified'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-right">
                      <StatValue
                        label="Apps"
                        value={stat.appearances}
                      />

                      <StatValue
                        label="Goals"
                        value={stat.goals}
                      />

                      <StatValue
                        label="Assists"
                        value={stat.assists}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Trial applications */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Trial applications
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Keep track of your current recruitment activity.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={() => navigate('/player/trials')}
            >
              Browse trials
            </Button>
          </div>

          {applications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Browse verified club trial opportunities and submit an application."
              actionLabel="Find trials"
              onAction={() => navigate('/player/trials')}
            />
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {applications.slice(0, 6).map((application) => (
                <div
                  key={application.id}
                  className="rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        Trial application
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Applied {formatDate(application.created_at)}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                      {String(application.status).replaceAll('_', ' ')}
                    </span>
                  </div>

                  {application.message && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                      {application.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Player protection */}
        {player.is_minor && (
          <Card className="border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <div className="mt-0.5 shrink-0">
                <Icon name="shield" size={20} />
              </div>

              <div>
                <h2 className="font-semibold text-amber-900">
                  Minor-player protection is active
                </h2>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Your account is subject to additional safeguarding controls.
                  Your profile visibility is managed according to FutWeb's
                  minor-player protection rules.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

function calculateProfileCompleteness(
  player: {
    first_name: string
    last_name: string
    dob: string
    nationality: string
    position_primary: string
    foot: string
    height_cm: number | null
    weight_kg: number | null
    bio: string | null
  },
) {
  const checks = [
    Boolean(player.first_name),
    Boolean(player.last_name),
    Boolean(player.dob),
    Boolean(player.nationality),
    Boolean(player.position_primary),
    Boolean(player.foot),
    Boolean(player.height_cm),
    Boolean(player.weight_kg),
    Boolean(player.bio),
  ]

  const completed = checks.filter(Boolean).length

  return Math.round((completed / checks.length) * 100)
}

function ProfileCheck({
  label,
  complete,
}: {
  label: string
  complete: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full ${
          complete
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-400'
        }`}
      >
        <Icon
          name={complete ? 'check' : 'minus'}
          size={14}
        />
      </div>

      <span className="text-sm font-medium text-slate-700">
        {label}
      </span>
    </div>
  )
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
        <Icon name={icon} size={17} />
      </span>

      <span>{label}</span>

      <Icon
        name="chevron-right"
        size={15}
        className="ml-auto text-slate-400"
      />
    </button>
  )
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  )
}

function StatValue({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value ?? 0}
      </p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center">
      <h3 className="font-medium text-slate-800">{title}</h3>

      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>

      <Button
        variant="secondary"
        className="mt-4"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  )
}

function formatAvailability(
  value:
    | 'available'
    | 'trial_only'
    | 'under_contract'
    | 'not_looking',
) {
  switch (value) {
    case 'available':
      return 'Available'

    case 'trial_only':
      return 'Trial opportunities'

    case 'under_contract':
      return 'Under contract'

    case 'not_looking':
      return 'Not looking'

    default:
      return value
  }
}
