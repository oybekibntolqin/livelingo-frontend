// Report — foydalanuvchini shikoyat qilish, o'z shikoyatlarim ro'yxati.
// Shikoyatni qaytarib olib bo'lmaydi — faqat yaratish va ro'yxatini
// ko'rish mumkin.

import { api } from './api'

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'FAKE_PROFILE'
  | 'SCAM'
  | 'OTHER'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'SCAM', label: 'Scam or fraud' },
  { value: 'OTHER', label: 'Other' },
]

export interface Report {
  id: string
  reporterId: string
  reportedUserId: string
  reportedUserFirstName: string
  reportedUserLastName: string
  reason: ReportReason
  description: string | null
  createdAt: string
}

interface PageResponse<T> {
  content?: T[]
}

function unwrapList<T>(res: T[] | PageResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return []
}

export const reportApi = {
  reportUser: (userId: string, dto: { reason: ReportReason; description?: string }) =>
    api.post(`/api/reports/users/${userId}`, dto),

  getMyReports: async (page = 0, size = 20): Promise<Report[]> => {
    const res = await api.get<Report[] | PageResponse<Report>>(
      `/api/reports/my?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },
}
