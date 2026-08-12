import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FileWarning,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { submitSheqRecord, uploadSheqAttachments } from '../../lib/sheq'
import type { Severity, SheqType } from '../../types'
import { SHEQ_LABELS } from '../../types'

const recordTypes: { type: SheqType; icon: React.ReactNode; desc: string }[] = [
  { type: 'inspection',        icon: <ShieldCheck className="h-5 w-5" />,   desc: 'Routine safety check' },
  { type: 'near_miss',         icon: <AlertTriangle className="h-5 w-5" />, desc: 'Potential incident' },
  { type: 'incident',          icon: <FileWarning className="h-5 w-5" />,   desc: 'Reportable event' },
  { type: 'environmental',     icon: <Leaf className="h-5 w-5" />,          desc: 'Environmental check' },
  { type: 'audit',             icon: <ClipboardCheck className="h-5 w-5" />,desc: 'Audit observation' },
  { type: 'toolbox_talk',      icon: <FileText className="h-5 w-5" />,      desc: 'Safety briefing' },
  { type: 'corrective_action', icon: <RefreshCw className="h-5 w-5" />,     desc: 'Remediation task' },
]

const severities: { value: Severity; label: string }[] = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export default function SheqRecordForm() {
  const { user } = useAuth()
  const { reloadSheq, realSites } = useData()
  const navigate = useNavigate()

  const todayDisplay = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [type, setType] = useState<SheqType>('inspection')
  // site_id is a uuid column, so the picker must offer real Supabase sites.
  // Mock ids like 'muriel' are rejected by Postgres.
  const [siteId, setSiteId] = useState(user?.siteId ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('low')
  const [dueDate, setDueDate] = useState('')
  const [findings, setFindings] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...picked])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (!siteId) {
      setSubmitError('Select the site this record belongs to.')
      return
    }
    setSubmitting(true)
    setSubmitError('')

    const { id, error } = await submitSheqRecord({
      siteId,
      recordType: type,
      severity,
      title: title.trim(),
      description: description.trim() || undefined,
      conductedById: user?.id,
      dueDate: dueDate || undefined,
      findings: findings.trim() || undefined,
    })

    if (error) {
      setSubmitError(error)
      setSubmitting(false)
      return
    }

    // Upload any attachments now that we have the record id
    if (id && files.length > 0) {
      await uploadSheqAttachments(id, files)
    }

    // Refetch the live register so the new record carries its real DB id and is
    // therefore editable and deletable (an optimistic copy would have a fake id).
    await reloadSheq()

    setSubmitted(true)
    setTimeout(() => navigate('/sheq'), 1400)
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-scale-in">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-ink-900">Record submitted</h2>
        <p className="mt-1 text-sm text-ink-500">Added to the live SHEQ register.</p>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="New SHEQ Record"
        subtitle={`${todayDisplay} · ${user?.name ?? ''}`}
      />

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Record type */}
          <Panel title="Record Type">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recordTypes.map((rt) => (
                <button
                  key={rt.type}
                  type="button"
                  onClick={() => setType(rt.type)}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                    type === rt.type
                      ? 'border-billnick-300 bg-billnick-50 text-billnick-700'
                      : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {rt.icon}
                  <span className="text-sm font-semibold leading-tight">{SHEQ_LABELS[rt.type]}</span>
                  <span className="text-xs text-ink-400">{rt.desc}</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Details */}
          <Panel title="Details">
            <div className="space-y-4">
              <div>
                <label className="label">Title / Description</label>
                <input
                  required
                  className="input"
                  placeholder="Brief summary of the record"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Full Description</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  placeholder="Detailed description, persons involved, circumstances…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">Site</label>
                  <select
                    className="input disabled:bg-ink-50 disabled:text-ink-500"
                    value={siteId}
                    disabled={!!user?.siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                  >
                    <option value="">Select site…</option>
                    {realSites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {user?.siteId && (
                    <p className="mt-1 text-xs text-ink-400">Records file against your site.</p>
                  )}
                </div>
                <div>
                  <label className="label">Severity</label>
                  <select
                    className="input"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                  >
                    {severities.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input
                    type="date"
                    className="input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              {(type === 'audit' || type === 'corrective_action' || type === 'incident') && (
                <div>
                  <label className="label">Initial Findings / Immediate Action</label>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    placeholder="What was found or what immediate action was taken?"
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                  />
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Panel title="Attachments" icon={<FileText className="h-4 w-4 text-billnick-500" />}>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-4 py-6 text-center transition-colors hover:border-billnick-300 hover:bg-billnick-50/40">
              <Upload className="h-6 w-6 text-ink-300" />
              <span className="text-sm font-medium text-ink-600">Photos, documents</span>
              <span className="text-xs text-ink-400">PDF, PNG, JPG</span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={onUpload}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600"
                  >
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-ink-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {submitError && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="btn-primary w-full disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Record'}
          </button>
          <p className="text-center text-xs text-ink-400">
            Saves to the live SHEQ register instantly.
          </p>
        </div>
      </form>
    </>
  )
}
