import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { PageHeader, Panel } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { listUsers, inviteUser, updateUser, deleteUser, resetUserPassword } from '../../lib/adminUsers'
import type { ManagedUser } from '../../lib/adminUsers'
import type { Role } from '../../types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'supervisor', label: 'Site Supervisor' },
  { value: 'workshop', label: 'Workshop Manager' },
  { value: 'sheq', label: 'SHEQ Officer' },
  { value: 'project', label: 'Project Manager' },
  { value: 'executive', label: 'Executive' },
  { value: 'client', label: 'Client' },
]

const roleLabel = (r: Role | null) => ROLES.find((x) => x.value === r)?.label ?? 'No role'

// Roles that can be tied to a single site; others are group-wide. A supervisor
// must have a site; a SHEQ officer may have one (per-site officer) or none
// (group-wide SHEQ manager).
const SITE_ROLES: Role[] = ['supervisor', 'sheq', 'client']

export default function UserManagement() {
  const { user } = useAuth()
  const { realSites, siteName } = useData()

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ManagedUser | null>(null)
  const [busy, setBusy] = useState(false)

  // Form fields
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('supervisor')
  const [siteId, setSiteId] = useState('')
  const [formError, setFormError] = useState('')
  // Shown when we hand the admin a temporary password: either a newly created
  // account, or a password reset for an existing user.
  const [credResult, setCredResult] = useState<{ email: string; tempPassword: string; mode: 'created' | 'reset' } | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    const { users: u, error: e } = await listUsers()
    if (e) setError(e)
    else setUsers(u)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sorted = useMemo(
    () => [...users].sort((a, b) => (a.fullName || a.email || '').localeCompare(b.fullName || b.email || '')),
    [users],
  )

  function openInvite() {
    setEditing(null)
    setEmail(''); setFullName(''); setRole('supervisor'); setSiteId('')
    setFormError('')
    setShowForm(true)
  }

  function openEdit(u: ManagedUser) {
    setEditing(u)
    setEmail(u.email ?? ''); setFullName(u.fullName); setRole(u.role ?? 'supervisor'); setSiteId(u.siteId ?? '')
    setFormError('')
    setShowForm(true)
  }

  async function save() {
    if (!editing && !email.trim()) { setFormError('Enter an email address.'); return }
    if (!fullName.trim()) { setFormError('Enter the person\'s name.'); return }
    if ((role === 'supervisor' || role === 'client') && !siteId) { setFormError(`A ${roleLabel(role)} must be assigned to a site.`); return }

    setBusy(true); setFormError('')
    const finalSite = SITE_ROLES.includes(role) ? siteId : null

    if (editing) {
      const { error: e } = await updateUser({ userId: editing.id, fullName: fullName.trim(), role, siteId: finalSite })
      setBusy(false)
      if (e) { setFormError(e); return }
      setShowForm(false)
      await load()
      return
    }

    const inviteEmail = email.trim()
    const { error: e, emailed, tempPassword } = await inviteUser({ email: inviteEmail, fullName: fullName.trim(), role, siteId: finalSite })
    setBusy(false)
    if (e) { setFormError(e); return }
    setShowForm(false)
    await load()
    // If the invite email could not be sent, surface the temporary password so
    // the executive can hand it over directly.
    if (!emailed && tempPassword) {
      setCopied(false)
      setCredResult({ email: inviteEmail, tempPassword, mode: 'created' })
    }
  }

  async function resetUser(u: ManagedUser) {
    setBusy(true)
    const { error: e, tempPassword } = await resetUserPassword(u.id)
    setBusy(false)
    if (e) { setError(e); return }
    if (tempPassword) {
      setCopied(false)
      setCredResult({ email: u.email ?? '', tempPassword, mode: 'reset' })
    }
  }

  async function doDelete() {
    if (!confirmDelete) return
    setBusy(true)
    const { error: e } = await deleteUser(confirmDelete.id)
    setBusy(false)
    if (e) { setError(e); setConfirmDelete(null); return }
    setConfirmDelete(null)
    await load()
  }

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Invite staff, set their role and site, and manage access"
        action={
          <button onClick={openInvite} className="btn-primary">
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="font-semibold text-red-800">Could not load users</p>
            <p className="mt-0.5 text-sm text-red-600">{error}</p>
            <p className="mt-1 text-xs text-red-500">The admin-users function must be deployed and you must be signed in as an executive.</p>
          </div>
        </div>
      )}

      <Panel title={`Users (${users.length})`} icon={<Users className="h-4 w-4 text-billnick-500" />}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="pb-2 pr-3 font-semibold">Name</th>
                  <th className="px-3 pb-2 font-semibold">Role</th>
                  <th className="px-3 pb-2 font-semibold">Site</th>
                  <th className="px-3 pb-2 font-semibold">Status</th>
                  <th className="px-3 pb-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ink-800">{u.fullName || '(no name)'}</p>
                      <p className="text-xs text-ink-400">{u.email}</p>
                    </td>
                    <td className="px-3 py-3 text-ink-600">{roleLabel(u.role)}</td>
                    <td className="px-3 py-3 text-ink-600">{u.siteId ? siteName(u.siteId) : <span className="text-ink-300">Group-wide</span>}</td>
                    <td className="px-3 py-3">
                      {u.confirmed ? (
                        <span className="pill bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Active</span>
                      ) : (
                        <span className="pill bg-amber-100 text-amber-700"><Clock className="h-3 w-3" /> Invited</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} aria-label={`Edit ${u.fullName}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => resetUser(u)} disabled={busy} aria-label={`Reset password for ${u.fullName}`} title="Reset password" className="rounded-lg p-1.5 text-ink-400 hover:bg-billnick-50 hover:text-billnick-600 disabled:opacity-50">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        {u.id !== user?.id && (
                          <button onClick={() => setConfirmDelete(u)} aria-label={`Delete ${u.fullName}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Invite / edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/60 p-4 pt-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-billnick-500" />
                <h2 className="font-bold text-ink-900">{editing ? 'Edit user' : 'Invite user'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="label" htmlFor="u-email">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                  <input
                    id="u-email"
                    className="input pl-9 disabled:bg-ink-50 disabled:text-ink-400"
                    type="email"
                    placeholder="person@billnickengineering.co.zw"
                    value={email}
                    disabled={!!editing}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {editing && <p className="mt-1 text-xs text-ink-400">Email cannot be changed here.</p>}
              </div>

              <div>
                <label className="label" htmlFor="u-name">Full name</label>
                <input id="u-name" className="input" placeholder="e.g. Tendai Chikore" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div>
                <label className="label" htmlFor="u-role">Role</label>
                <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="u-site">Site</label>
                {SITE_ROLES.includes(role) ? (
                  <>
                    <select id="u-site" className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                      <option value="">{role === 'sheq' ? 'Group-wide (all sites)' : 'Select site…'}</option>
                      {realSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-ink-400">
                      {role === 'sheq'
                        ? 'Assign a site for a per-site SHEQ officer, or leave group-wide to oversee every site.'
                        : 'Supervisors are tied to one site.'}
                    </p>
                  </>
                ) : (
                  <>
                    <input className="input bg-ink-50 text-ink-500" value="Group-wide (all sites)" disabled readOnly />
                    <p className="mt-1 text-xs text-ink-400">This role covers every site, so no single site is assigned.</p>
                  </>
                )}
              </div>

              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

              {!editing && (
                <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                  The account is created immediately with a temporary password, shown to you next to
                  share with them. They sign in with it and can change it from the sidebar.
                </p>
              )}
            </div>

            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowForm(false)} disabled={busy} className="btn-outline flex-1">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? 'Save changes' : 'Send invitation'}
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
              <h2 className="font-bold text-ink-900">Remove {confirmDelete.fullName || confirmDelete.email}?</h2>
              <p className="mt-1 text-sm text-ink-500">
                This permanently deletes their account and access. Their submitted reports and records
                stay in the system.
              </p>
            </div>
            <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setConfirmDelete(null)} disabled={busy} className="btn-outline flex-1">Cancel</button>
              <button onClick={doDelete} disabled={busy} className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Removing…</> : 'Remove user'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporary-password result: new account, or a reset for an existing user */}
      {credResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl animate-scale-in">
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  {credResult.mode === 'reset' ? <KeyRound className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </span>
                <div>
                  <h2 className="font-bold text-ink-900">{credResult.mode === 'reset' ? 'Password reset' : 'Account created'}</h2>
                  <p className="text-xs text-ink-500">
                    {credResult.mode === 'reset'
                      ? 'Give this new temporary password to the user.'
                      : 'The invite email could not be sent, so use this temporary password.'}
                  </p>
                </div>
              </div>
              <button onClick={() => setCredResult(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-6 py-4 text-sm">
              <div>
                <p className="label mb-1">Email</p>
                <p className="rounded-lg bg-ink-50 px-3 py-2 font-medium text-ink-800">{credResult.email}</p>
              </div>
              <div>
                <p className="label mb-1">Temporary password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-ink-50 px-3 py-2 font-mono text-ink-900">{credResult.tempPassword}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(credResult.tempPassword)
                      setCopied(true)
                    }}
                    className="btn-outline shrink-0 px-3 py-2 text-xs"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Share these with {credResult.email} over a secure channel. They can sign in now and
                change the password from the sidebar. Once email sending is configured at handover,
                users can reset their own passwords by email instead.
              </p>
            </div>

            <div className="border-t border-ink-100 px-6 py-4">
              <button onClick={() => setCredResult(null)} className="btn-primary w-full">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
