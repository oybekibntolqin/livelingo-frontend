// Centralized fetch wrapper. Adds JWT auth header, parses JSON or text,
// throws a structured ApiError on non-2xx so callers can branch on status.
//
// MUHIM O'ZGARISH (xavfsizlik): access token endi qisqa muddatli
// (15 daqiqa). Shuning uchun bu fayl endi 401 (token muddati tugagan)
// javobini oddiy "logout" deb hisoblamaydi — avval /api/auth/refresh
// orqali (httpOnly refresh cookie yordamida) yangi access token
// olishga urinadi, muvaffaqiyatli bo'lsa asl so'rovni BIR marta qayta
// yuboradi. Faqat refresh ham muvaffaqiyatsiz bo'lsa, foydalanuvchi
// haqiqatan ham chiqarib yuboriladi.

// const API_BASE = import.meta.env.VITE_API_BASE || 'https://nonimaginary-violette-slakeless.ngrok-free.dev/'
// MUHIM O'ZGARISH: standart qiymat endi BO'SH satr (nisbiy yo'l), avval
// 'http://localhost:8080' edi. Sabab: refresh token httpOnly cookie
// orqali ishlaydi va cookie'lar faqat "bir xil origin" so'rovlarida
// ishonchli yuriladi. vite.config.ts endi /api va /ws so'rovlarini
// backend'ga PROXY qiladi — shuning uchun bo'sh API_BASE bilan barcha
// so'rovlar brauzer nuqtai nazaridan frontend bilan BIR XIL origin
// bo'lib qoladi. Agar to'g'ridan-to'g'ri boshqa backend manziliga
// ulanish kerak bo'lsa (masalan real qurilmada test qilish), buni
// .env.local'da VITE_API_BASE orqali qayta belgilang.
const API_BASE = import.meta.env.VITE_API_BASE || ''
// const API_BASE = import.meta.env.VITE_API_BASE || 'http://172.20.0.1:8080'
import { getAdminSessionToken } from './adminAuth'
import { getToken, setToken, clearToken } from './auth'


export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  // Set to true to skip the Authorization header (e.g. for auth endpoints).
  skipAuth?: boolean
  // Ichki flag — refresh-retry'dan keyin qayta chaqirilganda cheksiz
  // tsiklning oldini olish uchun. Tashqaridan berilmasligi kerak.
  _isRetry?: boolean
}

// ── Refresh single-flight: bir vaqtda bir nechta so'rov 401 olsa,
// faqat BITTA /api/auth/refresh chaqiriladi, qolganlari shuni kutadi. ──
let refreshInFlight: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // httpOnly refresh cookie shu orqali yuboriladi
      })

      if (!res.ok) {
        clearToken()
        return null
      }

      const data = (await res.json()) as { jwt: string }
      setToken(data.jwt)
      return data.jwt
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

// "Barcha qurilmalardan chiqish" — Settings sahifasidagi tugma shuni
// chaqiradi. Serverdagi barcha refresh-token yozuvlarini bekor qiladi.
export async function revokeAllSessions(): Promise<void> {
  const token = getToken()
  await fetch(`${API_BASE}/api/auth/sessions/revoke-all`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  clearToken()
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { body, skipAuth, headers: extraHeaders, _isRetry, ...rest } = options

  const headers = new Headers(extraHeaders)
  if (!headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (!skipAuth) {
    const token = getToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const adminSession = getAdminSessionToken()

    if (adminSession) {
      headers.set('X-Admin-Session', adminSession)
    }
  } // todo

  const init: RequestInit = {
    ...rest,
    headers,
    // Refresh token httpOnly cookie sifatida yuriladi — uni har bir
    // so'rovda (kerak bo'lganda) yuborish uchun credentials shart.
    // Bu faqat /api/auth/** ga ta'sir qiladi (cookie path=/api/auth),
    // boshqa endpointlar uchun amaliy o'zgarish yo'q.
    credentials: 'include',
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, init)

  // Try to parse body even on error so we can surface backend messages.
  const contentType = res.headers.get('Content-Type') || ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '')

  if (!res.ok) {
    // Access token muddati tugagan bo'lishi mumkin — avval refresh'ga
    // urinamiz (faqat auth so'rovlari va allaqachon bir marta retry
    // qilingan so'rovlar bundan mustasno, aks holda cheksiz tsikl
    // yoki login endpointida keraksiz refresh urinishi bo'lardi).
    const isAuthEndpoint = path.startsWith('/api/auth/')
    if (res.status === 401 && !skipAuth && !isAuthEndpoint && !_isRetry) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        return apiFetch<T>(path, { ...options, _isRetry: true })
      }
    }

    // Refresh ham muvaffaqiyatsiz bo'ldi (yoki umuman urinilmadi) —
    // eski token endi yaroqsiz, tozalaymiz.
    if (res.status === 401) {
      clearToken()
    }
    const message =
      (typeof data === 'object' && data && 'message' in data && typeof data.message === 'string'
        ? data.message
        : typeof data === 'string' && data.length > 0
        ? data
        : null) || res.statusText || `Request failed (${res.status})`
    throw new ApiError(res.status, data, message)
  }

  return data as T
}

// Convenience helpers.
export const api = {
  get: <T = unknown>(path: string, opts: ApiOptions = {}) =>
    apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, opts: ApiOptions = {}) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, opts: ApiOptions = {}) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', body }),
  del: <T = unknown>(path: string, opts: ApiOptions = {}) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
}

export { API_BASE }
