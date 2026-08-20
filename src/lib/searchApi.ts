// searchApi — Instagram uslubidagi qidiruv paneli uchun.
//
// Faqat foydalanuvchi qidiruvi: backend'da haqiqiy endpoint bor —
// GET /api/users/search?q=&size= — ism (firstName), familiya
// (lastName) va username bo'yicha qidiradi (chatApi.searchUsers
// bilan bir xil endpoint, shu yerda qayta ishlatildi).

import { api } from './api'
import type { UserSearchResult } from './chatTypes'

interface PageResponse<T> {
  content?: T[]
}

function unwrapList<T>(res: T[] | PageResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return []
}

// ── Foydalanuvchi qidiruvi (haqiqiy backend endpoint) ──
export async function searchUsers(query: string, size = 20): Promise<UserSearchResult[]> {
  const q = query.trim()
  if (q.length === 0) return []
  const res = await api.get<UserSearchResult[] | PageResponse<UserSearchResult>>(
    `/api/users/search?q=${encodeURIComponent(q)}&size=${size}`
  )
  return unwrapList(res)
}

export const searchApi = { searchUsers }

