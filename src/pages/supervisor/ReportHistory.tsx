import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  CloudSun,
  Droplets,
  Factory,
  Fuel,
  HardHat,
  Loader2,
  Timer,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import {
  fetchSiteReportHistory,
  fetchReportDetail,
  fetchSite,
  deleteReport,
} from '../../lib/reports'
import type { ReportHistoryRow, ReportDetail, SiteInfo } from '../../lib/reports'

function pretty(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReportHistory() {
  const { user } = useAuth()
  const { siteName } = useData()
  const siteId = user?.siteId

  const [site, setSite] = useState<SiteInfo | null>(null)
  const [rows, setRows] = useState<ReportHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function removeReport(id: string) {
    if (!window.confirm('Delete this report? Its production, TSF, fuel, labour and other entries are removed too. This cannot be undone.')) return
    setDeleting(true)
    const { error } = await deleteReport(id)
    setDeleting(false)
    if (!error) {
      setDetail(null)
      if (siteId) fetchSiteReportHistory(siteId).then(setRows)
    }
  }

  useEffect(() => {
    if (!siteId) { setLoading(false); return }
    Promise.all([fetchSite(siteId), fetchSiteReportHistory(siteId)]).then(([s, r]) => {
      setSite(s)
      setRows(r)
      setLoading(false)
    })
  }, [siteId])

  async function openDetail(id: string) {
    setDetailLoading(true)
    const d = await fetchReportDetail(id)
    setDetail(d)
    setDetailLoading(false)
  }

  if (!siteId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ClipboardList className="h-10 w-10 text-ink-300" />
        <p className="font-semibold text-ink-700">No site assigned</p>
        <p className="text-sm text-ink-500">Contact your administrator to assign you to a site.</p>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Submitted Reports"
        subtitle={`${site?.name ?? siteName(siteId)} · your daily reports, newest first`}
        action={
          <Link to="/supervisor/report" className="btn-primary">
            <ClipboardList className="h-4 w-4" /> New Daily Report
          </Link>
        }
      />

      <Panel title={`Report History (${rows.length})`} icon={<CalendarDays className="h-4 w-4 text-billnick-500" />}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-50">
              <CalendarDays className="h-7 w-7 text-ink-300" />
            </span>
            <p className="mt-4 font-semibold text-ink-600">No reports submitted yet</p>
            <p className="mt-1 text-sm text-ink-400">Your submitted daily reports will appear here.</p>
            <Link to="/supervisor/report" className="btn-primary mt-6">
              <ClipboardList className="h-4 w-4" /> Submit today's report
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const variance = r.production_tonnes_target
                ? Math.round(((r.production_tonnes_actual - r.production_tonnes_target) / r.production_tonnes_target) * 100)
                : 0
              return (
                <button
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 text-left transition-colors hover:border-billnick-200 hover:bg-ink-50/50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-800">{pretty(r.report_date)}</p>
                    <p className="text-xs text-ink-400">
                      {r.production_tonnes_actual.toLocaleString()}t actual · {r.tonnes_processed.toLocaleString()}t processed
                    </p>
                  </div>
                  <span className={`pill shrink-0 ${variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {variance >= 0 ? '+' : ''}{variance}% vs target
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Detail overlay */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-ink-900">Daily Report</h2>
                <p className="text-xs text-ink-400">{pretty(detail.report_date)}</p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6 text-sm">
              <DetailBlock icon={<Factory className="h-4 w-4 text-billnick-500" />} title="Production" rows={[
                ['Tonnes processed', `${detail.tonnes_processed.toLocaleString()} t`],
                ['Actual output', `${detail.production_tonnes_actual.toLocaleString()} t`],
                ['Target', `${detail.production_tonnes_target.toLocaleString()} t`],
              ]} />

              <DetailBlock icon={<Truck className="h-4 w-4 text-blue-500" />} title="Equipment" rows={[
                ['Running', `${detail.equipment_units_running}`],
                ['Idle', `${detail.equipment_units_idle}`],
                ['Breakdown', `${detail.equipment_units_breakdown}`],
              ]} />

              {detail.labour && (
                <DetailBlock icon={<HardHat className="h-4 w-4 text-billnick-500" />} title="Labour" rows={[
                  ['Crew', `${detail.labour.present} of ${detail.labour.total_workers} present`],
                  ['Absent', `${detail.labour.absent}`],
                  ['Overtime', `${detail.labour.overtime_hours} h`],
                ]} />
              )}

              <DetailBlock icon={<Fuel className="h-4 w-4 text-billnick-500" />} title="Fuel" rows={[
                ['Consumed', `${detail.fuel.toLocaleString()} L`],
              ]} />

              <DetailBlock icon={<CloudSun className="h-4 w-4 text-blue-500" />} title="Weather" rows={[
                ['Conditions', detail.weather_conditions ?? 'Not recorded'],
                ...(detail.weather_temp_min_c !== null || detail.weather_temp_max_c !== null
                  ? [['Temperature', `${detail.weather_temp_min_c ?? '—'} to ${detail.weather_temp_max_c ?? '—'} °C`] as [string, string]] : []),
                ...(detail.rainfall_mm !== null ? [['Rainfall', `${detail.rainfall_mm} mm`] as [string, string]] : []),
                ...(detail.wind_speed_kmh !== null ? [['Wind', `${detail.wind_speed_kmh} km/h${detail.wind_direction ? ' ' + detail.wind_direction : ''}`] as [string, string]] : []),
                ...(detail.humidity_pct !== null ? [['Humidity', `${detail.humidity_pct}%`] as [string, string]] : []),
              ]} />

              {detail.tsf.map((t, i) => (
                <DetailBlock key={i} icon={<Droplets className="h-4 w-4 text-blue-500" />} title={`TSF · ${t.facilityName}`} rows={[
                  ['Freeboard', `${t.freeboard_m} m`],
                  ['Pool depth', `${t.pool_depth_m} m`],
                  ['Return water dam', `${t.return_water_dam_level_m}%`],
                ]} />
              ))}

              {detail.delays.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink-700"><Timer className="h-4 w-4 text-amber-500" /> Delays</p>
                  <ul className="space-y-1.5">
                    {detail.delays.map((d, i) => (
                      <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <span className="font-semibold capitalize">{d.delay_type}</span> · {d.duration_hours}h · {d.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.materials.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold text-ink-700">Materials</p>
                  <ul className="space-y-1">
                    {detail.materials.map((m, i) => (
                      <li key={i} className="flex justify-between text-xs text-ink-600">
                        <span>{m.material_name}</span>
                        <span className="font-semibold">{m.quantity} {m.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.general_notes && (
                <div>
                  <p className="mb-1 font-semibold text-ink-700">Notes</p>
                  <p className="whitespace-pre-wrap text-ink-600">{detail.general_notes}</p>
                </div>
              )}

              <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-400">
                Submitted figures should not be edited, to keep an accurate record. Delete only to
                remove a mistaken or test entry; the whole report and its readings go with it.
              </p>
            </div>

            <div className="flex gap-2 border-t border-ink-100 px-6 py-4">
              <button
                onClick={() => removeReport(detail.id)}
                disabled={deleting}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5"><Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete'}</span>
              </button>
              <button onClick={() => setDetail(null)} className="btn-outline flex-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailBlock({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink-700">{icon} {title}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <dt className="text-ink-500">{k}</dt>
            <dd className="font-semibold text-ink-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
