import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  CloudSun,
  Droplets,
  Factory,
  Fuel,
  HardHat,
  Loader2,
  Timer,
  Truck,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useData } from '../../state/DataContext'
import { fetchAllReports, fetchReportDetail } from '../../lib/reports'
import type { AllReportRow, ReportDetail } from '../../lib/reports'

function pretty(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Reports() {
  const { realSites, reloadSites } = useData()
  const [rows, setRows] = useState<AllReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSite, setFilterSite] = useState('')
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // ?report=<id> deep link, so a dashboard row can open one report directly.
  const [params, setParams] = useSearchParams()
  const deepLinkId = params.get('report')

  useEffect(() => { reloadSites() }, [reloadSites])

  useEffect(() => {
    setLoading(true)
    fetchAllReports(filterSite || undefined).then((r) => { setRows(r); setLoading(false) })
  }, [filterSite])

  useEffect(() => {
    if (!deepLinkId) return
    let cancelled = false
    setDetailLoading(true)
    fetchReportDetail(deepLinkId).then((d) => {
      if (cancelled) return
      setDetail(d)
      setDetailLoading(false)
    })
    return () => { cancelled = true }
  }, [deepLinkId])

  async function openDetail(id: string) {
    setDetailLoading(true)
    setDetail(await fetchReportDetail(id))
    setDetailLoading(false)
  }

  function closeDetail() {
    setDetail(null)
    if (deepLinkId) {
      const next = new URLSearchParams(params)
      next.delete('report')
      setParams(next, { replace: true })
    }
  }

  return (
    <>
      <PageHeader
        title="Submitted Reports"
        subtitle="Every daily site report across all sites, newest first"
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="rep-site" className="sr-only">Filter by site</label>
            <select id="rep-site" className="input py-1.5 text-sm" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
              <option value="">All sites</option>
              {realSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        }
      />

      <Panel title={`Reports (${rows.length})`} icon={<CalendarDays className="h-4 w-4 text-billnick-500" />}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No reports submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="px-3 pb-2 font-semibold">Site</th>
                  <th className="px-3 pb-2 font-semibold">Submitted by</th>
                  <th className="px-3 pb-2 font-semibold">Actual / Target</th>
                  <th className="px-3 pb-2 text-right font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const variance = r.production_tonnes_target
                    ? Math.round(((r.production_tonnes_actual - r.production_tonnes_target) / r.production_tonnes_target) * 100)
                    : 0
                  return (
                    <tr key={r.id} onClick={() => openDetail(r.id)} className="cursor-pointer border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                      <td className="py-3 pr-3 font-semibold text-ink-800">{pretty(r.report_date)}</td>
                      <td className="px-3 py-3 text-ink-600">{r.siteName}</td>
                      <td className="px-3 py-3 text-ink-600">
                        {r.submittedBy ?? <span className="text-ink-300">Not recorded</span>}
                      </td>
                      <td className="px-3 py-3 text-ink-600">{r.production_tonnes_actual.toLocaleString()}t / {r.production_tonnes_target.toLocaleString()}t</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`pill ${variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {variance >= 0 ? '+' : ''}{variance}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm" onClick={closeDetail}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-ink-900">Daily Report</h2>
                <p className="text-xs text-ink-400">{pretty(detail.report_date)}</p>
              </div>
              <button onClick={closeDetail} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6 text-sm">
              <Block icon={<Factory className="h-4 w-4 text-billnick-500" />} title="Production" rows={[
                ['Tonnes processed', `${detail.tonnes_processed.toLocaleString()} t`],
                ['Actual output', `${detail.production_tonnes_actual.toLocaleString()} t`],
                ['Target', `${detail.production_tonnes_target.toLocaleString()} t`],
              ]} />
              <Block icon={<Truck className="h-4 w-4 text-blue-500" />} title="Equipment" rows={[
                ['Running', `${detail.equipment_units_running}`],
                ['Idle', `${detail.equipment_units_idle}`],
                ['Breakdown', `${detail.equipment_units_breakdown}`],
              ]} />
              {detail.labour && (
                <Block icon={<HardHat className="h-4 w-4 text-billnick-500" />} title="Labour" rows={[
                  ['Crew', `${detail.labour.present} of ${detail.labour.total_workers} present`],
                  ['Absent', `${detail.labour.absent}`],
                  ['Overtime', `${detail.labour.overtime_hours} h`],
                ]} />
              )}
              <Block icon={<Fuel className="h-4 w-4 text-billnick-500" />} title="Fuel" rows={[['Consumed', `${detail.fuel.toLocaleString()} L`]]} />
              <Block icon={<CloudSun className="h-4 w-4 text-blue-500" />} title="Weather" rows={[
                ['Conditions', detail.weather_conditions ?? 'Not recorded'],
                ...(detail.weather_temp_min_c !== null || detail.weather_temp_max_c !== null
                  ? [['Temperature', `${detail.weather_temp_min_c ?? '—'} to ${detail.weather_temp_max_c ?? '—'} °C`] as [string, string]] : []),
                ...(detail.rainfall_mm !== null ? [['Rainfall', `${detail.rainfall_mm} mm`] as [string, string]] : []),
                ...(detail.wind_speed_kmh !== null ? [['Wind', `${detail.wind_speed_kmh} km/h${detail.wind_direction ? ' ' + detail.wind_direction : ''}`] as [string, string]] : []),
                ...(detail.humidity_pct !== null ? [['Humidity', `${detail.humidity_pct}%`] as [string, string]] : []),
              ]} />
              {detail.tsf.map((t, i) => (
                <Block key={i} icon={<Droplets className="h-4 w-4 text-blue-500" />} title={`TSF · ${t.facilityName}`} rows={[
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
            </div>

            <div className="border-t border-ink-100 px-6 py-4">
              <button onClick={closeDetail} className="btn-outline w-full">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Block({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: [string, string][] }) {
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
