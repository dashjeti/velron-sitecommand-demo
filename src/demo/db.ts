import type {
  BreakdownReport,
  Certificate,
  Equipment,
  SheqRecord,
} from '../types'

/**
 * SiteCommand demo database.
 *
 * The entire demo runs on this in-memory store: no backend, no credentials,
 * nothing a visitor can break. Every "lib" module reimplements the production
 * API surface on top of it, so the pages are identical to the real product.
 * Refreshing the browser resets the demo to this seed.
 */

// ── Deterministic PRNG so the demo numbers look organic but stable ────────────
let prngState = 20260811
function rand(): number {
  prngState |= 0
  prngState = (prngState + 0x6d2b79f5) | 0
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function between(min: number, max: number): number {
  return min + rand() * (max - min)
}

let idCounter = 1000
export function newId(prefix = 'sc'): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ── Entities ──────────────────────────────────────────────────────────────────

export interface DemoSite {
  id: string
  name: string
  location: string | null
  region: string | null
  status: 'active' | 'inactive' | 'care_maintenance'
}

export interface DemoFacility {
  id: string
  siteId: string
  name: string
  freeboardMinM: number | null
  freeboardCriticalM: number | null
  thresholdsSource: string | null
}

export interface DemoTsfEntry {
  facilityId: string
  freeboard: number
  poolDepth: number
  rwd: number // percentage
  deposited: number
  ahead: number
  piezometers: { label: string; value: number }[]
}

export interface DemoReport {
  id: string
  siteId: string
  date: string // yyyy-mm-dd
  createdAt: string
  /** users.id of the supervisor who submitted it; null when unattributed. */
  supervisorId: string | null
  tonnesProcessed: number
  actual: number
  target: number
  equipRunning: number
  equipIdle: number
  equipBreakdown: number
  weather: string | null
  tempMin: number | null
  tempMax: number | null
  rainfallMm: number | null
  windSpeedKmh: number | null
  windDirection: string | null
  humidityPct: number | null
  notes: string | null
  fuel: number
  labour: { total: number; present: number; absent: number; overtime: number } | null
  delays: { type: string; hours: number; description: string }[]
  materials: { name: string; quantity: number; unit: string }[]
  tsf: DemoTsfEntry[]
  photoUrl: string | null
  photoCaption: string | null
}

export interface DemoDoc {
  id: string
  siteId: string
  title: string
  docType: 'Progress Report' | 'Production Report' | 'Compliance Document' | 'Deliverable'
  fileName: string
  documentDate: string
  url: string | null
}

export interface DemoPackContent {
  agenda: string[]
  executiveSummary: string
  productionReview: string
  safetyReview: string
  fleetReview: string
  correctiveActions: string[]
  recommendationsForApproval: string[]
  nextMeetingFocus: string[]
}

export interface DemoPack {
  id: string
  createdAt: string
  periodType: 'monthly' | 'quarterly'
  periodLabel: string
  previousMinutes: string | null
  content: DemoPackContent | null
  status: 'draft' | 'finalised'
}

export interface DemoUser {
  id: string
  email: string
  fullName: string
  role: 'supervisor' | 'ops_manager' | 'workshop' | 'sheq' | 'sheq_manager' | 'project' | 'executive' | 'client'
  siteId: string | null
  title: string
}

// ── Placeholder "photo" (an inline SVG, so no storage is needed) ──────────────
function svgPhoto(label: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="640" height="480" fill="url(#g)"/>
    <text x="24" y="448" font-family="Arial" font-size="26" fill="rgba(255,255,255,0.92)" font-weight="bold">${label}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// ── Seed: sites & TSF facilities ──────────────────────────────────────────────

export const sites: DemoSite[] = [
  { id: 'site-hq',     name: 'Head Office',        location: 'Metro City',      region: 'Central',  status: 'active' },
  { id: 'site-north',  name: 'North Ridge Mine',   location: 'North Ridge',     region: 'Northern', status: 'active' },
  { id: 'site-falcon', name: 'Falcon Creek Mine',  location: 'Falcon Creek',    region: 'Western',  status: 'active' },
  { id: 'site-silver', name: 'Silver Plains Mine', location: 'Silver Plains',   region: 'Central',  status: 'active' },
  { id: 'site-east',   name: 'Eastgate Mine',      location: 'Eastgate Valley', region: 'Eastern',  status: 'active' },
]
const MINE_SITES = ['site-north', 'site-falcon', 'site-silver', 'site-east']

export const facilities: DemoFacility[] = [
  { id: 'tsf-north-1',  siteId: 'site-north',  name: 'TSF 1',      freeboardMinM: 1.5, freeboardCriticalM: 1.0, thresholdsSource: 'TSF design report rev D, K. Ndlela Pr.Eng, 2026-03-02' },
  { id: 'tsf-north-2',  siteId: 'site-north',  name: 'TSF 2',      freeboardMinM: 2.0, freeboardCriticalM: 1.2, thresholdsSource: 'TSF design report rev D, K. Ndlela Pr.Eng, 2026-03-02' },
  { id: 'tsf-falcon-1', siteId: 'site-falcon', name: 'Main TSF',   freeboardMinM: 1.8, freeboardCriticalM: 1.1, thresholdsSource: 'Facility audit 2026-01, R. Vermaak Pr.Eng' },
  { id: 'tsf-east-1',   siteId: 'site-east',   name: 'East TSF',   freeboardMinM: null, freeboardCriticalM: null, thresholdsSource: null },
]
// Silver Plains deliberately has no TSF, to show that sites without one skip the section.

// ── Seed: 30 days of daily reports per mine site ──────────────────────────────

const SITE_TARGETS: Record<string, number> = {
  'site-north': 2600, 'site-falcon': 1900, 'site-silver': 1500, 'site-east': 1100,
}
// Eastgate trends below target so alerts, rankings and risks have something to show.
const SITE_BIAS: Record<string, number> = {
  'site-north': 1.05, 'site-falcon': 1.01, 'site-silver': 0.99, 'site-east': 0.86,
}
const WEATHER_POOL = ['Clear', 'Clear', 'Overcast', 'Light Rain', 'Clear', 'Overcast', 'Heavy Rain']

// Which supervisor submits each site's daily report (see `users` seed below).
const SITE_SUPERVISORS: Record<string, string> = {
  'site-north': 'u-super', 'site-falcon': 'u-super-falcon',
  'site-silver': 'u-super-silver', 'site-east': 'u-super-east',
}

export const reports: DemoReport[] = []

for (const siteId of MINE_SITES) {
  const target = SITE_TARGETS[siteId]
  for (let d = 29; d >= 0; d--) {
    const date = isoDaysAgo(d)
    const actual = Math.round(target * SITE_BIAS[siteId] * between(0.88, 1.12))
    const siteFacilities = facilities.filter((f) => f.siteId === siteId)
    const weather = WEATHER_POOL[Math.floor(rand() * WEATHER_POOL.length)]
    const total = siteId === 'site-north' ? 42 : 28
    const absent = rand() < 0.3 ? Math.floor(between(1, 3)) : 0
    reports.push({
      id: newId('rep'),
      siteId,
      date,
      createdAt: `${date}T06:${String(Math.floor(between(10, 50))).padStart(2, '0')}:00Z`,
      supervisorId: SITE_SUPERVISORS[siteId] ?? null,
      tonnesProcessed: Math.round(actual * between(1.02, 1.1)),
      actual,
      target,
      equipRunning: Math.floor(between(4, 8)),
      equipIdle: Math.floor(between(0, 2)),
      equipBreakdown: rand() < 0.2 ? 1 : 0,
      weather,
      tempMin: Math.round(between(8, 14)),
      tempMax: Math.round(between(22, 31)),
      rainfallMm: weather.includes('Rain') ? Math.round(between(2, 24)) : 0,
      windSpeedKmh: Math.round(between(4, 28)),
      windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(rand() * 8)],
      humidityPct: Math.round(between(30, 78)),
      notes: d === 0 ? 'Night shift handover completed without incident.' : null,
      fuel: Math.round(actual * between(0.55, 0.75)),
      labour: { total, present: total - absent, absent, overtime: rand() < 0.25 ? Math.floor(between(2, 9)) : 0 },
      delays: rand() < 0.25
        ? [{ type: 'equipment', hours: Math.round(between(1, 4)), description: 'Cyclone feed pump tripped; reset and monitored.' }]
        : [],
      materials: [{ name: 'Flocculant', quantity: Math.round(between(80, 140)), unit: 'kg' }],
      tsf: siteFacilities.map((f) => ({
        facilityId: f.id,
        freeboard: Number(between(f.freeboardMinM ? f.freeboardMinM + 0.2 : 1.6, 3.2).toFixed(2)),
        poolDepth: Number(between(0.8, 2.4).toFixed(2)),
        rwd: Math.round(between(38, 82)),
        deposited: Math.floor(between(2, 6)),
        ahead: Math.floor(between(1, 4)),
        piezometers: ['PZ-A1', 'PZ-A2', 'PZ-A3'].map((label) => ({
          label,
          value: Number(between(2.2, 4.8).toFixed(2)),
        })),
      })),
      photoUrl: d < 6
        ? svgPhoto(
            ['TSF decant station', 'Slurry pump array', 'Haul road & berms', 'Process plant', 'Return water dam', 'Deposition paddocks'][d],
            ['#1e3a8a', '#1d4ed8', '#0f172a', '#334155', '#1e40af', '#172554'][d],
            ['#60a5fa', '#93c5fd', '#475569', '#94a3b8', '#3b82f6', '#3730a3'][d],
          )
        : null,
      photoCaption: d < 6
        ? ['TSF decant station', 'Slurry pump array', 'Haul road & berms', 'Process plant', 'Return water dam', 'Deposition paddocks'][d]
        : null,
    })
  }
}

// Make today's Eastgate TSF freeboard read LOW so a live safety alert shows
// (East TSF has no limits so it stays verdict-free; use Falcon for the alert).
const todayFalcon = reports.find((r) => r.siteId === 'site-falcon' && r.date === isoDaysAgo(0))
if (todayFalcon && todayFalcon.tsf[0]) {
  todayFalcon.tsf[0].freeboard = 1.42 // below the 1.8m advisory, above 1.1m critical
}

// ── Seed: fleet ───────────────────────────────────────────────────────────────

function asset(
  name: string, type: Equipment['type'], reg: string | null, siteId: string,
  status: Equipment['status'], unit: Equipment['usageUnit'], current: number, due: number,
  location: string,
): Equipment {
  const availability = status === 'breakdown' ? 0 : status === 'maintenance' ? 40 : Math.round(between(88, 99))
  return { id: newId('ast'), name, type, registration: reg, status, usageUnit: unit, usageCurrent: current, usageDue: due, availability, siteId, location }
}

export const assets: Equipment[] = [
  asset('Excavator XC-210',        'Excavator',    'EX-210',   'site-north',  'running',     'hours', 6240, 6400, 'North pit'),
  asset('Excavator XC-260',        'Excavator',    'EX-260',   'site-falcon', 'running',     'hours', 4110, 4600, 'Falcon east face'),
  asset('Tipper T-40 #1',          'Tipper Truck', 'TP-4001',  'site-north',  'running',     'hours', 8890, 9000, 'Haul road A'),
  asset('Tipper T-40 #2',          'Tipper Truck', 'TP-4002',  'site-north',  'maintenance', 'hours', 9120, 9100, 'Workshop bay 2'),
  asset('Tipper T-40 #3',          'Tipper Truck', 'TP-4003',  'site-silver', 'running',     'hours', 5230, 6000, 'Silver haul loop'),
  asset('Grader G-14',             'Dozer/Grader', 'GR-014',   'site-east',   'running',     'hours', 3010, 3500, 'Access roads'),
  asset('Dozer D-8',               'Dozer/Grader', 'DZ-008',   'site-falcon', 'breakdown',   'hours', 7770, 8000, 'Falcon workshop bay'),
  asset('Slurry pump SP-6 #1',     'Pump',         null,       'site-north',  'running',     'hours', 11200, 12000, 'TSF 1 pump station'),
  asset('Slurry pump SP-6 #2',     'Pump',         null,       'site-north',  'running',     'hours', 10940, 11000, 'TSF 2 pump station'),
  asset('Slurry pump SP-4',        'Pump',         null,       'site-falcon', 'running',     'hours', 8450, 9000, 'Main TSF'),
  asset('Return water pump RW-2',  'Pump',         null,       'site-east',   'idle',        'hours', 2210, 3000, 'Return water dam'),
  asset('Generator 250kVA',        'Generator',    null,       'site-silver', 'running',     'hours', 1890, 2500, 'Plant standby'),
  asset('Crew bus 22-seat',        'Light Vehicle','LV-2201',  'site-hq',     'running',     'km',    84200, 90000, 'Head Office'),
  asset('Pickup 4x4 #1',           'Light Vehicle','LV-1104',  'site-north',  'running',     'km',    61200, 65000, 'North Ridge'),
  asset('Pickup 4x4 #2',           'Light Vehicle','LV-1108',  'site-falcon', 'running',     'km',    43800, 50000, 'Falcon Creek'),
  asset('Pickup 4x4 #3',           'Light Vehicle','LV-1112',  'site-east',   'running',     'km',    39150, 40000, 'Eastgate'),
  asset('Service truck',           'Other',        'SV-090',   'site-hq',     'running',     'km',    102300, 110000, 'Mobile workshop'),
]

// ── Seed: breakdowns ──────────────────────────────────────────────────────────

export const breakdowns: BreakdownReport[] = [
  {
    id: newId('bd'),
    assetId: assets.find((a) => a.name === 'Dozer D-8')!.id,
    assetName: 'Dozer D-8',
    issue: 'Final drive overheating under load; metal particles found in oil sample.',
    severity: 'high',
    estDowntimeHrs: 48,
    reportedBy: 'Daniel Kim',
    date: `${isoDaysAgo(1)}T09:40:00Z`,
    status: 'in-progress',
  },
  {
    id: newId('bd'),
    assetId: assets.find((a) => a.name === 'Tipper T-40 #2')!.id,
    assetName: 'Tipper T-40 #2',
    issue: 'Scheduled 9,000h service plus brake pack replacement.',
    severity: 'medium',
    estDowntimeHrs: 24,
    reportedBy: 'Daniel Kim',
    date: `${isoDaysAgo(2)}T14:05:00Z`,
    status: 'in-progress',
  },
]

// ── Seed: SHEQ & certificates ────────────────────────────────────────────────

export const sheqRecords: SheqRecord[] = [
  { id: newId('sh'), type: 'incident',          siteId: 'site-east',   title: 'Minor hand laceration during screen change', severity: 'medium', status: 'open',        date: isoDaysAgo(1),  raisedBy: 'Grace Okafor', raisedById: 'u-sheq',       attachments: 1 },
  { id: newId('sh'), type: 'environmental',     siteId: 'site-falcon', title: 'Quarterly TSF seepage & dust monitoring',     severity: 'high',   status: 'overdue',     date: isoDaysAgo(9),  raisedBy: 'Ravi Patel',   raisedById: 'u-sheq-falcon', attachments: 2 },
  { id: newId('sh'), type: 'inspection',        siteId: 'site-north',  title: 'Monthly pipeline corridor walkdown',          severity: 'low',    status: 'closed',      date: isoDaysAgo(3),  raisedBy: 'Grace Okafor', raisedById: 'u-sheq',       attachments: 0 },
  { id: newId('sh'), type: 'near_miss',         siteId: 'site-north',  title: 'Reversing tipper near light vehicle at berm', severity: 'high',   status: 'in_progress', date: isoDaysAgo(4),  raisedBy: 'Tendai M.',    raisedById: 'u-super',      attachments: 0 },
  // Deliberately unattributed, to show the "no officer recorded" path.
  { id: newId('sh'), type: 'toolbox_talk',      siteId: 'site-silver', title: 'Working near water: rescue readiness',        severity: 'low',    status: 'closed',      date: isoDaysAgo(2),  raisedBy: 'Site crew',    raisedById: null,           attachments: 0 },
  { id: newId('sh'), type: 'corrective_action', siteId: 'site-falcon', title: 'Install secondary containment at fuel bay',   severity: 'high',   status: 'in_progress', date: isoDaysAgo(11), raisedBy: 'Ravi Patel',   raisedById: 'u-sheq-falcon', attachments: 1 },
  { id: newId('sh'), type: 'audit',             siteId: 'site-north',  title: 'External ISO 45001 surveillance audit',       severity: 'medium', status: 'closed',      date: isoDaysAgo(16), raisedBy: 'Grace Okafor', raisedById: 'u-sheq',       attachments: 3 },
]

/** Full text of each seeded SHEQ record, for the manager's read-through view. */
export interface DemoSheqDetail {
  description: string | null
  findings: string | null
  correctiveAction: string | null
  dueDate: string | null
  attachmentNames: string[]
}

export const sheqDetails = new Map<string, DemoSheqDetail>([
  [sheqRecords[0].id, {
    description: 'Fitter sustained a shallow cut to the left palm while changing a vibrating screen panel. First aid administered on site; no lost time.',
    findings: 'Cut-resistant gloves were available but not worn for this task. Panel edges are sharper than the task risk assessment assumes.',
    correctiveAction: 'Reissue glove standard for screen work and update the task risk assessment. Toolbox talk scheduled for all plant crews.',
    dueDate: isoDaysAgo(-6),
    attachmentNames: ['first-aid-register-entry.pdf'],
  }],
  [sheqRecords[1].id, {
    description: 'Quarterly seepage and dust monitoring round for the Main TSF, covering downstream boreholes and perimeter dust buckets.',
    findings: 'Sampling round not completed in the quarter. Two downstream boreholes remain unsampled.',
    correctiveAction: 'Complete the outstanding boreholes and lodge results with the environmental agency. Standing calendar entry created.',
    dueDate: isoDaysAgo(2),
    attachmentNames: ['monitoring-schedule.pdf', 'borehole-map.png'],
  }],
  [sheqRecords[2].id, {
    description: 'Monthly walkdown of the tailings pipeline corridor from the plant to TSF 1 and TSF 2.',
    findings: 'No leaks or wet spots. Two pipe supports flagged for corrosion re-coating next shutdown.',
    correctiveAction: null,
    dueDate: null,
    attachmentNames: [],
  }],
  [sheqRecords[3].id, {
    description: 'Tipper reversed towards a parked light vehicle at the TSF berm; spotter stopped the movement. No contact.',
    findings: 'Reversing camera obscured by dust; light vehicle parked inside the exclusion zone.',
    correctiveAction: 'Re-mark the exclusion zone and brief all drivers. Camera cleaning added to pre-start checklist.',
    dueDate: isoDaysAgo(-3),
    attachmentNames: [],
  }],
  [sheqRecords[4].id, {
    description: 'Toolbox talk on rescue readiness for crews working near the return water dam: lifebuoy positions, buddy rules, emergency numbers.',
    findings: null,
    correctiveAction: null,
    dueDate: null,
    attachmentNames: [],
  }],
  [sheqRecords[5].id, {
    description: 'Secondary containment required at the Falcon Creek fuel bay following the January facility audit.',
    findings: 'Bund walls delivered; civil work approximately 60% complete.',
    correctiveAction: 'Complete bund installation and closeout inspection with the auditor.',
    dueDate: isoDaysAgo(-10),
    attachmentNames: ['audit-extract.pdf'],
  }],
  [sheqRecords[6].id, {
    description: 'External ISO 45001 surveillance audit across North Ridge operations.',
    findings: 'Certificate maintained. Two minor findings: contractor induction records and lifting gear register gaps.',
    correctiveAction: 'Both minor findings closed with evidence submitted to the certification body.',
    dueDate: null,
    attachmentNames: ['audit-report.pdf', 'finding-1-evidence.pdf', 'finding-2-evidence.pdf'],
  }],
])

function certStatus(expiryDate: string, reminderDays: number): Certificate['status'] {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= reminderDays) return 'expiring_soon'
  return 'valid'
}

function cert(siteId: string | null, type: string, number: string, issuedBy: string, expiryInDays: number, reminderDays = 30): Certificate {
  const expiry = isoDaysAgo(-expiryInDays)
  return {
    id: newId('crt'),
    siteId,
    assetId: null,
    certificateType: type,
    certificateNumber: number,
    issuedBy,
    issueDate: isoDaysAgo(300),
    expiryDate: expiry,
    status: certStatus(expiry, reminderDays),
    reminderDays,
    notes: null,
  }
}

export const certificates: Certificate[] = [
  cert('site-north',  'Operating License',                'OL-2026-114', 'Ministry of Mines',        212),
  cert('site-falcon', 'Water Use Permit',                 'WU-88213',    'Water Authority',          21),
  cert('site-east',   'Environmental Management Plan',    'EMP-4471',    'Environmental Agency',     -6),
  cert('site-silver', 'Fire Safety Certificate',          'FS-9902',     'Fire & Rescue Service',    145),
  cert(null,          'Public Liability Insurance',       'PL-55020',    'Meridian Underwriters',    88),
  cert('site-north',  'TSF Safety Certificate',           'TSF-2026-07', 'Dam Safety Board',         310),
]

// ── Seed: meeting packs ───────────────────────────────────────────────────────

export const meetingPacks: DemoPack[] = [
  {
    id: newId('mp'),
    createdAt: `${isoDaysAgo(12)}T08:00:00Z`,
    periodType: 'monthly',
    periodLabel: 'July 2026 Management Meeting',
    previousMinutes: 'Fuel efficiency initiative approved. Eastgate recovery plan to be tabled.',
    status: 'finalised',
    content: {
      agenda: ['Safety & compliance review', 'Production vs plan by site', 'Fleet availability & maintenance', 'Eastgate recovery plan', 'Approvals & next actions'],
      executiveSummary: 'Group production closed 3% ahead of plan. Eastgate remains the drag at -12%; a recovery plan is tabled for approval. Zero lost-time injuries recorded.',
      productionReview: 'North Ridge and Falcon Creek exceeded plan on improved cyclone availability. Silver Plains held plan. Eastgate shortfall traced to haul cycle times and weather delays.',
      safetyReview: 'One medical-treatment case, closed with corrective action. Overdue quarterly environmental monitoring at Falcon Creek requires immediate closeout.',
      fleetReview: 'Fleet availability averaged 92%. Dozer D-8 final drive failure is the notable outage; parts on order, 48h estimated.',
      correctiveActions: ['Close out Falcon Creek quarterly environmental monitoring', 'Complete fuel-bay secondary containment', 'Review reversing procedures at North Ridge berms'],
      recommendationsForApproval: ['Approve Eastgate recovery plan and weekly tracking', 'Approve standby pump purchase for TSF 2'],
      nextMeetingFocus: ['Eastgate recovery progress', 'Wet-season TSF readiness'],
    },
  },
]

// ── Seed: client documents ────────────────────────────────────────────────────

export const clientDocs: DemoDoc[] = [
  { id: newId('doc'), siteId: 'site-north', title: 'Monthly Progress Report — July 2026', docType: 'Progress Report',    fileName: 'north-ridge-progress-jul-2026.pdf', documentDate: isoDaysAgo(10), url: null },
  { id: newId('doc'), siteId: 'site-north', title: 'Environmental Compliance Summary',    docType: 'Compliance Document', fileName: 'north-ridge-environmental.pdf',     documentDate: isoDaysAgo(24), url: null },
]

// ── Seed: user accounts (demo personas) ───────────────────────────────────────

export const users: DemoUser[] = [
  { id: 'u-exec',         email: 'exec@sitecommand.demo',        fullName: 'Alex Morgan',   role: 'executive',    siteId: null,          title: 'Managing Director' },
  { id: 'u-ops',          email: 'operations@sitecommand.demo',  fullName: 'Sofia Reyes',   role: 'ops_manager',  siteId: null,          title: 'Operations Manager' },
  { id: 'u-pm',           email: 'projects@sitecommand.demo',    fullName: 'Priya Naidoo',  role: 'project',      siteId: null,          title: 'Project Manager' },
  { id: 'u-work',         email: 'workshop@sitecommand.demo',    fullName: 'Daniel Kim',    role: 'workshop',     siteId: null,          title: 'Workshop Manager' },
  { id: 'u-sheq',         email: 'sheq@sitecommand.demo',        fullName: 'Grace Okafor',  role: 'sheq',         siteId: null,          title: 'SHEQ Officer' },
  { id: 'u-sheq-falcon',  email: 'sheq.falcon@sitecommand.demo', fullName: 'Ravi Patel',    role: 'sheq',         siteId: 'site-falcon', title: 'SHEQ Officer — Falcon Creek' },
  { id: 'u-sheq-mgr',     email: 'sheq.manager@sitecommand.demo', fullName: 'Amara Osei',   role: 'sheq_manager', siteId: null,          title: 'SHEQ Manager' },
  { id: 'u-super',        email: 'supervisor@sitecommand.demo',  fullName: 'Tendai M.',     role: 'supervisor',   siteId: 'site-north',  title: 'Site Supervisor — North Ridge' },
  { id: 'u-super-falcon', email: 'falcon@sitecommand.demo',      fullName: 'Marcus Vale',   role: 'supervisor',   siteId: 'site-falcon', title: 'Site Supervisor — Falcon Creek' },
  { id: 'u-super-silver', email: 'silver@sitecommand.demo',      fullName: 'Lena Fischer',  role: 'supervisor',   siteId: 'site-silver', title: 'Site Supervisor — Silver Plains' },
  { id: 'u-super-east',   email: 'eastgate@sitecommand.demo',    fullName: 'Owen Blake',    role: 'supervisor',   siteId: 'site-east',   title: 'Site Supervisor — Eastgate' },
  { id: 'u-client',       email: 'client@northwind.demo',        fullName: 'Jordan Reeve',  role: 'client',       siteId: 'site-north',  title: 'Client — Northwind Resources' },
]
