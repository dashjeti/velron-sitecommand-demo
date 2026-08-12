import type { DailyReportRow } from './production'
import type { SiteRecord } from './sites'

/**
 * The single live view model for a site, built from the real Supabase sites
 * table, real daily-report production, and the interim compliance score. Every
 * dashboard renders from these, so a site added or renamed in Site Management
 * shows up everywhere with no mock list to fall out of sync.
 */

export type OpStatus = 'active' | 'inactive' | 'care_maintenance'
export type PerfStatus = 'on-track' | 'attention' | 'critical'

export interface SiteView {
  id: string
  name: string
  code: string
  location: string
  region: string | null
  opStatus: OpStatus
  /** True once at least one daily report exists for the site. */
  hasData: boolean
  actual: number
  target: number
  variance: number
  perfStatus: PerfStatus
  compliance: number
}

/** A short code from the site name: "Golden Valley Mine" -> "GVM". */
export function siteCode(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const letters = words.map((w) => w[0]!.toUpperCase()).join('')
  if (letters.length >= 2) return letters.slice(0, 4)
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || '—'
}

/** Latest day's actual/target for a site from its production rows. */
function latestProduction(rows: DailyReportRow[]): { actual: number; target: number; hasData: boolean } {
  if (rows.length === 0) return { actual: 0, target: 0, hasData: false }
  const latestDate = rows.reduce((m, r) => (r.report_date > m ? r.report_date : m), rows[0].report_date)
  const onLatest = rows.filter((r) => r.report_date === latestDate)
  return {
    actual: onLatest.reduce((s, r) => s + r.production_tonnes_actual, 0),
    target: onLatest.reduce((s, r) => s + r.production_tonnes_target, 0),
    hasData: true,
  }
}

function perfFromVariance(variance: number, hasData: boolean): PerfStatus {
  if (!hasData) return 'on-track'
  if (variance < -15) return 'critical'
  if (variance < -5) return 'attention'
  return 'on-track'
}

export function buildSiteViews(
  sites: SiteRecord[],
  production: DailyReportRow[],
  compliance: Record<string, number>,
): SiteView[] {
  return sites.map((s) => {
    const rows = production.filter((p) => p.site_id === s.id)
    const { actual, target, hasData } = latestProduction(rows)
    const variance = target ? Math.round(((actual - target) / target) * 100) : 0
    return {
      id: s.id,
      name: s.name,
      code: siteCode(s.name),
      location: s.location ?? 'No location set',
      region: s.region,
      opStatus: s.status,
      hasData,
      actual,
      target,
      variance,
      perfStatus: perfFromVariance(variance, hasData),
      compliance: compliance[s.id] ?? 100,
    }
  })
}
