import { sites, facilities, reports, assets, newId } from '../demo/db'

/** Demo implementation of the sites API over the in-memory store. */

export interface SiteThresholds {
  siteId: string
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  source: string | null
}

export async function fetchSiteThresholds(): Promise<Record<string, SiteThresholds>> {
  // Limits are per TSF facility in this product version; the legacy per-site
  // map stays empty so callers never imply a verdict from it.
  return {}
}

export interface SiteOption {
  id: string
  name: string
  status: SiteStatus
}

export async function fetchAllSites(): Promise<SiteOption[]> {
  return sites
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, name: s.name, status: s.status }))
}

export type SiteStatus = 'active' | 'inactive' | 'care_maintenance'

export interface SiteRecord {
  id: string
  name: string
  location: string | null
  region: string | null
  status: SiteStatus
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  thresholdsSource: string | null
}

export async function fetchSitesFull(): Promise<SiteRecord[]> {
  return sites
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location,
      region: s.region,
      status: s.status,
      freeboardMinM: null,
      freeboardCriticalM: null,
      thresholdsSource: null,
    }))
}

export interface SiteInput {
  name: string
  location: string | null
  region: string | null
  status: SiteStatus
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  thresholdsSource: string | null
}

export async function createSite(input: SiteInput): Promise<{ error: string | null }> {
  sites.push({
    id: newId('site'),
    name: input.name,
    location: input.location,
    region: input.region,
    status: input.status,
  })
  return { error: null }
}

export async function updateSite(id: string, input: SiteInput): Promise<{ error: string | null }> {
  const s = sites.find((x) => x.id === id)
  if (!s) return { error: 'Site not found.' }
  s.name = input.name
  s.location = input.location
  s.region = input.region
  s.status = input.status
  return { error: null }
}

export async function deleteSite(id: string): Promise<{ error: string | null }> {
  if (reports.some((r) => r.siteId === id) || assets.some((a) => a.siteId === id)) {
    return { error: 'update or delete on table "sites" violates foreign key constraint' }
  }
  const i = sites.findIndex((x) => x.id === id)
  if (i >= 0) sites.splice(i, 1)
  for (let f = facilities.length - 1; f >= 0; f--) {
    if (facilities[f].siteId === id) facilities.splice(f, 1)
  }
  return { error: null }
}

export interface ThresholdInput {
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  thresholdsSource: string | null
}

export async function updateSiteThresholds(
  _id: string,
  _input: ThresholdInput,
): Promise<{ error: string | null }> {
  // Per-site limits are legacy; limits live on TSF facilities in lib/tsf.
  return { error: null }
}

export type FreeboardVerdict = 'critical' | 'below-advisory' | 'ok' | 'unknown'

export function judgeFreeboard(
  freeboardM: number,
  thresholds: { freeboardMinM: number | null; freeboardCriticalM: number | null } | undefined,
): FreeboardVerdict {
  if (!thresholds) return 'unknown'
  const { freeboardMinM, freeboardCriticalM } = thresholds
  if (freeboardMinM === null && freeboardCriticalM === null) return 'unknown'
  if (freeboardCriticalM !== null && freeboardM < freeboardCriticalM) return 'critical'
  if (freeboardMinM !== null && freeboardM < freeboardMinM) return 'below-advisory'
  return 'ok'
}
