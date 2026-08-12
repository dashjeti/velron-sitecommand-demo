export type Role =
  | 'supervisor'
  | 'workshop'
  | 'sheq'
  | 'project'
  | 'executive'
  | 'client'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  title: string
  siteId?: string // for supervisors / clients
  initials: string
}

export type SiteStatus = 'on-track' | 'attention' | 'critical'

export interface Site {
  id: string
  name: string
  code: string
  location: string
  commodity: string
  manager: string
  status: SiteStatus
}

export interface PiezometerReading {
  label: string
  value: number
}

export interface TSFReading {
  freeboard: number
  poolDepth: number
  returnWaterDamLevel: number
  depositedPaddocks: number
  paddocksAheadOfDeposition: number
  piezometers: PiezometerReading[]
}

export interface ProductionDay {
  date: string // ISO yyyy-mm-dd
  siteId: string
  target: number // tonnes
  actual: number // tonnes
  fuel: number // litres
}

// Matches the assets.category values in the database (the discovery brief's set)
export type EquipmentType =
  | 'Excavator'
  | 'Tipper Truck'
  | 'Dozer/Grader'
  | 'Light Vehicle'
  | 'Pump'
  | 'Generator'
  | 'Other'

export const EQUIPMENT_TYPES: EquipmentType[] = [
  'Excavator', 'Tipper Truck', 'Dozer/Grader', 'Light Vehicle', 'Pump', 'Generator', 'Other',
]

export type EquipmentStatus = 'running' | 'idle' | 'breakdown' | 'maintenance'

// Road vehicles are serviced on kilometres, plant on engine hours.
export type UsageUnit = 'hours' | 'km'

export interface Equipment {
  id: string
  name: string
  type: EquipmentType
  registration: string | null
  status: EquipmentStatus
  usageUnit: UsageUnit
  usageCurrent: number // engine hours or km, per usageUnit
  usageDue: number // next service at this reading; 0 means not set
  availability: number // %
  siteId: string
  location: string
}

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface BreakdownReport {
  id: string
  assetId: string
  assetName: string
  issue: string
  severity: Severity
  estDowntimeHrs: number
  reportedBy: string
  date: string
  status: 'open' | 'in-progress' | 'resolved'
}

// DB-aligned values (snake_case matching sheq_records.record_type)
export type SheqType =
  | 'incident'
  | 'near_miss'
  | 'toolbox_talk'
  | 'inspection'
  | 'audit'
  | 'environmental'
  | 'corrective_action'

export const SHEQ_LABELS: Record<SheqType, string> = {
  incident:          'Incident',
  near_miss:         'Near Miss',
  toolbox_talk:      'Toolbox Talk',
  inspection:        'Safety Inspection',
  audit:             'Audit Finding',
  environmental:     'Environmental Inspection',
  corrective_action: 'Corrective Action',
}

export interface SheqRecord {
  id: string
  type: SheqType
  siteId: string
  title: string
  severity: Severity
  status: 'open' | 'in_progress' | 'closed' | 'overdue'
  date: string
  raisedBy: string
  attachments: number
}

export interface Certificate {
  id: string
  siteId: string | null
  assetId: string | null
  certificateType: string
  certificateNumber: string | null
  issuedBy: string | null
  issueDate: string | null
  expiryDate: string
  status: 'valid' | 'expiring_soon' | 'expired'
  reminderDays: number
  notes: string | null
}

export interface SiteReport {
  id: string
  siteId: string
  date: string
  tonnesProcessed: number
  target: number
  actualOutput: number
  fuel: number
  equipRunning: number
  equipIdle: number
  equipBreakdown: number
  tsf: TSFReading
  photoName?: string
  notes: string
  submittedBy: string
}

export interface Issue {
  id: string
  siteId: string
  title: string
  severity: Severity
  age: string
}

export interface ClientDeliverable {
  id: string
  title: string
  type: 'Progress Report' | 'Production Report' | 'Compliance Document' | 'Deliverable'
  date: string
  status: 'available' | 'pending'
}
