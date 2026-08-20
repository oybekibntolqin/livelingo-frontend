// Chat REST chaqiruvlari — mavjud `api` wrapper ustida.

import { api, API_BASE } from './api'
import type {
  AttachmentUploadResult,
  ChatListItem,
  ChatMessage,
  MediaType,
  UserSearchResult,
} from './chatTypes'

export const chatApi = {
  // Chat ro'yxati (oxirgi xabar, unread, online bilan) — SAHIFALANGAN.
  // Backend Page<...> qaytaradi ({content: [...]}), shuning uchun
  // content'ni ajratib olamiz. `hasMore` — conversation() dagi bilan
  // bir xil oddiy mezon: so'ralgan `size` to'liq qaytgan bo'lsa,
  // ehtimol yana bor.
  //
  // MUHIM: avval bu funksiya page/size umuman yubormasdi — har doim
  // backend'ning default'i (page=0, size=20) ishlatilardi. Shuning
  // uchun 20 tadan ko'p suhbati bor foydalanuvchi HECH QACHON
  // qolganlarini ko'ra olmasdi (ChatList'да scroll listener ham
  // yo'q edi). Endi ikkalasi ham qo'shildi (bu yerda + Chat.tsx +
  // ChatList.tsx).
  list: async (
    page = 0,
    size = 20
  ): Promise<{ chats: ChatListItem[]; hasMore: boolean }> => {
    const res = await api.get<ChatListItem[] | { content?: ChatListItem[] }>(
      `/api/chats/list?page=${page}&size=${size}`
    )
    let arr: ChatListItem[] = []
    if (Array.isArray(res)) arr = res
    else if (res && Array.isArray(res.content)) arr = res.content
    return { chats: arr, hasMore: arr.length >= size }
  },

  // Bitta suhbat tarixi — SAHIFALANGAN.  Backend Page qaytaradi va
  // DESC tartibda (eng yangi birinchi, page 0 = eng yangi N ta) —
  // biz eskisidan yangisiga tartiblaymiz (ekranda tabiiy o'qish
  // uchun).  `hasMore` — yuqoriga skroll qilganda yana eski
  // xabarlar bor-yo'qligini bildiradi.
  conversation: async (
    otherUserId: string,
    page = 0,
    size = 20
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    const res = await api.get<
      ChatMessage[] | { content?: ChatMessage[] }
    >(`/api/chats/conversation/${otherUserId}?page=${page}&size=${size}`)

    let arr: ChatMessage[] = []
    if (Array.isArray(res)) {
      arr = res
    } else if (res && Array.isArray(res.content)) {
      arr = res.content
    }
    // MUHIM TUZATISH: avval `hasMore` backend Page'нинг `last`/
    // `totalPages` maydonlariga tayanardi — bu maydonlar nomi yoki
    // shakli (masalan backend Spring versiyasi/konfiguratsiyasi
    // sabab) kutilganidan farq qilsa, `hasMore` doim `false` bo'lib
    // qolardi — va foydalanuvchi tepaga qancha skroll qilmasin,
    // HECH QANDAY so'rov ketmasdi (aynan shu muammo yuz bergan
    // bo'lishi mumkin). Endi butunlay ODDIY, ISHONCHLI mezon:
    // agar so'ralgan `size` to'liq qaytgan bo'lsa — ehtimol yana
    // bor (keyingi skrollда tekshiramiz); to'liqdan KAM qaytgan
    // bo'lsa — bu suhbatning boshi, aniq tugagan.
    const hasMore = arr.length >= size

    // Eskidan yangiga (createdAt bo'yicha)
    const sorted = arr.slice().sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    return { messages: sorted, hasMore }
  },

  // Xabarni ko'rildi deb belgilash
  markSeen: (messageId: string) =>
    api.post('/api/chats/message/seen', { messageId }),

  // Faqat menda o'chirish
  deleteForMe: (messageId: string) =>
    api.del(`/api/chats/messages/${messageId}/me`),

  // Hamma uchun o'chirish (backend'da endpoint nomida typo: "eveyone")
  deleteForEveryone: (messageId: string) =>
    api.del(`/api/chats/message/${messageId}/eveyone`),

  // Xabarni tahrirlash
  edit: (messageId: string, content: string) =>
    api.put(`/api/chats/message/${messageId}`, { content }),

  // User qidiruv — hali chatlashmagan odamlarni topish uchun.
  // Backend Page<User> qaytaradi, content'ni ajratamiz.
  searchUsers: async (q: string): Promise<UserSearchResult[]> => {
    if (q.trim().length < 2) return []
    const res = await api.get<
      UserSearchResult[] | { content?: UserSearchResult[] }
    >(`/api/users/search?q=${encodeURIComponent(q.trim())}&size=20`)
    if (Array.isArray(res)) return res
    if (res && Array.isArray(res.content)) return res.content
    return []
  },
}

// ── Attachment yuklash — multipart, api wrapper'dan tashqarida ──
// (api wrapper JSON uchun; bu yerda FormData kerak)
export async function uploadChatAttachment(
  file: File,
  mediaType?: MediaType,
  durationSeconds?: number,
  onProgress?: (percent: number) => void
): Promise<AttachmentUploadResult> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    if (mediaType) fd.append('mediaType', mediaType)
    if (durationSeconds != null)
      fd.append('durationSeconds', String(Math.round(durationSeconds)))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/chat/attachments`)

    const token = localStorage.getItem('jwt')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onerror = () => reject(new Error('Tarmoq xatosi'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error("Server javobi noto'g'ri"))
        }
      } else {
        reject(new Error(xhr.responseText || `Xato (${xhr.status})`))
      }
    }
    xhr.send(fd)
  })
}

// Fayl turidan MediaType aniqlash (frontend tomonda)
export function detectMediaType(file: File): MediaType {
  const t = file.type
  if (t.startsWith('image/')) return 'IMAGE'
  if (t.startsWith('video/')) return 'VIDEO'
  if (t.startsWith('audio/')) return 'AUDIO'
  return 'FILE'
}

// Hajmni chiroyli ko'rsatish
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Sekundni MM:SS ko'rinishida
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
