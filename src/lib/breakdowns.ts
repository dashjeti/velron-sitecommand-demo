import { assets, breakdowns, newId, users } from '../demo/db'
import type { BreakdownReport, Severity } from '../types'

/** Demo implementation of the breakdowns API over the in-memory store. */

export async function fetchBreakdowns(): Promise<BreakdownReport[]> {
  return breakdowns
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((b) => ({ ...b }))
}

export interface BreakdownInput {
  assetId: string
  issue: string
  severity: Severity
  estDowntimeHrs: number
  reportedById?: string
}

export async function createBreakdown(input: BreakdownInput): Promise<{ error: string | null }> {
  const asset = assets.find((a) => a.id === input.assetId)
  breakdowns.unshift({
    id: newId('bd'),
    assetId: input.assetId,
    assetName: asset?.name ?? 'Unknown asset',
    issue: input.issue,
    severity: input.severity,
    estDowntimeHrs: input.estDowntimeHrs,
    reportedBy: users.find((u) => u.id === input.reportedById)?.fullName ?? 'Workshop',
    date: new Date().toISOString(),
    status: 'open',
  })
  if (asset) {
    asset.status = 'breakdown'
    asset.availability = 0
  }
  return { error: null }
}

export async function setBreakdownStatus(
  id: string,
  assetId: string,
  status: 'open' | 'in-progress' | 'resolved',
  _resolutionNotes?: string,
): Promise<{ error: string | null }> {
  const b = breakdowns.find((x) => x.id === id)
  if (b) b.status = status
  const asset = assets.find((a) => a.id === assetId)
  if (asset) {
    asset.status = status === 'resolved' ? 'running' : 'breakdown'
    asset.availability = status === 'resolved' ? 95 : 0
  }
  return { error: null }
}

export async function deleteBreakdown(id: string): Promise<{ error: string | null }> {
  const i = breakdowns.findIndex((x) => x.id === id)
  if (i >= 0) breakdowns.splice(i, 1)
  return { error: null }
}
