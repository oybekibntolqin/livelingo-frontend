// Admin panel — turlar + API yordamchilari.
// Backend: AdminController / AdminService bilan aniq mos.

import { api, ApiError } from './api'
import { getAdminSessionToken, clearAdminSessionToken } from './adminAuth'

// MUHIM: har bir /api/admin/** so'rovi shu orqali o'tadi — agar
// backend "session kerak" (403, AdminSessionFilter'dan) qaytarsa,
// eskirgan tokenni tozalab, 'admin-session-expired' hodisasini
// yuboradi. AdminGuard shuni tinglaydi va darhol parol darvozasini
// qayta ko'rsatadi — foydalanuvchi URL'ni qo'lda qayta yozishi
// SHART emas.
async function adminFetch<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      clearAdminSessionToken()
      window.dispatchEvent(new Event('admin-session-expired'))
    }
    throw e
  }
}

// Har bir /api/admin/** so'roviga qo'shiladigan sarlavha — admin
// panel paroli orqali olingan qisqa muddatli session token.
function adminHeaders(): { headers: Record<string, string> } {
  const token = getAdminSessionToken()
  return { headers: token ? { 'X-Admin-Session': token } : {} }
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

export interface AdminStats {
  activeUserCount: number
  totalUserCount: number
  bannedUserCount: number
  pendingReportCount: number
  weeklyGrowth: { label: string; newUsers: number }[]
  monthlyGrowth: { label: string; newUsers: number }[]
}

export interface AdminUserSummary {
  id: string
  firstName: string | null
  lastName: string | null
  username: string
  email: string | null
  profilePhotoUrl: string | null
  roles: string[]
  banned: boolean
  reportCount: number
  postCount: number
  createdAt: string
  lastSeen: string | null
}

export interface AdminUserDetail extends AdminUserSummary {
  phoneNumber: string | null
  bio: string | null
  birthDate: string | null
  countryCode: string | null
  city: string | null
  followerCount: number
  followingCount: number
  languageProgress: {
    languageCode: string
    currentLevel: string | null
    totalXp: number
    streakDays: number
  }[]
}

export interface AdminPostSummary {
  id: string
  content: string
  moderationStatus: string | null
  deleted: boolean
  likeCount: number
  commentCount: number
  createdAt: string
}

export interface AdminReport {
  id: string
  reporterId: string | null
  reporterUsername: string | null
  reportedUserId: string | null
  reportedUsername: string | null
  reportedUserBanned: boolean
  reportedUserReportCount: number
  reason: string | null
  description: string | null
  createdAt: string
  resolved: boolean
  resolvedByUsername: string | null
  resolvedAt: string | null
}

export interface AdminRole {
  id: string
  name: string
  description: string | null
}

export const adminApi = {
  getStats: () => adminFetch(() => api.get<AdminStats>('/api/admin/stats', adminHeaders())),

  getUsers: (search: string, page = 0, size = 20) =>
    adminFetch(() =>
      api.get<Page<AdminUserSummary>>(
        `/api/admin/users?search=${encodeURIComponent(search)}&page=${page}&size=${size}`,
        adminHeaders()
      )
    ),

  getUserDetail: (id: string) =>
    adminFetch(() => api.get<AdminUserDetail>(`/api/admin/users/${id}`, adminHeaders())),

  getUserPosts: (id: string, page = 0, size = 20) =>
    adminFetch(() =>
      api.get<Page<AdminPostSummary>>(
        `/api/admin/users/${id}/posts?page=${page}&size=${size}`,
        adminHeaders()
      )
    ),

  banUser: (id: string) =>
    adminFetch(() => api.put<void>(`/api/admin/users/${id}/ban`, {}, adminHeaders())),
  unbanUser: (id: string) =>
    adminFetch(() => api.put<void>(`/api/admin/users/${id}/unban`, {}, adminHeaders())),

  deletePost: (id: string) =>
    adminFetch(() => api.del<void>(`/api/admin/posts/${id}`, adminHeaders())),

  getReportedUsers: (page = 0, size = 20) =>
    adminFetch(() =>
      api.get<Page<AdminUserSummary>>(
        `/api/admin/reported-users?page=${page}&size=${size}`,
        adminHeaders()
      )
    ),

  getReports: (resolved: boolean | null, page = 0, size = 20) =>
    adminFetch(() =>
      api.get<Page<AdminReport>>(
        `/api/admin/reports?${resolved === null ? '' : `resolved=${resolved}&`}page=${page}&size=${size}`,
        adminHeaders()
      )
    ),

  resolveReport: (id: string) =>
    adminFetch(() => api.put<void>(`/api/admin/reports/${id}/resolve`, {}, adminHeaders())),

  // ── Roles (faqat Owner haqiqatda o'zgartira oladi — backend tekshiradi) ──
  getAllRoles: () => adminFetch(() => api.get<AdminRole[]>('/api/admin/roles', adminHeaders())),

  updateUserRoles: (userId: string, roleNames: string[]) =>
    adminFetch(() =>
      api.put<{ roles: string[] }>(
        `/api/admin/users/${userId}/roles`,
        { roleNames },
        adminHeaders()
      )
    ),
}
