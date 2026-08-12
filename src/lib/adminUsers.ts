import { users, newId } from '../demo/db'
import type { Role } from '../types'

/** Demo implementation of user management over the in-memory store. */

export interface ManagedUser {
  id: string
  email: string | null
  confirmed: boolean
  lastSignIn: string | null
  fullName: string
  role: Role | null
  siteId: string | null
}

function tempPassword(): string {
  return `Demo-${Math.random().toString(36).slice(2, 8)}!`
}

export async function listUsers(): Promise<{ users: ManagedUser[]; error: string | null }> {
  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      confirmed: true,
      lastSignIn: new Date().toISOString(),
      fullName: u.fullName,
      role: u.role,
      siteId: u.siteId,
    })),
    error: null,
  }
}

export async function inviteUser(input: {
  email: string
  fullName: string
  role: Role
  siteId: string | null
}): Promise<{ error: string | null; emailed?: boolean; tempPassword?: string }> {
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { error: 'A user with this email already exists. Delete it first to re-invite.' }
  }
  users.push({
    id: newId('u'),
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    siteId: input.siteId,
    title: input.fullName,
  })
  return { error: null, emailed: false, tempPassword: tempPassword() }
}

export async function updateUser(input: {
  userId: string
  fullName: string
  role: Role
  siteId: string | null
}): Promise<{ error: string | null }> {
  const u = users.find((x) => x.id === input.userId)
  if (!u) return { error: 'User not found.' }
  u.fullName = input.fullName
  u.role = input.role
  u.siteId = input.siteId
  return { error: null }
}

export async function deleteUser(userId: string): Promise<{ error: string | null }> {
  const i = users.findIndex((x) => x.id === userId)
  if (i >= 0) users.splice(i, 1)
  return { error: null }
}

export async function resetUserPassword(userId: string): Promise<{ error: string | null; tempPassword?: string }> {
  const u = users.find((x) => x.id === userId)
  if (!u) return { error: 'User not found.' }
  return { error: null, tempPassword: tempPassword() }
}
