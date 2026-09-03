import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, groupForPosition, scoreColor } from '@/lib/ratings'
import type { PlayerAttributes } from '@/types'
import { ProgressBar, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'

/** Horizontal attribute bars grouped by category — scannable, print-friendly,
 *  and far more legible on a phone in bright sunlight than a radar alone. */
export function AttributeBars({
  attributes, compare, highlightGroup, compact,
}: {
  attributes: PlayerAttributes
  compare?: PlayerAttributes | null
  highlightGroup?: string
  compact?: boolean
}) {
  return (
    <div className="space-y-5">
      {Object.entries(ATTRIBUTE_GROUPS).map(([group, keys]) => (
        <div key={group} className={cn(highlightGroup && highlightGroup !== group && 'opacity-60')}>
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-2xs font-bold uppercase tracking-widest text-ink-400">{group}</h4>
            <div className="h-px flex-1 bg-ink-100" />
            {highlightGroup === group && (
              <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-2xs font-bold text-red-600">KEY</span>
            )}
          </div>
          <div className={cn('grid gap-x-6 gap-y-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
            {keys.map(k => {
              const v = attributes[k] ?? 0
              const c = compare?.[k]
              const delta = typeof c === 'number' ? v - c : null
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-xs font-medium text-ink-700">
                    {ATTRIBUTE_LABELS[k] ?? k}
                  </span>
                  <div className="flex-1">
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${v}%`, background: scoreColor(v) }} />
                      {typeof c === 'number' && (
                        <div className="absolute top-0 h-full w-0.5 bg-ink-900/50" style={{ left: `${c}%` }} />
                      )}
                    </div>
                  </div>
                  <span className="tnum w-6 shrink-0 text-right text-xs font-bold text-ink-900">{v}</span>
                  {delta !== null && (
                    <span className={cn('tnum w-7 shrink-0 text-right text-2xs font-bold',
                      delta > 0 ? 'text-trust-600' : delta < 0 ? 'text-red-500' : 'text-ink-300')}>
                      {delta > 0 ? `+${delta}` : delta === 0 ? '–' : delta}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Big headline score with a confidence ring. */
export function ScoreRing({ score, size = 84, label, sublabel, confidence }:
  { score: number; size?: number; label?: string; sublabel?: string; confidence?: number }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const stroke = scoreColor(score)
  const confStroke = confidence === undefined ? 0 : (confidence / 100) * c

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4E8F1" strokeWidth={6} />
          {confidence !== undefined && (
            <circle cx={size / 2} cy={size / 2} r={r - 7} fill="none" stroke="#C3CADA"
              strokeWidth={2} strokeDasharray={`${confStroke} ${c}`} strokeLinecap="round" opacity={0.55} />
          )}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={6}
            strokeDasharray={`${(score / 99) * c} ${c}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="tnum font-display text-2xl leading-none" style={{ color: stroke }}>{score}</span>
        </div>
      </div>
      {(label || sublabel) && (
        <div className="min-w-0">
          {label && <p className="text-sm font-bold text-ink-900">{label}</p>}
          {sublabel && <p className="text-xs text-ink-500">{sublabel}</p>}
        </div>
      )}
    </div>
  )
}

/** Compact position-fit strip: how well the player fits each position group. */
export function PositionFitBar({ fit, primary }: { fit: Record<string, number>; primary: string }) {
  const group = groupForPosition(primary)
  return (
    <div className="flex gap-1.5">
      {(['GK', 'DF', 'MF', 'FW'] as const).map(g => {
        const v = fit[g] ?? 0
        const isPrimary = g === group
        return (
          <Tooltip key={g} content={`${g} fit: ${v}/100`}>
            <div className={cn('min-w-0 flex-1 rounded-lg px-2 py-1.5 text-center transition-all',
              isPrimary ? 'bg-red-500 text-white' : 'bg-ink-100 text-ink-600')}>
              <div className="text-2xs font-bold tracking-wide">{g}</div>
              <div className="tnum text-sm font-bold">{v}</div>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

/** Confidence meter — shows how much evidence backs the rating. */
export function ConfidenceMeter({ score, label, factors }:
  { score: number; label: string; factors?: { label: string; weight: number; satisfied: boolean; detail: string }[] }) {
  const tone = score >= 65 ? 'trust' : score >= 40 ? 'gold' : 'red'
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-600">Data Confidence</span>
        <span className="text-xs font-bold text-ink-900">{label} · {score}</span>
      </div>
      <ProgressBar value={score} tone={tone} />
      {factors && factors.length > 0 && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {factors.map(f => (
            <li key={f.label} className="flex items-start gap-1.5 text-xs">
              <span className={cn('mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full',
                f.satisfied ? 'bg-trust-400 text-white' : 'bg-ink-200 text-ink-400')}>
                {f.satisfied
                  ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" /></svg>
                  : <span className="text-[8px] font-bold">–</span>}
              </span>
              <span className={cn(f.satisfied ? 'text-ink-700' : 'text-ink-400')}>
                <span className="font-medium">{f.label}</span>
                <span className="text-ink-400"> · {f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
