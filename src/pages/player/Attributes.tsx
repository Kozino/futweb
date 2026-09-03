import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  Icon,
  Select,
  Tabs,
  toast,
} from '@/components/ui'
import {
  AttributeBars,
  ConfidenceMeter,
  PositionFitBar,
  ScoreRing,
} from '@/components/player/Attributes'
import { AttributeRadar } from '@/components/player/Radar'
import { usePlayer } from '@/context/PlayerContext'
import {
  createSelfRatingSnapshot,
  getPlayerRatingSnapshots,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributesRow,
} from '@/lib/supabase/attributes'
import {
  ATTRIBUTE_GROUPS,
  POSITION_LIST,
  computeConfidence,
  computeFutWebScore,
  ageFrom,
} from '@/lib/ratings'
import type { PlayerAttributes } from '@/types'

const GROUP_NAMES = [
  'Technical',
  'Physical',
  'Mental',
  'Defending',
  'Goalkeeping',
] as const

type AttributeGroup = (typeof GROUP_NAMES)[number]

type RatingSnapshot = {
  id?: string
  player_id?: string
  rated_by?: string
  rated_by_role?: string
  context?: string
  attributes?: Record<string, unknown>
  futweb_score?: number | null
  position_fit?: Record<string, number> | null
  confidence?: number | null
  offline_captured?: boolean
  created_at?: string
}

function attributesFromRow(
  row: PlayerAttributesRow | null,
): PlayerAttributes {
  const attributes = {} as PlayerAttributes

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const value = row?.[key]

    attributes[key] =
      typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(99, value))
        : 50
  }

  return attributes
}

function attributesFromSnapshot(
  snapshot: RatingSnapshot | null,
): PlayerAttributes | null {
  if (!snapshot?.attributes) return null

  const attributes = {} as PlayerAttributes
  let found = false

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const value = snapshot.attributes[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      attributes[key] = Math.max(0, Math.min(99, value))
      found = true
    } else {
      attributes[key] = 50
    }
  }

  return found ? attributes : null
}

function snapshotCreatedAt(snapshot: RatingSnapshot) {
  if (!snapshot.created_at) return 'Unknown date'

  const date = new Date(snapshot.created_at)

  if (Number.isNaN(date.getTime())) {
    return snapshot.created_at
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function countDistinctRaters(snapshots: RatingSnapshot[]) {
  return new Set(
    snapshots
      .map(snapshot => snapshot.rated_by)
      .filter((value): value is string => Boolean(value)),
  ).size
}

export default function PlayerAttributes() {
  const {
    player,
    attributes: playerAttributes,
    loading: playerLoading,
  } = usePlayer()

  const [attrs, setAttrs] = useState<PlayerAttributes | null>(null)
  const [group, setGroup] = useState<AttributeGroup>('Technical')
  const [position, setPosition] = useState('')
  const [snapshots, setSnapshots] = useState<RatingSnapshot[]>([])
  const [loadingRatings, setLoadingRatings] = useState(true)
  const [saving, setSaving] = useState(false)

 useEffect(() => {
  if (!player) {
    setLoadingRatings(false)
    return
  }

  const playerId = player.id
  const playerPosition = player.position_primary

  setPosition(playerPosition)

  let cancelled = false
   
    async function loadRatings() {
      setLoadingRatings(true)

      try {
       const rows = await getPlayerRatingSnapshots(playerId)

        if (cancelled) return

        const typedSnapshots = rows as RatingSnapshot[]
        setSnapshots(typedSnapshots)

      const latestSelfRating =
  typedSnapshots.find(
    snapshot => snapshot.rated_by_role === 'self',
  ) ?? null

const snapshotAttributes = attributesFromSnapshot(latestSelfRating)

        if (snapshotAttributes) {
          setAttrs(snapshotAttributes)
        } else {
          setAttrs(attributesFromRow(playerAttributes as PlayerAttributesRow | null))
        }
      } catch (error) {
        if (cancelled) return

        setAttrs(
          attributesFromRow(
            playerAttributes as PlayerAttributesRow | null,
          ),
        )

        toast({
          tone: 'error',
          title: 'Could not load rating history',
          description:
            error instanceof Error
              ? error.message
              : 'Your current attributes were loaded, but rating history could not be read.',
        })
      } finally {
        if (!cancelled) {
          setLoadingRatings(false)
        }
      }
    }

    void loadRatings()

    return () => {
      cancelled = true
    }
  }, [player, playerAttributes])

  const confidence = useMemo(() => {
    const ratingCount = snapshots.length
    const independentRaters = countDistinctRaters(snapshots)
    const verifiedRaters = snapshots.filter(
      snapshot =>
        snapshot.rated_by_role === 'coach' ||
        snapshot.rated_by_role === 'scout' ||
        snapshot.rated_by_role === 'analyst' ||
        snapshot.rated_by_role === 'academy',
    ).length

    return computeConfidence({
      ratingCount,
      independentRaters,
      verifiedRaters,
      matchesObserved: 0,
      hasVideo: false,
      hasVerifiedStats: false,
    })
  }, [snapshots])

  const score = useMemo(() => {
    if (!attrs || !player || !position) return null

    return computeFutWebScore({
      attributes: attrs,
      position,
      age: ageFrom(player.dob),
      confidence: confidence.score,
    })
  }, [attrs, player, position, confidence.score])

  const latestSelfRating = useMemo(
    () =>
      snapshots.find(snapshot => snapshot.rated_by_role === 'self') ?? null,
    [snapshots],
  )

  const verifiedRatingCount = useMemo(
    () =>
      snapshots.filter(
        snapshot =>
          snapshot.rated_by_role === 'coach' ||
          snapshot.rated_by_role === 'scout' ||
          snapshot.rated_by_role === 'analyst' ||
          snapshot.rated_by_role === 'academy',
      ).length,
    [snapshots],
  )

  const update = (key: string, value: number) => {
    setAttrs(current =>
      current
        ? {
            ...current,
            [key]: Math.max(20, Math.min(99, value)),
          }
        : current,
    )
  }

  const save = async () => {
    if (!player || !attrs || !score) return

    setSaving(true)

    try {
      const savedSnapshot = await createSelfRatingSnapshot(
        {
          playerId: player.id,
          attributes: attrs,
          context: 'training',
          futwebScore: score.current,
          positionFit: score.positionFit,
          confidence: confidence.score,
          offlineCaptured: false,
        },
        player.user_id,
      )

      setSnapshots(current => [
        savedSnapshot as RatingSnapshot,
        ...current,
      ])

      toast({
        tone: 'success',
        title: 'Self-rating saved',
        description:
          'Your latest attribute assessment has been permanently recorded as a self-rating snapshot.',
      })
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not save rating',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (playerLoading || (player && loadingRatings)) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="radar"
          title="Attributes"
          subtitle="Loading your live attribute profile…"
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="space-y-4">
                <div className="fw-skeleton h-5 w-40 rounded" />
                <div className="fw-skeleton h-10 rounded-xl" />
                <div className="space-y-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div
                      key={index}
                      className="fw-skeleton h-5 rounded"
                    />
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="fw-skeleton h-5 w-32 rounded" />
              <div className="mt-5 fw-skeleton h-64 rounded-xl" />
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="fw-skeleton h-24 rounded-xl" />
            </Card>
            <Card className="p-5">
              <div className="fw-skeleton h-64 rounded-xl" />
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!player || !attrs) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="radar"
          title="Attributes"
          subtitle="Your real attribute profile will appear here once your player profile is available."
        />

        <Card className="p-8">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-500">
              <Icon name="radar" size={24} />
            </div>

            <h2 className="mt-4 text-lg font-bold text-ink-900">
              No player profile found
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Complete player onboarding before editing your attributes.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const hasSelfRating = Boolean(latestSelfRating)

  return (
    <div>
      <PageHeader
        breadcrumb="Player workspace"
        icon="radar"
        title="Attributes"
        subtitle="Your 32-attribute profile. Self-ratings are recorded as evidence snapshots; verified coach and scout ratings carry greater weight."
        actions={
          <Button
            icon="check"
            loading={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save self-rating'}
          </Button>
        }
      />

      {!hasSelfRating && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-xs font-semibold text-gold-700">
          <Icon
            name="info"
            size={15}
            className="mt-0.5 shrink-0"
          />
          <span>
            You are viewing your current attribute record. Saving your
            assessment will create the first persistent self-rating snapshot.
          </span>
        </div>
      )}

      {verifiedRatingCount > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-trust-200 bg-trust-50 px-4 py-3 text-xs font-semibold text-trust-700">
          <Icon
            name="shield"
            size={15}
          />
          {verifiedRatingCount} verified rating
          {verifiedRatingCount === 1 ? '' : 's'} are included in your rating
          history.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  Self-rating editor
                </h3>

                <p className="text-xs text-ink-500">
                  Rate yourself honestly from 20–99. Your score is confidence-adjusted.
                </p>
              </div>

              <Select
                className="w-36"
                value={position}
                onChange={event => setPosition(event.target.value)}
                options={POSITION_LIST.map(value => ({
                  value,
                  label: value,
                }))}
              />
            </div>

            <Tabs
              value={group}
              onChange={setGroup}
              tabs={GROUP_NAMES.map(value => ({
                value,
                label: value,
              }))}
            />

            <div className="mt-5 space-y-3.5">
              {ATTRIBUTE_GROUPS[group].map(key => (
                <div
                  key={key}
                  className="flex items-center gap-3"
                >
                  <span className="w-28 shrink-0 truncate text-xs font-semibold capitalize text-ink-700">
                    {key.replace(/_/g, ' ')}
                  </span>

                  <input
                    type="range"
                    min={20}
                    max={99}
                    value={attrs[key] ?? 50}
                    onChange={event =>
                      update(key, Number(event.target.value))
                    }
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-100 accent-red-500"
                    aria-label={key.replace(/_/g, ' ')}
                  />

                  <span className="tnum w-8 shrink-0 text-right text-sm font-bold text-ink-900">
                    {attrs[key] ?? 50}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold">
              Full profile
            </h3>

            <AttributeBars
              attributes={attrs}
              highlightGroup={group}
            />
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold">
                  Rating history
                </h3>

                <p className="mt-1 text-xs text-ink-500">
                  Persistent snapshots recorded on FutWeb.
                </p>
              </div>

              <Badge tone="neutral" size="sm">
                {snapshots.length} snapshot
                {snapshots.length === 1 ? '' : 's'}
              </Badge>
            </div>

            <div className="mt-4">
              {snapshots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 px-4 py-7 text-center">
                  <Icon
                    name="list"
                    size={21}
                    className="mx-auto text-ink-300"
                  />

                  <p className="mt-3 text-sm font-semibold text-ink-700">
                    No rating snapshots yet
                  </p>

                  <p className="mt-1 text-xs text-ink-400">
                    Save your first self-rating to create a persistent
                    rating record.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.slice(0, 5).map(snapshot => (
                    <div
                      key={snapshot.id ?? snapshot.created_at}
                      className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-white">
                        <Icon
                          name={
                            snapshot.rated_by_role === 'self'
                              ? 'user'
                              : 'shield'
                          }
                          size={16}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold capitalize text-ink-900">
                          {snapshot.rated_by_role ?? 'Rating'}
                        </p>

                        <p className="text-2xs text-ink-500">
                          {snapshot.context ?? 'training'}
                          {' · '}
                          {snapshotCreatedAt(snapshot)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="tnum text-sm font-extrabold text-ink-900">
                          {snapshot.futweb_score ?? '—'}
                        </p>

                        <p className="text-2xs text-ink-400">
                          score
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold">
              Live score
            </h3>

            {score ? (
              <>
                <ScoreRing
                  score={score.current}
                  size={84}
                  confidence={confidence.score}
                  label={score.ratingTier}
                  sublabel={`Potential ${score.potential}`}
                />

                <div className="mt-4">
                  <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-ink-400">
                    Position fit
                  </p>

                  <PositionFitBar
                    fit={score.positionFit}
                    primary={position}
                  />
                </div>

                {score.viablePositions.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-2xs font-bold uppercase tracking-widest text-ink-400">
                      Also viable at
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {score.viablePositions
                        .slice(0, 8)
                        .map(value => (
                          <Badge
                            key={value}
                            tone="neutral"
                            size="sm"
                          >
                            {value}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-500">
                Score unavailable until your position and attributes are loaded.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <AttributeRadar
              attributes={attrs}
              keys={[...ATTRIBUTE_GROUPS[group]]}
              size={240}
            />
          </Card>

          <Card className="p-5">
            <ConfidenceMeter
              score={confidence.score}
              label={confidence.label}
              factors={confidence.factors}
            />

            <div className="mt-4 rounded-xl bg-ink-50 p-3.5">
              <p className="text-2xs leading-relaxed text-ink-600">
                Self-ratings are evidence, but they are not treated as
                equivalent to independent verified observations. As coach,
                scout and match evidence accumulates, confidence can increase.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold">
              What clubs should know
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100">
                  <Icon
                    name="user"
                    size={14}
                    className="text-ink-500"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-ink-700">
                    Self-assessment
                  </p>

                  <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">
                    Your own ratings are clearly identified and confidence-adjusted.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-trust-50">
                  <Icon
                    name="shield"
                    size={14}
                    className="text-trust-600"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-ink-700">
                    Verified evidence
                  </p>

                  <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">
                    Independent coach and scout ratings can provide stronger evidence than self-ratings.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50">
                  <Icon
                    name="radar"
                    size={14}
                    className="text-blue-600"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-ink-700">
                    Position-aware scoring
                  </p>

                  <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">
                    The headline score changes with the position selected above.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
