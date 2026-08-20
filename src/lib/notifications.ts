// Notifications — turlar + API yordamchilari.
// Backend: NotificationDTO / NotificationController bilan aniq mos.

import { api } from './api'

export interface AppNotification {
  id: string
  senderId: string | null
  senderName: string | null
  senderUsername: string | null
  senderProfilePhotoUrl: string | null
  type: string
  title: string | null
  message: string
  referenceId: string | null
  referenceType: string | null
  referenceThumbnailUrl: string | null
  read: boolean
  readAt: string | null
  createdAt: string
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

export const notificationsApi = {
  list: (page = 0, size = 20) =>
    api.get<Page<AppNotification>>(`/api/notifications?page=${page}&size=${size}`),

  unreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread/count'),

  markAsRead: (id: string) =>
    api.put<void>(`/api/notifications/${id}/read`, {}),

  markAllAsRead: () => api.put<void>('/api/notifications/read-all', {}),
}
