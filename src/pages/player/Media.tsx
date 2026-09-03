import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Card, Icon, Modal, ProgressBar, Tabs, toast } from '@/components/ui'
import { DEMO_PLAYERS } from '@/data/mock'
import { useOffline } from '@/context/OfflineContext'
import { formatDate } from '@/lib/utils'
import { NoFeeGuarantee } from '@/components/trust'

export default function PlayerMedia() {
  const me = useMemo(() => DEMO_PLAYERS[0], [])
  const [tab, setTab] = useState<'all' | 'highlight' | 'full_match' | 'photo'>('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const { dataSaver } = useOffline()
  const [uploading, setUploading] = useState(0)

  const items = me.media.filter(m => tab === 'all' || m.kind === tab)

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="video" title="Media"
        subtitle="Video is the single most persuasive thing on your CV. Lead with it."
        actions={<Button icon="upload" onClick={() => setUploadOpen(true)}>Upload</Button>} />

      {dataSaver && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800">
          <Icon name="zap" size={15} />
          Data saver is on — thumbnails are compressed and videos stream at a lower bitrate.
        </div>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'all', label: 'All', count: me.media.length },
        { value: 'highlight', label: 'Highlights', count: me.media.filter(m => m.kind === 'highlight').length },
        { value: 'full_match', label: 'Full matches', count: me.media.filter(m => m.kind === 'full_match').length },
        { value: 'photo', label: 'Photos', count: me.media.filter(m => m.kind === 'photo').length },
      ]} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(m => (
          <Card key={m.id} hover className="overflow-hidden">
            <div className="relative aspect-video bg-ink-900">
              <div className="absolute inset-0 bg-pitch bg-pitch opacity-40" />
              <div className="grid h-full w-full place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
                  <Icon name={m.kind === 'photo' ? 'video' : 'video'} size={20} />
                </span>
              </div>
              {m.duration_s && (
                <span className="tnum absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-2xs font-semibold text-white">
                  {Math.floor(m.duration_s / 60)}:{String(m.duration_s % 60).padStart(2, '0')}
                </span>
              )}
              {m.verified && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-trust-400 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <Icon name="shield" size={9} /> VERIFIED
                </span>
              )}
            </div>
            <div className="p-3.5">
              <p className="truncate text-xs font-bold">{m.title}</p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {m.recorded_location} · {formatDate(m.recorded_at!)}
              </p>
              <div className="mt-2.5 flex items-center gap-1.5">
                <Button size="sm" variant="outline" icon="edit" className="flex-1">Edit</Button>
                <Button size="sm" variant="ghost" icon="trash" className="text-red-500" />
              </div>
            </div>
          </Card>
        ))}

        <button onClick={() => setUploadOpen(true)}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 text-ink-400 transition-colors hover:border-red-300 hover:bg-red-50/40 hover:text-red-500">
          <Icon name="plus" size={26} />
          <span className="text-xs font-semibold">Add media</span>
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h3 className="text-sm font-bold">Why we record provenance</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Every clip carries when and where it was recorded. It is a small thing that solves a
            real problem: players passing off borrowed footage as their own. Clubs can see the
            provenance, and clips that do not check out lose their verified mark.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {['Max 500MB per upload', 'MP4, MOV or WebM', 'Compressed for 3G playback', 'Verified badge after review'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-ink-600">
                <Icon name="check" size={13} className="shrink-0 text-trust-500" />{t}
              </span>
            ))}
          </div>
        </Card>

        <NoFeeGuarantee />
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload media"
        description="Highlights under three minutes perform best with scouts."
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button icon="upload" onClick={() => {
              setUploadOpen(false); setUploading(0)
              toast({ tone: 'success', title: 'Upload queued', description: 'We will notify you once processing finishes.' })
            }}>Upload</Button>
          </>
        }>
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 px-6 py-10 text-center">
            <Icon name="upload" size={28} className="mx-auto text-ink-400" />
            <p className="mt-2 text-sm font-semibold">Drop a file or browse</p>
            <p className="text-xs text-ink-500">MP4, MOV or WebM · up to 500MB</p>
            <Button className="mt-3" size="sm" variant="outline">Choose file</Button>
          </div>
          {uploading > 0 && <ProgressBar value={uploading} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="fw-input" placeholder="Title" />
            <input className="fw-input" type="date" placeholder="Recorded on" />
            <input className="fw-input" placeholder="Location (e.g. Lagos)" />
            <select className="fw-input">
              <option>Highlight reel</option><option>Full match</option><option>Photo</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
