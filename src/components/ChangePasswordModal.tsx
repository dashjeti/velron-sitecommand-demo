import { useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, X } from 'lucide-react'
import { useAuth } from '../state/AuthContext'
import PasswordInput from './PasswordInput'

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setSaving(true)
    setError('')
    const { error: updErr } = await updatePassword(password)
    setSaving(false)
    if (updErr) {
      setError(updErr)
      return
    }
    setDone(true)
    setTimeout(onClose, 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-billnick-500" />
            <h2 className="font-bold text-ink-900">Change password</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="font-semibold text-ink-800">Password updated</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-6">
            <div>
              <label htmlFor="cp-new" className="label">New password</label>
              <PasswordInput
                id="cp-new"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                showLockIcon={false}
                value={password}
                onChange={(v) => { setPassword(v); setError('') }}
              />
            </div>
            <div>
              <label htmlFor="cp-confirm" className="label">Confirm password</label>
              <PasswordInput
                id="cp-confirm"
                autoComplete="new-password"
                placeholder="Re-enter it"
                showLockIcon={false}
                value={confirm}
                onChange={(v) => { setConfirm(v); setError('') }}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
