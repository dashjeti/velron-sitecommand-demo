import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileBadge,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { KpiCard, PageHeader, Panel, SeverityBadge, SheqStatusBadge } from '../../components/ui'
import { VBars, chartColors } from '../../components/charts'
import { useData } from '../../state/DataContext'
import { daysUntilExpiry } from '../../lib/sheq'
import { fetchTeam, initialsOf } from '../../lib/team'
import type { TeamMember } from '../../lib/team'
import { agoLabel, isoDaysAgo, prettyDay, todayIso } from '../../lib/dates'
import { SHEQ_LABELS } from '../../types'
import type { SheqType } from '../../types'

/** How far back "recent" activity looks. */
const ACTIVITY_DAYS = 30
/** Certificates inside this many days of expiry are on the watchlist. */
const EXPIRY_WINDOW = 30

/**
 * SHEQ Manager home. The question this page answers is "are my SHEQ officers
 * reporting, and what is outstanding across the group", so officer activity and
 * the open register lead. The full register with its filters and certificate
 * tools stays on the shared SHEQ page.
 */
export default function SheqManagerDashboard() {
  const { sheq, certs, siteName, siteViews, compliance, reloadSheq, reloadCerts } = useData()

  const [officers, setOfficers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [team] = await Promise.all([fetchTeam(['sheq']), reloadSheq(), reloadCerts()])
    setOfficers(team)
    setLoading(false)
  }, [reloadSheq, reloadCerts])

  useEffect(() => { load() }, [load])

  const monthStart = todayIso().slice(0, 8) + '01'
  const windowStart = isoDaysAgo(ACTIVITY_DAYS)

  const openItems = useMemo(() => sheq.filter((r) => r.status !== 'closed'), [sheq])
  const overdueItems = useMemo(() => sheq.filter((r) => r.status === 'overdue'), [sheq])
  const thisMonth = useMemo(() => sheq.filter((r) => r.date >= monthStart), [sheq, monthStart])
  const seriousOpen = useMemo(
    () => openItems.filter((r) => r.severity === 'high' || r.severity === 'critical'),
    [openItems],
  )

  const expiring = useMemo(
    () =>
      certs
        .filter((c) => daysUntilExpiry(c.expiryDate) <= EXPIRY_WINDOW)
        .sort((a, b) => daysUntilExpiry(a.expiryDate) - daysUntilExpiry(b.expiryDate)),
    [certs],
  )

  // Every officer, quietest first, so anyone who has gone silent is on top.
  const activity = useMemo(() => {
    return officers
      .map((officer) => {
        const mine = sheq.filter((r) => r.raisedById === officer.id)
        const recent = mine.filter((r) => r.date >= windowStart)
        const last = mine.reduce<string | null>((latest, r) => (!latest || r.date > latest ? r.date : latest), null)
        return {
          officer,
          total: mine.length,
          recent: recent.length,
          open: mine.filter((r) => r.status !== 'closed').length,
          last,
        }
      })
      .sort((a, b) => a.recent - b.recent || a.officer.name.localeCompare(b.officer.name))
  }, [officers, sheq, windowStart])

  const unattributed = useMemo(() => sheq.filter((r) => !r.raisedById).length, [sheq])

  // Records raised per site, over the activity window.
  const bySite = useMemo(() => {
    const recent = sheq.filter((r) => r.date >= windowStart)
    return siteViews
      .map((v) => ({ label: v.code, value: recent.filter((r) => r.siteId === v.id).length }))
      .filter((row) => row.value > 0)
  }, [sheq, siteViews, windowStart])

  // Records raised per type, over the activity window.
  const byType = useMemo(() => {
    const recent = sheq.filter((r) => r.date >= windowStart)
    return (Object.keys(SHEQ_LABELS) as SheqType[])
      .map((type) => ({ label: SHEQ_LABELS[type], value: recent.filter((r) => r.type === type).length }))
      .filter((row) => row.value > 0)
  }, [sheq, windowStart])

  const attentionList = useMemo(
    () =>
      [...openItems].sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 }
        const overdueFirst = Number(b.status === 'overdue') - Number(a.status === 'overdue')
        return overdueFirst || rank[b.severity] - rank[a.severity] || b.date.localeCompare(a.date)
      }),
    [openItems],
  )

  return (
    <>
      <PageHeader
        title="SHEQ Manager"
        subtitle="Safety, health, environment and quality reporting from every SHEQ officer"
        action={
          <button onClick={load} disabled={loading} className="btn-outline text-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Open Items"
          value={openItems.length}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent={openItems.length ? 'billnick' : 'green'}
          sub={`${seriousOpen.length} high or critical`}
          delay={0}
        />
        <KpiCard
          label="Overdue"
          value={overdueItems.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={overdueItems.length ? 'red' : 'green'}
          sub={overdueItems.length ? 'Past their due date' : 'Nothing past due'}
          delay={50}
        />
        <KpiCard
          label="Raised This Month"
          value={thisMonth.length}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="blue"
          sub={`${officers.length} officer${officers.length === 1 ? '' : 's'} reporting`}
          delay={100}
        />
        <KpiCard
          label="Certificates Due"
          value={expiring.length}
          icon={<FileBadge className="h-5 w-5" />}
          accent={expiring.length ? 'red' : 'green'}
          sub={`Within ${EXPIRY_WINDOW} days, or expired`}
          delay={150}
        />
      </div>

      <Panel
        className="mb-6"
        title="Officer activity"
        icon={<Users className="h-4 w-4 text-billnick-500" />}
        action={
          <Link to="/sheq-manager/records" className="flex items-center gap-1 text-xs font-semibold text-billnick-600 hover:text-billnick-700">
            Submitted records <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {loading && officers.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : officers.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            No SHEQ officers yet. An executive invites them in User Management and assigns each
            one to a site.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {activity.map(({ officer, recent, total, open, last }) => (
              <div key={officer.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                  {initialsOf(officer.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-800">{officer.name}</p>
                  <p className="truncate text-xs text-ink-400">
                    {officer.siteId ? siteName(officer.siteId) : 'Group-wide'}
                    {' · '}
                    {recent === 0
                      ? (total === 0 ? 'has not raised anything yet' : `nothing in ${ACTIVITY_DAYS} days`)
                      : `${recent} record${recent === 1 ? '' : 's'}, last ${last ? agoLabel(last) : 'unknown'}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {/* An officer who has never raised anything is not "silent" in
                      any meaningful sense while the whole register is empty. */}
                  <span className={`pill ${
                    recent > 0 ? 'bg-emerald-100 text-emerald-700'
                    : total > 0 ? 'bg-amber-100 text-amber-700'
                    : 'bg-ink-100 text-ink-500'
                  }`}>
                    {recent > 0 ? 'Active' : total > 0 ? 'Silent' : 'No records yet'}
                  </span>
                  {open > 0 && <span className="text-[11px] text-ink-400">{open} open</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {unattributed > 0 && (
          <p className="mt-3 text-xs text-ink-400">
            {unattributed} record{unattributed === 1 ? '' : 's'} {unattributed === 1 ? 'has' : 'have'} no
            officer recorded, usually because the account was removed after the record was raised.
          </p>
        )}
      </Panel>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title={`Records by site, last ${ACTIVITY_DAYS} days`} icon={<ShieldCheck className="h-4 w-4 text-billnick-500" />}>
          {bySite.length ? (
            <VBars data={bySite} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">
              No records raised in this window. Officers log incidents, near misses, inspections
              and toolbox talks from the SHEQ page.
            </p>
          )}
        </Panel>

        <Panel title={`Records by type, last ${ACTIVITY_DAYS} days`} icon={<ClipboardList className="h-4 w-4 text-billnick-500" />}>
          {byType.length ? (
            <VBars data={byType} color={chartColors.BLUE} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">
              Nothing to break down yet. This fills in as records are raised.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Needs attention (${attentionList.length})`} icon={<AlertTriangle className="h-4 w-4 text-red-500" />}>
          {attentionList.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-center text-sm text-ink-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nothing open across any site.
            </p>
          ) : (
            <div className="space-y-2">
              {attentionList.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800">{r.title}</p>
                    <p className="truncate text-xs text-ink-400">
                      {siteName(r.siteId)} · {SHEQ_LABELS[r.type]} · {r.raisedBy} · {agoLabel(r.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SheqStatusBadge status={r.status} />
                    <SeverityBadge severity={r.severity} />
                  </div>
                </div>
              ))}
              {attentionList.length > 8 && (
                <Link to="/sheq-manager/records" className="block pt-1 text-xs font-semibold text-billnick-600 hover:text-billnick-700">
                  View all {attentionList.length} submitted records
                </Link>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Certificate watchlist" icon={<FileBadge className="h-4 w-4 text-billnick-500" />}>
          {expiring.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No certificates due in the next {EXPIRY_WINDOW} days.
            </p>
          ) : (
            <div className="space-y-2">
              {expiring.slice(0, 8).map((c) => {
                const days = daysUntilExpiry(c.expiryDate)
                return (
                  <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">{c.certificateType}</p>
                      <p className="truncate text-xs text-ink-400">
                        {c.siteId ? siteName(c.siteId) : 'Group-wide'} · expires {prettyDay(c.expiryDate)}
                      </p>
                    </div>
                    <span className={`pill shrink-0 ${days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 rounded-xl bg-ink-50 p-3">
            <p className="section-title mb-1">Group compliance</p>
            <p className="text-sm text-ink-600">
              Interim score <span className="font-bold text-ink-900">{compliance.group}%</span>, computed
              live from open SHEQ items and certificate validity.
            </p>
          </div>
        </Panel>
      </div>
    </>
  )
}
