import { meetingPacks, newId } from '../demo/db'

/** Demo implementation of the meeting packs API. "AI" generation is a canned
 *  writer with a short delay, so the demo needs no API key and costs nothing. */

export interface AiPackContent {
  agenda: string[]
  executiveSummary: string
  productionReview: string
  safetyReview: string
  fleetReview: string
  correctiveActions: string[]
  recommendationsForApproval: string[]
  nextMeetingFocus: string[]
}

export interface MeetingPack {
  id: string
  createdAt: string
  periodType: 'monthly' | 'quarterly'
  periodLabel: string
  previousMinutes: string | null
  aiContent: AiPackContent | null
  status: 'draft' | 'finalised'
}

export async function fetchMeetingPacks(): Promise<MeetingPack[]> {
  return meetingPacks
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      periodType: p.periodType,
      periodLabel: p.periodLabel,
      previousMinutes: p.previousMinutes,
      aiContent: null,
      status: p.status,
    }))
}

export async function fetchPackContent(id: string): Promise<AiPackContent | null> {
  const p = meetingPacks.find((x) => x.id === id)
  return p?.content ? { ...p.content } : null
}

export async function saveMeetingPack(pack: {
  periodType: 'monthly' | 'quarterly'
  periodLabel: string
  previousMinutes?: string
  aiContent: AiPackContent
}): Promise<{ id: string | null; error: string | null }> {
  const id = newId('mp')
  meetingPacks.unshift({
    id,
    createdAt: new Date().toISOString(),
    periodType: pack.periodType,
    periodLabel: pack.periodLabel,
    previousMinutes: pack.previousMinutes ?? null,
    content: pack.aiContent,
    status: 'draft',
  })
  return { id, error: null }
}

export async function updatePackContent(id: string, content: AiPackContent): Promise<{ error: string | null }> {
  const p = meetingPacks.find((x) => x.id === id)
  if (p) p.content = content
  return { error: null }
}

export async function renameMeetingPack(id: string, label: string): Promise<{ error: string | null }> {
  const trimmed = label.trim()
  if (!trimmed) return { error: 'Name cannot be empty.' }
  const p = meetingPacks.find((x) => x.id === id)
  if (p) p.periodLabel = trimmed
  return { error: null }
}

export async function setPackStatus(
  id: string,
  status: 'draft' | 'finalised',
): Promise<{ error: string | null }> {
  const p = meetingPacks.find((x) => x.id === id)
  if (p) p.status = status
  return { error: null }
}

export async function deleteMeetingPack(id: string): Promise<{ error: string | null }> {
  const i = meetingPacks.findIndex((x) => x.id === id)
  if (i >= 0) meetingPacks.splice(i, 1)
  return { error: null }
}

/** Pulls "Key: value" style figures out of the live context summary so the
 *  canned pack still reflects what is actually on the dashboards. */
function grab(summary: string, pattern: RegExp, fallback: string): string {
  const m = summary.match(pattern)
  return m?.[1]?.trim() ?? fallback
}

export async function generatePackWithAI(params: {
  periodType: 'monthly' | 'quarterly'
  periodLabel: string
  previousMinutes?: string
  contextSummary: string
}): Promise<{ content: AiPackContent | null; error: string | null }> {
  // A short pause so the generation feels real in the demo.
  await new Promise((r) => setTimeout(r, 1600))

  const s = params.contextSummary
  const variance = grab(s, /Variance:\s*([+\-]?\d+%)/, 'on plan')
  const avail = grab(s, /Fleet availability:\s*(\d+%)/, '—')
  const down = grab(s, /Assets down:\s*(\d+)/, '0')
  const comp = grab(s, /compliance score:\s*(\d+%)/i, '—')
  const incidents = grab(s, /Open incidents:\s*(\d+)/, '0')
  const overdue = grab(s, /Overdue items:\s*(\d+)/, '0')

  const content: AiPackContent = {
    agenda: [
      'Safety, health, environment & quality review',
      'Production performance vs plan by site',
      'Fleet availability and maintenance outlook',
      'Compliance, certificates and open actions',
      'Approvals and focus for the next period',
    ],
    executiveSummary:
      `For ${params.periodLabel}, group production is tracking ${variance} against plan with fleet availability at ${avail}. ` +
      `The compliance score stands at ${comp}, with ${incidents} open incident(s) and ${overdue} overdue action(s) requiring closeout. ` +
      'Site-level detail and the corrective-action register follow.',
    productionReview:
      'Site-by-site production is summarised from the live daily reports for the period. Strongest performance came from the sites running ahead of plan; the shortfall sites are flagged for focused intervention, with haul cycle times and weather stoppages the recurring constraints.',
    safetyReview:
      `${incidents} incident(s) are open and under investigation and ${overdue} action(s) are past due. ` +
      'Toolbox talks and inspections continued on schedule across sites. Overdue items are listed in the corrective actions below and should be closed before the next review.',
    fleetReview:
      `Fleet availability averaged ${avail} for the period with ${down} asset(s) down at the time of writing. ` +
      'Assets inside their service window have work orders raised; watch items are the units running close to service-due readings.',
    correctiveActions: [
      'Close out all overdue SHEQ items and confirm evidence is attached',
      'Renew any certificates inside their reminder window',
      'Review recovery plans for sites running behind plan',
    ],
    recommendationsForApproval: [
      'Approve the maintenance schedule for the coming period',
      'Approve focused support for underperforming sites',
    ],
    nextMeetingFocus: [
      'Progress on recovery plans and overdue actions',
      'Seasonal TSF readiness and freeboard trends',
    ],
  }

  return { content, error: null }
}
