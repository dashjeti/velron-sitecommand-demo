import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

/**
 * Password field with a show/hide eye toggle. Keeps autocomplete and id so it
 * works inside forms and with password managers.
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  showLockIcon = true,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  showLockIcon?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      {showLockIcon && (
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
      )}
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={`input ${showLockIcon ? 'pl-9' : ''} pr-10`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
