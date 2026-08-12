import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Pencil,
  PlusCircle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useData } from '../../state/DataContext'
import { fleetAvailability } from '../../state/DataContext'
import {
  deleteMeetingPack,
  fetchMeetingPacks,
  fetchPackContent,
  generatePackWithAI,
  renameMeetingPack,
  saveMeetingPack,
  setPackStatus,
  updatePackContent,
} from '../../lib/meetingPacks'
import type { MeetingPack, AiPackContent } from '../../lib/meetingPacks'
import { downloadFile, printBrandedDocument, slugify } from '../../lib/download'

// Build a plain-text context summary from live app state to send to the AI
function buildContextSummary(
  siteViews: ReturnType<typeof useData>['siteViews'],
  equipment: ReturnType<typeof useData>['equipment'],
  sheq: ReturnType<typeof useData>['sheq'],
  siteName: ReturnType<typeof useData>['siteName'],
  avgComp: number,
): string {
  const withData = siteViews.filter((v) => v.hasData)
  const totalActual = withData.reduce((s, v) => s + v.actual, 0)
  const totalTarget = withData.reduce((s, v) => s + v.target, 0)
  const groupVar = totalTarget ? Math.round(((totalActual - totalTarget) / totalTarget) * 100) : 0

  const avail = fleetAvailability(equipment)
  const down = equipment.filter((e) => e.status === 'breakdown').length
  const dueSoon = equipment.filter((e) => e.usageDue > 0 && e.usageDue - e.usageCurrent <= 200 && e.status !== 'breakdown').length

  const openIncidents = sheq.filter((s) => s.type === 'incident' && s.status === 'open').length
  const overdue = sheq.filter((s) => s.status === 'overdue').length

  const siteLines = withData.length
    ? withData.map(
        (v) => `  - ${v.name}: ${v.actual.toLocaleString()}t actual vs ${v.target.toLocaleString()}t target (${v.variance >= 0 ? '+' : ''}${v.variance}%)`,
      ).join('\n')
    : '  - No production reported yet'

  return `GROUP PRODUCTION:
Total actual: ${totalActual.toLocaleString()}t | Total target: ${totalTarget.toLocaleString()}t | Variance: ${groupVar >= 0 ? '+' : ''}${groupVar}%
By site:
${siteLines}

FLEET STATUS:
Fleet availability: ${avail}% | Assets down: ${down} | Assets due service within 7 days: ${dueSoon}
Total assets: ${equipment.length}

SHEQ & COMPLIANCE:
Average compliance score: ${avgComp}%
Open incidents: ${openIncidents} | Overdue items: ${overdue}
Recent SHEQ events: ${sheq.slice(0, 5).map((s) => `${s.type.replace('_', ' ')} at ${siteName(s.siteId)} (${s.status})`).join(', ')}

SITES: ${siteViews.map((v) => v.name).join(', ') || 'None on record'}
COMMODITY: Gold TSF management, hydro-sluicing
CURRENCY: USD`
}

// Generate month/quarter period options
function periodOptions(type: 'monthly' | 'quarterly'): string[] {
  const now = new Date()
  const opts: string[] = []
  if (type === 'monthly') {
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      opts.push(d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))
    }
  } else {
    const currentQ = Math.floor(now.getMonth() / 3)
    for (let i = 0; i < 4; i++) {
      const q = ((currentQ - i + 4) % 4) + 1
      const year = now.getFullYear() - (currentQ - i < 0 ? 1 : 0)
      opts.push(`Q${q} ${year}`)
    }
  }
  return opts
}

function PackCard({ pack, onOpen }: { pack: MeetingPack; onOpen: () => void }) {
  const date = new Date(pack.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-4 text-left transition-all hover:border-billnick-200 hover:shadow-card"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-billnick-50 text-billnick-600">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">{pack.periodLabel}</p>
          <p className="text-xs text-ink-400 capitalize">{pack.periodType} pack · generated {date}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`pill ${pack.status === 'finalised' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {pack.status === 'finalised' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {pack.status === 'finalised' ? 'Finalised' : 'Draft'}
        </span>
        <ChevronRight className="h-4 w-4 text-ink-400" />
      </div>
    </button>
  )
}

function packToText(pack: MeetingPack, c: AiPackContent): string {
  const generated = new Date(pack.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const block = (heading: string, body: string) => [heading, '-'.repeat(heading.length), body, '']
  const list = (heading: string, items: string[], ordered = false) => [
    heading,
    '-'.repeat(heading.length),
    ...items.map((it, i) => (ordered ? `${i + 1}. ${it}` : `  - ${it}`)),
    '',
  ]

  return [
    'SITECOMMAND OPERATIONS GROUP',
    `${pack.periodLabel.toUpperCase()} MEETING PACK`,
    '',
    `Pack type: ${pack.periodType === 'monthly' ? 'Monthly' : 'Quarterly'}`,
    `Generated: ${generated}`,
    `Status:    ${pack.status === 'finalised' ? 'Finalised' : 'Draft'}`,
    '',
    ...list('AGENDA', c.agenda, true),
    ...block('EXECUTIVE SUMMARY', c.executiveSummary),
    ...block('PRODUCTION REVIEW', c.productionReview),
    ...block('SAFETY, HEALTH, ENVIRONMENT & QUALITY', c.safetyReview),
    ...block('FLEET & EQUIPMENT REVIEW', c.fleetReview),
    ...list('CORRECTIVE ACTIONS REGISTER', c.correctiveActions),
    ...list('RECOMMENDATIONS FOR BOARD APPROVAL', c.recommendationsForApproval),
    ...list('NEXT MEETING FOCUS AREAS', c.nextMeetingFocus),
    '---',
    'Generated by SiteCommand, the Operations Intelligence Platform.',
    'Drafted by AI from live production, fleet and SHEQ data. Review before circulation.',
  ].join('\r\n')
}

function PackViewer({
  pack,
  onClose,
  onRename,
  onToggleStatus,
  onDelete,
  onSaveContent,
}: {
  pack: MeetingPack
  onClose: () => void
  onRename: (label: string) => void
  onToggleStatus: () => void
  onDelete: () => void
  onSaveContent: (content: AiPackContent) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(pack.periodLabel)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const c = pack.aiContent

  // Section editing
  const [contentEditing, setContentEditing] = useState(false)
  const [savingContent, setSavingContent] = useState(false)
  const [draft, setDraft] = useState({
    agenda: '', executiveSummary: '', productionReview: '', safetyReview: '',
    fleetReview: '', correctiveActions: '', recommendationsForApproval: '', nextMeetingFocus: '',
  })

  if (!c) return null

  function startContentEdit() {
    setDraft({
      agenda: c!.agenda.join('\n'),
      executiveSummary: c!.executiveSummary,
      productionReview: c!.productionReview,
      safetyReview: c!.safetyReview,
      fleetReview: c!.fleetReview,
      correctiveActions: c!.correctiveActions.join('\n'),
      recommendationsForApproval: c!.recommendationsForApproval.join('\n'),
      nextMeetingFocus: c!.nextMeetingFocus.join('\n'),
    })
    setContentEditing(true)
  }

  async function saveContentEdits() {
    const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
    const next: AiPackContent = {
      agenda: lines(draft.agenda),
      executiveSummary: draft.executiveSummary.trim(),
      productionReview: draft.productionReview.trim(),
      safetyReview: draft.safetyReview.trim(),
      fleetReview: draft.fleetReview.trim(),
      correctiveActions: lines(draft.correctiveActions),
      recommendationsForApproval: lines(draft.recommendationsForApproval),
      nextMeetingFocus: lines(draft.nextMeetingFocus),
    }
    setSavingContent(true)
    await onSaveContent(next)
    setSavingContent(false)
    setContentEditing(false)
  }

  const commitRename = () => {
    const trimmed = draftLabel.trim()
    if (trimmed && trimmed !== pack.periodLabel) onRename(trimmed)
    else setDraftLabel(pack.periodLabel)
    setEditing(false)
  }

  const handleExportText = () =>
    downloadFile(`${slugify(pack.periodLabel)}-meeting-pack.txt`, packToText(pack, c))

  const handleExportPdf = () => {
    const generated = new Date(pack.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    printBrandedDocument({
      title: `${pack.periodLabel} Meeting Pack`,
      subtitle: `${pack.periodType === 'monthly' ? 'Monthly' : 'Quarterly'} management meeting pack`,
      meta: [
        { label: 'Generated', value: generated },
        { label: 'Status', value: pack.status === 'finalised' ? 'Finalised' : 'Draft' },
      ],
      sections: [
        { heading: 'Agenda', bullets: c.agenda },
        { heading: 'Executive Summary', body: c.executiveSummary },
        { heading: 'Production Review', body: c.productionReview },
        { heading: 'Safety, Health, Environment & Quality', body: c.safetyReview },
        { heading: 'Fleet & Equipment Review', body: c.fleetReview },
        ...(c.correctiveActions.length ? [{ heading: 'Corrective Actions Register', bullets: c.correctiveActions }] : []),
        ...(c.recommendationsForApproval.length ? [{ heading: 'Recommendations for Board Approval', bullets: c.recommendationsForApproval }] : []),
        ...(c.nextMeetingFocus.length ? [{ heading: 'Next Meeting Focus Areas', bullets: c.nextMeetingFocus }] : []),
      ],
      footer: 'Generated by BOIP. Drafted by AI from live operational data. Review before circulation.',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl animate-scale-in">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-ink-100 bg-white px-6 py-4">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                autoFocus
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') {
                    setDraftLabel(pack.periodLabel)
                    setEditing(false)
                  }
                }}
                aria-label="Meeting pack name"
                className="input w-full text-lg font-bold"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                title="Click to rename"
                className="group flex items-center gap-2 text-left"
              >
                <h2 className="truncate text-lg font-bold text-ink-900">{pack.periodLabel}</h2>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-300 transition-colors group-hover:text-billnick-500" />
              </button>
            )}
            <p className="mt-0.5 text-xs text-ink-400 capitalize">
              {pack.periodType} · {pack.status === 'finalised' ? 'finalised' : 'draft'} · generated by AI
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={handleExportPdf} className="btn-primary px-3 py-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={handleExportText} className="btn-ghost px-3 py-1.5 text-xs">
              Text
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-ink-50/60 px-6 py-3">
          <button
            onClick={onToggleStatus}
            className={`pill transition-colors ${
              pack.status === 'finalised'
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            {pack.status === 'finalised' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {pack.status === 'finalised' ? 'Finalised, click to reopen' : 'Draft, click to finalise'}
          </button>

          {contentEditing ? (
            <>
              <button onClick={saveContentEdits} disabled={savingContent} className="btn-primary px-2.5 py-1 text-xs disabled:opacity-60">
                {savingContent ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><CheckCircle2 className="h-3 w-3" /> Save changes</>}
              </button>
              <button onClick={() => setContentEditing(false)} disabled={savingContent} className="pill bg-ink-100 text-ink-600">Cancel</button>
            </>
          ) : (
            <button onClick={startContentEdit} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-billnick-700 hover:bg-billnick-50">
              <Pencil className="h-3.5 w-3.5" /> Edit sections
            </button>
          )}

          {!contentEditing && (confirmDelete ? (
            <span className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-ink-500">Delete this pack?</span>
              <button onClick={onDelete} className="pill bg-red-100 text-red-700 hover:bg-red-200">
                Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="pill bg-ink-100 text-ink-600">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ))}
        </div>

        {contentEditing ? (
          <div className="space-y-5 p-6 text-sm">
            <p className="rounded-xl bg-billnick-50 px-3 py-2 text-xs text-billnick-700">
              Edit any section below. For lists (agenda, corrective actions, recommendations, focus
              areas), put one item per line.
            </p>
            <EditField label="Agenda (one item per line)" value={draft.agenda} rows={5} onChange={(v) => setDraft((d) => ({ ...d, agenda: v }))} />
            <EditField label="Executive Summary" value={draft.executiveSummary} rows={5} onChange={(v) => setDraft((d) => ({ ...d, executiveSummary: v }))} />
            <EditField label="Production Review" value={draft.productionReview} rows={5} onChange={(v) => setDraft((d) => ({ ...d, productionReview: v }))} />
            <EditField label="Safety, Health, Environment & Quality" value={draft.safetyReview} rows={5} onChange={(v) => setDraft((d) => ({ ...d, safetyReview: v }))} />
            <EditField label="Fleet & Equipment Review" value={draft.fleetReview} rows={5} onChange={(v) => setDraft((d) => ({ ...d, fleetReview: v }))} />
            <EditField label="Corrective Actions Register (one per line)" value={draft.correctiveActions} rows={4} onChange={(v) => setDraft((d) => ({ ...d, correctiveActions: v }))} />
            <EditField label="Recommendations for Board Approval (one per line)" value={draft.recommendationsForApproval} rows={4} onChange={(v) => setDraft((d) => ({ ...d, recommendationsForApproval: v }))} />
            <EditField label="Next Meeting Focus Areas (one per line)" value={draft.nextMeetingFocus} rows={3} onChange={(v) => setDraft((d) => ({ ...d, nextMeetingFocus: v }))} />
          </div>
        ) : (
        <div className="space-y-6 p-6 text-sm text-ink-700">
          <section>
            <h3 className="section-title mb-3">Agenda</h3>
            <ol className="space-y-1.5 list-decimal list-inside">
              {c.agenda.map((item, i) => (
                <li key={i} className="text-ink-800">{item}</li>
              ))}
            </ol>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h3 className="section-title mb-3">Executive Summary</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{c.executiveSummary}</p>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h3 className="section-title mb-3">Production Review</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{c.productionReview}</p>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h3 className="section-title mb-3">Safety, Health, Environment & Quality</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{c.safetyReview}</p>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h3 className="section-title mb-3">Fleet & Equipment Review</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{c.fleetReview}</p>
          </section>

          {c.correctiveActions.length > 0 && (
            <section className="border-t border-ink-100 pt-6">
              <h3 className="section-title mb-3">Corrective Actions Register</h3>
              <ul className="space-y-2">
                {c.correctiveActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.recommendationsForApproval.length > 0 && (
            <section className="border-t border-ink-100 pt-6">
              <h3 className="section-title mb-3">Recommendations for Board Approval</h3>
              <ul className="space-y-2">
                {c.recommendationsForApproval.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-billnick-50 px-3 py-2 text-billnick-800">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-billnick-500" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.nextMeetingFocus.length > 0 && (
            <section className="border-t border-ink-100 pt-6">
              <h3 className="section-title mb-3">Next Meeting Focus Areas</h3>
              <ul className="space-y-1.5">
                {c.nextMeetingFocus.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-ink-700">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" /> {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function EditField({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input min-h-[80px] w-full resize-y leading-relaxed"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function MeetingPacks() {
  const { equipment, sheq, compliance, siteViews, siteName } = useData()
  const [packs, setPacks] = useState<MeetingPack[]>([])
  const [loadingPacks, setLoadingPacks] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewPack, setViewPack] = useState<MeetingPack | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly')
  const [periodLabel, setPeriodLabel] = useState('')
  const [previousMinutes, setPreviousMinutes] = useState('')
  const [minutesOpen, setMinutesOpen] = useState(false)

  const periodOpts = useMemo(() => periodOptions(periodType), [periodType])

  useEffect(() => {
    if (!periodLabel || !periodOpts.includes(periodLabel)) {
      setPeriodLabel(periodOpts[0] ?? '')
    }
  }, [periodType, periodOpts, periodLabel])

  useEffect(() => {
    fetchMeetingPacks().then((data) => {
      setPacks(data)
      setLoadingPacks(false)
    })
  }, [])

  const contextSummary = useMemo(
    () => buildContextSummary(siteViews, equipment, sheq, siteName, compliance.group),
    [siteViews, equipment, sheq, siteName, compliance],
  )

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    const { content, error: aiErr } = await generatePackWithAI({
      periodType,
      periodLabel,
      previousMinutes: previousMinutes.trim() || undefined,
      contextSummary,
    })

    if (aiErr || !content) {
      setError(aiErr ?? 'Unknown error from AI')
      setGenerating(false)
      return
    }

    const { id, error: saveErr } = await saveMeetingPack({
      periodType,
      periodLabel,
      previousMinutes: previousMinutes.trim() || undefined,
      aiContent: content,
    })

    if (saveErr) {
      // Still show the pack even if save fails
      setError(`Pack generated but not saved: ${saveErr}`)
    }

    const newPack: MeetingPack = {
      id: id ?? crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      periodType,
      periodLabel,
      previousMinutes: previousMinutes.trim() || null,
      aiContent: content,
      status: 'draft',
    }

    setPacks((prev) => [newPack, ...prev])
    setGenerating(false)
    setShowForm(false)
    // View the new pack directly from memory (content already in newPack)
    setViewPack(newPack)
  }

  return (
    <>
      <PageHeader
        title="Meeting Packs"
        subtitle="AI-generated monthly and quarterly management meeting packs, with agenda, minutes and corrective actions"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            <PlusCircle className="h-4 w-4" /> Generate Pack
          </button>
        }
      />

      {/* Generate form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-billnick-500" />
                <h2 className="font-bold text-ink-900">Generate Meeting Pack</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="label">Pack Type</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(['monthly', 'quarterly'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPeriodType(t)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        periodType === t
                          ? 'border-billnick-400 bg-billnick-50 text-billnick-700'
                          : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      <Calendar className="mx-auto mb-1 h-4 w-4" />
                      {t === 'monthly' ? 'Monthly' : 'Quarterly'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="period-select">Period</label>
                <select
                  id="period-select"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="input mt-1 w-full"
                >
                  {periodOpts.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setMinutesOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${minutesOpen ? 'rotate-180' : ''}`} />
                  {minutesOpen ? 'Hide' : 'Add'} previous meeting minutes (optional)
                </button>
                {minutesOpen && (
                  <textarea
                    value={previousMinutes}
                    onChange={(e) => setPreviousMinutes(e.target.value)}
                    rows={5}
                    placeholder="Paste the previous meeting minutes here..."
                    className="input mt-2 w-full resize-y text-xs"
                  />
                )}
              </div>

              <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                <p className="flex items-center gap-1.5 font-semibold text-ink-700">
                  <Sparkles className="h-3.5 w-3.5 text-billnick-500" /> AI will use live platform data
                </p>
                <p className="mt-1">Production totals, fleet availability, SHEQ records and compliance scores from today are automatically included as context.</p>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowForm(false)} className="btn-outline flex-1">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={generating || !periodLabel}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate with AI</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content loading overlay */}
      {loadingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-billnick-500" />
            <span className="text-sm font-semibold text-ink-700">Loading pack…</span>
          </div>
        </div>
      )}

      {/* Pack viewer */}
      {viewPack && (
        <PackViewer
          pack={viewPack}
          onClose={() => setViewPack(null)}
          onRename={async (label) => {
            const target = viewPack.id
            setViewPack((p) => (p ? { ...p, periodLabel: label } : p))
            setPacks((prev) => prev.map((p) => (p.id === target ? { ...p, periodLabel: label } : p)))
            const { error: renameErr } = await renameMeetingPack(target, label)
            if (renameErr) {
              setError(`Rename failed: ${renameErr}`)
              setPacks(await fetchMeetingPacks())
            }
          }}
          onToggleStatus={async () => {
            const target = viewPack.id
            const next = viewPack.status === 'finalised' ? 'draft' : 'finalised'
            setViewPack((p) => (p ? { ...p, status: next } : p))
            setPacks((prev) => prev.map((p) => (p.id === target ? { ...p, status: next } : p)))
            const { error: statusErr } = await setPackStatus(target, next)
            if (statusErr) {
              setError(`Status update failed: ${statusErr}`)
              setPacks(await fetchMeetingPacks())
            }
          }}
          onDelete={async () => {
            const target = viewPack.id
            setViewPack(null)
            setPacks((prev) => prev.filter((p) => p.id !== target))
            const { error: delErr } = await deleteMeetingPack(target)
            if (delErr) {
              setError(`Delete failed: ${delErr}`)
              setPacks(await fetchMeetingPacks())
            }
          }}
          onSaveContent={async (content) => {
            const target = viewPack.id
            setViewPack((p) => (p ? { ...p, aiContent: content } : p))
            const { error: saveErr } = await updatePackContent(target, content)
            if (saveErr) {
              setError(`Could not save edits: ${saveErr}`)
              const fresh = await fetchPackContent(target)
              setViewPack((p) => (p ? { ...p, aiContent: fresh } : p))
            }
          }}
        />
      )}

      <Panel
        title="Saved Packs"
        icon={<FileText className="h-4 w-4 text-billnick-500" />}
      >
        {loadingPacks ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-ink-300" />
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-50">
              <BookOpen className="h-7 w-7 text-ink-300" />
            </span>
            <p className="mt-4 font-semibold text-ink-600">No meeting packs yet</p>
            <p className="mt-1 text-sm text-ink-400">Generate your first pack using the button above. The AI will draft an agenda, executive summary, production review, SHEQ review and corrective actions register in seconds.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-6">
              <Sparkles className="h-4 w-4" /> Generate your first pack
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {packs.map((p) => (
              <PackCard
                key={p.id}
                pack={p}
                onOpen={async () => {
                  setLoadingContent(true)
                  const content = await fetchPackContent(p.id)
                  setViewPack({ ...p, aiContent: content })
                  setLoadingContent(false)
                }}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}
