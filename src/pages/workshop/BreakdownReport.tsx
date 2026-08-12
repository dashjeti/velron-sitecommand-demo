import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Wrench } from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useData } from '../../state/DataContext'
import { useAuth } from '../../state/AuthContext'
import { createBreakdown } from '../../lib/breakdowns'
import type { Severity } from '../../types'

const severities: Severity[] = ['low', 'medium', 'high', 'critical']

export default function BreakdownReport() {
  const { equipment, reloadBreakdowns, reloadAssets } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [assetId, setAssetId] = useState(equipment[0]?.id ?? '')
  const [issue, setIssue] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [downtime, setDowntime] = useState(8)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const asset = equipment.find((e) => e.id === assetId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asset) return
    if (!issue.trim()) {
      setSubmitError('Describe the fault before logging it.')
      return
    }
    setSubmitting(true)
    setSubmitError('')

    const { error } = await createBreakdown({
      assetId: asset.id,
      issue: issue.trim(),
      severity,
      estDowntimeHrs: downtime,
      reportedById: user?.id,
    })

    if (error) {
      setSubmitError(error)
      setSubmitting(false)
      return
    }

    await Promise.all([reloadBreakdowns(), reloadAssets()])
    setSubmitted(true)
    setTimeout(() => navigate('/workshop'), 1400)
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-scale-in">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-ink-900">Breakdown logged</h2>
        <p className="mt-1 text-sm text-ink-500">
          {asset?.name} flagged as down, fleet dashboard updated.
        </p>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Create Breakdown Report" subtitle="Log an equipment failure and estimated downtime" />

      <form onSubmit={submit} className="mx-auto max-w-2xl">
        <Panel icon={<Wrench className="h-4 w-4 text-red-500" />} title="Breakdown Details">
          <div className="space-y-4">
            <div>
              <label className="label">Asset</label>
              <select className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id}, {e.name} ({e.type})
                  </option>
                ))}
              </select>
              {asset && (
                <p className="mt-1.5 text-xs text-ink-400">
                  Current status: {asset.status}{asset.usageCurrent > 0 ? ` · ${asset.usageCurrent.toLocaleString()} ${asset.usageUnit === 'km' ? 'km' : 'engine hrs'}` : ''}{asset.location ? ` · ${asset.location}` : ''}
                </p>
              )}
            </div>

            <div>
              <label className="label">Issue Description</label>
              <textarea
                required
                className="input min-h-[110px] resize-y"
                placeholder="Describe the fault, symptoms, when it started, suspected cause…"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Severity</label>
              <div className="grid grid-cols-4 gap-2">
                {severities.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition-all ${
                      severity === s
                        ? s === 'critical'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : s === 'high'
                            ? 'border-orange-300 bg-orange-50 text-orange-700'
                            : s === 'medium'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-ink-300 bg-ink-50 text-ink-700'
                        : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Estimated Downtime (hours)</label>
              <input
                className="input"
                type="number"
                min={1}
                value={downtime}
                onChange={(e) => setDowntime(Number(e.target.value) || 0)}
              />
              <input
                type="range"
                min={1}
                max={72}
                value={downtime}
                onChange={(e) => setDowntime(Number(e.target.value))}
                className="mt-3 w-full accent-billnick-500"
              />
              <div className="mt-1 flex justify-between text-xs text-ink-400">
                <span>1h</span><span>≈ {(downtime / 24).toFixed(1)} days</span><span>72h</span>
              </div>
            </div>

            {submitError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
              {submitting ? 'Logging…' : 'Submit Breakdown Report'}
            </button>
          </div>
        </Panel>
      </form>
    </>
  )
}
