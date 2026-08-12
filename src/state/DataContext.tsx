import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  BreakdownReport,
  Certificate,
  Equipment,
  SheqRecord,
  SiteReport,
} from '../types'
import { fetchSheqRecords, fetchCertificates } from '../lib/sheq'
import { fetchAssets } from '../lib/assets'
import { fetchBreakdowns } from '../lib/breakdowns'
import { fetchSitesFull } from '../lib/sites'
import type { SiteOption, SiteRecord } from '../lib/sites'
import { fetchWeeklyGroupProduction } from '../lib/production'
import type { DailyReportRow } from '../lib/production'
import { fetchLatestTsfByFacility } from '../lib/tsf'
import type { TsfSnapshot } from '../lib/tsf'
import { buildSiteViews } from '../lib/siteViews'
import type { SiteView } from '../lib/siteViews'
import { computeComplianceScores, groupComplianceScore } from '../lib/compliance'

/** How many days of production history to load for the live dashboards. */
const PRODUCTION_WINDOW_DAYS = 30

/** Interim compliance scores, computed live from SHEQ + certificates. Keyed by real site id. */
export interface ComplianceState {
  /** Per-site interim score, keyed by real Supabase site id. */
  bySite: Record<string, number>
  /** Group average. */
  group: number
}

interface DataState {
  reports: SiteReport[]
  breakdowns: BreakdownReport[]
  sheq: SheqRecord[]
  equipment: Equipment[]
  /** True once the real asset list has loaded from Supabase (even if empty). */
  assetsAreReal: boolean
  /** Real sites from Supabase (id + name + status). Empty until loaded. */
  realSites: SiteOption[]
  /** Full real site records from Supabase. Empty until loaded. */
  siteRecords: SiteRecord[]
  /**
   * The live per-site view model (real sites + real production + compliance).
   * Every dashboard renders from this, so Site Management stays the single
   * source of truth and nothing falls out of sync.
   */
  siteViews: SiteView[]
  /** Latest real TSF snapshot per site, keyed by real site id. */
  /** Latest TSF reading per facility, keyed by tsf_facility id. */
  tsfByFacility: Record<string, TsfSnapshot>
  /** Real daily production rows (last PRODUCTION_WINDOW_DAYS), for trend charts. */
  groupProduction: DailyReportRow[]
  /** Statutory certificates from Supabase. Empty until loaded. */
  certs: Certificate[]
  /** Interim compliance scores, computed live from SHEQ + certificates. */
  compliance: ComplianceState
  siteName: (id: string) => string
  addReport: (r: Omit<SiteReport, 'id'>) => void
  addBreakdown: (b: Omit<BreakdownReport, 'id'>) => void
  addSheq: (s: Omit<SheqRecord, 'id'>) => void
  reloadAssets: () => Promise<void>
  reloadBreakdowns: () => Promise<void>
  reloadSheq: () => Promise<void>
  reloadCerts: () => Promise<void>
  /** Refetch sites, production and TSF, so newly added/edited sites appear. */
  reloadSites: () => Promise<void>
}

const DataCtx = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  // Everything is live-only: state starts empty and is filled from Supabase, so
  // no seed row (which has no real DB id) can ever be shown or acted on.
  const [reports, setReports] = useState<SiteReport[]>([])
  const [breakdowns, setBreakdowns] = useState<BreakdownReport[]>([])
  const [sheq, setSheq] = useState<SheqRecord[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [assetsAreReal, setAssetsAreReal] = useState(false)
  // Load real SHEQ records from Supabase on mount.
  const reloadSheq = useCallback(async () => {
    setSheq(await fetchSheqRecords())
  }, [])

  useEffect(() => {
    reloadSheq()
  }, [reloadSheq])

  // Load the asset register. The fleet is exactly what has been added
  // in Supabase; empty means none entered yet.
  const reloadAssets = useCallback(async () => {
    setEquipment(await fetchAssets())
    setAssetsAreReal(true)
  }, [])

  useEffect(() => {
    reloadAssets()
  }, [reloadAssets])

  // Real breakdown reports from Supabase.
  const reloadBreakdowns = useCallback(async () => {
    const rows = await fetchBreakdowns()
    setBreakdowns(rows)
  }, [])

  useEffect(() => {
    reloadBreakdowns()
  }, [reloadBreakdowns])

  // Statutory certificates, loaded once and shared. Feeds the interim
  // compliance score as well as the SHEQ certificate register.
  const [certs, setCerts] = useState<Certificate[]>([])
  const reloadCerts = useCallback(async () => {
    setCerts(await fetchCertificates())
  }, [])
  useEffect(() => {
    reloadCerts()
  }, [reloadCerts])

  // Real sites, production and TSF, the single source of truth for the
  // dashboards. reloadSites() lets a page refresh them (e.g. after a site is
  // added in Site Management) so nothing goes stale.
  const [siteRecords, setSiteRecords] = useState<SiteRecord[]>([])
  const [groupProduction, setGroupProduction] = useState<DailyReportRow[]>([])
  const [tsfByFacility, setTsfByFacility] = useState<Record<string, TsfSnapshot>>({})
  const reloadSites = useCallback(async () => {
    const [recs, prod, tsf] = await Promise.all([
      fetchSitesFull(),
      fetchWeeklyGroupProduction(PRODUCTION_WINDOW_DAYS),
      fetchLatestTsfByFacility(),
    ])
    setSiteRecords(recs)
    setGroupProduction(prod)
    setTsfByFacility(tsf)
  }, [])
  useEffect(() => {
    reloadSites()
  }, [reloadSites])

  // id + name + status list, for dropdowns and name lookups that only need it.
  const realSites = useMemo<SiteOption[]>(
    () => siteRecords.map((s) => ({ id: s.id, name: s.name, status: s.status })),
    [siteRecords],
  )

  const siteName = useCallback(
    (id: string) => realSites.find((s) => s.id === id)?.name ?? id,
    [realSites],
  )

  // Interim compliance, keyed by real site id. Real SHEQ records and
  // certificates already carry real site ids, so the mapping is the identity.
  const compliance = useMemo<ComplianceState>(() => {
    const bySite = computeComplianceScores({
      sheq,
      certs,
      siteIds: siteRecords.map((s) => s.id),
      canonical: (id) => id,
    })
    return { bySite, group: groupComplianceScore(bySite) }
  }, [sheq, certs, siteRecords])

  // The live per-site view model consumed by every dashboard.
  const siteViews = useMemo<SiteView[]>(
    () => buildSiteViews(siteRecords, groupProduction, compliance.bySite),
    [siteRecords, groupProduction, compliance],
  )

  const addReport = useCallback((r: Omit<SiteReport, 'id'>) => {
    setReports((prev) => [{ ...r, id: `SR-${3011 + prev.length}` }, ...prev])
  }, [])

  const addBreakdown = useCallback((b: Omit<BreakdownReport, 'id'>) => {
    setBreakdowns((prev) => [{ ...b, id: `BD-${1043 + prev.length}` }, ...prev])
    setEquipment((prev) =>
      prev.map((e) =>
        e.id === b.assetId
          ? { ...e, status: 'breakdown' as const, availability: 0 }
          : e,
      ),
    )
  }, [])

  const addSheq = useCallback((s: Omit<SheqRecord, 'id'>) => {
    setSheq((prev) => [{ ...s, id: `SH-${2202 + prev.length}` }, ...prev])
  }, [])

  const value = useMemo(
    () => ({
      reports, breakdowns, sheq, equipment, assetsAreReal,
      realSites, siteRecords, siteViews, tsfByFacility, groupProduction, certs, compliance,
      siteName,
      addReport, addBreakdown, addSheq,
      reloadAssets, reloadBreakdowns, reloadSheq, reloadCerts, reloadSites,
    }),
    [
      reports, breakdowns, sheq, equipment, assetsAreReal,
      realSites, siteRecords, siteViews, tsfByFacility, groupProduction, certs, compliance,
      siteName,
      addReport, addBreakdown, addSheq,
      reloadAssets, reloadBreakdowns, reloadSheq, reloadCerts, reloadSites,
    ],
  )

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export function useData() {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Derived analytics (pure helpers used across dashboards)
// ---------------------------------------------------------------------------

export function fleetAvailability(equip: Equipment[]) {
  if (!equip.length) return 0
  return Math.round(equip.reduce((s, e) => s + e.availability, 0) / equip.length)
}

export function fleetUtilization(equip: Equipment[]) {
  const running = equip.filter((e) => e.status === 'running').length
  return equip.length ? Math.round((running / equip.length) * 100) : 0
}
