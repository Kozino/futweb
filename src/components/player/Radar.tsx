import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as ReRadar, RadarChart, ResponsiveContainer } from 'recharts'
import { ATTRIBUTE_LABELS } from '@/lib/ratings'
import type { PlayerAttributes } from '@/types'

/** Compact attribute radar. Recharts is lazy-imported by the bundle splitter
 *  so players on slow 3G don't pay for charts they never scroll to. */
export function AttributeRadar({
  attributes, compare, keys, size = 260, showLabels = true,
}: {
  attributes: PlayerAttributes
  compare?: { label: string; attributes: PlayerAttributes } | null
  keys: string[]
  size?: number
  showLabels?: boolean
}) {
  const data = keys.map(k => ({
    attr: (ATTRIBUTE_LABELS[k] ?? k).replace('Decision Making', 'Decisions').replace('Sprint Speed', 'Speed').replace('First Touch', 'First Touch'),
    value: attributes[k] ?? 0,
    compare: compare ? (compare.attributes[k] ?? 0) : undefined,
  }))

  return (
    <div style={{ width: '100%', height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#E4E8F1" />
          <PolarAngleAxis
            dataKey="attr"
            tick={showLabels ? { fill: '#6B7896', fontSize: 10, fontWeight: 600 } : false}
          />
          <PolarRadiusAxis domain={[0, 99]} tick={false} axisLine={false} />
          <ReRadar name="Player" dataKey="value" stroke="#E4002B" fill="#E4002B" fillOpacity={0.22} strokeWidth={2} />
          {compare && (
            <ReRadar name={compare.label} dataKey="compare" stroke="#0A0F1C" fill="#0A0F1C" fillOpacity={0.10} strokeWidth={2} strokeDasharray="4 3" />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
