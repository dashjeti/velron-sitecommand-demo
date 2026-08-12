import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Factory,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KpiCard, PageHeader, Panel, SiteStatusBadge } from '../../components/ui'
import { Donut, RankingBars, WeeklyTrend, chartColors } from '../../components/charts'
import { fleetAvailability, fleetUtilization, useData } from '../../state/DataContext'
import { complianceFactors } from '../../lib/compliance'
import { prettyDate } from '../../data/mockData'
import { generateExecutiveBrief } from '../../utils/aiBrief'
import { formatDateLabel } from '../../lib/production'
import { judgeFreeboard } from '../../lib/sites'
import type { SiteView } from '../../lib/siteViews'
import { forecastFromDaily } from '../../utils/forecast'
import { SHEQ_LABELS } from '../../types'

interface ExecAlert {
  id: string
  icon: React.ReactNode
  tone: 'bad' | 'warn'
  title: string
  detail: string
  rows: { k: string; v: string }[]
}

export default function ExecutiveDashboard() {
  const {
    equipment, sheq, breakdowns, certs, compliance,
    siteViews, tsfByFacility, groupProduction, siteName, reloadSites,
  } = useData()
  const navigate = useNavigate()

  // Refresh the real sites/production/TSF whenever this page is opened, so a
  // site added or renamed in Site Management shows up immediately.
  useEffect(() => { reloadSites() }, [reloadSites])

  // Scope: 'all' for the group, or a real site id. Everything narrows to it.
  const [scope, setScope] = useState<string>('all')
  const scopedView = scope === 'all' ? null : siteViews.find((v) => v.id === scope) ?? null

  const inScope = (siteId: string) => scope === 'all' || siteId === scope

  const scopedViews = useMemo(
    () => (scope === 'all' ? siteViews : siteViews.filter((v) => v.id === scope)),
    [siteViews, scope],
  )
  const scopedEquipment = useMemo(() => equipment.filter((e) => inScope(e.siteId)), [equipment, scope])
  const scopedSheq = useMemo(() => sheq.filter((s) => inScope(s.siteId)), [sheq, scope])

  const totalActual = scopedViews.reduce((s, v) => s + v.actual, 0)
  const totalTarget = scopedViews.reduce((s, v) => s + v.target, 0)
  const groupVar = totalTarget ? Math.round(((totalActual - totalTarget) / totalTarget) * 100) : 0

  const avail = fleetAvailability(scopedEquipment)
  const util = fleetUtilization(scopedEquipment)
  const down = scopedEquipment.filter((e) => e.status === 'breakdown').length

  const avgComp = scope === 'all' ? compliance.group : compliance.bySite[scope] ?? 100

  const openIncidents = scopedSheq.filter((s) => s.type === 'incident' && s.status === 'open').length
  const overdue = scopedSheq.filter((s) => s.status === 'overdue').length

  const activeSiteCount = siteViews.filter((v) => v.opStatus === 'active').length

  // Cross-site comparison needs production data; sites with no reports are excluded.
  const withData = scopedViews.filter((v) => v.hasData)
  const rankedWithData = useMemo(() => [...withData].sort((a, b) => b.variance - a.variance), [withData])
  const best = rankedWithData[0]
  const worst = rankedWithData[rankedWithData.length - 1]
  // Only flag a site as needing attention if it is genuinely below target, so a
  // single strong site is never labelled "needs attention" just for being alone.
  const needsAttention = worst && worst.variance < 0 ? worst : null

  const brief = useMemo(
    () => generateExecutiveBrief({
      sites: scopedViews,
      equipment: scopedEquipment,
      sheq: scopedSheq,
      breakdowns,
      compliance: compliance.bySite,
      scopeName: scopedView?.name,
    }),
    [scopedViews, scopedEquipment, scopedSheq, breakdowns, compliance, scopedView],
  )

  const [openAlert, setOpenAlert] = useState<ExecAlert | null>(null)

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })


  // KPI drill-downs. The executive role is gated out of the workshop and SHEQ
  // pages, so these open an in-place detail modal rather than linking away.
  function openComplianceDetail() {
    const scoped = scopedView ? [scopedView] : siteViews
    const agg = scoped.reduce(
      (a, v) => {
        const f = complianceFactors(v.id, scopedSheq, certs, (id) => id)
        return {
          open: a.open + f.open,
          overdue: a.overdue + f.overdue,
          openIncidents: a.openIncidents + f.openIncidents,
          expiredCerts: a.expiredCerts + f.expiredCerts,
          expiringCerts: a.expiringCerts + f.expiringCerts,
        }
      },
      { open: 0, overdue: 0, openIncidents: 0, expiredCerts: 0, expiringCerts: 0 },
    )
    setOpenAlert({
      id: 'kpi-compliance',
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: 'warn',
      title: 'Interim compliance score',
      detail:
        'A transparent stand-in until your official formula is supplied: 100 minus points for outstanding SHEQ risk and lapsed certificates.',
      rows: [
        ...scoped.map((v) => ({ k: v.name, v: `${v.compliance}%` })),
        { k: 'Open items', v: String(agg.open) },
        { k: 'Overdue actions', v: String(agg.overdue) },
        { k: 'Open incidents', v: String(agg.openIncidents) },
        { k: 'Expired certificates', v: String(agg.expiredCerts) },
        { k: 'Expiring certificates', v: String(agg.expiringCerts) },
      ],
    })
  }

  function openIncidentsDetail() {
    const items = scopedSheq.filter(
      (s) => (s.type === 'incident' && s.status === 'open') || s.status === 'overdue',
    )
    setOpenAlert({
      id: 'kpi-incidents',
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: 'bad',
      title: 'Open incidents & overdue items',
      detail: `${openIncidents} open incident${openIncidents === 1 ? '' : 's'}, ${overdue} overdue action${overdue === 1 ? '' : 's'}.`,
      rows: items.length
        ? items.map((s) => ({ k: s.title, v: `${siteName(s.siteId)} · ${s.status}` }))
        : [{ k: 'Nothing outstanding', v: 'All clear' }],
    })
  }

  // Weekly group production trend, from real daily reports scoped to selection.
  const weekly = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - i))
      const iso = d.toISOString().slice(0, 10)
      const rows = groupProduction.filter(
        (r) => r.report_date === iso && (scope === 'all' || r.site_id === scope),
      )
      return {
        label: formatDateLabel(iso),
        Actual: rows.reduce((s, r) => s + r.production_tonnes_actual, 0),
        Target: rows.reduce((s, r) => s + r.production_tonnes_target, 0),
      }
    })
  }, [groupProduction, scope])

  // Run-rate production forecast from the weekly series (see utils/forecast.ts).
  const forecast = useMemo(() => forecastFromDaily(weekly), [weekly])
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' })

  const ranking = rankedWithData.map((v) => ({
    name: v.code,
    value: v.actual,
    fill: v.variance >= 0 ? chartColors.ORANGE : v.variance < -10 ? '#ef4444' : '#f59e0b',
  }))

  // Latest real TSF reading per facility, scoped to the selected site.
  const tsfList = useMemo(
    () => Object.values(tsfByFacility)
      .filter((snap) => scope === 'all' || snap.siteId === scope)
      .sort((a, b) => a.reading.freeboard - b.reading.freeboard),
    [tsfByFacility, scope],
  )

  const lowestFreeboard = tsfList[0]

  const alerts: ExecAlert[] = [
    ...withData
      .filter((v) => v.variance < -8)
      .map((v) => ({
        id: `prod-${v.id}`,
        icon: <Factory className="h-4 w-4" />,
        tone: 'bad' as const,
        title: `${v.name} below target`,
        detail: `Running ${v.variance}% under plan (${v.actual.toLocaleString()}t).`,
        rows: [
          { k: 'Site', v: v.name },
          { k: 'Location', v: v.location },
          { k: 'Actual latest', v: `${v.actual.toLocaleString()} t` },
          { k: 'Target', v: `${v.target.toLocaleString()} t` },
          { k: 'Shortfall', v: `${(v.target - v.actual).toLocaleString()} t (${v.variance}%)` },
        ],
      })),
    ...scopedEquipment
      .filter((e) => e.status === 'breakdown')
      .slice(0, 3)
      .map((e) => ({
        id: `fleet-${e.id}`,
        icon: <Wrench className="h-4 w-4" />,
        tone: 'warn' as const,
        title: `${e.name} down`,
        detail: `In the workshop${e.location ? `, ${e.location}` : ''}.`,
        rows: [
          { k: 'Asset', v: e.name },
          ...(e.registration ? [{ k: 'Registration', v: e.registration }] : []),
          { k: 'Category', v: e.type },
          { k: 'Site', v: e.siteId ? siteName(e.siteId) : 'Unassigned' },
          { k: 'Location', v: e.location || 'Not recorded' },
          {
            k: 'Usage',
            v: e.usageCurrent > 0 ? `${e.usageCurrent.toLocaleString()} ${e.usageUnit === 'km' ? 'km' : 'hrs'}` : 'Not set',
          },
        ],
      })),
    ...scopedSheq
      .filter((s) => s.status === 'overdue')
      .map((s) => ({
        id: `sheq-${s.id}`,
        icon: <AlertTriangle className="h-4 w-4" />,
        tone: 'bad' as const,
        title: `${SHEQ_LABELS[s.type]} overdue`,
        detail: s.title,
        rows: [
          { k: 'Record', v: s.title },
          { k: 'Type', v: SHEQ_LABELS[s.type] },
          { k: 'Severity', v: s.severity },
          { k: 'Site', v: siteName(s.siteId) },
          { k: 'Raised by', v: s.raisedBy },
          { k: 'Raised', v: prettyDate(s.date) },
        ],
      })),
  ]

  return (
    <>
      <PageHeader
        title="Executive Command Centre"
        subtitle={
          scopedView
            ? `${scopedView.name} · ${scopedView.location}, live`
            : 'Group-wide operations, equipment, compliance & performance, live'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="site-scope" className="sr-only">Filter by site</label>
            <select
              id="site-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="input py-1.5 text-sm"
            >
              <option value="all">All sites</option>
              {siteViews.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <span className="pill bg-ink-900 text-white">
              <Sparkles className="h-3.5 w-3.5 text-billnick-400" /> CEO View
            </span>
          </div>
        }
      />

      {/* Executive Brief */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-ink-900 p-5 sm:p-6 shadow-card animate-scale-in">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-billnick-500/20 text-billnick-400">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-billnick-400">
            Executive Brief
          </h3>
          <span className="ml-auto text-xs text-ink-400">{brief.dateLabel} · auto-generated</span>
        </div>
        <p className="mt-4 text-lg font-semibold leading-snug text-white">
          {brief.headline}
        </p>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {brief.lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink-200">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  l.tone === 'good'
                    ? 'bg-emerald-400'
                    : l.tone === 'bad'
                      ? 'bg-red-400'
                      : l.tone === 'warn'
                        ? 'bg-amber-400'
                        : 'bg-ink-400'
                }`}
              />
              {l.text}
            </li>
          ))}
        </ul>
      </div>

      {/* KPI grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {scopedView ? (
          <KpiCard label="Site" value={scopedView.code} icon={<Factory className="h-5 w-5" />} sub={scopedView.location} delay={0} onClick={() => navigate('/executive/sites')} hint="Manage sites" />
        ) : (
          <KpiCard label="Active Sites" value={activeSiteCount} icon={<Factory className="h-5 w-5" />} sub={`${siteViews.length} total on record`} delay={0} onClick={() => navigate('/executive/sites')} hint="Manage sites" />
        )}
        <KpiCard label="Total Production" value={totalActual.toLocaleString()} unit="t/day" icon={<TrendingUp className="h-5 w-5" />} accent="green" delay={50} onClick={() => scrollTo('exec-production')} hint="See trend" />
        <KpiCard label="Production vs Target" value={`${groupVar >= 0 ? '+' : ''}${groupVar}`} unit="%" delta={groupVar} icon={<Target className="h-5 w-5" />} accent={groupVar >= 0 ? 'green' : 'red'} delay={100} onClick={() => scrollTo('exec-production')} hint="See trend" />
        <KpiCard label="Fleet Availability" value={avail} unit="%" icon={<Boxes className="h-5 w-5" />} accent="blue" sub={`${util}% utilization · ${down} down`} delay={150} onClick={() => scrollTo('exec-fleet')} hint="See fleet" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Compliance Score" value={avgComp} unit="%" icon={<CheckCircle2 className="h-5 w-5" />} accent={avgComp >= 95 ? 'green' : 'billnick'} sub="Interim measure" delay={0} onClick={openComplianceDetail} hint="View by site" />
        <KpiCard label="Open Incidents" value={openIncidents} icon={<AlertTriangle className="h-5 w-5" />} accent={openIncidents ? 'red' : 'green'} sub={`${overdue} overdue items`} delay={50} onClick={openIncidentsDetail} hint="View items" />
        {scopedView ? (
          <>
            <KpiCard label="Assets On Site" value={scopedEquipment.length} icon={<Boxes className="h-5 w-5" />} accent="blue" sub={`${down} currently down`} delay={100} />
            <KpiCard label="Site Status" value={scopedView.opStatus === 'care_maintenance' ? 'Care' : scopedView.opStatus.charAt(0).toUpperCase() + scopedView.opStatus.slice(1)} icon={<Gauge className="h-5 w-5" />} sub={scopedView.hasData ? `${scopedView.variance >= 0 ? '+' : ''}${scopedView.variance}% vs target` : 'Awaiting reports'} delay={150} />
          </>
        ) : best ? (
          <>
            <KpiCard label="Best Site" value={best.code} icon={<Trophy className="h-5 w-5" />} accent="green" sub={`${best.variance >= 0 ? '+' : ''}${best.variance}% vs target`} delay={100} onClick={() => setScope(best.id)} hint="Focus this site" />
            {needsAttention ? (
              <KpiCard label="Needs Attention" value={needsAttention.code} icon={<Gauge className="h-5 w-5" />} accent="red" sub={`${needsAttention.variance}% vs target`} delay={150} onClick={() => setScope(needsAttention.id)} hint="Focus this site" />
            ) : (
              <KpiCard label="Needs Attention" value="None" icon={<Gauge className="h-5 w-5" />} accent="green" sub="All reporting sites on target" delay={150} />
            )}
          </>
        ) : (
          <>
            <KpiCard label="Best Site" value="—" icon={<Trophy className="h-5 w-5" />} sub="Awaiting production data" delay={100} />
            <KpiCard label="Needs Attention" value="—" icon={<Gauge className="h-5 w-5" />} sub="Awaiting production data" delay={150} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel id="exec-production" title={`${scopedView ? scopedView.name : 'Group'} Production, Last 7 Days`} className="lg:col-span-2" icon={<TrendingUp className="h-4 w-4 text-billnick-500" />}>
          {totalActual === 0 && totalTarget === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">
              No production reported in this window yet. It fills in as supervisors submit daily reports.
            </p>
          ) : (
            <WeeklyTrend
              data={weekly}
              series={[
                { key: 'Actual', name: 'Actual (t)', color: chartColors.ORANGE },
                { key: 'Target', name: 'Target (t)', color: chartColors.NAVY },
              ]}
            />
          )}
        </Panel>
        <Panel id="exec-fleet" title="Fleet Status" icon={<Boxes className="h-4 w-4 text-blue-500" />}>
          <Donut
            centerValue={`${avail}%`}
            centerLabel="Availability"
            data={[
              { name: 'Running',     value: equipment.filter((e) => e.status === 'running').length,     color: chartColors.GREEN },
              { name: 'Idle',        value: equipment.filter((e) => e.status === 'idle').length,        color: '#cbd2de' },
              { name: 'Maintenance', value: equipment.filter((e) => e.status === 'maintenance').length, color: '#f59e0b' },
              { name: 'Breakdown',   value: equipment.filter((e) => e.status === 'breakdown').length,   color: '#ef4444' },
            ]}
          />
        </Panel>
      </div>

      {/* Production forecast */}
      {forecast && (
        <Panel
          title={`${monthName} Production Forecast`}
          className="mb-6"
          icon={<TrendingUp className="h-4 w-4 text-billnick-500" />}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-400">Projected month-end</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">
                {forecast.projectedMonth.toLocaleString()}<span className="ml-1 text-sm font-semibold text-ink-400">t</span>
              </p>
              <p className="mt-1 text-xs text-ink-500">Target {forecast.projectedTarget.toLocaleString()}t</p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-400">Against target</p>
              <p className={`mt-1 text-2xl font-extrabold ${forecast.variancePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {forecast.variancePct >= 0 ? '+' : ''}{forecast.variancePct}%
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {forecast.variancePct >= 0 ? 'On track to meet the monthly plan' : 'Trending below the monthly plan'}
              </p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-400">Current run-rate</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">
                {forecast.avgDailyActual.toLocaleString()}<span className="ml-1 text-sm font-semibold text-ink-400">t/day</span>
              </p>
              <p className="mt-1 text-xs text-ink-500">Target {forecast.avgDailyTarget.toLocaleString()}t/day</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Projected by extending the last {forecast.runRateDays}-day run-rate across all {forecast.daysInMonth} days
            of {monthName}. This is a run-rate projection, not a statistical model: it does not account for planned
            maintenance, weather or seasonality.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ranking is a cross-site comparison, so it only appears for the group */}
        {!scopedView && (
          <Panel title="Site Production Ranking" icon={<Trophy className="h-4 w-4 text-billnick-500" />}>
            {ranking.length ? (
              <RankingBars data={ranking} />
            ) : (
              <p className="py-10 text-center text-sm text-ink-400">
                No production data yet to rank sites.
              </p>
            )}
          </Panel>
        )}

        <Panel
          title={scopedView ? `${scopedView.name} Alerts` : 'Executive Alerts'}
          className="lg:col-span-2"
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        >
          <div className="space-y-2.5">
            {alerts.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-400">
                No active alerts{scopedView ? ` for ${scopedView.name}` : ''}.
              </p>
            )}
            {alerts.map((a) => (
              <button
                key={a.id}
                onClick={() => setOpenAlert(a)}
                className="flex w-full items-start gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-left transition-colors hover:border-billnick-200 hover:bg-ink-50"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    a.tone === 'bad' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-800">{a.title}</span>
                  <span className="block text-xs text-ink-500">{a.detail}</span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" />
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-ink-100 pt-4">
            <p className="section-title mb-2">Site Status Overview</p>
            {siteViews.length === 0 ? (
              <p className="text-sm text-ink-400">No sites yet. Add them in Site Management.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(scopedView ? [scopedView] : siteViews).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setScope(scope === v.id ? 'all' : v.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      scope === v.id ? 'border-billnick-300 bg-billnick-50' : 'border-ink-100 hover:bg-ink-50'
                    }`}
                  >
                    <span className="font-semibold text-ink-700">{v.name}</span>
                    {v.hasData
                      ? <SiteStatusBadge status={v.perfStatus} />
                      : <span className="pill bg-ink-100 text-ink-500">No data</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="TSF Parameters" className="mt-6" icon={<Boxes className="h-4 w-4 text-billnick-500" />}>
        {tsfList.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tsfList.map((snap) => {
              const verdict = judgeFreeboard(snap.reading.freeboard, snap.limits)
              const pillTone =
                verdict === 'critical'
                  ? 'bg-red-100 text-red-700'
                  : verdict === 'below-advisory'
                    ? 'bg-amber-100 text-amber-700'
                    : verdict === 'ok'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-ink-100 text-ink-600'
              return (
                <article key={snap.facilityId} className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{snap.facilityName}</p>
                      <p className="truncate text-xs text-ink-500">{siteName(snap.siteId)}</p>
                    </div>
                    <span
                      className={`pill shrink-0 ${pillTone}`}
                      title={verdict === 'unknown' ? 'No freeboard limits configured for this TSF' : undefined}
                    >
                      Freeboard {snap.reading.freeboard.toFixed(1)}m
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Pool depth</p>
                      <p className="mt-1 font-semibold text-ink-900">{snap.reading.poolDepth.toFixed(1)}m</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">RWD level</p>
                      <p className="mt-1 font-semibold text-ink-900">{snap.reading.returnWaterDamLevel.toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Deposited paddocks</p>
                      <p className="mt-1 font-semibold text-ink-900">{snap.reading.depositedPaddocks}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Ahead of deposition</p>
                      <p className="mt-1 font-semibold text-ink-900">{snap.reading.paddocksAheadOfDeposition}</p>
                    </div>
                  </div>
                  {snap.reading.piezometers.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {snap.reading.piezometers.map((reading) => (
                        <div key={reading.label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                          <span className="text-ink-500">{reading.label}</span>
                          <span className="font-semibold text-ink-900">{reading.value.toFixed(1)}m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No TSF readings captured yet. Submit a daily report with TSF data to populate this panel.</p>
        )}
        {lowestFreeboard && (
          <p className="mt-4 text-xs text-ink-500">
            Lowest freeboard currently on {lowestFreeboard.facilityName} ({siteName(lowestFreeboard.siteId)}): {lowestFreeboard.reading.freeboard.toFixed(1)}m.
          </p>
        )}
        {tsfList.some((snap) => judgeFreeboard(snap.reading.freeboard, snap.limits) === 'unknown') && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Some TSFs have no freeboard limits set, so their readings show without a safety assessment.
            The SHEQ officer sets each TSF's advisory and critical levels on the TSF Facilities screen.
          </p>
        )}
      </Panel>

      {/* Alert detail. The executive role cannot open the workshop or SHEQ
          pages, so the underlying record is shown here instead of linking. */}
      {openAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
          onClick={() => setOpenAlert(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    openAlert.tone === 'bad' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {openAlert.icon}
                </span>
                <div>
                  <h2 className="font-bold text-ink-900">{openAlert.title}</h2>
                  <p className="text-xs text-ink-500">{openAlert.detail}</p>
                </div>
              </div>
              <button
                onClick={() => setOpenAlert(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="px-6 py-4 text-sm">
              {openAlert.rows.map((r) => (
                <div key={r.k} className="flex items-start justify-between gap-4 border-b border-ink-50 py-2 last:border-0">
                  <dt className="shrink-0 text-ink-500">{r.k}</dt>
                  <dd className="text-right font-semibold capitalize text-ink-900">{r.v}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-ink-100 px-6 py-4">
              <button onClick={() => setOpenAlert(null)} className="btn-outline w-full">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
