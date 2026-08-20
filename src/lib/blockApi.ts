// Block — foydalanuvchini block/unblock qilish, block qilinganlar ro'yxati.

import { api } from './api'

export interface BlockedUser {
  id: string
  firstName: string
  lastName: string
  profilePhotoUrl: string | null
}

interface PageResponse<T> {
  content?: T[]
}

function unwrapList<T>(res: T[] | PageResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return []
}

export const blockApi = {
  isBlocked: (userId: string) => api.get<boolean>(`/api/blocks/check/${userId}`),

  block: (userId: string) => api.post(`/api/blocks/${userId}`, undefined),

  unblock: (userId: string) => api.del(`/api/blocks/${userId}`),

  getBlockedUsers: async (page = 0, size = 20): Promise<BlockedUser[]> => {
    const res = await api.get<BlockedUser[] | PageResponse<BlockedUser>>(
      `/api/blocks?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },
}
