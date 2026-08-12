import { assets, newId } from '../demo/db'
import type { Equipment, EquipmentStatus, EquipmentType, UsageUnit } from '../types'

/** Demo implementation of the asset register API over the in-memory store. */

export async function fetchAssets(): Promise<Equipment[]> {
  return assets.map((a) => ({ ...a }))
}

export interface AssetInput {
  name: string
  registration: string | null
  category: EquipmentType
  status: EquipmentStatus
  usageUnit: UsageUnit
  usageCurrent: number
  usageDue: number
  siteId: string | null
  location: string | null
}

function availabilityFor(status: EquipmentStatus): number {
  return status === 'breakdown' ? 0 : status === 'maintenance' ? 40 : 95
}

export async function createAsset(input: AssetInput): Promise<{ id: string | null; error: string | null }> {
  const id = newId('ast')
  assets.push({
    id,
    name: input.name,
    type: input.category,
    registration: input.registration,
    status: input.status,
    usageUnit: input.usageUnit,
    usageCurrent: input.usageCurrent,
    usageDue: input.usageDue,
    availability: availabilityFor(input.status),
    siteId: input.siteId ?? '',
    location: input.location ?? '',
  })
  return { id, error: null }
}

export async function updateAsset(id: string, input: AssetInput): Promise<{ error: string | null }> {
  const a = assets.find((x) => x.id === id)
  if (!a) return { error: 'Asset not found.' }
  a.name = input.name
  a.type = input.category
  a.registration = input.registration
  a.status = input.status
  a.usageUnit = input.usageUnit
  a.usageCurrent = input.usageCurrent
  a.usageDue = input.usageDue
  a.siteId = input.siteId ?? ''
  a.location = input.location ?? ''
  a.availability = availabilityFor(input.status)
  return { error: null }
}

export async function deleteAsset(id: string): Promise<{ error: string | null }> {
  const i = assets.findIndex((x) => x.id === id)
  if (i >= 0) assets.splice(i, 1)
  return { error: null }
}

export async function updateAssetReadings(updates: { id: string; reading: number }[]): Promise<void> {
  for (const u of updates) {
    const a = assets.find((x) => x.id === u.id)
    if (a) a.usageCurrent = u.reading
  }
}
