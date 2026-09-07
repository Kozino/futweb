import { useEffect, useState } from 'react'
import { Card, EmptyState, Icon, Skeleton, toast } from '@/components/ui'
import { hasSupabase } from '@/lib/supabase'
import { getMyProfileViews, type ProfileView } from '@/lib/supabase/views'
import { relativeTime } from '@/lib/utils'

export default function ProfileViewsPanel({ playerId }: { playerId?: string }) {
  const [views, setViews] = useState<ProfileView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase) { setLoading(false); return }
      try {
        const rows = await getMyProfileViews(15)
        if (!cancelled) setViews(rows)
      } catch {
        if (!cancelled) toast({ tone: 'error', title: 'Could not load profile views' })
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [playerId])

  if (loading) return <Skeleton className="h-40 w-full" />

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink-900">Who viewed your profile</h3>
          <p className="mt-0.5 text-xs text-ink-500">Scouts and clubs who recently looked at you.</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-white">
          <Icon name="eye" size={16} />
        </span>
      </div>

      {views.length === 0 ? (
        <div className="mt-2">
          <EmptyState icon="eye" title="No views yet"
            description="When a club or scout opens your profile, they'll appear here." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-ink-100">
          {views.slice(0, 8).map((v, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-800">
                  {v.viewerName}
                </p>
                {v.viewerClub && (
                  <p className="flex items-center gap-1 text-xs text-ink-500">
                    <Icon name="building" size={11} />
                    <span className="truncate">{v.viewerClub}</span>
                  </p>
                )}
              </div>
              <span className="shrink-0 text-2xs text-ink-400">{relativeTime(v.viewedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
