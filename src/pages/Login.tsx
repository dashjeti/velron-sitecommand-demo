import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Crown,
  FileText,
  Gauge,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../state/AuthContext'
import { SiteCommandLogo, VelronLogo } from '../components/Brand'
import { users } from '../demo/db'

const roleMeta: Record<string, { icon: ReactNode; blurb: string }> = {
  executive:  { icon: <Crown className="h-5 w-5" />,         blurb: 'Command centre, meeting packs, sites & users' },
  project:    { icon: <Gauge className="h-5 w-5" />,         blurb: 'Multi-site performance, risks & client documents' },
  supervisor: { icon: <ClipboardList className="h-5 w-5" />, blurb: 'Daily site report: production, weather, TSF readings' },
  workshop:   { icon: <Truck className="h-5 w-5" />,         blurb: 'Asset register, services & breakdown logging' },
  sheq:       { icon: <ShieldCheck className="h-5 w-5" />,   blurb: 'Incidents, certificates & TSF safety limits' },
  client:     { icon: <FileText className="h-5 w-5" />,      blurb: 'The read-only portal your clients see' },
}

const ROLE_ORDER = ['executive', 'project', 'supervisor', 'workshop', 'sheq', 'client']

export default function Login() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()

  const enter = (userId: string) => {
    loginAs(userId)
    navigate('/')
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left, brand / hero */}
      <div className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <SiteCommandLogo height={30} light />

        <div className="relative">
          <span className="pill bg-white/10 text-white">Operations Intelligence Platform</span>
          <h1 className="mt-5 max-w-md text-4xl font-extrabold leading-tight text-white">
            Real-time visibility across every site, asset &amp; shift.
          </h1>
          <p className="mt-4 max-w-md text-ink-300">
            One platform for every site, every asset and every shift, from the supervisor's morning
            report to the executive command centre.
          </p>
          <div className="mt-8 flex gap-10">
            <div><p className="text-3xl font-extrabold text-billnick-400">5</p><p className="text-sm text-ink-400">Active sites</p></div>
            <div><p className="text-3xl font-extrabold text-billnick-400">17</p><p className="text-sm text-ink-400">Fleet assets</p></div>
            <div><p className="text-3xl font-extrabold text-billnick-400">Live</p><p className="text-sm text-ink-400">Real-time data</p></div>
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 text-sm text-ink-400">
          Built by <VelronLogo height={14} light link />
        </div>
      </div>

      {/* Right, demo entry */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="lg:hidden"><SiteCommandLogo height={26} /></div>

        <h2 className="mt-6 text-2xl font-extrabold text-ink-900 lg:mt-0">Explore the demo</h2>
        <p className="mt-1 text-sm text-ink-500">
          Pick a role to enter as that person. Everything you see is live demo data, add reports,
          log breakdowns, generate meeting packs. Refreshing the page resets the demo.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {ROLE_ORDER.map((role) => {
            const persona = users.find((u) => u.role === role)
            if (!persona) return null
            const meta = roleMeta[role]
            return (
              <button
                key={role}
                onClick={() => enter(persona.id)}
                className="group flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-billnick-300 hover:shadow-cardhover"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-billnick-50 text-billnick-600">
                  {meta.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink-900">{persona.title.split(' — ')[0]}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">{meta.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-8 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          This is a demonstration environment with sample data. Want this for your operation, with
          your sites, your fleet and your branding? Talk to Velron Digital.
        </p>

        <div className="mt-6 flex items-center gap-1.5 text-xs text-ink-400 lg:hidden">
          Built by <VelronLogo height={13} link />
        </div>
      </div>
    </div>
  )
}
