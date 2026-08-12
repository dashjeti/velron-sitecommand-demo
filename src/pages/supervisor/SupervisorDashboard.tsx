import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  Droplet,
  Factory,
  Fuel,
  ShieldCheck,
  Target,
  Truck,
} from 'lucide-react'
import {
  EquipStatusBadge,
  KpiCard,
  PageHeader,
  Panel,
  Progress,
  SeverityBadge,
} from '../../components/ui'
import { ProductionTrend } from '../../components/charts'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { fetchSite, getTodayReport, fetchReportDetail } from '../../lib/reports'
import type { SiteInfo, TodayReportSummary } from '../../lib/reports'
import { fetchSiteProduction } from '../../lib/production'
import { SHEQ_LABELS } from '../../types'

export default function SupervisorDashboard() {
  const { user } = useAuth()
  const { equipment, sheq, breakdowns } = useData()
  const siteId = user!.siteId!

  const [site, setSite] = useState<SiteInfo | null>(null)
  const [todayReport, setTodayReport] = useState<TodayReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [fuel, setFuel] = useState(0)

  // Production trend, live from submitted daily reports (empty until any exist).
  const [trend, setTrend] = useState<{ date: string; actual: number; target: number }[]>([])

  useEffect(() => {
    async function load() {
      const [siteData, report] = await Promise.all([
        fetchSite(siteId),
        getTodayReport(siteId),
      ])
      setSite(siteData)
      setTodayReport(report)
      setLoading(false)

      // Real fuel for today, if a report exists
      if (report) {
        fetchReportDetail(report.id).then((d) => { if (d) setFuel(d.fuel) })
      }

      // Real production trend from submitted daily reports.
      const real = await fetchSiteProduction(siteId, 14)
      setTrend(real.map((r) => ({
        date: new Date(r.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        actual: r.production_tonnes_actual,
        target: r.production_tonnes_target,
      })))
    }
    if (siteId) load()
  }, [siteId])

  const actual = todayReport?.production_tonnes_actual ?? 0
  const target = todayReport?.production_tonnes_target ?? 0
  const variance = target > 0 ? Math.round(((actual - target) / target) * 100) : 0

  // All real: assets, breakdowns and SHEQ come from Supabase via the context.
  const siteEquip = equipment.filter((e) => e.siteId === siteId)
  const running = siteEquip.filter((e) => e.status === 'running').length
  const breakdown = siteEquip.filter((e) => e.status === 'breakdown').length

  // "Open issues" for a supervisor are the real operational problems on their
  // site: assets currently down. Safety actions are open SHEQ items.
  const siteAssetIds = new Set(siteEquip.map((e) => e.id))
  const siteBreakdowns = breakdowns.filter((b) => b.status !== 'resolved' && siteAssetIds.has(b.assetId))
  const safetyActions = sheq.filter((s) => s.siteId === siteId && s.status !== 'closed')

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-billnick-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={`${site?.name ?? 'Site Dashboard'}`}
        subtitle={`${site?.location ?? ''} · ${site?.region ?? ''} · Supervisor: ${user!.name}`}
        action={
          <Link to="/supervisor/report" className="btn-primary">
            <ClipboardList className="h-4 w-4" /> Submit Daily Report
          </Link>
        }
      />

      {todayReport && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 animate-fade-in">
          <ShieldCheck className="h-4 w-4" />
          Today's report submitted at{' '}
          {new Date(todayReport.created_at).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
         , dashboard updated live.
        </div>
      )}

      {!todayReport && (
        <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-billnick-200 bg-billnick-50 px-4 py-2.5 animate-fade-in">
          <p className="text-sm font-medium text-billnick-700">
            Today's report has not been submitted yet.
          </p>
          <Link to="/supervisor/report" className="text-sm font-semibold text-billnick-600 underline underline-offset-2">
            Submit now →
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Today's Production"
          value={actual > 0 ? actual.toLocaleString() : '—'}
          unit={actual > 0 ? 't' : undefined}
          icon={<Factory className="h-5 w-5" />}
          delta={actual > 0 ? variance : undefined}
          accent={actual > 0 ? (variance >= 0 ? 'green' : 'red') : 'blue'}
          delay={0}
        />
        <KpiCard
          label="Equipment Running"
          value={siteEquip.length ? `${running}/${siteEquip.length}` : '—'}
          icon={<Truck className="h-5 w-5" />}
          accent="blue"
          sub={breakdown ? `${breakdown} breakdown` : siteEquip.length ? 'All healthy' : 'No assets yet'}
          delay={50}
        />
        <KpiCard
          label="Assets Down"
          value={siteBreakdowns.length || '0'}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={siteBreakdowns.length ? 'red' : 'green'}
          delay={100}
        />
        <KpiCard
          label="Safety Actions"
          value={safetyActions.length || '0'}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent="billnick"
          sub="Open SHEQ items"
          delay={150}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Production Trend"
          className="lg:col-span-2"
          icon={<Target className="h-4 w-4 text-billnick-500" />}
        >
          {trend.length ? (
            <ProductionTrend data={trend} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">
              No production reported yet. Submit a daily report to start the trend.
            </p>
          )}
        </Panel>

        <Panel title="Today at a Glance" icon={<Factory className="h-4 w-4 text-billnick-500" />}>
          {todayReport ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-ink-500">Target progress</span>
                  <span className="font-semibold text-ink-800">
                    {actual.toLocaleString()} / {target.toLocaleString()} t
                  </span>
                </div>
                <Progress
                  value={target > 0 ? (actual / target) * 100 : 0}
                  color={variance >= 0 ? 'green' : 'billnick'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-ink-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-ink-400">
                    <Fuel className="h-3.5 w-3.5" /> Fuel used
                  </div>
                  <p className="mt-1 text-lg font-bold text-ink-800">
                    {fuel.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-ink-400">L</span>
                  </p>
                </div>
                <div className="rounded-xl bg-ink-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-ink-400">
                    <Droplet className="h-3.5 w-3.5" /> L / tonne
                  </div>
                  <p className="mt-1 text-lg font-bold text-ink-800">
                    {actual > 0 ? (fuel / actual).toFixed(2) : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardList className="h-8 w-8 text-ink-200" />
              <p className="mt-2 text-sm text-ink-400">No report submitted yet today</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Equipment Status" icon={<Truck className="h-4 w-4 text-blue-500" />}>
          {siteEquip.length ? (
            <div className="space-y-2">
              {siteEquip.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{e.name}</p>
                    <p className="text-xs text-ink-400">
                      {e.id} · {e.location}
                    </p>
                  </div>
                  <EquipStatusBadge status={e.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-400">
              No equipment assigned to this site yet.
            </p>
          )}
        </Panel>

        <Panel
          title="Open Issues & Safety Actions"
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        >
          <div className="space-y-2">
            {siteBreakdowns.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-800">{b.assetName} down</p>
                  <p className="text-xs text-ink-400">{b.issue}</p>
                </div>
                <SeverityBadge severity={b.severity} />
              </div>
            ))}
            {safetyActions.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 bg-billnick-50/40 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-800">{s.title}</p>
                  <p className="text-xs text-ink-400">
                    {SHEQ_LABELS[s.type]} · {s.status === 'in_progress' ? 'in progress' : s.status}
                  </p>
                </div>
                <SeverityBadge severity={s.severity} />
              </div>
            ))}
            {!siteBreakdowns.length && !safetyActions.length && (
              <p className="py-6 text-center text-sm text-ink-400">No open items.</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}
