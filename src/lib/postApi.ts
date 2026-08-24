// Post — feed, like, comment, yaratish.
//
// SODDALASHTIRILDI: Outbox/IndexedDB olib tashlandi.  Endi har amal
// bitta so'rov — muvaffaqiyatli bo'lsa promise resolve, bo'lmasa
// reject qiladi.  Optimistik UI va muvaffaqiyatsizlikni ko'rsatish
// (retry tugmasi) chaqiruvchi komponentda (PostCard.tsx,
// Dashboard.tsx) hal qilinadi — bu yerda faqat "bitta amal, aniq
// natija" mavjud.
//
// clientRequestId hali ham yuboriladi (backend allaqachon qo'llab-
// quvvatlaydi) — bu faqat tasodifiy tez-tez bosishdan (double-click)
// himoya uchun, avtomatik qayta urinish uchun EMAS.

import { api, API_BASE } from './api'

export interface PostAuthorAttachment {
  id: string
  url: string
  // Chat'даgi bilan bir xil pattern — kichik, siqilgan preview.
  // Thumbnail bo'lmasa (eski yozuv yoki generatsiya muvaffaqiyatsiz)
  // backend url bilan bir xil qiymat qaytaradi (fallback).
  thumbnailUrl?: string
  // Telegram uslubidagi darhol ko'rinadigan xira placeholder (base64)
  tinyPreview?: string | null
  fileName: string
  contentType: string
  size: number
  mediaType: string
}

export interface Post {
  id: string
  authorId: string
  authorName: string
  username: string | null
  authorProfileDTO: PostAuthorAttachment | null
  following: boolean
  content: string
  language: 'ENGLISH' | 'UZBEK' | 'RUSSIAN' | 'OTHER'
  cefrLevel: string | null
  attachments: PostAuthorAttachment[]
  tags: string[]
  edited: boolean
  editedAt: string | null
  createdAt: string
  likeCount?: number
  liked?: boolean
  commentCount?: number
}

export interface PostComment {
  id: string
  postId: string
  authorId: string
  authorFirstName: string
  authorLastName: string
  authorUsername?: string | null
  authorProfileDTO: PostAuthorAttachment | null
  content: string
  edited: boolean
  editedAt: string | null
  createdAt: string
  clientRequestId?: string | null
  // Optimistik holat — hali yuborilmoqda yoki yuborilmadi
  _pending?: boolean
  _failed?: boolean
}

export type PostLanguage = 'ENGLISH' | 'UZBEK' | 'RUSSIAN' | 'OTHER'

export interface CreatePostInput {
  content: string
  language: PostLanguage
  cefrLevel?: string
  tags?: string[]
  imageFile?: File
  // Rasm yuklash progressi (0-100) — ComposeModal progress bar
  // ko'rsatishi uchun. Ixtiyoriy — berilmasa hech narsa o'zgarmaydi.
  onUploadProgress?: (percent: number) => void
}

interface PageResponse<T> {
  content?: T[]
}

function unwrapList<T>(res: T[] | PageResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return []
}

export const postApi = {
  // ── O'qish (o'zgarmagan) ──
  // mode: 'home' — created_at DESC saqlanadi, ozgina aralashgan (80% eng
  // yangi + 20% tasodifiy). 'explore' — Search sahifasidagi grid uchun,
  // to'liq aralashtiriladi (tartib muhim emas).
  feed: async (page = 0, size = 20, mode: 'home' | 'explore' = 'home'): Promise<Post[]> => {
    const res = await api.get<Post[] | PageResponse<Post>>(
        `/api/posts?page=${page}&size=${size}&mode=${mode}`
    )
    return unwrapList(res)
  },

  likeInfo: (postId: string) =>
      api.get<{ count: number; liked: boolean }>(`/api/posts/${postId}/like`),

  commentCount: async (postId: string): Promise<number> => {
    const res = await api.get<{ count: number }>(
        `/api/posts/${postId}/comments/count`
    )
    return res?.count ?? 0
  },

  comments: async (postId: string, page = 0, size = 20): Promise<PostComment[]> => {
    const res = await api.get<PostComment[] | PageResponse<PostComment>>(
        `/api/posts/${postId}/comments?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },

  // ── Yozish — endi to'g'ridan-to'g'ri, bitta urinish ──

  like: (postId: string) =>
      api.post(`/api/posts/${postId}/like`, undefined),

  unlike: (postId: string) =>
      api.del(`/api/posts/${postId}/like`),

  addComment: (postId: string, content: string, clientRequestId?: string) =>
      api.post(`/api/posts/${postId}/comments`, content, {
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          ...(clientRequestId ? { 'Idempotency-Key': clientRequestId } : {}),
        },
      }),

  // Post yaratish — rasm bo'lsa AVVAL sinxron yuklanadi (oddiy,
  // to'g'ridan-to'g'ri), keyin post yaratiladi.  Ikkalasi ham
  // bitta oqim — muvaffaqiyatsiz bo'lsa xato otiladi, chaqiruvchi
  // (ComposeModal) buni ko'rsatib, foydalanuvchiga qayta "Post"
  // bosishni taklif qiladi.
  createPost: async (input: CreatePostInput): Promise<Post> => {
    let attachmentIds: string[] = []

    if (input.imageFile) {
      const uploaded = await uploadImageToServer(input.imageFile, input.onUploadProgress)
      // MUHIM: attachment metadata'sini qayta yubormaymiz (objectKey
      // barribir /api/chat/attachments javobida yo'q edi — shuning
      // uchun har doim undefined bo'lardi). Buning o'rniga faqat
      // attachmentId yuboramiz — backend allaqachon yuklangan
      // AttachmentContent'ga bog'lanadi, dublikat yozuv yaratmaydi.
      attachmentIds = [uploaded.attachmentId]
    }

    const clientRequestId = crypto.randomUUID()

    return api.post<Post>('/api/posts', {
      content: input.content,
      language: input.language,
      cefrLevel: input.cefrLevel ?? null,
      tags: input.tags ?? [],
      attachmentIds,
      clientRequestId,
    })
  },

  // ── Bitta post (share link ochilganda ishlatiladi) ──
  getPostById: (postId: string) =>
      api.get<Post>(`/api/posts/post-by-id/${postId}`),

  deletePost: (postId: string) => api.del(`/api/posts/${postId}`),
}

// Share qilinadigan link — bizning ilovamizning o'z domeniga
// ishora qiladi (R2/CDN xom URL emas).  Instagram'нинг
// instagram.com/reel/{id} bilan bir xil mantiq: link bosilganda
// R2 fayli emas, BIZNING ilovamiz ochiladi.
//
// MUHIM: ilova HashRouter ishlatadi — haqiqiy route "#" belgisidan
// keyin yoziladi (masalan /#/posts/abc123).  "#"ni unutish React
// Router'ga hech qanday route ko'rsatmaydi, natijada standart
// (Landing) sahifa ochilib qoladi — bu safar aynan shu bug tuzatildi.
export function getPostShareUrl(postId: string): string {
  return `${window.location.origin}/#/posts/${postId}`
}

interface UploadedAttachmentResult {
  attachmentId: string
  url: string
  fileName: string
  contentType: string
  size: number
  mediaType: string
}

// Rasm faylini serverga yuklash — mavjud chat attachment endpoint'ini
// qayta ishlatamiz.  Oddiy, bir martalik: muvaffaqiyatsiz bo'lsa xato
// otadi, hech qanday avtomatik qayta urinish yo'q.
// MUHIM TUZATISH: avval `fetch()` ishlatilardi — bu API upload
// progressini KUZATISH IMKONIYATI umuman bermaydi (fetch'нинг
// Request body'si progress event bermaydi). XMLHttpRequest'ga
// o'tkazildi — endi Chat/Listening'даgi bilan bir xil, haqiqiy
// progress foizini ko'rsatish mumkin.
function uploadImageToServer(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedAttachmentResult> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mediaType', 'IMAGE')

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
        reject(new Error(xhr.responseText || `Rasm yuklanmadi (${xhr.status})`))
      }
    }
    xhr.send(fd)
  })
}

// Backend PostDTO'да likeCount/commentCount YO'Q — bular har doim
// alohida so'ralishi kerak.  Bu funksiya buni bir joyda qiladi,
// shunda Dashboard/Profile/Search kabi har xil sahifa bir xil
// xatoni (sonlar 0 ko'rinishi) qaytadan qilmaydi.
export async function enrichPostsWithCounts(posts: Post[]): Promise<Post[]> {
  return Promise.all(
    posts.map(async (p) => {
      const [likeInfo, commentCount] = await Promise.all([
        postApi.likeInfo(p.id).catch(() => ({ count: 0, liked: false })),
        postApi.commentCount(p.id).catch(() => 0),
      ])
      return {
        ...p,
        likeCount: likeInfo.count,
        liked: likeInfo.liked,
        commentCount,
      }
    })
  )
}
