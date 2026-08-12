import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import { users as demoUsers } from '../demo/db'
import type { DemoUser } from '../demo/db'

/**
 * Demo authentication. There is no backend: "signing in" simply selects one of
 * the demo personas. The selection survives refreshes via sessionStorage so a
 * visitor can browse naturally, and closing the tab ends the session.
 */

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: string | null }>
  /** One-click demo entry: sign in as a persona by id. */
  loginAs: (userId: string) => void
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthCtx = createContext<AuthState | null>(null)

const STORAGE_KEY = 'sitecommand-demo-user'

function toUser(d: DemoUser): User {
  const initials = d.fullName.trim().split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  return {
    id: d.id,
    name: d.fullName,
    email: d.email,
    role: d.role,
    title: d.title,
    siteId: d.siteId ?? undefined,
    initials,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    const d = saved ? demoUsers.find((u) => u.id === saved) : undefined
    if (d) setUser(toUser(d))
    setLoading(false)
  }, [])

  const loginAs = (userId: string) => {
    const d = demoUsers.find((u) => u.id === userId)
    if (!d) return
    sessionStorage.setItem(STORAGE_KEY, d.id)
    setUser(toUser(d))
  }

  const login = async (email: string, _password: string) => {
    const d = demoUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!d) return { error: 'This is a demo: pick one of the demo roles instead of typing credentials.' }
    loginAs(d.id)
    return { error: null }
  }

  const logout = async () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const requestPasswordReset = async (_email: string) => ({ error: null })
  const updatePassword = async (_newPassword: string) => ({ error: null })

  return (
    <AuthCtx.Provider value={{ user, loading, login, loginAs, logout, requestPasswordReset, updatePassword }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
