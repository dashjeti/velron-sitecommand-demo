import {
  reports, sites, facilities, newId, users,
} from '../demo/db'
import type { DemoReport } from '../demo/db'

/** Demo implementation of the reports API over the in-memory store. */

export type WeatherCondition =
  | 'Clear' | 'Overcast' | 'Light Rain' | 'Heavy Rain' | 'Dust Storm' | 'Fog'

export type DelayType = 'equipment' | 'weather' | 'supply' | 'power' | 'labour' | 'other'

export interface SiteInfo {
  id: string
  name: string
  location: string | null
  region: string | null
  tsfFreeboardMinM: number | null
  tsfFreeboardCriticalM: number | null
  tsfThresholdsSource: string | null
}

export interface TodayReportSummary {
  id: string
  production_tonnes_actual: number
  production_tonnes_target: number
  created_at: string
}

export interface DelayEntry {
  type: DelayType
  durationHours: number
  description: string
}

export interface MaterialEntry {
  name: string
  quantity: number
  unit: string
}

export interface TsfReadingInput {
  facilityId: string
  freeboard: number
  poolDepth: number
  returnWaterDamLevel: number // percentage
  depositedPaddocks: number
  paddocksAheadOfDeposition: number
  piezometerA: number
  piezometerB: number
  piezometerC: number
}

export interface DailyReportInput {
  siteId: string
  submittedBy: string
  tonnesProcessed: number
  targetTonnes: number
  actualOutput: number
  notes: string
  fuel: number
  equipRunning: number
  equipIdle: number
  equipBreakdown: number
  weather: string
  weatherTempMinC: number | null
  weatherTempMaxC: number | null
  rainfallMm: number | null
  windSpeedKmh: number | null
  windDirection: string | null
  humidityPct: number | null
  labour: {
    totalWorkers: number
    present: number
    absent: number
    absentReason: string
    overtimeHours: number
  }
  delays: DelayEntry[]
  materials: MaterialEntry[]
  tsf: TsfReadingInput[]
  photo?: File
}

export async function fetchSite(siteId: string): Promise<SiteInfo | null> {
  const s = sites.find((x) => x.id === siteId)
  if (!s) return null
  return {
    id: s.id, name: s.name, location: s.location, region: s.region,
    tsfFreeboardMinM: null, tsfFreeboardCriticalM: null, tsfThresholdsSource: null,
  }
}

export interface ReportHistoryRow {
  id: string
  report_date: string
  shift: string
  production_tonnes_actual: number
  production_tonnes_target: number
  tonnes_processed: number
  created_at: string
}

export async function fetchSiteReportHistory(siteId: string, limit = 30): Promise<ReportHistoryRow[]> {
  return reports
    .filter((r) => r.siteId === siteId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      report_date: r.date,
      shift: 'day',
      production_tonnes_actual: r.actual,
      production_tonnes_target: r.target,
      tonnes_processed: r.tonnesProcessed,
      created_at: r.createdAt,
    }))
}

export interface AllReportRow {
  id: string
  report_date: string
  siteId: string
  siteName: string
  production_tonnes_actual: number
  production_tonnes_target: number
}

export async function fetchAllReports(siteId?: string, limit = 200): Promise<AllReportRow[]> {
  return reports
    .filter((r) => !siteId || r.siteId === siteId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      report_date: r.date,
      siteId: r.siteId,
      siteName: sites.find((s) => s.id === r.siteId)?.name ?? '—',
      production_tonnes_actual: r.actual,
      production_tonnes_target: r.target,
    }))
}

export interface ReportDetail {
  id: string
  report_date: string
  production_tonnes_actual: number
  production_tonnes_target: number
  tonnes_processed: number
  equipment_units_running: number
  equipment_units_idle: number
  equipment_units_breakdown: number
  weather_conditions: string | null
  weather_temp_min_c: number | null
  weather_temp_max_c: number | null
  rainfall_mm: number | null
  wind_speed_kmh: number | null
  wind_direction: string | null
  humidity_pct: number | null
  general_notes: string | null
  fuel: number
  labour: { total_workers: number; present: number; absent: number; overtime_hours: number } | null
  tsf: { facilityName: string; freeboard_m: number; pool_depth_m: number; return_water_dam_level_m: number }[]
  delays: { delay_type: string; duration_hours: number; description: string }[]
  materials: { material_name: string; quantity: number; unit: string }[]
}

export async function fetchReportDetail(reportId: string): Promise<ReportDetail | null> {
  const r = reports.find((x) => x.id === reportId)
  if (!r) return null
  return {
    id: r.id,
    report_date: r.date,
    production_tonnes_actual: r.actual,
    production_tonnes_target: r.target,
    tonnes_processed: r.tonnesProcessed,
    equipment_units_running: r.equipRunning,
    equipment_units_idle: r.equipIdle,
    equipment_units_breakdown: r.equipBreakdown,
    weather_conditions: r.weather,
    weather_temp_min_c: r.tempMin,
    weather_temp_max_c: r.tempMax,
    rainfall_mm: r.rainfallMm,
    wind_speed_kmh: r.windSpeedKmh,
    wind_direction: r.windDirection,
    humidity_pct: r.humidityPct,
    general_notes: r.notes,
    fuel: r.fuel,
    labour: r.labour
      ? { total_workers: r.labour.total, present: r.labour.present, absent: r.labour.absent, overtime_hours: r.labour.overtime }
      : null,
    tsf: r.tsf.map((t) => ({
      facilityName: facilities.find((f) => f.id === t.facilityId)?.name ?? 'TSF',
      freeboard_m: t.freeboard,
      pool_depth_m: t.poolDepth,
      return_water_dam_level_m: t.rwd,
    })),
    delays: r.delays.map((d) => ({ delay_type: d.type, duration_hours: d.hours, description: d.description })),
    materials: r.materials.map((m) => ({ material_name: m.name, quantity: m.quantity, unit: m.unit })),
  }
}

export async function deleteReport(reportId: string): Promise<{ error: string | null }> {
  const i = reports.findIndex((r) => r.id === reportId)
  if (i >= 0) reports.splice(i, 1)
  return { error: null }
}

export async function getTodayReport(siteId: string): Promise<TodayReportSummary | null> {
  const today = new Date().toISOString().slice(0, 10)
  const r = reports.find((x) => x.siteId === siteId && x.date === today)
  if (!r) return null
  return {
    id: r.id,
    production_tonnes_actual: r.actual,
    production_tonnes_target: r.target,
    created_at: r.createdAt,
  }
}

export async function submitDailyReport(input: DailyReportInput): Promise<{ error: string | null }> {
  const today = new Date().toISOString().slice(0, 10)
  const submitter = users.find((u) => u.id === input.submittedBy)
  const rep: DemoReport = {
    id: newId('rep'),
    siteId: input.siteId,
    date: today,
    createdAt: new Date().toISOString(),
    tonnesProcessed: input.tonnesProcessed,
    actual: input.actualOutput,
    target: input.targetTonnes,
    equipRunning: input.equipRunning,
    equipIdle: input.equipIdle,
    equipBreakdown: input.equipBreakdown,
    weather: input.weather || null,
    tempMin: input.weatherTempMinC,
    tempMax: input.weatherTempMaxC,
    rainfallMm: input.rainfallMm,
    windSpeedKmh: input.windSpeedKmh,
    windDirection: input.windDirection,
    humidityPct: input.humidityPct,
    notes: input.notes || null,
    fuel: input.fuel,
    labour: {
      total: input.labour.totalWorkers,
      present: input.labour.present,
      absent: input.labour.absent,
      overtime: input.labour.overtimeHours,
    },
    delays: input.delays.map((d) => ({ type: d.type, hours: d.durationHours, description: d.description })),
    materials: input.materials.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit })),
    tsf: input.tsf.map((t) => ({
      facilityId: t.facilityId,
      freeboard: t.freeboard,
      poolDepth: t.poolDepth,
      rwd: t.returnWaterDamLevel,
      deposited: t.depositedPaddocks,
      ahead: t.paddocksAheadOfDeposition,
      piezometers: [
        { label: 'PZ-A1', value: t.piezometerA },
        { label: 'PZ-A2', value: t.piezometerB },
        { label: 'PZ-A3', value: t.piezometerC },
      ],
    })),
    photoUrl: input.photo ? URL.createObjectURL(input.photo) : null,
    photoCaption: input.photo ? `Submitted by ${submitter?.fullName ?? 'supervisor'}` : null,
  }
  reports.push(rep)
  return { error: null }
}
