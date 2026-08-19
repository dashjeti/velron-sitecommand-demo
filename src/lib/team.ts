import { users } from '../demo/db'
import type { Role } from '../types'

/**
 * Demo implementation of the team roster API over the in-memory store.
 *
 * Who reports to a manager. The oversight dashboards need the full roster, not
 * just the people who happen to have submitted something, so that a supervisor
 * or officer who has gone quiet is visible rather than invisible.
 */
export interface TeamMember {
  id: string
  name: string
  role: Role
  /** The site they are assigned to, or null when they are group-wide. */
  siteId: string | null
}

export async function fetchTeam(roles: Role[]): Promise<TeamMember[]> {
  return users
    .filter((u) => roles.includes(u.role))
    .map((u) => ({ id: u.id, name: u.fullName, role: u.role, siteId: u.siteId }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Initials for an avatar chip, matching the sidebar treatment. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
