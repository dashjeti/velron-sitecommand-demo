import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Trash2,
  Wrench,
  Activity,
} from 'lucide-react'
import {
  EquipStatusBadge,
  KpiCard,
  PageHeader,
  Panel,
  Progress,
  SeverityBadge,
} from '../../components/ui'
import { Donut, VBars, chartColors } from '../../components/charts'
import { useData, fleetAvailability, fleetUtilization } from '../../state/DataContext'
import { fetchAllSites } from '../../lib/sites'
import type { SiteOption } from '../../lib/sites'
import { setBreakdownStatus, deleteBreakdown } from '../../lib/breakdowns'
import { prettyDate } from '../../data/mockData'
import { EQUIPMENT_TYPES } from '../../types'
import type { BreakdownReport, EquipmentType, UsageUnit } from '../../types'

const types: (EquipmentType | 'All')[] = ['All', ...EQUIPMENT_TYPES]

// Service due within this many hours or km counts as "due soon".
const SERVICE_SOON = 200

const unitLabel = (u: UsageUnit) => (u === 'km' ? 'km' : 'h')

export default function WorkshopDashboard() {
  const { equipment, breakdowns, reloadBreakdowns, reloadAssets } = useData()
  const [filter, setFilter] = useState<EquipmentType | 'All'>('All')
  const [sites, setSites] = useState<SiteOption[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const active = breakdowns.filter((b) => b.status !== 'resolved')
  const resolved = breakdowns.filter((b) => b.status === 'resolved')

  async function changeStatus(b: BreakdownReport, status: 'open' | 'in-progress' | 'resolved') {
    setBusyId(b.id)
    await setBreakdownStatus(b.id, b.assetId, status)
    await Promise.all([reloadBreakdowns(), reloadAssets()])
    setBusyId(null)
  }

  async function removeBreakdown(b: BreakdownReport) {
    setBusyId(b.id)
    await deleteBreakdown(b.id)
    await reloadBreakdowns()
    setBusyId(null)
  }

  useEffect(() => {
    fetchAllSites().then(setSites)
  }, [])

  const siteName = useMemo(() => {
    const map = new Map(sites.map((s) => [s.id, s.name]))
    return (id: string) => map.get(id) ?? 'Unassigned'
  }, [sites])

  const filtered = filter === 'All' ? equipment : equipment.filter((e) => e.type === filter)

  const avail = fleetAvailability(equipment)
  const util = fleetUtilization(equipment)
  const down = equipment.filter((e) => e.status === 'breakdown').length
  // Only assets with a service target set can be "due soon".
  const dueSoon = equipment.filter((e) => e.usageDue > 0 && e.usageDue - e.usageCurrent <= SERVICE_SOON).length

  // Availability by category, over the categories that actually have assets.
  const byType = useMemo(
    () =>
      EQUIPMENT_TYPES.map((t) => {
        const inType = equipment.filter((e) => e.type === t)
        return {
          label: t,
          value: inType.length
            ? Math.round(inType.reduce((s, e) => s + e.availability, 0) / inType.length)
            : 0,
        }
      }).filter((d) => equipment.some((e) => e.type === d.label)),
    [equipment],
  )

  return (
    <>
      <PageHeader
        title="Equipment Dashboard"
        subtitle="Fleet status across the asset register"
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/workshop/assets" className="btn-outline">
              <Boxes className="h-4 w-4" /> Asset Register
            </Link>
            <Link to="/workshop/breakdown" className="btn-primary">
              <ClipboardList className="h-4 w-4" /> Create Breakdown Report
            </Link>
          </div>
        }
      />

      {equipment.length === 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0">No assets in the register yet. Add your fleet to see availability, service and breakdown tracking.</p>
          <Link to="/workshop/assets" className="btn-primary shrink-0 px-3 py-1.5 text-xs">
            <Boxes className="h-3.5 w-3.5" /> Add assets
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Fleet Availability" value={avail} unit="%" icon={<Boxes className="h-5 w-5" />} accent="green" delay={0} />
        <KpiCard label="Utilization" value={util} unit="%" icon={<Activity className="h-5 w-5" />} accent="blue" sub={`${equipment.length} assets`} delay={50} />
        <KpiCard label="In Breakdown" value={down} icon={<Wrench className="h-5 w-5" />} accent={down ? 'red' : 'green'} delay={100} />
        <KpiCard label="Service Due Soon" value={dueSoon} icon={<Clock className="h-5 w-5" />} accent="billnick" delay={150} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Availability by Type" className="lg:col-span-2" icon={<Boxes className="h-4 w-4 text-billnick-500" />}>
          <VBars data={byType} color={chartColors.ORANGE} />
        </Panel>
        <Panel title="Fleet Status Mix" icon={<Activity className="h-4 w-4 text-blue-500" />}>
          <Donut
            centerValue={`${util}%`}
            centerLabel="Utilized"
            data={[
              { name: 'Running', value: equipment.filter((e) => e.status === 'running').length, color: chartColors.GREEN },
              { name: 'Idle', value: equipment.filter((e) => e.status === 'idle').length, color: '#cbd2de' },
              { name: 'Maintenance', value: equipment.filter((e) => e.status === 'maintenance').length, color: '#f59e0b' },
              { name: 'Breakdown', value: equipment.filter((e) => e.status === 'breakdown').length, color: '#ef4444' },
            ]}
          />
        </Panel>
      </div>

      {/* Asset list */}
      <Panel
        title="Fleet Assets"
        icon={<Wrench className="h-4 w-4 text-billnick-500" />}
        action={
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filter === t ? 'bg-billnick-500 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      >
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400">
                <th className="pb-2 pr-3 font-semibold">Asset</th>
                <th className="px-3 pb-2 font-semibold">Status</th>
                <th className="px-3 pb-2 font-semibold">Usage</th>
                <th className="px-3 pb-2 font-semibold">Service Due</th>
                <th className="px-3 pb-2 font-semibold">Availability</th>
                <th className="px-3 pb-2 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const remaining = e.usageDue - e.usageCurrent
                const serviceKnown = e.usageDue > 0
                const u = unitLabel(e.usageUnit)
                return (
                  <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ink-800">{e.name}</p>
                      <p className="text-xs text-ink-400">
                        {e.registration ? `${e.registration} · ` : ''}{e.type} · {siteName(e.siteId)}
                      </p>
                    </td>
                    <td className="px-3 py-3"><EquipStatusBadge status={e.status} /></td>
                    <td className="px-3 py-3 tabular-nums text-ink-600">
                      {e.usageCurrent > 0 ? `${e.usageCurrent.toLocaleString()} ${u}` : <span className="text-ink-300">not set</span>}
                    </td>
                    <td className="px-3 py-3">
                      {!serviceKnown ? (
                        <span className="text-xs text-ink-300">not set</span>
                      ) : (
                        <span className={`pill ${remaining <= 0 ? 'bg-red-100 text-red-700' : remaining <= SERVICE_SOON ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>
                          {remaining <= 0 ? 'Overdue' : `${remaining.toLocaleString()} ${u}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={e.availability} color={e.availability >= 85 ? 'green' : 'red'} />
                        <span className="w-16 text-xs font-semibold text-ink-600">{e.availability > 0 ? 'Available' : 'Down'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-300" />{e.location || '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {filtered.map((e) => {
            const remaining = e.usageDue - e.usageCurrent
            const serviceKnown = e.usageDue > 0
            const u = unitLabel(e.usageUnit)
            return (
              <div key={e.id} className="rounded-xl border border-ink-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-800">{e.name}</p>
                    <p className="text-xs text-ink-400">{e.registration ?? e.type} · {siteName(e.siteId)}</p>
                  </div>
                  <EquipStatusBadge status={e.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-500">
                  <span>Usage: <b className="text-ink-700">{e.usageCurrent > 0 ? `${e.usageCurrent.toLocaleString()} ${u}` : 'not set'}</b></span>
                  <span>Service: <b className={serviceKnown && remaining <= SERVICE_SOON ? 'text-amber-600' : 'text-ink-700'}>{!serviceKnown ? 'not set' : remaining <= 0 ? 'Overdue' : `${remaining.toLocaleString()} ${u}`}</b></span>
                  {e.location && <span className="col-span-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Active breakdowns */}
      <Panel title="Active Breakdown Reports" className="mt-4" icon={<Wrench className="h-4 w-4 text-red-500" />}>
        {active.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No active breakdowns. The fleet is running.</p>
        ) : (
          <div className="space-y-2">
            {active.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-ink-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{b.assetName}</p>
                  <p className="text-xs text-ink-500">{b.issue}</p>
                  <p className="mt-0.5 text-xs text-ink-400">Reported by {b.reportedBy} · {prettyDate(b.date)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill bg-ink-100 text-ink-600"><Clock className="h-3 w-3" />{b.estDowntimeHrs}h</span>
                  <SeverityBadge severity={b.severity} />
                  <span className={`pill capitalize ${b.status === 'in-progress' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{b.status}</span>
                  {b.status === 'open' && (
                    <button onClick={() => changeStatus(b, 'in-progress')} disabled={busyId === b.id} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50">
                      Start work
                    </button>
                  )}
                  <button onClick={() => changeStatus(b, 'resolved')} disabled={busyId === b.id} className="btn-primary px-2.5 py-1 text-xs disabled:opacity-50">
                    <Wrench className="h-3 w-3" /> Mark repaired
                  </button>
                  <button onClick={() => removeBreakdown(b)} disabled={busyId === b.id} aria-label="Delete report" className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Recently repaired */}
      {resolved.length > 0 && (
        <Panel title="Recently Repaired" className="mt-4" icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}>
          <div className="space-y-2">
            {resolved.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-50 bg-ink-50/40 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-700">{b.assetName}</p>
                  <p className="truncate text-xs text-ink-400">{b.issue}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="pill bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Repaired</span>
                  <button onClick={() => changeStatus(b, 'open')} disabled={busyId === b.id} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50">
                    Reopen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
