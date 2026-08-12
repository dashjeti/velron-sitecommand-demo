import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  Factory,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  Wrench,
  X,
} from 'lucide-react'
import {
  KpiCard,
  PageHeader,
  Panel,
  Progress,
  SeverityBadge,
  SiteStatusBadge,
} from '../../components/ui'
import { RankingBars, WeeklyTrend, chartColors } from '../../components/charts'
import { fleetAvailability, useData } from '../../state/DataContext'
import { formatDateLabel } from '../../lib/production'
import { prettyDate } from '../../data/mockData'
import { useAuth } from '../../state/AuthContext'
import {
  fetchClientDocuments,
  uploadClientDocument,
  deleteClientDocument,
} from '../../lib/documents'
import type { ClientDocument, DocType } from '../../lib/documents'
import { SHEQ_LABELS } from '../../types'
import type { Severity } from '../../types'

const DOC_TYPES: DocType[] = ['Progress Report', 'Production Report', 'Compliance Document', 'Deliverable']

export default function ProjectDashboard() {
  const { equipment, sheq, realSites, siteName, siteViews, groupProduction, reloadSites } = useData()
  const { user } = useAuth()

  // Keep the site list live: refresh when the page opens.
  useEffect(() => { reloadSites() }, [reloadSites])

  // KPI drill-down modal (project role is gated out of the SHEQ page).
  const [detail, setDetail] = useState<{ title: string; subtitle: string; rows: { k: string; v: string }[] } | null>(null)
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Client document publishing
  const [docSite, setDocSite] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [docType, setDocType] = useState<DocType>('Progress Report')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docs, setDocs] = useState<ClientDocument[]>([])
  const [docBusy, setDocBusy] = useState(false)
  const [docError, setDocError] = useState('')

  useEffect(() => {
    if (docSite) fetchClientDocuments(docSite).then(setDocs)
    else setDocs([])
  }, [docSite])

  async function publishDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docSite || !docTitle.trim() || !docFile) {
      setDocError('Choose a site, a title and a file.')
      return
    }
    setDocBusy(true)
    setDocError('')
    const { error } = await uploadClientDocument({
      siteId: docSite,
      title: docTitle.trim(),
      docType,
      documentDate: new Date().toISOString().slice(0, 10),
      file: docFile,
      uploadedById: user?.id,
    })
    if (error) {
      setDocError(error)
      setDocBusy(false)
      return
    }
    setDocs(await fetchClientDocuments(docSite))
    setDocTitle('')
    setDocFile(null)
    setDocBusy(false)
  }

  async function removeDoc(doc: ClientDocument) {
    setDocBusy(true)
    // storagePath is not returned by the list query; delete by re-deriving from id is not possible,
    // so we refetch after removing via the id and its known file. We stored path server-side.
    await deleteClientDocument(doc.id, doc.storagePath)
    setDocs(await fetchClientDocuments(docSite))
    setDocBusy(false)
  }

  const withData = siteViews.filter((v) => v.hasData)
  const ranked = useMemo(() => [...withData].sort((a, b) => b.variance - a.variance), [withData])
  const totalActual = siteViews.reduce((s, v) => s + v.actual, 0)
  const totalTarget = siteViews.reduce((s, v) => s + v.target, 0)
  const groupVar = totalTarget ? Math.round(((totalActual - totalTarget) / totalTarget) * 100) : 0
  const avail = fleetAvailability(equipment)
  const down = equipment.filter((e) => e.status === 'breakdown').length

  const outstandingItems = sheq.filter((s) => s.status !== 'closed')
  const outstanding = outstandingItems.length
  const highRisk = withData.filter((v) => v.perfStatus !== 'on-track')

  function openOutstanding() {
    setDetail({
      title: 'Outstanding SHEQ items',
      subtitle: `${outstanding} open across all sites`,
      rows: outstandingItems.length
        ? outstandingItems.map((s) => ({ k: s.title, v: `${siteName(s.siteId)} · ${s.status}` }))
        : [{ k: 'Nothing outstanding', v: 'All clear' }],
    })
  }

  function openHighRisk() {
    setDetail({
      title: 'High-risk sites',
      subtitle: `${highRisk.length} not on track`,
      rows: highRisk.length
        ? highRisk.map((v) => ({ k: v.name, v: v.perfStatus.replace('-', ' ') }))
        : [{ k: 'All sites on track', v: 'No elevated risk' }],
    })
  }

  // Weekly trend, top 6 producing sites, from real daily reports.
  const topSites = ranked.slice(0, 6)
  const weekly = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - i))
      const iso = d.toISOString().slice(0, 10)
      const row: Record<string, number | string> = { label: formatDateLabel(iso) }
      topSites.forEach((v) => {
        row[v.code] = groupProduction
          .filter((r) => r.site_id === v.id && r.report_date === iso)
          .reduce((s, r) => s + r.production_tonnes_actual, 0)
      })
      return row
    })
  }, [groupProduction, topSites])

  const ranking = ranked.map((v) => ({
    name: v.code,
    value: v.actual,
    fill: v.variance >= 0 ? chartColors.ORANGE : v.variance < -10 ? '#ef4444' : '#f59e0b',
  }))

  // Every site, those with production first, so the PM sees the full estate.
  const performanceList = useMemo(
    () => [...siteViews].sort((a, b) => Number(b.hasData) - Number(a.hasData) || b.variance - a.variance),
    [siteViews],
  )

  // Live risk feed, derived from real signals: serious open/overdue SHEQ items
  // and sites running below production target. No seed data.
  const derivedRisks = useMemo(() => {
    const sev = (s: string) => ({ critical: 4, high: 3, medium: 2, low: 1 }[s] ?? 0)
    const fromSheq = sheq
      .filter((s) => (s.status === 'overdue' || s.status === 'open' || s.status === 'in_progress') && (s.severity === 'high' || s.severity === 'critical'))
      .map((s) => ({
        id: `sheq-${s.id}`,
        title: s.title,
        meta: `${siteName(s.siteId)} · ${s.status === 'overdue' ? 'overdue' : SHEQ_LABELS[s.type]}`,
        severity: s.severity as Severity,
      }))
    const fromProd = withData
      .filter((v) => v.variance < -8)
      .map((v) => ({
        id: `prod-${v.id}`,
        title: `${v.name} below production target`,
        meta: `${v.variance}% vs target`,
        severity: (v.variance < -15 ? 'critical' : 'high') as Severity,
      }))
    return [...fromSheq, ...fromProd].sort((a, b) => sev(b.severity) - sev(a.severity))
  }, [sheq, withData, siteName])

  return (
    <>
      <PageHeader
        title="Project Manager, Multi-Site Overview"
        subtitle="Production, equipment, SHEQ & risk across all operations"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Daily Production" value={totalActual.toLocaleString()} unit="t" delta={groupVar} icon={<TrendingUp className="h-5 w-5" />} accent={groupVar >= 0 ? 'green' : 'red'} delay={0} onClick={() => scrollTo('pm-trend')} hint="See trends" />
        <KpiCard label="Fleet Availability" value={avail} unit="%" icon={<Boxes className="h-5 w-5" />} accent="blue" sub={`${down} in breakdown`} delay={50} onClick={() => scrollTo('pm-risks')} hint="See downtime" />
        <KpiCard label="Outstanding SHEQ" value={outstanding} icon={<ShieldCheck className="h-5 w-5" />} accent="billnick" delay={100} onClick={openOutstanding} hint="View items" />
        <KpiCard label="High-Risk Sites" value={highRisk.length} icon={<AlertTriangle className="h-5 w-5" />} accent={highRisk.length ? 'red' : 'green'} delay={150} onClick={openHighRisk} hint="View sites" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Panel id="pm-trend" title="Weekly Production Trends" className="lg:col-span-3" icon={<TrendingUp className="h-4 w-4 text-billnick-500" />}>
          {topSites.length ? (
            <WeeklyTrend
              data={weekly}
              series={topSites.map((v) => ({ key: v.code, name: v.code }))}
            />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">
              No production reported yet. Trends appear as supervisors submit daily reports.
            </p>
          )}
        </Panel>
        <Panel title="Site Production Ranking" className="lg:col-span-2" icon={<Trophy className="h-4 w-4 text-billnick-500" />}>
          {ranking.length ? (
            <RankingBars data={ranking} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">No production data yet to rank sites.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Site Performance" icon={<Factory className="h-4 w-4 text-billnick-500" />}>
          {performanceList.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No sites yet. An executive adds them in Site Management.</p>
          ) : (
            <div className="space-y-2">
              {performanceList.map((v) => {
                const siteDown = equipment.filter((e) => e.siteId === v.id && e.status === 'breakdown').length
                return (
                  <div key={v.id} className="rounded-xl border border-ink-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-800">{v.name}</span>
                        {v.hasData
                          ? <SiteStatusBadge status={v.perfStatus} />
                          : <span className="pill bg-ink-100 text-ink-500">No data</span>}
                      </div>
                      {v.hasData && (
                        <span className={`pill ${v.variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {v.variance >= 0 ? '+' : ''}{v.variance}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-ink-400">Production</p>
                        <p className="font-semibold text-ink-700">{v.hasData ? `${v.actual.toLocaleString()}t` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-ink-400">Compliance</p>
                        <p className="font-semibold text-ink-700">{v.compliance}%</p>
                      </div>
                      <div>
                        <p className="text-ink-400">Breakdowns</p>
                        <p className="font-semibold text-ink-700">{siteDown}</p>
                      </div>
                    </div>
                    <div className="mt-2"><Progress value={v.target ? (v.actual / v.target) * 100 : 0} color={v.variance >= 0 ? 'green' : 'billnick'} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel id="pm-risks" title="Risks, Delays & Resource Issues" icon={<AlertTriangle className="h-4 w-4 text-red-500" />}>
          <div className="space-y-2">
            {derivedRisks.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">
                No high-risk items right now. This fills from serious SHEQ records and sites below target.
              </p>
            ) : (
              derivedRisks.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800">{r.title}</p>
                    <p className="text-xs text-ink-400">{r.meta}</p>
                  </div>
                  <SeverityBadge severity={r.severity} />
                </div>
              ))
            )}
          </div>

          <div className="mt-4 rounded-xl bg-ink-50 p-3">
            <p className="section-title mb-2">Equipment downtime</p>
            <div className="flex flex-wrap gap-2">
              {equipment.filter((e) => e.status === 'breakdown' || e.status === 'maintenance').map((e) => (
                <span key={e.id} className="pill bg-white text-ink-600 border border-ink-100">
                  <Wrench className="h-3 w-3 text-red-500" /> {e.name}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Client document publishing */}
      <Panel title="Publish Documents to Clients" className="mt-6" icon={<FileText className="h-4 w-4 text-billnick-500" />}>
        <p className="mb-4 text-sm text-ink-500">
          Upload a report or compliance document against a site. It appears in that site's Client
          Portal for the client to download.
        </p>

        <form onSubmit={publishDoc} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="doc-site">Site</label>
            <select id="doc-site" className="input" value={docSite} onChange={(e) => setDocSite(e.target.value)}>
              <option value="">Select site…</option>
              {realSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="doc-type">Type</label>
            <select id="doc-type" className="input" value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="doc-title">Title</label>
            <input id="doc-title" className="input" placeholder="e.g. Monthly Progress Report, July 2026" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="doc-file">File</label>
            <input
              id="doc-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-500 file:mr-3 file:rounded-lg file:border-0 file:bg-billnick-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-billnick-700 hover:file:bg-billnick-100"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={docBusy} className="btn-primary w-full disabled:opacity-60">
              {docBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Publish</>}
            </button>
          </div>
        </form>

        {docError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{docError}</p>}

        {docSite && (
          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="section-title mb-2">Published to {realSites.find((s) => s.id === docSite)?.name ?? 'this site'}</p>
            {docs.length === 0 ? (
              <p className="py-3 text-sm text-ink-400">No documents published to this site yet.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-800">{doc.title}</p>
                      <p className="text-xs text-ink-400">{doc.docType} · {prettyDate(doc.documentDate)} · {doc.fileName}</p>
                    </div>
                    <button onClick={() => removeDoc(doc)} disabled={docBusy} aria-label="Delete document" className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* KPI drill-down detail */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-ink-900">{detail.title}</h2>
                <p className="text-xs text-ink-500">{detail.subtitle}</p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="max-h-[60vh] overflow-y-auto px-6 py-4 text-sm">
              {detail.rows.map((r, i) => (
                <div key={i} className="flex items-start justify-between gap-4 border-b border-ink-50 py-2 last:border-0">
                  <dt className="min-w-0 text-ink-700">{r.k}</dt>
                  <dd className="shrink-0 text-right font-semibold capitalize text-ink-900">{r.v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-ink-100 px-6 py-4">
              <button onClick={() => setDetail(null)} className="btn-outline w-full">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
