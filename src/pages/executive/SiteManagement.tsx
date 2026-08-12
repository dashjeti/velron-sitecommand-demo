import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Droplets,
  Factory,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import {
  fetchSitesFull,
  createSite,
  updateSite,
  deleteSite,
} from '../../lib/sites'
import type { SiteRecord, SiteInput, SiteStatus } from '../../lib/sites'

const STATUSES: { value: SiteStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'care_maintenance', label: 'Care & Maintenance' },
]

interface FormState {
  name: string
  location: string
  region: string
  status: SiteStatus
  freeboardMin: string
  freeboardCritical: string
  source: string
}

const blank: FormState = {
  name: '', location: '', region: '', status: 'active',
  freeboardMin: '', freeboardCritical: '', source: '',
}

function toForm(s: SiteRecord): FormState {
  return {
    name: s.name,
    location: s.location ?? '',
    region: s.region ?? '',
    status: s.status,
    freeboardMin: s.freeboardMinM != null ? String(s.freeboardMinM) : '',
    freeboardCritical: s.freeboardCriticalM != null ? String(s.freeboardCriticalM) : '',
    source: s.thresholdsSource ?? '',
  }
}

export default function SiteManagement() {
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SiteRecord | null>(null)
  const [form, setForm] = useState<FormState>(blank)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<SiteRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    setSites(await fetchSitesFull())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm(blank); setFormError(''); setShowForm(true) }
  function openEdit(s: SiteRecord) { setEditing(s); setForm(toForm(s)); setFormError(''); setShowForm(true) }

  async function save() {
    if (!form.name.trim()) { setFormError('Enter the site name.'); return }

    setSaving(true); setFormError('')
    // TSF freeboard limits are managed per TSF facility on the SHEQ "TSF
    // Facilities" screen, so they are not set here.
    const input: SiteInput = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      region: form.region.trim() || null,
      status: form.status,
      freeboardMinM: editing?.freeboardMinM ?? null,
      freeboardCriticalM: editing?.freeboardCriticalM ?? null,
      thresholdsSource: editing?.thresholdsSource ?? null,
    }
    const { error } = editing ? await updateSite(editing.id, input) : await createSite(input)
    setSaving(false)
    if (error) { setFormError(error); return }
    setShowForm(false)
    await load()
  }

  async function doDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    const { error } = await deleteSite(confirmDelete.id)
    setDeleting(false)
    if (error) {
      setFormError(`Could not delete: ${error}. A site with reports or assets cannot be removed; set it Inactive instead.`)
      setConfirmDelete(null)
      return
    }
    setConfirmDelete(null)
    await load()
  }

  return (
    <>
      <PageHeader
        title="Site Management"
        subtitle="Add and edit sites, and set each facility's TSF freeboard safety limits"
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Site
          </button>
        }
      />

      {formError && !showForm && (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
      )}

      <Panel title={`Sites (${sites.length})`} icon={<Factory className="h-4 w-4 text-billnick-500" />}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : (
          <div className="space-y-2">
            {sites.map((s) => {
              return (
                <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-ink-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink-800">{s.name}</p>
                      <span className={`pill capitalize ${
                        s.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'inactive' ? 'bg-ink-100 text-ink-500' : 'bg-amber-100 text-amber-700'
                      }`}>{s.status.replace('_', ' ')}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400">
                      <MapPin className="h-3 w-3" />{[s.location, s.region].filter(Boolean).join(', ') || 'No location set'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(s)} aria-label={`Delete ${s.name}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Add / edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-billnick-500" />
                <h2 className="font-bold text-ink-900">{editing ? 'Edit site' : 'Add site'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="label" htmlFor="s-name">Site name</label>
                <input id="s-name" className="input" placeholder="e.g. Muriel Mine" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="s-loc">Location</label>
                  <input id="s-loc" className="input" placeholder="e.g. Bindura" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="label" htmlFor="s-region">Region</label>
                  <input id="s-region" className="input" placeholder="e.g. Mash Central" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
                </div>
                <div>
                  <label className="label" htmlFor="s-status">Status</label>
                  <select id="s-status" className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SiteStatus }))}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                TSF facilities and their freeboard limits are managed by the SHEQ officer on the
                <b> TSF Facilities</b> screen, since each TSF has its own limits.
              </p>

              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowForm(false)} disabled={saving} className="btn-outline flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? 'Save changes' : 'Add site'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-ink-900">Delete {confirmDelete.name}?</h2>
              <p className="mt-1 text-sm text-ink-500">
                A site that already has reports, assets or records cannot be deleted. If it is no
                longer operating, set it to Inactive instead to keep its history.
              </p>
            </div>
            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="btn-outline flex-1">Cancel</button>
              <button onClick={doDelete} disabled={deleting} className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60">
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : 'Delete site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
