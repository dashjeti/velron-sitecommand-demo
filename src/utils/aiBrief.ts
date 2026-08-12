import type { BreakdownReport, Equipment, SheqRecord } from '../types'
import { SHEQ_LABELS } from '../types'
import type { SiteView } from '../lib/siteViews'

export interface BriefInputs {
  /** The scoped site views (already narrowed to the selection). Carry production + compliance. */
  sites: SiteView[]
  equipment: Equipment[]
  sheq: SheqRecord[]
  breakdowns: BreakdownReport[]
  /** Interim compliance scores keyed by real site id (optional; site views also carry it). */
  compliance?: Record<string, number>
  /** Set when scoped to a single site, for the narrative label. */
  scopeName?: string
}

export interface BriefLine {
  text: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
}

/**
 * Generates a daily executive brief from the live data, the same narrative an
 * analyst would write, derived purely from the numbers on screen.
 */
export function generateExecutiveBrief(input: BriefInputs): {
  headline: string
  lines: BriefLine[]
  dateLabel: string
} {
  const lines: BriefLine[] = []
  const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  const scopeLabel = input.scopeName ?? 'Group'
  const nameById = (id: string) => input.sites.find((v) => v.id === id)?.name

  // --- Production vs target ---
  const withData = input.sites.filter((v) => v.hasData)
  const totalActual = withData.reduce((s, v) => s + v.actual, 0)
  const totalTarget = withData.reduce((s, v) => s + v.target, 0)
  const groupVar = totalTarget ? Math.round(((totalActual - totalTarget) / totalTarget) * 100) : 0

  if (withData.length === 0) {
    lines.push({
      text: `No production has been reported yet for ${scopeLabel.toLowerCase() === 'group' ? 'the group' : scopeLabel}. The brief fills in as supervisors submit daily reports.`,
      tone: 'neutral',
    })
  } else if (groupVar >= 0) {
    lines.push({
      text: `${scopeLabel} production exceeded target by ${groupVar}% (${totalActual.toLocaleString()}t against ${totalTarget.toLocaleString()}t).`,
      tone: 'good',
    })
  } else {
    lines.push({
      text: `${scopeLabel} production fell ${Math.abs(groupVar)}% short of target (${totalActual.toLocaleString()}t against ${totalTarget.toLocaleString()}t).`,
      tone: 'bad',
    })
  }

  // --- Underperforming sites ---
  const under = withData
    .filter((v) => v.variance < -5)
    .sort((a, b) => a.variance - b.variance)
  if (under.length) {
    const names = under.map((u) => `${u.name} (${u.variance}%)`).join(', ')
    lines.push({
      text: `${under.length === 1 ? 'One site is' : `${under.length} sites are`} operating below target: ${names}.`,
      tone: 'warn',
    })
  }

  // --- Equipment / maintenance ---
  const breakdownCount = input.equipment.filter((e) => e.status === 'breakdown').length
  const dueSoon = input.equipment.filter(
    (e) => e.usageDue > 0 && e.usageDue - e.usageCurrent <= 200 && e.status !== 'breakdown',
  )
  if (breakdownCount) {
    lines.push({
      text: `${breakdownCount} asset${breakdownCount > 1 ? 's are' : ' is'} currently down and in the workshop.`,
      tone: 'bad',
    })
  }
  if (dueSoon.length) {
    lines.push({
      text: `${dueSoon.length} asset${dueSoon.length > 1 ? 's require' : ' requires'} maintenance within 7 days.`,
      tone: 'warn',
    })
  }

  // --- Compliance (from the site views, which carry the interim score) ---
  const compVals = input.sites.map((v) => v.compliance)
  const avgComp = compVals.length
    ? Math.round(compVals.reduce((a, b) => a + b, 0) / compVals.length)
    : 0
  if (avgComp > 0) {
    lines.push({
      text: `${scopeLabel} compliance score remains ${avgComp >= 95 ? 'above 95%' : `at ${avgComp}%`}.`,
      tone: avgComp >= 95 ? 'good' : 'warn',
    })
  }

  // --- SHEQ outstanding ---
  const overdue = input.sheq.filter((s) => s.status === 'overdue')
  const openIncidents = input.sheq.filter((s) => s.type === 'incident' && s.status === 'open')
  if (overdue.length) {
    const o = overdue[0]
    const siteName = nameById(o.siteId)
    lines.push({
      text: `${overdue.length} ${SHEQ_LABELS[o.type].toLowerCase()}${overdue.length > 1 ? 's are' : ' is'} overdue${siteName ? ` (${siteName})` : ''} and requires immediate closeout.`,
      tone: 'bad',
    })
  }
  if (openIncidents.length) {
    lines.push({
      text: `${openIncidents.length} open incident${openIncidents.length > 1 ? 's' : ''} under investigation.`,
      tone: 'warn',
    })
  }

  // --- Best performer (only meaningful across sites) ---
  if (!input.scopeName && withData.length > 1) {
    const best = [...withData].sort((a, b) => b.variance - a.variance)[0]
    if (best) {
      lines.push({
        text: `Best performing site: ${best.name}, ${best.variance >= 0 ? '+' : ''}${best.variance}% vs target.`,
        tone: 'good',
      })
    }
  }

  const worstName = under[0]?.name
  const headline = input.scopeName
    ? groupVar >= 0
      ? `${scopeLabel} is tracking ahead of plan at +${groupVar}% against target.`
      : `${scopeLabel} is behind plan at ${groupVar}% against target; intervention needed.`
    : withData.length === 0
      ? 'Awaiting today’s site reports to build the executive picture.'
      : groupVar >= 0
        ? `Operations are tracking ahead of plan${worstName ? `, with localised risks at ${worstName}` : ''}.`
        : `Production is behind plan; intervention needed at ${worstName ?? 'underperforming sites'}.`

  return { headline, lines, dateLabel }
}
