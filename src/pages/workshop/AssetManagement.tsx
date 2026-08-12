import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { PageHeader, Panel, EquipStatusBadge } from '../../components/ui'
import { useData } from '../../state/DataContext'
import { createAsset, deleteAsset, updateAsset } from '../../lib/assets'
import type { AssetInput } from '../../lib/assets'
import { fetchAllSites } from '../../lib/sites'
import type { SiteOption } from '../../lib/sites'
import { EQUIPMENT_TYPES } from '../../types'
import type { Equipment, EquipmentStatus, EquipmentType, UsageUnit } from '../../types'

type SortKey = 'name' | 'type' | 'status' | 'site' | 'usage'

const STATUS_OPTIONS: { value: EquipmentStatus; label: string }[] = [
  { value: 'running',     label: 'Operational' },
  { value: 'idle',        label: 'Standby' },
  { value: 'maintenance', label: 'In Maintenance' },
  { value: 'breakdown',   label: 'Breakdown' },
]

// Road vehicles are measured in km, plant in engine hours. This decides the
// default unit when someone picks a category, but they can still override it.
const KM_CATEGORIES: EquipmentType[] = ['Light Vehicle']

interface FormState {
  name: string
  registration: string
  category: EquipmentType
  status: EquipmentStatus
  usageUnit: UsageUnit
  usageCurrent: string
  usageDue: string
  siteId: string
  location: string
}

function blankForm(): FormState {
  return {
    name: '', registration: '', category: 'Excavator', status: 'running',
    usageUnit: 'hours', usageCurrent: '', usageDue: '', siteId: '', location: '',
  }
}

function equipmentToForm(e: Equipment): FormState {
  return {
    name: e.name,
    registration: e.registration ?? '',
    category: e.type,
    status: e.status,
    usageUnit: e.usageUnit,
    usageCurrent: e.usageCurrent ? String(e.usageCurrent) : '',
    usageDue: e.usageDue ? String(e.usageDue) : '',
    siteId: e.siteId,
    location: e.location,
  }
}

export default function AssetManagement() {
  const { equipment, assetsAreReal, reloadAssets } = useData()
  const [sites, setSites] = useState<SiteOption[]>([])
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Equipment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // List controls: filter by category, sort by column, paginate.
  const [filterCat, setFilterCat] = useState<EquipmentType | 'All'>('All')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 12

  useEffect(() => {
    fetchAllSites().then(setSites)
  }, [])

  const siteName = useMemo(() => {
    const map = new Map(sites.map((s) => [s.id, s.name]))
    return (id: string) => map.get(id) ?? 'Unassigned'
  }, [sites])

  const processed = useMemo(() => {
    const list = filterCat === 'All' ? equipment : equipment.filter((e) => e.type === filterCat)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'type':   return a.type.localeCompare(b.type) * dir
        case 'status': return a.status.localeCompare(b.status) * dir
        case 'site':   return siteName(a.siteId).localeCompare(siteName(b.siteId)) * dir
        case 'usage':  return (a.usageCurrent - b.usageCurrent) * dir
        default:       return a.name.localeCompare(b.name) * dir
      }
    })
  }, [equipment, filterCat, sortKey, sortDir, siteName])

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = processed.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  // Keep the page in range as filters shrink the list.
  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1)
  }, [page, totalPages])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  function openAdd() {
    setEditing(null)
    setForm(blankForm())
    setErrors({})
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(e: Equipment) {
    setEditing(e)
    setForm(equipmentToForm(e))
    setErrors({})
    setSaveError('')
    setShowForm(true)
  }

  function pickCategory(category: EquipmentType) {
    setForm((f) => ({
      ...f,
      category,
      // Only auto-switch the unit if the user has not typed usage yet, so we
      // never silently change a unit they deliberately chose.
      usageUnit: f.usageCurrent || f.usageDue ? f.usageUnit : KM_CATEGORIES.includes(category) ? 'km' : 'hours',
    }))
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Give the asset a name.'
    if (!form.siteId) e.siteId = 'Assign the asset to a site.'
    if (form.usageCurrent && Number(form.usageCurrent) < 0) e.usageCurrent = 'Cannot be negative.'
    if (form.usageDue && Number(form.usageDue) < 0) e.usageDue = 'Cannot be negative.'
    return e
  }

  async function save() {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setSaving(true)
    setSaveError('')

    const input: AssetInput = {
      name: form.name.trim(),
      registration: form.registration.trim() || null,
      category: form.category,
      status: form.status,
      usageUnit: form.usageUnit,
      usageCurrent: Number(form.usageCurrent) || 0,
      usageDue: Number(form.usageDue) || 0,
      siteId: form.siteId || null,
      location: form.location.trim() || null,
    }

    const { error } = editing
      ? await updateAsset(editing.id, input)
      : await createAsset(input)

    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }

    await reloadAssets()
    setSaving(false)
    setShowForm(false)
  }

  async function doDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    const { error } = await deleteAsset(confirmDelete.id)
    if (error) {
      setSaveError(error)
      setDeleting(false)
      return
    }
    await reloadAssets()
    setDeleting(false)
    setConfirmDelete(null)
  }

  const unitLabel = (u: UsageUnit) => (u === 'km' ? 'km' : 'h')

  return (
    <>
      <PageHeader
        title="Asset Register"
        subtitle="Add, edit and retire fleet assets. This is the master list the dashboards read from."
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Asset
          </button>
        }
      />

      {!assetsAreReal && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-800">Showing sample assets</p>
            <p className="mt-0.5 text-sm text-amber-700">
              No assets have been added to the database yet, so the list below is illustrative.
              Add your first real asset and the sample fleet is replaced entirely.
            </p>
          </div>
        </div>
      )}

      <Panel
        title={`Assets (${processed.length}${filterCat !== 'All' ? ` of ${equipment.length}` : ''})`}
        icon={<Boxes className="h-4 w-4 text-billnick-500" />}
        action={
          <div className="flex flex-wrap gap-1.5">
            {(['All', ...EQUIPMENT_TYPES] as (EquipmentType | 'All')[]).map((t) => {
              const count = t === 'All' ? equipment.length : equipment.filter((e) => e.type === t).length
              if (t !== 'All' && count === 0) return null
              return (
                <button
                  key={t}
                  onClick={() => { setFilterCat(t); setPage(0) }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    filterCat === t ? 'bg-billnick-500 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                  }`}
                >
                  {t === 'All' ? 'All' : t}
                </button>
              )
            })}
          </div>
        }
      >
        {equipment.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-50">
              <Truck className="h-7 w-7 text-ink-300" />
            </span>
            <p className="mt-4 font-semibold text-ink-600">No assets yet</p>
            <p className="mt-1 text-sm text-ink-400">Add your first asset to build the register.</p>
            <button onClick={openAdd} className="btn-primary mt-6">
              <Plus className="h-4 w-4" /> Add Asset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400">
                  <SortableTh label="Asset" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pr-3" />
                  <SortableTh label="Category" col="type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Usage" col="usage" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-3 pb-2 font-semibold">Service Due</th>
                  <SortableTh label="Site" col="site" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-3 pb-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((e) => {
                  const remaining = e.usageDue - e.usageCurrent
                  const serviceKnown = e.usageDue > 0
                  return (
                    <tr key={e.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-ink-800">{e.name}</p>
                        {e.registration && <p className="text-xs text-ink-400">{e.registration}</p>}
                      </td>
                      <td className="px-3 py-3 text-ink-600">{e.type}</td>
                      <td className="px-3 py-3"><EquipStatusBadge status={e.status} /></td>
                      <td className="px-3 py-3 tabular-nums text-ink-600">
                        {e.usageCurrent > 0 ? `${e.usageCurrent.toLocaleString()} ${unitLabel(e.usageUnit)}` : <span className="text-ink-300">not set</span>}
                      </td>
                      <td className="px-3 py-3">
                        {!serviceKnown ? (
                          <span className="text-xs text-ink-300">not set</span>
                        ) : (
                          <span className={`pill ${remaining <= 0 ? 'bg-red-100 text-red-700' : remaining <= 200 ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>
                            {remaining <= 0 ? 'Overdue' : `${remaining.toLocaleString()} ${unitLabel(e.usageUnit)}`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-ink-500">
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-300" />{siteName(e.siteId)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(e)}
                            aria-label={`Edit ${e.name}`}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(e)}
                            aria-label={`Delete ${e.name}`}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                <span className="text-ink-400">
                  {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, processed.length)} of {processed.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                  <span className="px-2 text-xs text-ink-400">Page {safePage + 1} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-50 disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Add / edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-billnick-500" />
                <h2 className="font-bold text-ink-900">{editing ? 'Edit asset' : 'Add asset'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <FormField label="Asset name" error={errors.name}>
                <input
                  className={inputCls(errors.name)}
                  placeholder="e.g. Toyota Hilux (BNE 010)"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Registration">
                  <input
                    className="input"
                    placeholder="e.g. ADY 9290"
                    value={form.registration}
                    onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))}
                  />
                </FormField>
                <FormField label="Category">
                  <select className="input" value={form.category} onChange={(e) => pickCategory(e.target.value as EquipmentType)}>
                    {EQUIPMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Site" error={errors.siteId}>
                  <select
                    className={inputCls(errors.siteId)}
                    value={form.siteId}
                    onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                  >
                    <option value="">Select site…</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EquipmentStatus }))}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Location on site">
                <input
                  className="input"
                  placeholder="e.g. Haul Road A, Workshop Bay 1"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </FormField>

              {/* Usage unit toggle */}
              <div>
                <label className="label">Serviced on</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(['hours', 'km'] as UsageUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, usageUnit: u }))}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                        form.usageUnit === u
                          ? 'border-billnick-400 bg-billnick-50 text-billnick-700'
                          : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      {u === 'hours' ? 'Engine hours' : 'Kilometres'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={`Current reading (${form.usageUnit === 'km' ? 'km' : 'hrs'})`} error={errors.usageCurrent}>
                  <input
                    className={inputCls(errors.usageCurrent)}
                    type="number" min={0} placeholder="Optional"
                    value={form.usageCurrent}
                    onChange={(e) => setForm((f) => ({ ...f, usageCurrent: e.target.value }))}
                  />
                </FormField>
                <FormField label={`Service due at (${form.usageUnit === 'km' ? 'km' : 'hrs'})`} error={errors.usageDue}>
                  <input
                    className={inputCls(errors.usageDue)}
                    type="number" min={0} placeholder="Optional"
                    value={form.usageDue}
                    onChange={(e) => setForm((f) => ({ ...f, usageDue: e.target.value }))}
                  />
                </FormField>
              </div>
              <p className="text-xs text-ink-400">
                Leave the readings blank if you do not have them yet. The dashboard shows the asset
                without a service warning until they are filled in.
              </p>

              {saveError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>
              )}
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowForm(false)} disabled={saving} className="btn-outline flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? 'Save changes' : 'Add asset'}
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
                <Trash2 className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-ink-900">Delete {confirmDelete.name}?</h2>
              <p className="mt-1 text-sm text-ink-500">
                This removes the asset from the register permanently. To take a machine out of use
                without deleting its history, set its status to Breakdown or edit it instead.
              </p>
            </div>
            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="btn-outline flex-1">Cancel</button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SortableTh({
  label, col, sortKey, sortDir, onSort, className = '',
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sortKey === col
  return (
    <th className={`px-3 pb-2 font-semibold ${className}`}>
      <button
        onClick={() => onSort(col)}
        className={`-mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-ink-700 ${active ? 'text-ink-700' : ''}`}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

function inputCls(error?: string) {
  return error ? 'input border-red-300 focus:border-red-400 focus:ring-red-100' : 'input'
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
