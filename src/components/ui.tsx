import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { EquipmentStatus, Severity, SiteStatus } from '../types'

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------
export function KpiCard({
  label,
  value,
  unit,
  icon,
  delta,
  accent = 'billnick',
  sub,
  delay = 0,
  onClick,
  hint,
}: {
  label: string
  value: string | number
  unit?: string
  icon?: ReactNode
  delta?: number
  accent?: 'billnick' | 'green' | 'blue' | 'red' | 'slate'
  sub?: string
  delay?: number
  /** When set, the whole tile becomes a button that drills into the detail. */
  onClick?: () => void
  /** Small affordance shown on a clickable tile, e.g. "View by site". */
  hint?: string
}) {
  const accents: Record<string, string> = {
    billnick: 'bg-billnick-50 text-billnick-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-ink-50 text-ink-600',
  }
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-title">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-ink-900 tabular-nums">
              {value}
            </span>
            {unit && <span className="text-sm font-medium text-ink-400">{unit}</span>}
          </div>
          {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
        </div>
        {icon && (
          <div className={`shrink-0 rounded-xl p-2.5 ${accents[accent]}`}>{icon}</div>
        )}
      </div>
      {typeof delta === 'number' && (
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold">
          <span
            className={`pill ${
              delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
          <span className="text-ink-400">vs target</span>
        </div>
      )}
      {onClick && (
        <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-billnick-600">
          {hint ?? 'View details'}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  )

  const style = { animationDelay: `${delay}ms` } as const

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className="card card-hover cursor-pointer p-4 sm:p-5 animate-fade-in text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-billnick-400"
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="card card-hover p-4 sm:p-5 animate-fade-in" style={style}>
      {inner}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card wrapper with header
// ---------------------------------------------------------------------------
export function Panel({
  title,
  action,
  children,
  className = '',
  icon,
  id,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  icon?: ReactNode
  id?: string
}) {
  return (
    <section id={id} className={`card scroll-mt-20 p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink-800">
            {icon}
            {title}
          </h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Status pills
// ---------------------------------------------------------------------------
const severityStyles: Record<Severity, string> = {
  low: 'bg-ink-100 text-ink-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`pill ${severityStyles[severity]}`}>
      <span className="capitalize">{severity}</span>
    </span>
  )
}

const equipStatusStyles: Record<EquipmentStatus, { c: string; label: string }> = {
  running: { c: 'bg-emerald-100 text-emerald-700', label: 'Running' },
  idle: { c: 'bg-ink-100 text-ink-600', label: 'Idle' },
  breakdown: { c: 'bg-red-100 text-red-700', label: 'Breakdown' },
  maintenance: { c: 'bg-amber-100 text-amber-700', label: 'Maintenance' },
}

export function EquipStatusBadge({ status }: { status: EquipmentStatus }) {
  const s = equipStatusStyles[status]
  return (
    <span className={`pill ${s.c}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'running'
            ? 'bg-emerald-500'
            : status === 'breakdown'
              ? 'bg-red-500'
              : status === 'maintenance'
                ? 'bg-amber-500'
                : 'bg-ink-400'
        }`}
      />
      {s.label}
    </span>
  )
}

const siteStatusStyles: Record<SiteStatus, { c: string; label: string }> = {
  'on-track': { c: 'bg-emerald-100 text-emerald-700', label: 'On Track' },
  attention: { c: 'bg-amber-100 text-amber-700', label: 'Attention' },
  critical: { c: 'bg-red-100 text-red-700', label: 'Critical' },
}

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  const s = siteStatusStyles[status]
  return <span className={`pill ${s.c}`}>{s.label}</span>
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
export function Progress({
  value,
  color = 'billnick',
}: {
  value: number
  color?: 'billnick' | 'green' | 'red' | 'blue'
}) {
  const colors: Record<string, string> = {
    billnick: 'bg-billnick-500',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className={`h-full rounded-full ${colors[color]} transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
