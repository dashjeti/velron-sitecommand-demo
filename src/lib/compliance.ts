import type { Certificate, SheqRecord } from '../types'

/**
 * Interim compliance score.
 *
 * The client has not yet supplied an official compliance-scoring formula, so
 * this is a transparent, defensible stand-in computed live from the data the
 * platform already holds: open/overdue SHEQ items, open incidents, and the
 * state of statutory certificates. Every score starts at 100 and loses points
 * for outstanding risk, floored at 60 so a single bad week never reads as a
 * total failure. Swap this whole module for the client's method once they give it
 * to us — the shape (a Record keyed by site id, plus a group average) stays the
 * same, so the dashboards do not change.
 */

const PENALTY = {
  openItem: 3,        // any open / in-progress SHEQ item
  overdueItem: 8,     // an item past its due date
  openIncident: 10,   // an open safety incident
  expiredCert: 12,    // a lapsed statutory certificate
  expiringCert: 4,    // a certificate inside its reminder window
}

const CAP = {
  openItem: 18,
  overdueItem: 24,
  openIncident: 30,
  expiredCert: 24,
  expiringCert: 12,
}

const FLOOR = 60

function capped(count: number, per: number, cap: number): number {
  return Math.min(count * per, cap)
}

export interface ComplianceInputs {
  sheq: SheqRecord[]
  certs: Certificate[]
  /** Mock site ids to score. */
  siteIds: string[]
  /** Maps a real Supabase site id to its mock counterpart (identity otherwise). */
  canonical: (id: string) => string
}

/** Interim compliance score for one site, in [FLOOR, 100]. */
function scoreForSite(
  siteId: string,
  sheq: SheqRecord[],
  certs: Certificate[],
  canonical: (id: string) => string,
): number {
  const forSite = sheq.filter((s) => canonical(s.siteId) === siteId)
  const open = forSite.filter((s) => s.status === 'open' || s.status === 'in_progress').length
  const overdue = forSite.filter((s) => s.status === 'overdue').length
  const openIncidents = forSite.filter(
    (s) => s.type === 'incident' && (s.status === 'open' || s.status === 'overdue'),
  ).length

  // Group-wide certificates (no site id) apply to every site.
  const certsForSite = certs.filter(
    (c) => !c.siteId || canonical(c.siteId) === siteId,
  )
  const expired = certsForSite.filter((c) => c.status === 'expired').length
  const expiring = certsForSite.filter((c) => c.status === 'expiring_soon').length

  const deductions =
    capped(open, PENALTY.openItem, CAP.openItem) +
    capped(overdue, PENALTY.overdueItem, CAP.overdueItem) +
    capped(openIncidents, PENALTY.openIncident, CAP.openIncident) +
    capped(expired, PENALTY.expiredCert, CAP.expiredCert) +
    capped(expiring, PENALTY.expiringCert, CAP.expiringCert)

  return Math.max(FLOOR, 100 - deductions)
}

/** Interim compliance score per site, keyed by mock site id. */
export function computeComplianceScores(input: ComplianceInputs): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of input.siteIds) {
    out[id] = scoreForSite(id, input.sheq, input.certs, input.canonical)
  }
  return out
}

/** Group average of a per-site score map. */
export function groupComplianceScore(scores: Record<string, number>): number {
  const vals = Object.values(scores)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 100
}

/** The reasons a site's score is below 100, for drill-down displays. */
export interface ComplianceFactors {
  open: number
  overdue: number
  openIncidents: number
  expiredCerts: number
  expiringCerts: number
}

export function complianceFactors(
  siteId: string,
  sheq: SheqRecord[],
  certs: Certificate[],
  canonical: (id: string) => string,
): ComplianceFactors {
  const forSite = sheq.filter((s) => canonical(s.siteId) === siteId)
  const certsForSite = certs.filter((c) => !c.siteId || canonical(c.siteId) === siteId)
  return {
    open: forSite.filter((s) => s.status === 'open' || s.status === 'in_progress').length,
    overdue: forSite.filter((s) => s.status === 'overdue').length,
    openIncidents: forSite.filter(
      (s) => s.type === 'incident' && (s.status === 'open' || s.status === 'overdue'),
    ).length,
    expiredCerts: certsForSite.filter((c) => c.status === 'expired').length,
    expiringCerts: certsForSite.filter((c) => c.status === 'expiring_soon').length,
  }
}
