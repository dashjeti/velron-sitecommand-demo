import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileBadge,
  Droplets,
  TrendingDown,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useData } from '../state/DataContext'
import { useAuth } from '../state/AuthContext'
import { daysUntilExpiry } from '../lib/sheq'
import { judgeFreeboard } from '../lib/sites'
import { SHEQ_LABELS } from '../types'
import type { Role } from '../types'

type Tone = 'bad' | 'warn' | 'info'

interface Alert {
  id: string
  icon: ReactNode
  tone: Tone
  title: string
  detail: string
  to: string
}

/** Which alert kinds each role should see. */
const relevance: Record<Role, string[]> = {
  executive: ['production', 'fleet', 'sheq', 'cert', 'tsf'],
  project:   ['production', 'fleet', 'sheq', 'cert', 'tsf'],
  workshop:  ['fleet'],
  sheq:      ['sheq', 'cert'],
  supervisor:['production', 'tsf', 'fleet'],
  client:    ['production'],
}

const toneStyles: Record<Tone, string> = {
  bad:  'bg-red-100 text-red-600',
  warn: 'bg-amber-100 text-amber-600',
  info: 'bg-blue-100 text-blue-600',
}

export default function NotificationBell() {
  const { user } = useAuth()
  const { siteViews, tsfByFacility, equipment, sheq, certs, siteName } = useData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on click outside and on Escape
  useEffect(() => {
    if (!open) return

    const onPointer = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const alerts = useMemo<Alert[]>(() => {
    if (!user) return []
    const out: { kind: string; alert: Alert }[] = []

    // A per-site SHEQ officer only gets SHEQ and certificate alerts for their
    // own site (group-wide certificates still apply).
    const scopedSheq = user.role === 'sheq' && user.siteId
      ? sheq.filter((r) => r.siteId === user.siteId)
      : sheq
    const scopedCerts = user.role === 'sheq' && user.siteId
      ? certs.filter((c) => !c.siteId || c.siteId === user.siteId)
      : certs

    // Production below target
    for (const v of siteViews) {
      if (!v.hasData || v.variance >= -8) continue
      out.push({
        kind: 'production',
        alert: {
          id: `prod-${v.id}`,
          icon: <TrendingDown className="h-4 w-4" />,
          tone: v.variance < -15 ? 'bad' : 'warn',
          title: `${v.name} below target`,
          detail: `Running ${v.variance}% under plan at ${v.actual.toLocaleString()}t.`,
          to: '/executive',
        },
      })
    }

    // Assets down
    for (const e of equipment.filter((a) => a.status === 'breakdown')) {
      out.push({
        kind: 'fleet',
        alert: {
          id: `fleet-${e.id}`,
          icon: <Wrench className="h-4 w-4" />,
          tone: 'bad',
          title: `${e.name} is down`,
          detail: `Asset ${e.id} in the workshop, availability ${e.availability}%.`,
          to: '/workshop',
        },
      })
    }

    // Service due soon
    const dueSoon = equipment.filter(
      (e) => e.status !== 'breakdown' && e.usageDue > 0 && e.usageDue - e.usageCurrent <= 200,
    )
    if (dueSoon.length) {
      out.push({
        kind: 'fleet',
        alert: {
          id: 'fleet-service-due',
          icon: <Wrench className="h-4 w-4" />,
          tone: 'warn',
          title: `${dueSoon.length} asset${dueSoon.length > 1 ? 's' : ''} due for service`,
          detail: dueSoon.map((e) => e.name).slice(0, 3).join(', ') + (dueSoon.length > 3 ? '…' : ''),
          to: '/workshop',
        },
      })
    }

    // Overdue SHEQ
    for (const s of scopedSheq.filter((r) => r.status === 'overdue')) {
      out.push({
        kind: 'sheq',
        alert: {
          id: `sheq-${s.id}`,
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'bad',
          title: `${SHEQ_LABELS[s.type]} overdue`,
          detail: s.title,
          to: '/sheq',
        },
      })
    }

    // Open incidents
    const openIncidents = scopedSheq.filter((s) => s.type === 'incident' && s.status === 'open')
    if (openIncidents.length) {
      out.push({
        kind: 'sheq',
        alert: {
          id: 'sheq-open-incidents',
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'warn',
          title: `${openIncidents.length} open incident${openIncidents.length > 1 ? 's' : ''}`,
          detail: 'Under investigation, awaiting closeout.',
          to: '/sheq',
        },
      })
    }

    // Certificate expiry
    for (const c of scopedCerts) {
      const days = daysUntilExpiry(c.expiryDate)
      if (days > c.reminderDays) continue
      const certSite = c.siteId ? siteName(c.siteId) : null
      out.push({
        kind: 'cert',
        alert: {
          id: `cert-${c.id}`,
          icon: <FileBadge className="h-4 w-4" />,
          tone: days < 0 ? 'bad' : 'warn',
          title: days < 0
            ? `${c.certificateType} expired`
            : `${c.certificateType} expires in ${days} day${days === 1 ? '' : 's'}`,
          detail: certSite ?? c.certificateNumber ?? 'Certificate renewal required.',
          to: '/sheq',
        },
      })
    }

    // Low TSF freeboard, judged only against each TSF's own configured limits.
    // A TSF with no limits set raises nothing: we do not guess what is safe.
    for (const snap of Object.values(tsfByFacility)) {
      const verdict = judgeFreeboard(snap.reading.freeboard, snap.limits)
      if (verdict !== 'critical' && verdict !== 'below-advisory') continue

      const where = `${snap.facilityName} (${siteName(snap.siteId)})`
      const limit = verdict === 'critical' ? snap.limits.freeboardCriticalM! : snap.limits.freeboardMinM!
      out.push({
        kind: 'tsf',
        alert: {
          id: `tsf-${snap.facilityId}`,
          icon: <Droplets className="h-4 w-4" />,
          tone: verdict === 'critical' ? 'bad' : 'warn',
          title: verdict === 'critical' ? `Critical freeboard at ${where}` : `Low freeboard at ${where}`,
          detail: `${snap.reading.freeboard.toFixed(2)}m, below this TSF's ${
            verdict === 'critical' ? 'critical' : 'advisory'
          } level of ${limit.toFixed(2)}m.`,
          to: '/executive',
        },
      })
    }

    const allowed = relevance[user.role]
    const ranked: Record<Tone, number> = { bad: 0, warn: 1, info: 2 }
    return out
      .filter((o) => allowed.includes(o.kind))
      .map((o) => o.alert)
      .sort((a, b) => ranked[a.tone] - ranked[b.tone])
  }, [user, siteViews, tsfByFacility, equipment, sheq, certs, siteName])

  // Routes a client or supervisor cannot reach: send them to their own home instead
  const homeByRole: Record<Role, string> = {
    supervisor: '/supervisor',
    workshop: '/workshop',
    sheq: '/sheq',
    project: '/project',
    executive: '/executive',
    client: '/client',
  }

  const go = (to: string) => {
    setOpen(false)
    const reachable = to.startsWith(`/${user?.role}`) || user?.role === 'executive' || user?.role === 'project'
    navigate(reachable ? to : homeByRole[user!.role])
  }

  const count = alerts.length
  const hasCritical = alerts.some((a) => a.tone === 'bad')

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications, none'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-50"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white ${
              hasCritical ? 'bg-red-500' : 'bg-billnick-500'
            }`}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-cardhover animate-scale-in"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-bold text-ink-900">Notifications</p>
            {count > 0 && (
              <span className="pill bg-ink-100 text-ink-600">{count} active</span>
            )}
          </div>

          {count === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </span>
              <p className="text-sm font-semibold text-ink-700">All clear</p>
              <p className="text-xs text-ink-400">
                No alerts need your attention right now.
              </p>
            </div>
          ) : (
            <ul className="max-h-[24rem] divide-y divide-ink-50 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => go(a.to)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneStyles[a.tone]}`}
                    >
                      {a.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-800">{a.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{a.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
