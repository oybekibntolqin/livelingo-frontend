// Admin Panel — shaxsiy parol orqali olinadigan session token'ni
// boshqarish. sessionStorage'да saqlanadi — tab yopilsa avtomatik
// yo'qoladi (asosiy login token — localStorage'da, doimiy;
// bu esa ataylab QISQA muddatli va vaqtinchalik).

import { api } from './api'

const STORAGE_KEY = 'adminSessionToken'

export function getAdminSessionToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function setAdminSessionToken(token: string): void {
  sessionStorage.setItem(STORAGE_KEY, token)
}

export function clearAdminSessionToken(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export const adminAuthApi = {
  status: () => api.get<{ hasPassword: boolean }>('/api/admin/auth/status'),

  setPassword: (password: string, currentPassword?: string) =>
    api.post<{ sessionToken: string }>('/api/admin/auth/set-password', {
      password,
      currentPassword: currentPassword ?? null,
    }),

  verifyPassword: (password: string) =>
    api.post<{ sessionToken: string }>('/api/admin/auth/verify-password', {
      password,
    }),
}
