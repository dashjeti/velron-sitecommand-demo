import { useEffect, useMemo, useState } from 'react'
import { Droplets, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { fetchSitesFull } from '../../lib/sites'
import type { SiteRecord } from '../../lib/sites'
import {
  fetchTsfFacilities,
  createTsfFacility,
  updateTsfFacility,
  deleteTsfFacility,
} from '../../lib/tsf'
import type { TsfFacility, TsfFacilityInput } from '../../lib/tsf'

interface FormState {
  name: string
  min: string
  crit: string
  source: string
}

const blank: FormState = { name: '', min: '', crit: '', source: '' }

export default function TsfLimits() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [facilities, setFacilities] = useState<TsfFacility[]>([])
  const [loading, setLoading] = useState(true)

  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editingFacility, setEditingFacility] = useState<TsfFacility | null>(null)
  const [form, setForm] = useState<FormState>(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<TsfFacility | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [s, f] = await Promise.all([fetchSitesFull(), fetchTsfFacilities()])
    setSites(s)
    setFacilities(f)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // A per-site SHEQ officer manages only their own site's TSFs.
  const visibleSites = user?.siteId ? sites.filter((s) => s.id === user.siteId) : sites

  const bySite = useMemo(() => {
    const m = new Map<string, TsfFacility[]>()
    for (const f of facilities) {
      const list = m.get(f.siteId) ?? []
      list.push(f)
      m.set(f.siteId, list)
    }
    return m
  }, [facilities])

  function openAdd(siteId: string) {
    setEditingSiteId(siteId)
    setEditingFacility(null)
    setForm(blank)
    setError('')
  }
  function openEdit(f: TsfFacility) {
    setEditingSiteId(f.siteId)
    setEditingFacility(f)
    setForm({
      name: f.name,
      min: f.freeboardMinM != null ? String(f.freeboardMinM) : '',
      crit: f.freeboardCriticalM != null ? String(f.freeboardCriticalM) : '',
      source: f.thresholdsSource ?? '',
    })
    setError('')
  }
  function closeForm() { setEditingSiteId(null); setEditingFacility(null) }

  async function save() {
    if (!editingSiteId) return
    if (!form.name.trim()) { setError('Give the TSF a name (e.g. TSF 1).'); return }
    const min = form.min === '' ? null : Number(form.min)
    const crit = form.crit === '' ? null : Number(form.crit)
    if (min !== null && Number.isNaN(min)) { setError('Advisory minimum must be a number.'); return }
    if (crit !== null && Number.isNaN(crit)) { setError('Critical level must be a number.'); return }
    if (min !== null && crit !== null && crit >= min) {
      setError('The critical level should be lower than the advisory minimum.')
      return
    }
    if ((min !== null || crit !== null) && !form.source.trim()) {
      setError('Add the source for the limits (document and engineer), for the audit trail.')
      return
    }

    setSaving(true); setError('')
    const input: TsfFacilityInput = {
      name: form.name.trim(),
      freeboardMinM: min,
      freeboardCriticalM: crit,
      thresholdsSource: form.source.trim() || null,
    }
    const { error: err } = editingFacility
      ? await updateTsfFacility(editingFacility.id, input)
      : await createTsfFacility(editingSiteId, input)
    setSaving(false)
    if (err) { setError(err); return }
    closeForm()
    await load()
  }

  async function doDelete() {
    if (!confirmDelete) return
    setBusy(true)
    const { error: err } = await deleteTsfFacility(confirmDelete.id)
    setBusy(false)
    setConfirmDelete(null)
    if (!err) await load()
  }

  return (
    <>
      <PageHeader
        title="TSF Facilities & Freeboard Limits"
        subtitle="Add each site's TSFs and set each one's advisory & critical freeboard levels"
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="m-0">
          Each TSF has its own safe levels, signed off by the dam engineer. Until a TSF's limits are
          set, its readings show without a safe or unsafe verdict rather than assume one. The critical
          level must be lower than the advisory minimum. Sites with no TSF need none added.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
      ) : visibleSites.length === 0 ? (
        <Panel><p className="py-6 text-center text-sm text-ink-400">No sites yet. An executive adds sites in Site Management first.</p></Panel>
      ) : (
        <div className="space-y-4">
          {visibleSites.map((s) => {
            const list = bySite.get(s.id) ?? []
            return (
              <Panel
                key={s.id}
                title={s.name}
                icon={<Droplets className="h-4 w-4 text-blue-500" />}
                action={
                  <button onClick={() => openAdd(s.id)} className="btn-primary px-3 py-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add TSF
                  </button>
                }
              >
                {list.length === 0 ? (
                  <p className="py-3 text-sm text-ink-400">No TSFs on this site. Add one if it has a tailings facility.</p>
                ) : (
                  <div className="space-y-2">
                    {list.map((f) => {
                      const hasLimits = f.freeboardMinM != null || f.freeboardCriticalM != null
                      return (
                        <div key={f.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-800">{f.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                              <Droplets className={`h-3 w-3 ${hasLimits ? 'text-blue-500' : 'text-ink-300'}`} />
                              {hasLimits ? (
                                <span className="text-ink-500">
                                  {f.freeboardMinM != null ? `Advisory ${f.freeboardMinM}m` : 'No advisory'}
                                  {' · '}
                                  {f.freeboardCriticalM != null ? `Critical ${f.freeboardCriticalM}m` : 'No critical'}
                                </span>
                              ) : (
                                <span className="text-amber-600">No limits set, alerting off for this TSF</span>
                              )}
                            </p>
                            {f.thresholdsSource && <p className="mt-0.5 text-xs text-ink-400">Source: {f.thresholdsSource}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={() => openEdit(f)} aria-label={`Edit ${f.name}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setConfirmDelete(f)} aria-label={`Delete ${f.name}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      )}

      {/* Add / edit TSF */}
      {editingSiteId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                <h2 className="font-bold text-ink-900">{editingFacility ? 'Edit TSF' : 'Add TSF'}</h2>
              </div>
              <button onClick={closeForm} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="label" htmlFor="t-name">TSF name</label>
                <input id="t-name" className="input" placeholder="e.g. TSF 1, North TSF" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="t-min">Advisory minimum (m)</label>
                  <input id="t-min" className="input" type="number" step="0.01" min={0} placeholder="e.g. 1.50" value={form.min} onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))} />
                </div>
                <div>
                  <label className="label" htmlFor="t-crit">Critical (m)</label>
                  <input id="t-crit" className="input" type="number" step="0.01" min={0} placeholder="e.g. 1.00" value={form.crit} onChange={(e) => setForm((f) => ({ ...f, crit: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="t-source">Source (document + engineer)</label>
                <input id="t-source" className="input" placeholder="e.g. TSF design report rev C, J. Moyo Pr.Eng, 2026-05-11" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
                <p className="mt-1 text-xs text-ink-400">Records who signed the limits off, for the audit trail. Leave limits blank until the engineer confirms.</p>
              </div>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={closeForm} disabled={saving} className="btn-outline flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editingFacility ? 'Save changes' : 'Add TSF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h2 className="font-bold text-ink-900">Delete {confirmDelete.name}?</h2>
            <p className="mt-1 text-sm text-ink-500">This removes the TSF and its readings. This cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={busy} className="btn-outline flex-1">Cancel</button>
              <button onClick={doDelete} disabled={busy} className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
