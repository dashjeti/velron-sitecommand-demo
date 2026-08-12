import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  Droplets,
  Factory,
  Fuel,
  Gauge,
  HardHat,
  ImagePlus,
  Info,
  Package,
  Plus,
  Timer,
  Truck,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { updateAssetReadings } from '../../lib/assets'
import { fetchSite, getTodayReport, submitDailyReport } from '../../lib/reports'
import type {
  DelayEntry,
  DelayType,
  MaterialEntry,
  SiteInfo,
  WeatherCondition,
} from '../../lib/reports'
import { fetchTsfFacilities } from '../../lib/tsf'
import type { TsfFacility } from '../../lib/tsf'

interface TsfBlock {
  freeboard: number
  poolDepth: number
  rwd: number // return-water-dam level, now a percentage
  deposited: number
  ahead: number
  pzA: number
  pzB: number
  pzC: number
}
const emptyTsfBlock: TsfBlock = { freeboard: 0, poolDepth: 0, rwd: 0, deposited: 0, ahead: 0, pzA: 0, pzB: 0, pzC: 0 }

const WEATHER_OPTIONS: WeatherCondition[] = [
  'Clear', 'Overcast', 'Light Rain', 'Heavy Rain', 'Dust Storm', 'Fog',
]

const DELAY_TYPES: { value: DelayType; label: string }[] = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'weather',   label: 'Weather' },
  { value: 'supply',    label: 'Supply' },
  { value: 'power',     label: 'Power' },
  { value: 'labour',    label: 'Labour' },
  { value: 'other',     label: 'Other' },
]

const MATERIAL_UNITS = ['tonnes', 'kg', 'litres', 'm3', 'units']

type FormErrors = Record<string, string>

export default function DailyReport() {
  const { user } = useAuth()
  const { equipment, reloadAssets } = useData()
  const navigate = useNavigate()
  const siteId = user!.siteId!

  // Assets on this supervisor's site, so they can update meter readings.
  const siteAssets = equipment.filter((e) => e.siteId === siteId)
  // reading input per asset id, keyed as string; blank means "no change"
  const [readings, setReadings] = useState<Record<string, string>>({})

  const [site, setSite] = useState<SiteInfo | null>(null)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showConfirm, setShowConfirm] = useState(false)

  const todayDisplay = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    async function init() {
      const [siteData, existing, facs] = await Promise.all([
        fetchSite(siteId),
        getTodayReport(siteId),
        fetchTsfFacilities(siteId),
      ])
      setSite(siteData)
      setFacilities(facs)
      setTsfReadings(Object.fromEntries(facs.map((f) => [f.id, { ...emptyTsfBlock }])))
      if (existing) setAlreadySubmitted(true)
      setInitLoading(false)
    }
    if (siteId) init()
  }, [siteId])

  const [form, setForm] = useState({
    tonnesProcessed: 0,
    target: 0,
    actualOutput: 0,
    fuel: 0,
    equipRunning: 0,
    equipIdle: 0,
    equipBreakdown: 0,
    weather: '' as WeatherCondition | 'Other' | '',
    weatherOther: '',
    weatherTempMin: '' as string,
    weatherTempMax: '' as string,
    rainfallMm: '' as string,
    windSpeed: '' as string,
    windDirection: '' as string,
    humidity: '' as string,
    labour: {
      totalWorkers: 0,
      present: 0,
      absent: 0,
      absentReason: '',
      overtimeHours: 0,
    },
    notes: '',
  })
  // One reading block per TSF facility on this site.
  const [facilities, setFacilities] = useState<TsfFacility[]>([])
  const [tsfReadings, setTsfReadings] = useState<Record<string, TsfBlock>>({})
  const [delays, setDelays] = useState<DelayEntry[]>([])
  const [materials, setMaterials] = useState<MaterialEntry[]>([])
  const [photo, setPhoto] = useState<File | null>(null)

  const num = (k: 'tonnesProcessed' | 'target' | 'actualOutput' | 'fuel' | 'equipRunning' | 'equipIdle' | 'equipBreakdown', v: string) => {
    setForm((f) => ({ ...f, [k]: Number(v) || 0 }))
    clearError(k)
  }

  const setTsfReading = (facilityId: string, k: keyof TsfBlock, v: string) => {
    setTsfReadings((prev) => ({
      ...prev,
      [facilityId]: { ...(prev[facilityId] ?? emptyTsfBlock), [k]: Number(v) || 0 },
    }))
    clearError(`${facilityId}.${k}`)
  }

  const setLabour = (k: keyof typeof form.labour, v: string) => {
    setForm((f) => ({
      ...f,
      labour: { ...f.labour, [k]: k === 'absentReason' ? v : Number(v) || 0 },
    }))
    clearError(k)
  }

  const clearError = (k: string) =>
    setErrors((e) => {
      if (!e[k]) return e
      const next = { ...e }
      delete next[k]
      return next
    })

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPhoto(file)
  }

  function validate(): FormErrors {
    const e: FormErrors = {}

    if (form.tonnesProcessed <= 0) e.tonnesProcessed = 'Enter the tonnes processed this shift.'
    if (form.target <= 0) e.target = 'Enter the target output for this shift.'
    if (form.actualOutput <= 0) e.actualOutput = 'Enter the actual output for this shift.'
    if (form.actualOutput > form.tonnesProcessed && form.tonnesProcessed > 0) {
      e.actualOutput = 'Actual output cannot exceed tonnes processed.'
    }

    if (form.fuel <= 0) e.fuel = 'Enter the fuel consumed this shift.'

    if (form.equipRunning + form.equipIdle + form.equipBreakdown === 0) {
      e.equipRunning = 'Record at least one equipment unit.'
    }

    if (!form.weather) e.weather = 'Select the weather conditions.'
    if (form.weather === 'Other' && !form.weatherOther.trim()) {
      e.weatherOther = 'Describe the weather conditions.'
    }

    const { totalWorkers, present, absent } = form.labour
    if (totalWorkers <= 0) e.totalWorkers = 'Enter the crew size.'
    else if (present + absent !== totalWorkers) {
      e.present = `Present plus absent must equal ${totalWorkers}.`
    }
    if (absent > 0 && !form.labour.absentReason.trim()) {
      e.absentReason = 'Give a reason for the absences.'
    }

    for (const f of facilities) {
      const r = tsfReadings[f.id]
      if (!r || r.freeboard <= 0) e[`${f.id}.freeboard`] = 'Required.'
      if (!r || r.poolDepth <= 0) e[`${f.id}.poolDepth`] = 'Required.'
      if (!r || r.rwd <= 0) e[`${f.id}.rwd`] = 'Required.'
      if (!r || r.pzA <= 0) e[`${f.id}.pzA`] = 'Required.'
      if (!r || r.pzB <= 0) e[`${f.id}.pzB`] = 'Required.'
      if (!r || r.pzC <= 0) e[`${f.id}.pzC`] = 'Required.'
    }

    delays.forEach((d, i) => {
      if (!d.description.trim()) e[`delay-${i}-desc`] = 'Describe the delay.'
      if (d.durationHours <= 0) e[`delay-${i}-dur`] = 'Enter a duration.'
    })

    materials.forEach((m, i) => {
      if (!m.name.trim()) e[`material-${i}-name`] = 'Name the material.'
      if (m.quantity <= 0) e[`material-${i}-qty`] = 'Enter a quantity.'
    })

    return e
  }

  const review = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setShowConfirm(true)
  }

  const confirmSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')

    const { error } = await submitDailyReport({
      siteId,
      submittedBy: user!.id,
      tonnesProcessed: form.tonnesProcessed,
      targetTonnes: form.target,
      actualOutput: form.actualOutput,
      notes: form.notes,
      fuel: form.fuel,
      equipRunning: form.equipRunning,
      equipIdle: form.equipIdle,
      equipBreakdown: form.equipBreakdown,
      weather: form.weather === 'Other' ? form.weatherOther.trim() : form.weather,
      weatherTempMinC: form.weatherTempMin === '' ? null : Number(form.weatherTempMin),
      weatherTempMaxC: form.weatherTempMax === '' ? null : Number(form.weatherTempMax),
      rainfallMm: form.rainfallMm === '' ? null : Number(form.rainfallMm),
      windSpeedKmh: form.windSpeed === '' ? null : Number(form.windSpeed),
      windDirection: form.windDirection || null,
      humidityPct: form.humidity === '' ? null : Number(form.humidity),
      labour: form.labour,
      delays,
      materials,
      tsf: facilities.map((f) => {
        const r = tsfReadings[f.id] ?? emptyTsfBlock
        return {
          facilityId: f.id,
          freeboard: r.freeboard,
          poolDepth: r.poolDepth,
          returnWaterDamLevel: r.rwd,
          depositedPaddocks: r.deposited,
          paddocksAheadOfDeposition: r.ahead,
          piezometerA: r.pzA,
          piezometerB: r.pzB,
          piezometerC: r.pzC,
        }
      }),
      photo: photo ?? undefined,
    })

    if (error) {
      setSubmitError(error)
      setSubmitting(false)
      setShowConfirm(false)
    } else {
      // Advance any asset meter readings the supervisor entered.
      const readingUpdates = siteAssets
        .map((a) => ({ id: a.id, reading: Number(readings[a.id]) }))
        .filter((u) => readings[u.id] !== undefined && readings[u.id] !== '' && u.reading > 0)
      if (readingUpdates.length) {
        await updateAssetReadings(readingUpdates)
        await reloadAssets()
      }
      setSubmitted(true)
      setTimeout(() => navigate('/supervisor'), 1500)
    }
  }

  if (initLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-billnick-500 border-t-transparent" />
      </div>
    )
  }

  if (!siteId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="font-semibold text-ink-800">No site assigned</p>
        <p className="text-sm text-ink-500">Contact your administrator to assign you to a site.</p>
      </div>
    )
  }

  if (alreadySubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center animate-scale-in">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h2 className="text-xl font-extrabold text-ink-900">Already submitted today</h2>
        <p className="text-sm text-ink-500">
          {site?.name ?? 'Your site'}'s daily report has been submitted for {todayDisplay}.
        </p>
        <button onClick={() => navigate('/supervisor')} className="btn-primary mt-2">
          Back to dashboard
        </button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-scale-in">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-ink-900">Report submitted</h2>
        <p className="mt-1 text-sm text-ink-500">
          {site?.name} dashboard is updating in real time…
        </p>
      </div>
    )
  }

  const variance =
    form.target > 0
      ? Math.round(((form.actualOutput - form.target) / form.target) * 100)
      : 0

  const errorCount = Object.keys(errors).length

  // Freeboard judgement is per TSF, against each facility's own limits. We never
  // invent a safe/unsafe verdict when limits are not set.
  const anyBelowCritical = facilities.some((f) => {
    const r = tsfReadings[f.id]
    return f.freeboardCriticalM !== null && !!r && r.freeboard > 0 && r.freeboard < f.freeboardCriticalM
  })
  const anyBelowMin = facilities.some((f) => {
    const r = tsfReadings[f.id]
    return f.freeboardMinM !== null && !!r && r.freeboard > 0 && r.freeboard < f.freeboardMinM
  })

  return (
    <>
      <PageHeader
        title="Daily Site Report"
        subtitle={`${site?.name ?? '…'} · ${todayDisplay}`}
      />

      {errorCount > 0 && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 animate-fade-in-fast"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="font-semibold text-red-800">
              {errorCount === 1
                ? 'One field needs attention before you can submit'
                : `${errorCount} fields need attention before you can submit`}
            </p>
            <p className="mt-0.5 text-sm text-red-600">Check the highlighted fields below.</p>
          </div>
        </div>
      )}

      <form onSubmit={review} noValidate className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Production */}
          <Panel title="Production" icon={<Factory className="h-4 w-4 text-billnick-500" />}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tonnes Processed" unit="t" error={errors.tonnesProcessed}>
                <input
                  className={inputCls(errors.tonnesProcessed)}
                  type="number" min={0} placeholder="0"
                  value={form.tonnesProcessed || ''}
                  aria-invalid={!!errors.tonnesProcessed}
                  onChange={(e) => num('tonnesProcessed', e.target.value)}
                />
              </Field>
              <Field label="Target Output" unit="t" error={errors.target}>
                <input
                  className={inputCls(errors.target)}
                  type="number" min={0} placeholder="0"
                  value={form.target || ''}
                  aria-invalid={!!errors.target}
                  onChange={(e) => num('target', e.target.value)}
                />
              </Field>
              <Field label="Actual Output" unit="t" error={errors.actualOutput}>
                <input
                  className={inputCls(errors.actualOutput)}
                  type="number" min={0} placeholder="0"
                  value={form.actualOutput || ''}
                  aria-invalid={!!errors.actualOutput}
                  onChange={(e) => num('actualOutput', e.target.value)}
                />
              </Field>
            </div>
            {form.target > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-ink-500">Variance vs target:</span>
                <span className={`pill ${variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {variance >= 0 ? '+' : ''}{variance}%
                </span>
              </div>
            )}
          </Panel>

          {/* Equipment */}
          <Panel title="Equipment" icon={<Truck className="h-4 w-4 text-blue-500" />}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Units Running" error={errors.equipRunning}>
                <input
                  className={inputCls(errors.equipRunning)}
                  type="number" min={0} placeholder="0"
                  value={form.equipRunning || ''}
                  aria-invalid={!!errors.equipRunning}
                  onChange={(e) => num('equipRunning', e.target.value)}
                />
              </Field>
              <Field label="Units Idle">
                <input
                  className="input" type="number" min={0} placeholder="0"
                  value={form.equipIdle || ''}
                  onChange={(e) => num('equipIdle', e.target.value)}
                />
              </Field>
              <Field label="Breakdown">
                <input
                  className="input" type="number" min={0} placeholder="0"
                  value={form.equipBreakdown || ''}
                  onChange={(e) => num('equipBreakdown', e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          {/* Equipment meter readings (optional) */}
          {siteAssets.length > 0 && (
            <Panel title="Equipment Readings" icon={<Gauge className="h-4 w-4 text-blue-500" />}>
              <p className="mb-3 text-xs text-ink-400">
                Optional. Enter today's meter reading for any machine that ran, and the maintenance
                countdown updates automatically. Leave blank to skip.
              </p>
              <div className="space-y-2">
                {siteAssets.map((a) => {
                  const unit = a.usageUnit === 'km' ? 'km' : 'hrs'
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800">{a.name}</p>
                        <p className="text-xs text-ink-400">
                          Current: {a.usageCurrent > 0 ? `${a.usageCurrent.toLocaleString()} ${unit}` : 'not set'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          placeholder={`New ${unit}`}
                          value={readings[a.id] ?? ''}
                          onChange={(e) => setReadings((r) => ({ ...r, [a.id]: e.target.value }))}
                          className="input w-28 py-1.5 text-sm"
                        />
                        <span className="text-xs text-ink-400">{unit}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* Labour */}
          <Panel title="Labour & Attendance" icon={<HardHat className="h-4 w-4 text-billnick-500" />}>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Crew Size" error={errors.totalWorkers}>
                <input
                  className={inputCls(errors.totalWorkers)}
                  type="number" min={0} placeholder="0"
                  value={form.labour.totalWorkers || ''}
                  aria-invalid={!!errors.totalWorkers}
                  onChange={(e) => setLabour('totalWorkers', e.target.value)}
                />
              </Field>
              <Field label="Present" error={errors.present}>
                <input
                  className={inputCls(errors.present)}
                  type="number" min={0} placeholder="0"
                  value={form.labour.present || ''}
                  aria-invalid={!!errors.present}
                  onChange={(e) => setLabour('present', e.target.value)}
                />
              </Field>
              <Field label="Absent">
                <input
                  className="input" type="number" min={0} placeholder="0"
                  value={form.labour.absent || ''}
                  onChange={(e) => setLabour('absent', e.target.value)}
                />
              </Field>
              <Field label="Overtime" unit="h">
                <input
                  className="input" type="number" min={0} step="0.5" placeholder="0"
                  value={form.labour.overtimeHours || ''}
                  onChange={(e) => setLabour('overtimeHours', e.target.value)}
                />
              </Field>
            </div>
            {form.labour.absent > 0 && (
              <div className="mt-4">
                <Field label="Reason for Absence" error={errors.absentReason}>
                  <input
                    className={inputCls(errors.absentReason)}
                    type="text"
                    placeholder="e.g. 2 on sick leave, 1 unauthorised"
                    value={form.labour.absentReason}
                    aria-invalid={!!errors.absentReason}
                    onChange={(e) => setLabour('absentReason', e.target.value)}
                  />
                </Field>
              </div>
            )}
          </Panel>

          {/* TSF Parameters, one reading block per TSF facility on this site */}
          {facilities.length > 0 && (
            <Panel title="TSF Parameters">
              <div className="space-y-6">
                {facilities.map((f) => {
                  const r = tsfReadings[f.id] ?? emptyTsfBlock
                  const thresholdsSet = f.freeboardMinM !== null || f.freeboardCriticalM !== null
                  const fb = r.freeboard
                  const belowCritical = f.freeboardCriticalM !== null && fb > 0 && fb < f.freeboardCriticalM
                  const belowMin = !belowCritical && f.freeboardMinM !== null && fb > 0 && fb < f.freeboardMinM
                  return (
                    <div key={f.id} className="rounded-2xl border border-ink-100 p-4">
                      <p className="mb-3 flex items-center gap-1.5 font-semibold text-ink-800">
                        <Droplets className="h-4 w-4 text-blue-500" /> {f.name}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Freeboard" unit="m" error={errors[`${f.id}.freeboard`]}>
                          <input className={inputCls(errors[`${f.id}.freeboard`])} type="number" step="0.01" min={0} placeholder="0.00"
                            value={r.freeboard || ''} aria-invalid={!!errors[`${f.id}.freeboard`]}
                            onChange={(e) => setTsfReading(f.id, 'freeboard', e.target.value)} />
                        </Field>
                        <Field label="Pool Depth" unit="m" error={errors[`${f.id}.poolDepth`]}>
                          <input className={inputCls(errors[`${f.id}.poolDepth`])} type="number" step="0.01" min={0} placeholder="0.00"
                            value={r.poolDepth || ''} aria-invalid={!!errors[`${f.id}.poolDepth`]}
                            onChange={(e) => setTsfReading(f.id, 'poolDepth', e.target.value)} />
                        </Field>
                        <Field label="Return Water Dam Level" unit="%" error={errors[`${f.id}.rwd`]}>
                          <input className={inputCls(errors[`${f.id}.rwd`])} type="number" step="0.1" min={0} max={100} placeholder="0"
                            value={r.rwd || ''} aria-invalid={!!errors[`${f.id}.rwd`]}
                            onChange={(e) => setTsfReading(f.id, 'rwd', e.target.value)} />
                        </Field>
                        <Field label="Deposited Paddocks">
                          <input className="input" type="number" min={0} placeholder="0"
                            value={r.deposited || ''} onChange={(e) => setTsfReading(f.id, 'deposited', e.target.value)} />
                        </Field>
                        <Field label="Paddocks Ahead of Deposition">
                          <input className="input" type="number" min={0} placeholder="0"
                            value={r.ahead || ''} onChange={(e) => setTsfReading(f.id, 'ahead', e.target.value)} />
                        </Field>
                      </div>

                      {belowCritical && (
                        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          <span>Freeboard is {fb.toFixed(2)}m, below this TSF's critical level of {f.freeboardCriticalM!.toFixed(2)}m. Escalate to the responsible engineer now. This will raise a critical alert.</span>
                        </div>
                      )}
                      {belowMin && (
                        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <span>Freeboard is {fb.toFixed(2)}m, below this TSF's advisory minimum of {f.freeboardMinM!.toFixed(2)}m. You can still submit, but this will raise an alert.</span>
                        </div>
                      )}
                      {!thresholdsSet && (
                        <div className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                          <span>No freeboard limits are set for this TSF, so the reading is recorded without a safety assessment. The SHEQ officer sets each TSF's advisory and critical levels.</span>
                        </div>
                      )}

                      <p className="mb-3 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">Piezometer Readings</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="PZ-A1" unit="m" error={errors[`${f.id}.pzA`]}>
                          <input className={inputCls(errors[`${f.id}.pzA`])} type="number" step="0.01" placeholder="0.00"
                            value={r.pzA || ''} aria-invalid={!!errors[`${f.id}.pzA`]}
                            onChange={(e) => setTsfReading(f.id, 'pzA', e.target.value)} />
                        </Field>
                        <Field label="PZ-A2" unit="m" error={errors[`${f.id}.pzB`]}>
                          <input className={inputCls(errors[`${f.id}.pzB`])} type="number" step="0.01" placeholder="0.00"
                            value={r.pzB || ''} aria-invalid={!!errors[`${f.id}.pzB`]}
                            onChange={(e) => setTsfReading(f.id, 'pzB', e.target.value)} />
                        </Field>
                        <Field label="PZ-A3" unit="m" error={errors[`${f.id}.pzC`]}>
                          <input className={inputCls(errors[`${f.id}.pzC`])} type="number" step="0.01" placeholder="0.00"
                            value={r.pzC || ''} aria-invalid={!!errors[`${f.id}.pzC`]}
                            onChange={(e) => setTsfReading(f.id, 'pzC', e.target.value)} />
                        </Field>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* Delays */}
          <Panel
            title="Delays & Stoppages"
            icon={<Timer className="h-4 w-4 text-amber-500" />}
            action={
              <button
                type="button"
                onClick={() => setDelays((d) => [...d, { type: 'equipment', durationHours: 0, description: '' }])}
                className="btn-ghost px-2.5 py-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add delay
              </button>
            }
          >
            {delays.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">
                No delays recorded. Add one if the shift lost time.
              </p>
            ) : (
              <div className="space-y-3">
                {delays.map((d, i) => (
                  <div key={i} className="rounded-xl border border-ink-100 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]">
                      <Field label="Type">
                        <select
                          className="input"
                          value={d.type}
                          onChange={(e) =>
                            setDelays((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value as DelayType } : x)))
                          }
                        >
                          {DELAY_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Duration" unit="h" error={errors[`delay-${i}-dur`]}>
                        <input
                          className={inputCls(errors[`delay-${i}-dur`])}
                          type="number" min={0} step="0.25" placeholder="0"
                          value={d.durationHours || ''}
                          onChange={(e) => {
                            clearError(`delay-${i}-dur`)
                            setDelays((prev) => prev.map((x, j) => (j === i ? { ...x, durationHours: Number(e.target.value) || 0 } : x)))
                          }}
                        />
                      </Field>
                      <div className="flex items-end pb-0.5">
                        <button
                          type="button"
                          aria-label={`Remove delay ${i + 1}`}
                          onClick={() => setDelays((prev) => prev.filter((_, j) => j !== i))}
                          className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Field label="Description" error={errors[`delay-${i}-desc`]}>
                        <input
                          className={inputCls(errors[`delay-${i}-desc`])}
                          type="text"
                          placeholder="e.g. Excavator EX-03 hydraulic failure, awaiting parts"
                          value={d.description}
                          onChange={(e) => {
                            clearError(`delay-${i}-desc`)
                            setDelays((prev) => prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                          }}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Materials */}
          <Panel
            title="Materials Consumed"
            icon={<Package className="h-4 w-4 text-billnick-500" />}
            action={
              <button
                type="button"
                onClick={() => setMaterials((m) => [...m, { name: '', quantity: 0, unit: 'tonnes' }])}
                className="btn-ghost px-2.5 py-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add material
              </button>
            }
          >
            {materials.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">
                No materials recorded for this shift.
              </p>
            ) : (
              <div className="space-y-3">
                {materials.map((m, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-[1fr_7rem_8rem_auto]">
                    <Field label="Material" error={errors[`material-${i}-name`]}>
                      <input
                        className={inputCls(errors[`material-${i}-name`])}
                        type="text" placeholder="e.g. Flocculant"
                        value={m.name}
                        onChange={(e) => {
                          clearError(`material-${i}-name`)
                          setMaterials((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                        }}
                      />
                    </Field>
                    <Field label="Quantity" error={errors[`material-${i}-qty`]}>
                      <input
                        className={inputCls(errors[`material-${i}-qty`])}
                        type="number" min={0} step="0.01" placeholder="0"
                        value={m.quantity || ''}
                        onChange={(e) => {
                          clearError(`material-${i}-qty`)
                          setMaterials((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x)))
                        }}
                      />
                    </Field>
                    <Field label="Unit">
                      <select
                        className="input"
                        value={m.unit}
                        onChange={(e) =>
                          setMaterials((prev) => prev.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
                        }
                      >
                        {MATERIAL_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </Field>
                    <div className="flex items-end pb-0.5">
                      <button
                        type="button"
                        aria-label={`Remove material ${i + 1}`}
                        onClick={() => setMaterials((prev) => prev.filter((_, j) => j !== i))}
                        className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Notes */}
          <Panel title="General Notes">
            <textarea
              className="input min-h-[100px] resize-y"
              placeholder="Anything else worth recording about the shift…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Panel title="Weather" icon={<CloudSun className="h-4 w-4 text-blue-500" />}>
            <Field label="Conditions" error={errors.weather}>
              <select
                className={inputCls(errors.weather)}
                value={form.weather}
                aria-invalid={!!errors.weather}
                onChange={(e) => {
                  clearError('weather')
                  clearError('weatherOther')
                  setForm((f) => ({ ...f, weather: e.target.value as WeatherCondition | 'Other' | '' }))
                }}
              >
                <option value="">Select…</option>
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
                <option value="Other">Other…</option>
              </select>
            </Field>
            {form.weather === 'Other' && (
              <div className="mt-3">
                <Field label="Describe the conditions" error={errors.weatherOther}>
                  <input
                    className={inputCls(errors.weatherOther)}
                    placeholder="e.g. Hail, Thunderstorm, Smoke haze"
                    value={form.weatherOther}
                    aria-invalid={!!errors.weatherOther}
                    onChange={(e) => {
                      clearError('weatherOther')
                      setForm((f) => ({ ...f, weatherOther: e.target.value }))
                    }}
                  />
                </Field>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Min temp" unit="°C">
                <input className="input" type="number" placeholder="Optional"
                  value={form.weatherTempMin}
                  onChange={(e) => setForm((f) => ({ ...f, weatherTempMin: e.target.value }))} />
              </Field>
              <Field label="Max temp" unit="°C">
                <input className="input" type="number" placeholder="Optional"
                  value={form.weatherTempMax}
                  onChange={(e) => setForm((f) => ({ ...f, weatherTempMax: e.target.value }))} />
              </Field>
              <Field label="Rainfall" unit="mm">
                <input className="input" type="number" min={0} placeholder="Optional"
                  value={form.rainfallMm}
                  onChange={(e) => setForm((f) => ({ ...f, rainfallMm: e.target.value }))} />
              </Field>
              <Field label="Humidity" unit="%">
                <input className="input" type="number" min={0} max={100} placeholder="Optional"
                  value={form.humidity}
                  onChange={(e) => setForm((f) => ({ ...f, humidity: e.target.value }))} />
              </Field>
              <Field label="Wind speed" unit="km/h">
                <input className="input" type="number" min={0} placeholder="Optional"
                  value={form.windSpeed}
                  onChange={(e) => setForm((f) => ({ ...f, windSpeed: e.target.value }))} />
              </Field>
              <Field label="Wind direction">
                <select className="input" value={form.windDirection}
                  onChange={(e) => setForm((f) => ({ ...f, windDirection: e.target.value }))}>
                  <option value="">Optional</option>
                  {['N','NE','E','SE','S','SW','W','NW'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Fuel" icon={<Fuel className="h-4 w-4 text-billnick-500" />}>
            <Field label="Fuel Consumed" unit="L" error={errors.fuel}>
              <input
                className={inputCls(errors.fuel)}
                type="number" min={0} placeholder="0"
                value={form.fuel || ''}
                aria-invalid={!!errors.fuel}
                onChange={(e) => num('fuel', e.target.value)}
              />
            </Field>
            {form.fuel > 0 && form.actualOutput > 0 && (
              <p className="mt-2 text-xs text-ink-400">
                ≈ {(form.fuel / form.actualOutput).toFixed(2)} L/tonne
              </p>
            )}
          </Panel>

          <Panel title="Site Photo">
            {photo ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-billnick-50 text-billnick-600">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm text-ink-700">{photo.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-4 py-8 text-center transition-colors hover:border-billnick-300 hover:bg-billnick-50/40">
                <ImagePlus className="h-6 w-6 text-ink-300" />
                <span className="text-sm font-medium text-ink-600">Upload site photo</span>
                <span className="text-xs text-ink-400">PNG, JPG up to 10 MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
            )}
          </Panel>

          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          <button type="submit" className="btn-primary w-full">
            Review & Submit
          </button>
          <p className="text-center text-xs text-ink-400">
            You will see a summary before anything is saved.
          </p>
        </div>
      </form>

      {/* Confirm step */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="border-b border-ink-100 px-6 py-4">
              <h2 className="font-bold text-ink-900">Confirm daily report</h2>
              <p className="text-xs text-ink-400">{site?.name} · {todayDisplay}</p>
            </div>

            <div className="space-y-3 p-6 text-sm">
              <SummaryRow label="Tonnes processed" value={`${form.tonnesProcessed.toLocaleString()} t`} />
              <SummaryRow label="Actual vs target" value={`${form.actualOutput.toLocaleString()} t vs ${form.target.toLocaleString()} t`} />
              <SummaryRow label="Variance" value={`${variance >= 0 ? '+' : ''}${variance}%`} tone={variance >= 0 ? 'good' : 'bad'} />
              <SummaryRow label="Fuel consumed" value={`${form.fuel.toLocaleString()} L`} />
              <SummaryRow label="Equipment" value={`${form.equipRunning} running · ${form.equipIdle} idle · ${form.equipBreakdown} down`} />
              <SummaryRow label="Crew" value={`${form.labour.present} of ${form.labour.totalWorkers} present`} tone={form.labour.absent > 0 ? 'bad' : 'good'} />
              <SummaryRow label="Weather" value={(form.weather === 'Other' ? form.weatherOther.trim() : form.weather) || 'Not recorded'} />
              <SummaryRow
                label="TSFs recorded"
                value={facilities.length ? `${facilities.length} TSF${facilities.length === 1 ? '' : 's'}` : 'None on this site'}
                tone={anyBelowCritical || anyBelowMin ? 'bad' : facilities.length ? 'good' : undefined}
              />
              <SummaryRow label="Delays" value={delays.length ? `${delays.length} logged, ${delays.reduce((s, d) => s + d.durationHours, 0)}h lost` : 'None'} />
              <SummaryRow label="Materials" value={materials.length ? `${materials.length} recorded` : 'None'} />
              <SummaryRow label="Photo" value={photo ? photo.name : 'None attached'} />

              {(anyBelowCritical || anyBelowMin) && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  Low freeboard on a TSF will raise a management alert.
                </p>
              )}

              <p className="pt-1 text-xs text-ink-400">
                Once submitted, this report is locked for today and appears on the management
                dashboard immediately.
              </p>
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowConfirm(false)} disabled={submitting} className="btn-outline flex-1">
                Go back
              </button>
              <button onClick={confirmSubmit} disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
                {submitting ? 'Submitting…' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function inputCls(error?: string) {
  return error ? 'input border-red-300 focus:border-red-400 focus:ring-red-100' : 'input'
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-50 pb-2 last:border-0">
      <span className="shrink-0 text-ink-500">{label}</span>
      <span
        className={`text-right font-semibold ${
          tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-ink-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Field({
  label,
  unit,
  error,
  children,
}: {
  label: string
  unit?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">
        {label} {unit && <span className="text-ink-400">({unit})</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
