// Access token storage utilities.
//
// MUHIM O'ZGARISH: bu — endi "asosiy" sessiya emas. Access token
// (JWT) endi qisqa muddatli (15 daqiqa, backend: jwt.expiration).
// localStorage'da saqlanishi avvalgidek qoladi (XSS xavfi hali ham
// nazariy jihatdan mavjud, lekin token 15 daqiqadan keyin o'zi
// yaroqsiz bo'ladi — o'g'irlash oynasi juda kichik).
//
// Uzoq muddatli sessiya endi REFRESH TOKEN orqali ishlaydi — u
// butunlay httpOnly cookie'da yashaydi, bu faylda yoki umuman JS
// kodida HECH QACHON ko'rinmaydi/o'qilmaydi (shuning uchun uni
// localStorage'dan "ko'chirib olib boshqa brauzerga qo'yish" endi
// ishlamaydi — DevTools orqali cookie qiymatini ko'rish mumkin bo'lsa
// ham, u faqat BIR MARTA ishlatilishi mumkin: qayta ishlatilsa,
// backend buni o'g'irlash signali deb hisoblab, foydalanuvchining
// BARCHA sessiyalarini bekor qiladi — qarang: RefreshTokenService.rotate).

const KEY = 'jwt'

export function getToken(): string | null {
    return localStorage.getItem(KEY)
}

export function setToken(jwt: string): void {
    localStorage.setItem(KEY, jwt)
}

export function clearToken(): void {
    localStorage.removeItem(KEY)
}

export function isAuthenticated(): boolean {
    return !!getToken()
}

// JWT payload (base64url) ni dekod qiladi. Imzoni tekshirmaydi —
// faqat clientda user id kabi claim'larni o'qish uchun.
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
    try {
        const payload = jwt.split('.')[1]
        if (!payload) return null

        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
        const json = decodeURIComponent(
            atob(padded)
                .split('')
                .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
        )

        return JSON.parse(json)
    } catch {
        return null
    }
}

// Joriy foydalanuvchining ID'sini JWT'dan oladi.
// TODO: agar sizning tokeningizda user id boshqa claim nomida bo'lsa
// (masalan faqat `sub` yoki faqat `userId`), quyidagi ro'yxatni soddalashtiring.
export function getUserIdFromToken(): string | null {
    const token = getToken()
    if (!token) return null

    const payload = decodeJwtPayload(token)
    if (!payload) return null

    const candidate = payload.userId ?? payload.id ?? payload._id ?? payload.sub
    return candidate != null ? String(candidate) : null
}

// Diqqat: refresh-token oqimi (refreshAccessToken) va "barcha
// qurilmalardan chiqish" (revokeAllSessions) funksiyalari ATAYLAB
// shu faylda emas, api.ts'da joylashgan — chunki ular fetch/API_BASE
// bilan ishlaydi va bu faylni api.ts bilan aylanma (circular) import
// qilishdan saqlaydi. Qarang: lib/api.ts.
