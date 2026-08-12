import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './state/AuthContext'
import type { Role } from './types'
import Layout from './components/Layout'
import Login from './pages/Login'
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard'
import DailyReport from './pages/supervisor/DailyReport'
import ReportHistory from './pages/supervisor/ReportHistory'
import WorkshopDashboard from './pages/workshop/WorkshopDashboard'
import BreakdownReport from './pages/workshop/BreakdownReport'
import AssetManagement from './pages/workshop/AssetManagement'
import SheqDashboard from './pages/sheq/SheqDashboard'
import SheqRecordForm from './pages/sheq/SheqRecordForm'
import TsfLimits from './pages/sheq/TsfLimits'
import ProjectDashboard from './pages/project/ProjectDashboard'
import ExecutiveDashboard from './pages/executive/ExecutiveDashboard'
import MeetingPacks from './pages/executive/MeetingPacks'
import UserManagement from './pages/executive/UserManagement'
import SiteManagement from './pages/executive/SiteManagement'
import Reports from './pages/executive/Reports'
import ClientPortal from './pages/client/ClientPortal'

const homeByRole: Record<Role, string> = {
  supervisor: '/supervisor',
  workshop: '/workshop',
  sheq: '/sheq',
  project: '/project',
  executive: '/executive',
  client: '/client',
}

function Protected({ allow, children }: { allow: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center bg-ink-50"><span className="text-sm text-ink-400">Loading…</span></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== allow) return <Navigate to={homeByRole[user.role]} replace />
  return <Layout>{children}</Layout>
}

function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-ink-50">
      <p className="text-6xl font-extrabold text-ink-200">404</p>
      <p className="text-lg font-semibold text-ink-700">Page not found</p>
      <a href="/" className="btn-primary text-sm">Go home</a>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <span className="text-sm text-ink-400">Loading…</span>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homeByRole[user.role]} replace /> : <Login />}
      />

      {/* Public: reached from the reset email even while a recovery session exists */}

      <Route path="/supervisor" element={<Protected allow="supervisor"><SupervisorDashboard /></Protected>} />
      <Route path="/supervisor/report" element={<Protected allow="supervisor"><DailyReport /></Protected>} />
      <Route path="/supervisor/history" element={<Protected allow="supervisor"><ReportHistory /></Protected>} />

      <Route path="/workshop" element={<Protected allow="workshop"><WorkshopDashboard /></Protected>} />
      <Route path="/workshop/assets" element={<Protected allow="workshop"><AssetManagement /></Protected>} />
      <Route path="/workshop/breakdown" element={<Protected allow="workshop"><BreakdownReport /></Protected>} />

      <Route path="/sheq" element={<Protected allow="sheq"><SheqDashboard /></Protected>} />
      <Route path="/sheq/record" element={<Protected allow="sheq"><SheqRecordForm /></Protected>} />
      <Route path="/sheq/tsf-limits" element={<Protected allow="sheq"><TsfLimits /></Protected>} />

      <Route path="/project" element={<Protected allow="project"><ProjectDashboard /></Protected>} />

      <Route path="/executive" element={<Protected allow="executive"><ExecutiveDashboard /></Protected>} />
      <Route path="/executive/meeting-packs" element={<Protected allow="executive"><MeetingPacks /></Protected>} />
      <Route path="/executive/users" element={<Protected allow="executive"><UserManagement /></Protected>} />
      <Route path="/executive/sites" element={<Protected allow="executive"><SiteManagement /></Protected>} />
      <Route path="/executive/reports" element={<Protected allow="executive"><Reports /></Protected>} />

      <Route path="/client" element={<Protected allow="client"><ClientPortal /></Protected>} />


      <Route path="/" element={<Navigate to={user ? homeByRole[user.role] : '/login'} replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
