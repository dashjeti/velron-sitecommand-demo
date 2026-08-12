import { facilities, reports, newId } from '../demo/db'
import type { TSFReading } from '../types'

/** Demo implementation of the TSF facilities API over the in-memory store. */

export interface TsfFacility {
  id: string
  siteId: string
  name: string
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  thresholdsSource: string | null
}

export async function fetchTsfFacilities(siteId?: string): Promise<TsfFacility[]> {
  return facilities
    .filter((f) => !siteId || f.siteId === siteId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ ...f }))
}

export interface TsfFacilityInput {
  name: string
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  thresholdsSource: string | null
}

export async function createTsfFacility(siteId: string, input: TsfFacilityInput): Promise<{ error: string | null }> {
  facilities.push({ id: newId('tsf'), siteId, ...input })
  return { error: null }
}

export async function updateTsfFacility(id: string, input: TsfFacilityInput): Promise<{ error: string | null }> {
  const f = facilities.find((x) => x.id === id)
  if (!f) return { error: 'TSF not found.' }
  Object.assign(f, input)
  return { error: null }
}

export async function deleteTsfFacility(id: string): Promise<{ error: string | null }> {
  const i = facilities.findIndex((x) => x.id === id)
  if (i >= 0) facilities.splice(i, 1)
  for (const r of reports) {
    for (let t = r.tsf.length - 1; t >= 0; t--) {
      if (r.tsf[t].facilityId === id) r.tsf.splice(t, 1)
    }
  }
  return { error: null }
}

// ── Latest reading per facility ──────────────────────────────────────────────

export interface TsfLimits {
  freeboardMinM: number | null
  freeboardCriticalM: number | null
}

export interface TsfSnapshot {
  facilityId: string
  facilityName: string
  siteId: string
  date: string
  reading: TSFReading
  limits: TsfLimits
}

export async function fetchLatestTsfByFacility(): Promise<Record<string, TsfSnapshot>> {
  const out: Record<string, TsfSnapshot> = {}
  const sorted = reports.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const r of sorted) {
    for (const t of r.tsf) {
      if (out[t.facilityId]) continue
      const f = facilities.find((x) => x.id === t.facilityId)
      if (!f) continue
      out[t.facilityId] = {
        facilityId: t.facilityId,
        facilityName: f.name,
        siteId: r.siteId,
        date: r.date,
        reading: {
          freeboard: t.freeboard,
          poolDepth: t.poolDepth,
          returnWaterDamLevel: t.rwd,
          depositedPaddocks: t.deposited,
          paddocksAheadOfDeposition: t.ahead,
          piezometers: t.piezometers.map((p) => ({ ...p })),
        },
        limits: { freeboardMinM: f.freeboardMinM, freeboardCriticalM: f.freeboardCriticalM },
      }
    }
  }
  return out
}
