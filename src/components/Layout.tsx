import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  Boxes,
  CalendarDays,
  ClipboardList,
  Crown,
  Droplets,
  Factory,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookText,
  ShieldCheck,
  Truck,
  Users,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../state/AuthContext'
import type { Role } from '../types'
import { SiteCommandLogo, VelronLogo } from './Brand'
import NotificationBell from './NotificationBell'
import ChangePasswordModal from './ChangePasswordModal'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const navByRole: Record<Role, NavItem[]> = {
  supervisor: [
    { to: '/supervisor', label: 'Site Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { to: '/supervisor/report', label: 'Daily Site Report', icon: <ClipboardList className="h-5 w-5" /> },
    { to: '/supervisor/history', label: 'Submitted Reports', icon: <CalendarDays className="h-5 w-5" /> },
  ],
  workshop: [
    { to: '/workshop', label: 'Equipment Dashboard', icon: <Truck className="h-5 w-5" /> },
    { to: '/workshop/assets', label: 'Asset Register', icon: <Boxes className="h-5 w-5" /> },
    { to: '/workshop/breakdown', label: 'Breakdown Report', icon: <ClipboardList className="h-5 w-5" /> },
  ],
  sheq: [
    { to: '/sheq', label: 'Compliance Dashboard', icon: <ShieldCheck className="h-5 w-5" /> },
    { to: '/sheq/record', label: 'New SHEQ Record', icon: <ClipboardList className="h-5 w-5" /> },
    { to: '/sheq/tsf-limits', label: 'TSF Limits', icon: <Droplets className="h-5 w-5" /> },
  ],
  project: [
    { to: '/project', label: 'Project Overview', icon: <Gauge className="h-5 w-5" /> },
  ],
  client: [
    { to: '/client', label: 'Client Portal', icon: <FileText className="h-5 w-5" /> },
  ],
  executive: [
    { to: '/executive', label: 'Command Centre', icon: <Crown className="h-5 w-5" /> },
    { to: '/executive/reports', label: 'Submitted Reports', icon: <CalendarDays className="h-5 w-5" /> },
    { to: '/executive/meeting-packs', label: 'Meeting Packs', icon: <NotebookText className="h-5 w-5" /> },
    { to: '/executive/sites', label: 'Site Management', icon: <Factory className="h-5 w-5" /> },
    { to: '/executive/users', label: 'User Management', icon: <Users className="h-5 w-5" /> },
  ],
}

const roleLabels: Record<Role, string> = {
  supervisor: 'Site Supervisor',
  workshop: 'Workshop Manager',
  sheq: 'SHEQ Officer',
  project: 'Project Manager',
  executive: 'Executive',
  client: 'Client Portal',
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [now, setNow] = useState(new Date())
  const location = useLocation()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!user) return null
  const nav = navByRole[user.role]

  const SidebarInner = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <SiteCommandLogo height={22} />
      </div>

      <div className="px-4 py-4">
        <p className="section-title px-2">Workspace</p>
        <p className="mt-1 px-2 text-sm font-semibold text-ink-700">
          {roleLabels[user.role]}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-billnick-50 text-billnick-700 shadow-sm'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-billnick-500 text-sm font-bold text-white">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-800">{user.name}</p>
            <p className="truncate text-xs text-ink-400">{user.title}</p>
          </div>
        </div>
        <button
          onClick={() => { setShowChangePw(true); setMobileOpen(false) }}
          className="btn-ghost mt-3 w-full justify-center text-ink-600"
        >
          <KeyRound className="h-4 w-4" /> Change password
        </button>
        <button
          onClick={logout}
          className="btn-outline mt-2 w-full text-ink-600"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
          <span>Powered by</span>
          <VelronLogo height={13} link />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f4f6fa]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-white lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarInner />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40 animate-fade-in-fast"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarInner />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <SiteCommandLogo height={20} />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
              <Activity className="h-3.5 w-3.5" />
              Live · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <NotificationBell />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">
              {user.initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          key={location.pathname}
          className="mx-auto w-full max-w-7xl flex-1 animate-page-in px-4 py-6 sm:px-6 lg:py-8"
        >
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-ink-100 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs text-ink-400 sm:flex-row">
            <span>© 2026 SiteCommand · Operations Intelligence Platform · Demo environment</span>
            <span className="flex items-center gap-1.5">
              Powered by <VelronLogo height={13} link />
            </span>
          </div>
        </footer>
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}
