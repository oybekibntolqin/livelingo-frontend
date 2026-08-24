// Profile — foydalanuvchi profili, follow/unfollow, uning postlari.

import { api, API_BASE } from './api'
import type { Post } from './postApi'

export interface UserLanguage {
  languageCode: string
  languageRole: 'NATIVE' | 'LEARNING'
  cefrLevel: string | null
}

export type Gender = 'MALE' | 'FEMALE'

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  username: string | null
  profilePhotoUrl: string | null
  bio: string | null
  gender: Gender | null
  birthDate: string | null // ISO — "YYYY-MM-DD"
  countryCode: string | null
  city: string | null
  languages: UserLanguage[]
  roles: string[]
  online: boolean
  // Ko'ring: backend PresenceVisibilityService — true bo'lsa haqiqiy
  // online holat bizdan yashirilgan, `lastSeenLabel` shu o'rniga
  // ko'rsatilishi kerak.
  presenceHidden: boolean
  lastSeenLabel: string | null
  // Ban qilingan bo'lsa — "Deleted Account" sifatida ko'rsatiladi.
  deletedAccount: boolean
  // Faqat /me javobida ma'noli — joriy foydalanuvchining o'z
  // maxfiylik sozlamasi (Settings sahifasidagi toggle shuni o'qiydi).
  showOnlineStatus: boolean
  profileCompleted: boolean
  followersCount: number
  followingCount: number
  postCount: number
}

// GET /api/follows/{userId}/followers|following backend'da
// UserShortDTO qaytaradi — UserProfile'дан farqli, yengilroq.
export interface FollowUser {
  id: string
  firstName: string
  lastName: string
  profilePhotoUrl: string | null
  online: boolean
}

// GET /api/users — UserListDTO, "suggested users" uchun ishlatiladi.
export interface SuggestedUser {
 id: string
  name: string
  lastName?: string | null
  username?: string | null
  bio: string | null
  region: string | null
  gender: string | null
  age: string | null
  avatar: string | null
  presence: string | null
}

interface PageResponse<T> {
  content?: T[]
}

function unwrapList<T>(res: T[] | PageResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return []
}

// GET /api/users/me/status — yengil, tez tekshiruv (faqat ikkita
// boolean). RequireCompletedProfile guard shu yerdan foydalanadi —
// to'liq profil (followers/following va h.k.) yuklanishi shart emas,
// faqat "onboarding tugaganmi" va "banned emasmi" bilinsa kifoya.
export interface MyStatus {
  banned: boolean
  profileCompleted: boolean
}

export const profileApi = {
  // ── Profil ──
  getProfile: (userId: string) => api.get<UserProfile>(`/api/users/${userId}`),

  getMyProfile: () => api.get<UserProfile>('/api/users/me'),

  getMyStatus: () => api.get<MyStatus>('/api/users/me/status'),

  updateProfile: (dto: {
    firstName?: string
    lastName?: string
    username?: string
    bio?: string
    gender?: Gender
    birthDate?: string // ISO — "YYYY-MM-DD"
    city?: string
  }) => api.put<UserProfile>('/api/users', dto),

  // Maxfiylik — online/offline holatni boshqalardan yashirish.
  updatePrivacy: (showOnlineStatus: boolean) =>
    api.put<UserProfile>('/api/users/privacy', { showOnlineStatus }),

  // Profil rasmi — avval xom fayl yuklanadi (mavjud chat-attachments
  // endpoint qayta ishlatiladi), keyin natija shu yerga yuboriladi.
  uploadProfilePhoto: async (file: File): Promise<UserProfile> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mediaType', 'IMAGE')

    const token = localStorage.getItem('jwt')
    const uploadRes = await fetch(`${API_BASE}/api/chat/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    })
    if (!uploadRes.ok) {
      throw new Error(await uploadRes.text().catch(() => 'Rasm yuklanmadi'))
    }
    const uploaded = await uploadRes.json()

    return api.post<UserProfile>('/api/users/profile-photo', {
      fileName: uploaded.fileName,
      contentType: uploaded.contentType,
      size: uploaded.size,
      objectKey: uploaded.objectKey,
      fileUrl: uploaded.url,
      mediaType: 'IMAGE',
    })
  },

  // Profil rasmini o'chirish — backend endi yangilangan (rasmsiz)
  // profilni qaytaradi.
  deleteProfilePhoto: () => api.del<UserProfile>('/api/users/profile-photo'),

  // ── Follow ──
  isFollowing: (userId: string) =>
    api.get<{ following: boolean }>(`/api/follows/${userId}/check`),

  getCounts: (userId: string) =>
    api.get<{ followers: number; following: number }>(`/api/follows/${userId}/counts`),

  follow: (userId: string) => api.post(`/api/follows/follow/${userId}`, undefined),

  unfollow: (userId: string) => api.del(`/api/follows/follow/${userId}`),

  getFollowers: async (userId: string, page = 0, size = 20): Promise<FollowUser[]> => {
    const res = await api.get<FollowUser[] | PageResponse<FollowUser>>(
      `/api/follows/${userId}/followers?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },

  getFollowing: async (userId: string, page = 0, size = 20): Promise<FollowUser[]> => {
    const res = await api.get<FollowUser[] | PageResponse<FollowUser>>(
      `/api/follows/${userId}/following?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },

  // ── Postlar ──
  getUserPosts: async (userId: string, page = 0, size = 20): Promise<Post[]> => {
    const res = await api.get<Post[] | PageResponse<Post>>(
      `/api/posts/${userId}?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },

  // ── Tavsiya etilgan foydalanuvchilar (follow qilish uchun) ──
  // Backend currentUserId'ni avtomatik chiqarib tashlaydi.  Kattaroq
  // sahifa so'rab, keyin client tomonda aralashtirib (shuffle),
  // "random" ko'rinish beramiz — backend'da alohida randomizatsiya
  // qo'shish shart emas.
  getSuggestedUsers: async (limit = 20): Promise<SuggestedUser[]> => {
    const res = await api.get<SuggestedUser[] | PageResponse<SuggestedUser>>(
      `/api/users?page=0&size=${limit * 2}`
    )
    const list = unwrapList(res)
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list.slice(0, limit)
  },
}
