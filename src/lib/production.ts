import { reports, isoDaysAgo } from '../demo/db'

/** Demo implementation of the production API over the in-memory store. */

export interface DailyReportRow {
  id: string
  site_id: string
  report_date: string
  production_tonnes_actual: number
  production_tonnes_target: number
}

function toRow(r: (typeof reports)[number]): DailyReportRow {
  return {
    id: r.id,
    site_id: r.siteId,
    report_date: r.date,
    production_tonnes_actual: r.actual,
    production_tonnes_target: r.target,
  }
}

export async function fetchWeeklyGroupProduction(days = 7): Promise<DailyReportRow[]> {
  const from = isoDaysAgo(days)
  return reports
    .filter((r) => r.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(toRow)
}

export async function fetchSiteProduction(siteId: string, days = 7): Promise<DailyReportRow[]> {
  const from = isoDaysAgo(days)
  return reports
    .filter((r) => r.siteId === siteId && r.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(toRow)
}

export function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function mergeWeeklySeries(
  realRows: DailyReportRow[],
  mockFallback: { date: string; actual: number; target: number }[],
): { label: string; Actual: number; Target: number }[] {
  return mockFallback.map((mock) => {
    const real = realRows.filter((r) => r.report_date === mock.date)
    if (real.length > 0) {
      return {
        label: formatDateLabel(mock.date),
        Actual: real.reduce((s, r) => s + r.production_tonnes_actual, 0),
        Target: real.reduce((s, r) => s + r.production_tonnes_target, 0),
      }
    }
    return { label: formatDateLabel(mock.date), Actual: mock.actual, Target: mock.target }
  })
}
