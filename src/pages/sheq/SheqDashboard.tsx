import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileBadge,
  FileWarning,
  Leaf,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  KpiCard,
  PageHeader,
  Panel,
  Progress,
  SeverityBadge,
} from '../../components/ui'
import { VBars, chartColors } from '../../components/charts'
import { useData } from '../../state/DataContext'
import { useAuth } from '../../state/AuthContext'
import { fetchCertificates, daysUntilExpiry, submitCertificate, updateSheqStatus, deleteSheqRecord, deleteCertificate } from '../../lib/sheq'
import { prettyDate } from '../../data/mockData'
import type { Certificate, SheqRecord, SheqType } from '../../types'
import { SHEQ_LABELS } from '../../types'

const typeIcon: Record<SheqType, React.ReactNode> = {
  inspection:        <ShieldCheck className="h-4 w-4" />,
  near_miss:         <AlertTriangle className="h-4 w-4" />,
  incident:          <FileWarning className="h-4 w-4" />,
  environmental:     <Leaf className="h-4 w-4" />,
  audit:             <ClipboardCheck className="h-4 w-4" />,
  toolbox_talk:      <ClipboardList className="h-4 w-4" />,
  corrective_action: <RefreshCw className="h-4 w-4" />,
}

const typeTone: Record<SheqType, string> = {
  incident:          'bg-red-50 text-red-600',
  near_miss:         'bg-red-50 text-red-600',
  environmental:     'bg-emerald-50 text-emerald-600',
  corrective_action: 'bg-amber-50 text-amber-600',
  inspection:        'bg-billnick-50 text-billnick-600',
  audit:             'bg-billnick-50 text-billnick-600',
  toolbox_talk:      'bg-blue-50 text-blue-600',
}

type Tab = 'register' | 'certificates'

export default function SheqDashboard() {
  const { sheq, siteName, realSites, reloadSheq, reloadCerts, compliance, siteViews } = useData()
  const { user } = useAuth()
  // A SHEQ officer assigned to a site sees only that site; group-wide sees all.
  const scopeSiteId = user?.siteId ?? null
  const [tab, setTab] = useState<Tab>('register')
  const [openRecord, setOpenRecord] = useState<SheqRecord | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [certs, setCerts] = useState<Certificate[]>([])
  const [certsLoading, setCertsLoading] = useState(true)

  // Add-certificate form
  const [showCertForm, setShowCertForm] = useState(false)
  const [certSaving, setCertSaving] = useState(false)
  const [certError, setCertError] = useState('')
  const [certForm, setCertForm] = useState({
    certificateType: '',
    certificateNumber: '',
    issuedBy: '',
    issueDate: '',
    expiryDate: '',
    siteId: user?.siteId ?? '',
    reminderDays: '30',
  })

  useEffect(() => {
    fetchCertificates().then((data) => {
      setCerts(data)
      setCertsLoading(false)
    })
  }, [])

  // Keep the register fresh on open, so newly created records appear.
  useEffect(() => { reloadSheq() }, [reloadSheq])

  async function changeRecordStatus(status: SheqRecord['status']) {
    if (!openRecord) return
    setStatusBusy(true)
    const { error } = await updateSheqStatus(openRecord.id, status)
    if (!error) {
      await reloadSheq()
      setOpenRecord((r) => (r ? { ...r, status } : r))
    }
    setStatusBusy(false)
  }

  async function saveCertificate() {
    if (!certForm.certificateType.trim() || !certForm.expiryDate) {
      setCertError('Certificate type and expiry date are required.')
      return
    }
    setCertSaving(true)
    setCertError('')

    const { error } = await submitCertificate({
      certificateType: certForm.certificateType.trim(),
      certificateNumber: certForm.certificateNumber.trim() || undefined,
      issuedBy: certForm.issuedBy.trim() || undefined,
      issueDate: certForm.issueDate || undefined,
      expiryDate: certForm.expiryDate,
      siteId: certForm.siteId || undefined,
      reminderDays: Number(certForm.reminderDays) || 30,
    })

    if (error) {
      setCertError(error)
      setCertSaving(false)
      return
    }

    setCerts(await fetchCertificates())
    // Refresh the shared cert list so the interim compliance score reflects it.
    reloadCerts()
    setCertSaving(false)
    setShowCertForm(false)
    setCertForm({
      certificateType: '', certificateNumber: '', issuedBy: '',
      issueDate: '', expiryDate: '', siteId: user?.siteId ?? '', reminderDays: '30',
    })
  }

  const visibleSheq = useMemo(
    () => (scopeSiteId ? sheq.filter((r) => r.siteId === scopeSiteId) : sheq),
    [sheq, scopeSiteId],
  )
  // Group-wide certificates (no site) apply to every site, so a scoped officer
  // still sees them alongside their own site's.
  const visibleCerts = useMemo(
    () => (scopeSiteId ? certs.filter((c) => !c.siteId || c.siteId === scopeSiteId) : certs),
    [certs, scopeSiteId],
  )
  const visibleViews = useMemo(
    () => (scopeSiteId ? siteViews.filter((v) => v.id === scopeSiteId) : siteViews),
    [siteViews, scopeSiteId],
  )

  const open = visibleSheq.filter((s) => s.status === 'open' || s.status === 'in_progress').length
  const overdue = visibleSheq.filter((s) => s.status === 'overdue').length
  const incidents = visibleSheq.filter((s) => s.type === 'incident').length
  const nearMisses = visibleSheq.filter((s) => s.type === 'near_miss').length

  const expiredCerts = visibleCerts.filter((c) => c.status === 'expired').length
  const expiringSoon = visibleCerts.filter((c) => c.status === 'expiring_soon').length

  const avgComp = scopeSiteId ? compliance.bySite[scopeSiteId] ?? 100 : compliance.group

  const compBars = useMemo(
    () => visibleViews.map((v) => ({ label: v.code, value: v.compliance })),
    [visibleViews],
  )

  const sorted = [...visibleSheq].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <>
      <PageHeader
        title="SHEQ & Compliance"
        subtitle={scopeSiteId
          ? `${siteName(scopeSiteId)} · your site's safety, health, environment & quality`
          : 'Safety, Health, Environment & Quality across all sites'}
        action={
          <Link to="/sheq/record" className="btn-primary">
            <ClipboardList className="h-4 w-4" /> New Record
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Compliance Score"       value={avgComp}                     unit="%" icon={<CheckCircle2 className="h-5 w-5" />} accent={avgComp >= 95 ? 'green' : 'billnick'} sub={scopeSiteId ? 'Interim · your site' : 'Interim · group avg'} delay={0} />
        <KpiCard label="Open Items"             value={open}                         icon={<ClipboardList className="h-5 w-5" />} accent="billnick" delay={50} />
        <KpiCard label="Overdue"                value={overdue}                      icon={<AlertTriangle className="h-5 w-5" />} accent={overdue ? 'red' : 'green'} delay={100} />
        <KpiCard label="Incidents / Near Miss"  value={`${incidents} / ${nearMisses}`} icon={<FileWarning className="h-5 w-5" />} accent="slate" sub="This period" delay={150} />
      </div>

      {/* Cert expiry alert banner */}
      {(expiredCerts > 0 || expiringSoon > 0) && (
        <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in ${
          expiredCerts > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          <FileBadge className="h-4 w-4 shrink-0" />
          <span>
            {expiredCerts > 0 && <strong>{expiredCerts} certificate{expiredCerts > 1 ? 's' : ''} expired. </strong>}
            {expiringSoon > 0 && <span>{expiringSoon} certificate{expiringSoon > 1 ? 's' : ''} expiring within 30 days.</span>}
          </span>
          <button
            onClick={() => {
              setTab('certificates')
              // The tab list sits below the fold, so switching alone looks inert.
              document.getElementById('sheq-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="ml-auto shrink-0 text-xs font-semibold underline underline-offset-2"
          >
            View certificates
          </button>
        </div>
      )}

      {/* Compliance charts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Compliance Score by Site" className="lg:col-span-2" icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}>
          <VBars data={compBars} color={chartColors.GREEN} />
          <p className="mt-3 text-xs text-ink-400">
            Interim measure: 100 minus points for open and overdue SHEQ items, open incidents and
            lapsed certificates. Replaced once an official compliance formula is supplied.
          </p>
        </Panel>
        <Panel title="Site Compliance" icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}>
          <div className="space-y-3">
            {visibleViews.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-400">No sites yet.</p>
            )}
            {visibleViews.map((v) => {
              const score = v.compliance
              return (
                <div key={v.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-600">{v.name}</span>
                    <span className="font-semibold text-ink-800">{score}%</span>
                  </div>
                  <Progress
                    value={score}
                    color={score >= 95 ? 'green' : score >= 90 ? 'billnick' : 'red'}
                  />
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* Tab switcher */}
      <div id="sheq-tabs" className="mb-4 flex scroll-mt-20 gap-1 rounded-xl border border-ink-100 bg-ink-50 p-1 w-fit">
        {(['register', 'certificates'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {t === 'register' ? 'SHEQ Register' : `Certificates${visibleCerts.length > 0 ? ` (${visibleCerts.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* SHEQ Register tab */}
      {tab === 'register' && (
        <Panel title="SHEQ Register" icon={<ClipboardCheck className="h-4 w-4 text-billnick-500" />}>
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No records yet. Submit the first one above.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setOpenRecord(r)}
                  className="flex w-full flex-col gap-2 rounded-xl border border-ink-100 p-3 text-left transition-colors hover:border-billnick-200 hover:bg-ink-50/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeTone[r.type]}`}>
                      {typeIcon[r.type]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-800">{r.title}</p>
                      <p className="text-xs text-ink-400">
                        {SHEQ_LABELS[r.type]} · {siteName(r.siteId)} · {prettyDate(r.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-12 sm:pl-0">
                    <SeverityBadge severity={r.severity} />
                    <span className={`pill capitalize ${
                      r.status === 'closed'      ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'overdue'     ? 'bg-red-100 text-red-700' :
                      r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                   'bg-amber-100 text-amber-700'
                    }`}>
                      {r.status === 'in_progress' ? 'In Progress' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Certificates tab */}
      {tab === 'certificates' && (
        <Panel
          title="Certificates & Permit Register"
          icon={<FileBadge className="h-4 w-4 text-billnick-500" />}
          action={
            <button onClick={() => setShowCertForm(true)} className="btn-primary px-3 py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Certificate
            </button>
          }
        >
          {certsLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-billnick-500 border-t-transparent" />
            </div>
          ) : visibleCerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-50">
                <FileBadge className="h-7 w-7 text-ink-300" />
              </span>
              <p className="mt-4 font-semibold text-ink-600">No certificates yet</p>
              <p className="mt-1 max-w-sm text-sm text-ink-400">
                Add the operating licences and permits issued by the regulators, and the
                platform will track their expiry and remind you before they lapse.
              </p>
              <button onClick={() => setShowCertForm(true)} className="btn-primary mt-6">
                <Plus className="h-4 w-4" /> Add your first certificate
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCerts.map((cert) => {
                const days = daysUntilExpiry(cert.expiryDate)
                const certSiteName = cert.siteId ? siteName(cert.siteId) : 'Group'
                return (
                  <article
                    key={cert.id}
                    className={`rounded-2xl border p-4 ${
                      cert.status === 'expired'       ? 'border-red-200 bg-red-50/60' :
                      cert.status === 'expiring_soon' ? 'border-amber-200 bg-amber-50/60' :
                                                        'border-ink-100 bg-ink-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900 leading-snug">{cert.certificateType}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{certSiteName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete "${cert.certificateType}"? This cannot be undone.`)) return
                            const { error } = await deleteCertificate(cert.id)
                            if (!error) { setCerts(await fetchCertificates()); reloadCerts() }
                          }}
                          aria-label="Delete certificate"
                          className="rounded-lg p-1 text-ink-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          cert.status === 'expired'       ? 'bg-red-100 text-red-600' :
                          cert.status === 'expiring_soon' ? 'bg-amber-100 text-amber-600' :
                                                            'bg-emerald-100 text-emerald-600'
                        }`}>
                          {cert.status === 'expired' ? <XCircle className="h-4 w-4" /> :
                           cert.status === 'expiring_soon' ? <AlertTriangle className="h-4 w-4" /> :
                           <CheckCircle2 className="h-4 w-4" />}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-ink-500">
                      {cert.certificateNumber && (
                        <p><span className="text-ink-400">Cert No.</span> {cert.certificateNumber}</p>
                      )}
                      {cert.issuedBy && (
                        <p><span className="text-ink-400">Issued by</span> {cert.issuedBy}</p>
                      )}
                      <p>
                        <span className="text-ink-400">Expires</span>{' '}
                        {new Date(cert.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className={`mt-3 rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold ${
                      cert.status === 'expired'       ? 'bg-red-100 text-red-700' :
                      cert.status === 'expiring_soon' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-emerald-100 text-emerald-700'
                    }`}>
                      {cert.status === 'expired'
                        ? `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
                        : cert.status === 'expiring_soon'
                        ? `Expires in ${days} day${days !== 1 ? 's' : ''}`
                        : `Valid for ${days} days`}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </Panel>
      )}

      {/* SHEQ record detail + status change */}
      {openRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm" onClick={() => setOpenRecord(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeTone[openRecord.type]}`}>
                  {typeIcon[openRecord.type]}
                </span>
                <div className="min-w-0">
                  <h2 className="font-bold text-ink-900 leading-snug">{openRecord.title}</h2>
                  <p className="text-xs text-ink-400">{SHEQ_LABELS[openRecord.type]} · {siteName(openRecord.siteId)}</p>
                </div>
              </div>
              <button onClick={() => setOpenRecord(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-6 text-sm">
              <div className="flex items-center justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">Severity</span>
                <SeverityBadge severity={openRecord.severity} />
              </div>
              <div className="flex items-center justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">Raised by</span>
                <span className="font-semibold text-ink-900">{openRecord.raisedBy}</span>
              </div>
              <div className="flex items-center justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">Date raised</span>
                <span className="font-semibold text-ink-900">{prettyDate(openRecord.date)}</span>
              </div>

              <div className="pt-1">
                <p className="label mb-2">Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['open', 'in_progress', 'closed', 'overdue'] as SheqRecord['status'][]).map((s) => (
                    <button
                      key={s}
                      onClick={() => changeRecordStatus(s)}
                      disabled={statusBusy}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                        openRecord.status === s
                          ? 'border-billnick-400 bg-billnick-50 text-billnick-700'
                          : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      {s === 'in_progress' ? 'In Progress' : s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Moving a record to Closed removes it from the open and overdue counts on every
                  dashboard.
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-ink-100 px-6 py-4">
              <button
                onClick={async () => {
                  if (!openRecord) return
                  setStatusBusy(true)
                  const { error } = await deleteSheqRecord(openRecord.id)
                  setStatusBusy(false)
                  if (!error) { await reloadSheq(); setOpenRecord(null) }
                }}
                disabled={statusBusy}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
              <button onClick={() => setOpenRecord(null)} className="btn-outline flex-1">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Add certificate */}
      {showCertForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileBadge className="h-5 w-5 text-billnick-500" />
                <h2 className="font-bold text-ink-900">Add certificate or permit</h2>
              </div>
              <button onClick={() => setShowCertForm(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="label" htmlFor="cert-type">Certificate type *</label>
                <input
                  id="cert-type"
                  className="input"
                  list="cert-type-options"
                  placeholder="e.g. Operating License"
                  value={certForm.certificateType}
                  onChange={(e) => setCertForm((f) => ({ ...f, certificateType: e.target.value }))}
                />
                <datalist id="cert-type-options">
                  <option value="Operating License" />
                  <option value="Environmental Impact Assessment" />
                  <option value="Environmental Management Plan" />
                  <option value="TSF Safety Certificate" />
                  <option value="Water Use Permit" />
                  <option value="Discharge Permit" />
                  <option value="Fire Safety Certificate" />
                </datalist>
                <p className="mt-1 text-xs text-ink-400">Pick a common type or type your own.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="cert-no">Certificate number</label>
                  <input
                    id="cert-no"
                    className="input"
                    placeholder="e.g. OL-MIN-2026-014"
                    value={certForm.certificateNumber}
                    onChange={(e) => setCertForm((f) => ({ ...f, certificateNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cert-issuer">Issued by</label>
                  <input
                    id="cert-issuer"
                    className="input"
                    placeholder="e.g. Ministry of Mines"
                    value={certForm.issuedBy}
                    onChange={(e) => setCertForm((f) => ({ ...f, issuedBy: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="cert-issued">Issue date</label>
                  <input
                    id="cert-issued"
                    className="input"
                    type="date"
                    value={certForm.issueDate}
                    onChange={(e) => setCertForm((f) => ({ ...f, issueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cert-expiry">Expiry date *</label>
                  <input
                    id="cert-expiry"
                    className="input"
                    type="date"
                    value={certForm.expiryDate}
                    onChange={(e) => setCertForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="cert-site">Site</label>
                  <select
                    id="cert-site"
                    className="input"
                    value={certForm.siteId}
                    onChange={(e) => setCertForm((f) => ({ ...f, siteId: e.target.value }))}
                  >
                    <option value="">Group-wide (no single site)</option>
                    {realSites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="cert-remind">Remind me (days before)</label>
                  <input
                    id="cert-remind"
                    className="input"
                    type="number"
                    min={1}
                    value={certForm.reminderDays}
                    onChange={(e) => setCertForm((f) => ({ ...f, reminderDays: e.target.value }))}
                  />
                </div>
              </div>

              <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                The platform counts down to the expiry date and raises an alert once it is within the
                reminder window, so a licence never lapses unnoticed.
              </p>

              {certError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{certError}</p>
              )}
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowCertForm(false)} disabled={certSaving} className="btn-outline flex-1">
                Cancel
              </button>
              <button onClick={saveCertificate} disabled={certSaving} className="btn-primary flex-1 disabled:opacity-60">
                {certSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Add certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
