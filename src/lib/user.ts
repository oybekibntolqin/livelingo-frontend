// User + role helpers.
//
// Backend returns roles as `List<String>` on GET /api/users/me. We cache
// the response in-memory for the tab's lifetime so pages don't hit the
// endpoint on every render — role changes require a re-login anyway.

import { api } from './api'

export interface CurrentUser {
  id: string
  email?: string
  fullName?: string
  roles: string[]
  // Anything else the backend returns is fine — we only read what we need.
  [key: string]: unknown
}

let cached: CurrentUser | null = null
let inflight: Promise<CurrentUser> | null = null

export async function getCurrentUser(): Promise<CurrentUser> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = api.get<CurrentUser>('/api/users/me')
    .then((user) => {
      cached = { ...user, roles: user.roles ?? [] }
      return cached
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function clearUserCache(): void {
  cached = null
  inflight = null
}

/**
 * Check whether the user carries any of the given role names.
 *
 * Handles both bare names ("TEACHER") and Spring's ROLE_-prefixed form
 * ("ROLE_TEACHER") because the backend may serialize roles either way
 * depending on where they're pulled from.
 */
export function hasAnyRole(
  user: CurrentUser | null,
  ...roles: string[]
): boolean {
  if (!user?.roles?.length) return false
  const set = new Set(user.roles.map((r) => r.replace(/^ROLE_/, '')))
  return roles.some((r) => set.has(r.replace(/^ROLE_/, '')))
}

/** Convenience for the exact bucket the Writing UI cares about. */
export const canAddQuestion = (u: CurrentUser | null) =>
  hasAnyRole(u, 'TEACHER', 'ADMIN', 'OWNER')

export const canGenerateWithAi = (u: CurrentUser | null) =>
  hasAnyRole(u, 'ADMIN', 'OWNER')
