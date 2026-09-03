import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  Icon,
  Modal,
  Select,
  Tabs,
  toast,
} from '@/components/ui'
import { usePlayer } from '@/context/PlayerContext'
import {
  createMediaAsset,
  deleteMediaAsset,
  getPlayerMedia,
  type MediaAssetRow,
  type MediaKind,
} from '@/lib/supabase/media'
import { NoFeeGuarantee } from '@/components/trust'

type MediaTab = 'all' | MediaKind

const MAX_FILE_SIZE = 500 * 1024 * 1024

function formatFileSize(bytes: number | null) {
  if (!bytes) return '—'

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function mediaLabel(kind: MediaKind) {
  switch (kind) {
    case 'highlight':
      return 'Highlight reel'
    case 'full_match':
      return 'Full match'
    case 'photo':
      return 'Photo'
  }
}

function isImage(asset: MediaAssetRow) {
  return asset.kind === 'photo'
}

function isVideo(asset: MediaAssetRow) {
  return asset.kind === 'highlight' || asset.kind === 'full_match'
}

export default function PlayerMedia() {
  const { player, loading: playerLoading } = usePlayer()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [media, setMedia] = useState<MediaAssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [tab, setTab] = useState<MediaTab>('all')

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [recordedLocation, setRecordedLocation] = useState('')
  const [kind, setKind] = useState<MediaKind>('highlight')

  useEffect(() => {
    let cancelled = false

    async function loadMedia() {
      if (!player) {
        setMedia([])
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const rows = await getPlayerMedia(player.id)

        if (!cancelled) {
          setMedia(rows)
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            tone: 'error',
            title: 'Could not load media',
            description:
              err instanceof Error
                ? err.message
                : 'Please try again.',
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMedia()

    return () => {
      cancelled = true
    }
  }, [player])

  const items = useMemo(
    () =>
      tab === 'all'
        ? media
        : media.filter(item => item.kind === tab),
    [media, tab],
  )

  const highlightCount = media.filter(
    item => item.kind === 'highlight',
  ).length

  const fullMatchCount = media.filter(
    item => item.kind === 'full_match',
  ).length

  const photoCount = media.filter(
    item => item.kind === 'photo',
  ).length

  function resetUploadForm() {
    setFile(null)
    setTitle('')
    setRecordedAt('')
    setRecordedLocation('')
    setKind('highlight')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function closeUpload() {
    if (uploading) return

    setUploadOpen(false)
    resetUploadForm()
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selected = event.target.files?.[0] ?? null

    if (!selected) {
      setFile(null)
      return
    }

    if (selected.size > MAX_FILE_SIZE) {
      toast({
        tone: 'error',
        title: 'File is too large',
        description: 'Media files must be 500MB or smaller.',
      })

      event.target.value = ''
      setFile(null)
      return
    }

    const allowedTypes = new Set([
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'image/jpeg',
      'image/png',
      'image/webp',
    ])

    if (!allowedTypes.has(selected.type)) {
      toast({
        tone: 'error',
        title: 'Unsupported file',
        description:
          'Use MP4, MOV, WebM, JPEG, PNG or WebP.',
      })

      event.target.value = ''
      setFile(null)
      return
    }

    setFile(selected)

    if (!title.trim()) {
      setTitle(
        selected.name.replace(/\.[^/.]+$/, '').slice(0, 100),
      )
    }

    if (selected.type.startsWith('image/')) {
      setKind('photo')
    }
  }

  async function handleUpload() {
    if (!player) return

    if (!file) {
      toast({
        tone: 'error',
        title: 'Choose a file',
        description: 'Select the video or photo you want to upload.',
      })
      return
    }

    if (!title.trim()) {
      toast({
        tone: 'error',
        title: 'Add a title',
        description: 'Give this media item a clear title.',
      })
      return
    }

    if (
      kind !== 'photo' &&
      file.type.startsWith('image/')
    ) {
      toast({
        tone: 'error',
        title: 'Media type mismatch',
        description: 'Photos must be uploaded as Photo.',
      })
      return
    }

    if (
      kind === 'photo' &&
      file.type.startsWith('video/')
    ) {
      toast({
        tone: 'error',
        title: 'Media type mismatch',
        description: 'Videos cannot be uploaded as Photo.',
      })
      return
    }

    setUploading(true)

    try {
      const created = await createMediaAsset({
        playerId: player.id,
        file,
        kind,
        title,
        recordedAt: recordedAt || null,
        recordedLocation: recordedLocation || null,
      })

      setMedia(current => [created, ...current])

      toast({
        tone: 'success',
        title: 'Media uploaded',
        description:
          'Your media has been added to your player profile.',
      })

      setUploadOpen(false)
      resetUploadForm()
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Upload failed',
        description:
          err instanceof Error
            ? err.message
            : 'Please try again.',
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(asset: MediaAssetRow) {
    const confirmed = window.confirm(
      `Delete "${asset.title}"? This cannot be undone.`,
    )

    if (!confirmed) return

    setDeletingId(asset.id)

    try {
      await deleteMediaAsset(asset)

      setMedia(current =>
        current.filter(item => item.id !== asset.id),
      )

      toast({
        tone: 'success',
        title: 'Media deleted',
        description: 'The media item was removed.',
      })
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Could not delete media',
        description:
          err instanceof Error
            ? err.message
            : 'Please try again.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (playerLoading || loading) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="video"
          title="Media"
          subtitle="Video is the single most persuasive thing on your CV. Lead with it."
        />

        <Card className="p-6">
          <p className="text-sm text-ink-500">
            Loading your media…
          </p>
        </Card>
      </div>
    )
  }

  if (!player) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="video"
          title="Media"
          subtitle="Video is the single most persuasive thing on your CV. Lead with it."
        />

        <Card className="p-6">
          <h2 className="text-base font-bold text-ink-900">
            Player profile not found
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Complete your player profile before uploading media.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Player workspace"
        icon="video"
        title="Media"
        subtitle="Video is the single most persuasive thing on your CV. Lead with it."
        actions={
          <Button
            icon="upload"
            onClick={() => setUploadOpen(true)}
          >
            Upload
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: 'all',
            label: 'All',
            count: media.length,
          },
          {
            value: 'highlight',
            label: 'Highlights',
            count: highlightCount,
          },
          {
            value: 'full_match',
            label: 'Full matches',
            count: fullMatchCount,
          },
          {
            value: 'photo',
            label: 'Photos',
            count: photoCount,
          },
        ]}
      />

      {items.length === 0 ? (
        <Card className="mt-5 p-6">
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-8 text-center">
            <Icon
              name="video"
              size={28}
              className="mx-auto text-ink-300"
            />
            <h3 className="mt-3 text-sm font-bold text-ink-800">
              No media yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-500">
              Upload a highlight reel, full match recording or player
              photo. Your uploads will be stored securely and remain
              unverified until reviewed.
            </p>

            <Button
              className="mt-4"
              icon="upload"
              onClick={() => setUploadOpen(true)}
            >
              Upload media
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(asset => (
            <Card
              key={asset.id}
              hover
              className="overflow-hidden"
            >
              <div className="relative aspect-video bg-ink-900">
                {asset.url && isImage(asset) ? (
                  <img
                    src={asset.url}
                    alt={asset.title}
                    className="h-full w-full object-cover"
                  />
                ) : asset.url && isVideo(asset) ? (
                  <video
                    src={asset.url}
                    controls
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
                      <Icon name="video" size={20} />
                    </span>
                  </div>
                )}

                {asset.duration_s ? (
                  <span className="tnum absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-2xs font-semibold text-white">
                    {Math.floor(asset.duration_s / 60)}:
                    {String(asset.duration_s % 60).padStart(2, '0')}
                  </span>
                ) : null}

                {asset.verified ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-trust-400 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <Icon name="shield" size={9} />
                    VERIFIED
                  </span>
                ) : null}
              </div>

              <div className="p-3.5">
                <p className="truncate text-xs font-bold">
                  {asset.title}
                </p>

                <p className="mt-0.5 truncate text-2xs text-ink-500">
                  {mediaLabel(asset.kind)}
                  {' · '}
                  {formatDate(asset.recorded_at)}
                </p>

                <p className="mt-0.5 truncate text-2xs text-ink-400">
                  {asset.recorded_location || 'Location not provided'}
                  {' · '}
                  {formatFileSize(asset.size_bytes)}
                </p>

                <div className="mt-2.5 flex items-center gap-1.5">
                  {asset.url ? (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        icon="external"
                        className="w-full"
                      >
                        Open
                      </Button>
                    </a>
                  ) : (
                    <span className="flex-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="w-full"
                      >
                        Unavailable
                      </Button>
                    </span>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    className="text-red-500"
                    disabled={deletingId === asset.id}
                    onClick={() => void handleDelete(asset)}
                  />
                </div>
              </div>
            </Card>
          ))}

          <button
            onClick={() => setUploadOpen(true)}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 text-ink-400 transition-colors hover:border-red-300 hover:bg-red-50/40 hover:text-red-500"
          >
            <Icon name="plus" size={26} />
            <span className="text-xs font-semibold">
              Add media
            </span>
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h3 className="text-sm font-bold">
            Why we record provenance
          </h3>

          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Every upload records when and where it was created. This gives
            clubs useful context and helps FutWeb distinguish genuine player
            footage from material that has been copied or misrepresented.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              'Max 500MB per upload',
              'MP4, MOV or WebM',
              'Private storage with signed access',
              'Verified badge after review',
            ].map(text => (
              <span
                key={text}
                className="flex items-center gap-1.5 text-xs text-ink-600"
              >
                <Icon
                  name="check"
                  size={13}
                  className="shrink-0 text-trust-500"
                />
                {text}
              </span>
            ))}
          </div>
        </Card>

        <NoFeeGuarantee />
      </div>

      <Modal
        open={uploadOpen}
        onClose={closeUpload}
        title="Upload media"
        description="Add genuine match footage or a player photo to your profile."
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeUpload}
              disabled={uploading}
            >
              Cancel
            </Button>

            <Button
              icon="upload"
              onClick={() => void handleUpload()}
              disabled={uploading || !file}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 px-6 py-8 text-center">
            <Icon
              name="upload"
              size={28}
              className="mx-auto text-ink-400"
            />

            <p className="mt-2 text-sm font-semibold">
              {file ? file.name : 'Choose a file'}
            </p>

            <p className="text-xs text-ink-500">
              MP4, MOV, WebM, JPEG, PNG or WebP · up to 500MB
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {file ? 'Choose another file' : 'Choose file'}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="fw-input"
              placeholder="Title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={120}
              disabled={uploading}
            />

            <input
              className="fw-input"
              type="date"
              value={recordedAt}
              onChange={event => setRecordedAt(event.target.value)}
              disabled={uploading}
            />

            <input
              className="fw-input"
              placeholder="Location (e.g. Lagos)"
              value={recordedLocation}
              onChange={event =>
                setRecordedLocation(event.target.value)
              }
              maxLength={120}
              disabled={uploading}
            />

            <Select
              value={kind}
              onChange={event =>
                setKind(event.target.value as MediaKind)
              }
              disabled={uploading}
              options={[
                {
                  value: 'highlight',
                  label: 'Highlight reel',
                },
                {
                  value: 'full_match',
                  label: 'Full match',
                },
                {
                  value: 'photo',
                  label: 'Photo',
                },
              ]}
            />
          </div>

          {file ? (
            <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2">
              <p className="text-xs font-semibold text-ink-700">
                Ready to upload
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {formatFileSize(file.size)}
                {' · '}
                {file.type || 'Unknown file type'}
              </p>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
