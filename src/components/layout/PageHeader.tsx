import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui'

export function PageHeader({ title, subtitle, actions, icon, breadcrumb }:
  { title: string; subtitle?: string; actions?: ReactNode; icon?: IconName; breadcrumb?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="mb-1 text-2xs font-bold uppercase tracking-widest text-ink-400">{breadcrumb}</p>
        )}
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
              <Icon name={icon} size={17} />
            </span>
          )}
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        </div>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
