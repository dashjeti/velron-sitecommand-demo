import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  FileBadge,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react'
import { PageHeader, Panel, SeverityBadge, SheqStatusBadge } from '../../components/ui'
import { useData } from '../../state/DataContext'
import { fetchSheqRecordDetail, sheqAttachmentUrl } from '../../lib/sheq'
import type { SheqRecordDetail } from '../../lib/sheq'
import { fetchTeam } from '../../lib/team'
import type { TeamMember } from '../../lib/team'
import { prettyDay } from '../../lib/dates'
import { SHEQ_LABELS } from '../../types'
import type { SheqType } from '../../types'

/**
 * Everything the SHEQ officers have submitted, in one browsable list with the
 * full text of each record. The compliance dashboard at /sheq is the working
 * view for an officer; this is the manager's read-through of the team's output,
 * and the counterpart to Submitted Reports on the operations side.
 */
export default function SheqSubmittedRecords() {
  const { sheq, siteName, realSites, reloadSheq } = useData()

  const [officers, setOfficers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSite, setFilterSite] = useState('')
  const [filterOfficer, setFilterOfficer] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [detail, setDetail] = useState<SheqRecordDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [team] = await Promise.all([fetchTeam(['sheq', 'sheq_manager']), reloadSheq()])
    setOfficers(team)
    setLoading(false)
  }, [reloadSheq])

  useEffect(() => { load() }, [load])

  const rows = useMemo(
    () =>
      sheq.filter(
        (r) =>
          (!filterSite || r.siteId === filterSite) &&
          (!filterOfficer || r.raisedById === filterOfficer) &&
          (!filterType || r.type === filterType) &&
          (!filterStatus || r.status === filterStatus),
      ),
    [sheq, filterSite, filterOfficer, filterType, filterStatus],
  )

  async function openDetail(id: string) {
    setDetailLoading(true)
    setDetail(await fetchSheqRecordDetail(id))
    setDetailLoading(false)
  }

  async function openAttachment(path: string) {
    const url = await sheqAttachmentUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
  }

  const isFiltered = Boolean(filterSite || filterOfficer || filterType || filterStatus)

  return (
    <>
      <PageHeader
        title="Submitted Records"
        subtitle="Every SHEQ record raised by an officer, newest first"
        action={
          <button onClick={load} disabled={loading} className="btn-outline text-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Refresh
          </button>
        }
      />

      <Panel className="mb-4" title="Filter">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="f-site">Site</label>
            <select id="f-site" className="input py-1.5 text-sm" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
              <option value="">All sites</option>
              {realSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-officer">Raised by</label>
            <select id="f-officer" className="input py-1.5 text-sm" value={filterOfficer} onChange={(e) => setFilterOfficer(e.target.value)}>
              <option value="">All officers</option>
              {officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-type">Type</label>
            <select id="f-type" className="input py-1.5 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {(Object.keys(SHEQ_LABELS) as SheqType[]).map((t) => <option key={t} value={t}>{SHEQ_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-status">Status</label>
            <select id="f-status" className="input py-1.5 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Any status</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="overdue">Overdue</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel title={`Records (${rows.length})`} icon={<ClipboardList className="h-4 w-4 text-billnick-500" />}>
        {loading && sheq.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ink-400">
              {isFiltered ? 'No records match these filters.' : 'No SHEQ records have been submitted yet.'}
            </p>
            {!isFiltered && (
              <p className="mx-auto mt-2 max-w-md text-xs text-ink-400">
                Officers raise incidents, near misses, inspections, toolbox talks and corrective
                actions from their own SHEQ screen. Everything they submit appears here in full,
                including findings, corrective actions and any files attached.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="px-3 pb-2 font-semibold">Site</th>
                  <th className="px-3 pb-2 font-semibold">Raised by</th>
                  <th className="px-3 pb-2 font-semibold">Type</th>
                  <th className="px-3 pb-2 font-semibold">Severity</th>
                  <th className="px-3 pb-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className="cursor-pointer border-b border-ink-50 last:border-0 hover:bg-ink-50/50"
                  >
                    <td className="py-3 pr-3 font-semibold text-ink-800">{prettyDay(r.date)}</td>
                    <td className="px-3 py-3 text-ink-600">{siteName(r.siteId)}</td>
                    <td className="px-3 py-3 text-ink-600">{r.raisedBy}</td>
                    <td className="px-3 py-3 text-ink-600">{SHEQ_LABELS[r.type]}</td>
                    <td className="px-3 py-3"><SeverityBadge severity={r.severity} /></td>
                    <td className="px-3 py-3 text-right"><SheqStatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
              <div className="min-w-0">
                <h2 className="font-bold leading-snug text-ink-900">{detail.title}</h2>
                <p className="text-xs text-ink-400">
                  {SHEQ_LABELS[detail.type]} · {siteName(detail.siteId)} · {prettyDay(detail.date)}
                </p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={detail.severity} />
                <SheqStatusBadge status={detail.status} />
                {detail.dueDate && (
                  <span className="pill bg-ink-100 text-ink-600">Due {prettyDay(detail.dueDate)}</span>
                )}
              </div>

              <div className="rounded-xl border border-ink-100 p-3">
                <p className="text-xs text-ink-400">Raised by</p>
                <p className="font-semibold text-ink-800">{detail.raisedBy}</p>
              </div>

              <Section title="What was reported" body={detail.description} />
              <Section title="Findings" body={detail.findings} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
              <Section title="Corrective action" body={detail.correctiveAction} icon={<FileBadge className="h-4 w-4 text-billnick-500" />} />

              <div>
                <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink-700">
                  <Paperclip className="h-4 w-4 text-ink-400" /> Attachments
                </p>
                {detail.attachments.length === 0 ? (
                  <p className="text-xs text-ink-400">None attached.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.attachments.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => openAttachment(a.storagePath)}
                          className="w-full truncate rounded-lg bg-ink-50 px-3 py-2 text-left text-xs font-medium text-billnick-700 hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-billnick-400"
                        >
                          {a.fileName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-t border-ink-100 px-6 py-4">
              <button onClick={() => setDetail(null)} className="btn-outline w-full">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, body, icon }: { title: string; body: string | null; icon?: ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink-700">{icon}{title}</p>
      {body ? (
        <p className="whitespace-pre-wrap text-ink-600">{body}</p>
      ) : (
        <p className="text-xs text-ink-400">Not recorded.</p>
      )}
    </div>
  )
}
