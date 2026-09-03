import { useRef, useState } from 'react'
import { Button, Icon, Modal, toast } from '@/components/ui'
import { ATTRIBUTE_LABELS, scoreColor } from '@/lib/ratings'
import type { PlayerAttributes } from '@/types'
import { formatDate } from '@/lib/utils'

/**
 * Shareable player card.
 *
 * Why this exists: in Nigeria the football marketplace runs on WhatsApp and
 * Instagram, not on portals. A scout forwards a link; a link gets ignored.
 * A crisp 1080×1350 image with the player's face, score and top attributes
 * gets forwarded to a coach's group chat and actually gets watched.
 *
 * Rendered with the raw Canvas API (no html2canvas) so it is dependency-free,
 * deterministic, and fast enough to run on a mid-range Android phone.
 */
export interface ShareCardData {
  name: string
  position: string
  age: number
  club: string
  nationality: string
  foot: string
  height: number
  weight: number
  score: number
  potential: number
  confidence: number
  attributes: PlayerAttributes
  verified: boolean
}

const W = 1080, H = 1350

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function draw(data: ShareCardData, avatar: HTMLImageElement | null): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  const PAD = 64

  /* --- Background: deep ink with a subtle pitch grid --- */
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0A0F1C'); bg.addColorStop(1, '#05070D')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  for (let x = 0; x < W; x += 46) for (let y = 0; y < H; y += 46) ctx.fillRect(x, y, 2, 2)

  /* --- Red diagonal sweep --- */
  ctx.save()
  ctx.beginPath(); ctx.moveTo(0, H * 0.52); ctx.lineTo(W, H * 0.30)
  ctx.lineTo(W, H * 0.44); ctx.lineTo(0, H * 0.66); ctx.closePath()
  const sweep = ctx.createLinearGradient(0, 0, W, 0)
  sweep.addColorStop(0, 'rgba(228,0,43,0.20)'); sweep.addColorStop(1, 'rgba(228,0,43,0.05)')
  ctx.fillStyle = sweep; ctx.fill(); ctx.restore()

  /* --- Header --- */
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 30px Inter, system-ui, sans-serif'
  ctx.fillText('FUTWEB', PAD, 112)
  ctx.fillStyle = '#E4002B'
  ctx.fillRect(PAD + 152, 92, 10, 10)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '500 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('VERIFIED PLAYER CV · ' + new Date().getFullYear(), W - PAD, 112)
  ctx.textAlign = 'left'

  /* --- Avatar --- */
  const AV = 300, avX = (W - AV) / 2, avY = 170
  ctx.save()
  roundRect(ctx, avX, avY, AV, AV, 36); ctx.clip()
  if (avatar) {
    const s = Math.max(AV / avatar.width, AV / avatar.height)
    const dw = avatar.width * s, dh = avatar.height * s
    ctx.drawImage(avatar, avX + (AV - dw) / 2, avY + (AV - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = '#1A243C'; ctx.fillRect(avX, avY, AV, AV)
    ctx.fillStyle = '#4B5876'; ctx.font = '700 110px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(data.name.split(' ').map(w => w[0]).slice(0, 2).join(''), avX + AV / 2, avY + AV / 2 + 38)
    ctx.textAlign = 'left'
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 3
  roundRect(ctx, avX, avY, AV, AV, 36); ctx.stroke()

  /* --- Name --- */
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '800 62px Inter, system-ui, sans-serif'
  ctx.fillText(data.name.toUpperCase(), W / 2, avY + AV + 96)

  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = '600 26px Inter, system-ui, sans-serif'
  ctx.fillText(`${data.position}  ·  ${data.age} yrs  ·  ${data.nationality}`, W / 2, avY + AV + 140)

  ctx.font = '500 22px Inter, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.40)'
  ctx.fillText(`${data.club}  ·  ${data.foot} foot  ·  ${data.height}cm / ${data.weight}kg`, W / 2, avY + AV + 180)
  ctx.textAlign = 'left'

  /* --- Score block --- */
  const cardY = avY + AV + 224, cardH = 168
  roundRect(ctx, PAD, cardY, W - PAD * 2, cardH, 28)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke()

  const cols: [string, string, string][] = [
    ['FUTWEB SCORE', String(data.score), scoreColor(data.score)],
    ['POTENTIAL', String(data.potential), '#F5B301'],
    ['CONFIDENCE', `${data.confidence}%`, '#94A0BC'],
  ]
  cols.forEach(([label, value, color], i) => {
    const x = PAD + (W - PAD * 2) * (i + 0.5) / 3
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '700 18px Inter, system-ui, sans-serif'
    ctx.fillText(label, x, cardY + 54)
    ctx.fillStyle = color
    ctx.font = '800 64px Inter, system-ui, sans-serif'
    ctx.fillText(value, x, cardY + 124)
    ctx.textAlign = 'left'
  })

  /* --- Top attributes --- */
  const top = Object.entries(data.attributes)
    .sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 6)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '700 18px Inter, system-ui, sans-serif'
  ctx.fillText('TOP ATTRIBUTES', PAD, cardY + cardH + 62)

  top.forEach(([k, v], i) => {
    const rowY = cardY + cardH + 96 + i * 62
    ctx.fillStyle = 'rgba(255,255,255,0.80)'
    ctx.font = '600 24px Inter, system-ui, sans-serif'
    ctx.fillText(ATTRIBUTE_LABELS[k] ?? k, PAD, rowY + 20)

    const barX = PAD + 300, barW = W - PAD * 2 - 300 - 90, barH = 16
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    roundRect(ctx, barX, rowY + 4, barW, barH, 8); ctx.fill()
    ctx.fillStyle = scoreColor(v as number)
    roundRect(ctx, barX, rowY + 4, Math.max(16, (barW * (v as number)) / 99), barH, 8); ctx.fill()

    ctx.textAlign = 'right'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '800 28px Inter, system-ui, sans-serif'
    ctx.fillText(String(v), W - PAD, rowY + 24)
    ctx.textAlign = 'left'
  })

  /* --- Footer --- */
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.font = '500 20px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  const foot = data.verified
    ? `Identity verified on FutWeb · ${formatDate(new Date())}`
    : `Unverified profile · ${formatDate(new Date())}`
  ctx.fillText(foot, W / 2, H - 54)

  ctx.fillStyle = '#E4002B'
  ctx.fillRect(W / 2 - 30, H - 116, 60, 5)
  ctx.textAlign = 'left'

  return c
}

export function useShareCard() {
  const [busy, setBusy] = useState(false)

  const build = async (data: ShareCardData, avatarUrl?: string) => {
    let avatar: HTMLImageElement | null = null
    if (avatarUrl) {
      try {
        avatar = await new Promise<HTMLImageElement | null>(res => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => res(img)
          img.onerror = () => res(null)
          img.src = avatarUrl
        })
      } catch { avatar = null }
    }
    return draw(data, avatar)
  }

  const download = async (data: ShareCardData, avatarUrl?: string) => {
    setBusy(true)
    try {
      const c = await build(data, avatarUrl)
      const a = document.createElement('a')
      a.download = `${data.name.replace(/\s+/g, '-').toLowerCase()}-futweb-card.png`
      a.href = c.toDataURL('image/png')
      a.click()
      toast({ tone: 'success', title: 'Card downloaded', description: 'Ready to share on WhatsApp or Instagram.' })
    } catch {
      toast({ tone: 'error', title: 'Could not generate card', description: 'Try again on a stable connection.' })
    } finally { setBusy(false) }
  }

  const share = async (data: ShareCardData, avatarUrl?: string, url?: string) => {
    setBusy(true)
    try {
      const c = await build(data, avatarUrl)
      const blob: Blob = await new Promise(res => c.toBlob(b => res(b!), 'image/png'))
      const file = new File([blob], `${data.name.toLowerCase().replace(/\s+/g, '-')}-futweb.png`, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${data.name} — FutWeb CV`,
          text: `${data.name}, ${data.position}, ${data.age}. FutWeb Score ${data.score}.`,
        })
        return
      }
      // Desktop / unsupported browsers: fall back to download.
      const a = document.createElement('a')
      a.download = file.name; a.href = URL.createObjectURL(blob); a.click()
      toast({ tone: 'info', title: 'Card downloaded', description: 'Share it directly on WhatsApp.' })
      void url
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        toast({ tone: 'error', title: 'Sharing unavailable', description: 'The card was downloaded instead.' })
      }
    } finally { setBusy(false) }
  }

  return { download, share, busy }
}

export function ShareCardModal({ open, onClose, data, avatarUrl, profileUrl }:
  { open: boolean; onClose: () => void; data: ShareCardData; avatarUrl?: string; profileUrl?: string }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { download, share, busy } = useShareCard()

  return (
    <Modal open={open} onClose={onClose} title="Share your CV" size="sm"
      description="A share-ready image card — built for WhatsApp and Instagram."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="dark" icon="download" loading={busy} onClick={() => download(data, avatarUrl)}>Download PNG</Button>
          <Button icon="share" loading={busy} onClick={() => share(data, avatarUrl, profileUrl)}>Share</Button>
        </>
      }>
      <div ref={canvasRef} className="mx-auto max-w-[320px]">
        <ShareCardPreview data={data} avatarUrl={avatarUrl} />
      </div>
      {profileUrl && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 p-2.5">
          <Icon name="globe" size={15} className="shrink-0 text-ink-400" />
          <code className="flex-1 truncate text-xs text-ink-600">{profileUrl}</code>
          <button onClick={() => { navigator.clipboard?.writeText(profileUrl); toast({ tone: 'success', title: 'Link copied' }) }}
            className="shrink-0 rounded-lg p-1.5 text-ink-500 hover:bg-ink-200 hover:text-ink-800">
            <Icon name="copy" size={14} />
          </button>
        </div>
      )}
    </Modal>
  )
}

/** Lightweight DOM preview (the PNG itself is canvas-rendered on demand). */
export function ShareCardPreview({ data, avatarUrl }: { data: ShareCardData; avatarUrl?: string }) {
  const top = Object.entries(data.attributes).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 6)
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-ink-900 shadow-2xl">
      <div className="absolute inset-0 bg-pitch bg-pitch opacity-70" />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-br from-red-600/25 to-transparent" />

      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg tracking-wider text-white">FUTWEB</span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-white/45">Player CV</span>
        </div>

        <div className="mx-auto mt-3 h-24 w-24 overflow-hidden rounded-2xl border-2 border-white/15 bg-ink-750">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center font-display text-2xl text-ink-400">
                {data.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>}
        </div>

        <div className="mt-3 text-center">
          <p className="font-display text-xl leading-tight tracking-wide text-white">{data.name.toUpperCase()}</p>
          <p className="mt-0.5 text-[11px] font-medium text-white/60">
            {data.position} · {data.age} yrs · {data.nationality}
          </p>
          <p className="text-[10px] text-white/35">{data.club}</p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
          {[['SCORE', data.score, scoreColor(data.score)], ['POTENTIAL', data.potential, '#F5B301'], ['CONFIDENCE', `${data.confidence}%`, '#94A0BC']]
            .map(([l, v, c]) => (
              <div key={l as string} className="text-center">
                <p className="text-[8px] font-bold tracking-wider text-white/45">{l as string}</p>
                <p className="tnum font-display text-2xl leading-tight" style={{ color: c as string }}>{v as number}</p>
              </div>
            ))}
        </div>

        <div className="mt-3 flex-1 space-y-1.5">
          {top.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-16 shrink-0 truncate text-[9px] font-semibold text-white/70">{ATTRIBUTE_LABELS[k] ?? k}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${v as number}%`, background: scoreColor(v as number) }} />
              </div>
              <span className="tnum w-4 text-right text-[9px] font-bold text-white">{v as number}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5">
          <span className="h-1 w-6 rounded-full bg-red-500" />
          <span className="text-[8px] font-medium text-white/30">
            {data.verified ? 'Identity verified on FutWeb' : 'Unverified profile'}
          </span>
        </div>
      </div>
    </div>
  )
}
