// Ban/unban holatini kuzatish — YAGONA markaz.
//
// MUHIM (nima uchun bu fayl kerak):
// Foydalanuvchi ban qilinganda backend WebSocket ulanishini yopadi
// (4003 — ACCOUNT_BANNED, qarang chatSocket.ts) va chatSocket bundan
// keyin qayta ulanishga urinmaydi (permanentlyClosed=true). Lekin WS
// yopiq bo'lgani uchun endi "unban bo'ldimi?" degan xabarni WebSocket
// orqali OLIB BO'LMAYDI — shuning uchun buni faqat REST polling orqali
// tekshiramiz (GET /api/users/me/status), va faqat foydalanuvchi ban
// qilingan holatdagina ishlaydi. Ban bo'lmasa — bu poller ishlamaydi,
// hech qanday qo'shimcha so'rov yubormaydi (ortiqcha yuklama yo'q).
import { API_BASE, refreshAccessToken } from './api'
import { getToken } from './auth'
import { chatSocket } from './chatSocket'

const POLL_INTERVAL_MS = 8000

// Foydalanuvchi ban qilinganda darhol (real-time) UI'ga signal berish
// uchun global event. AccountBannedOverlay shu eventni tinglab, sahifa
// yangilanishini yoki keyingi API so'rovining 403 qaytarishini
// KUTMASDAN darhol to'liq ekranli xabarni ko'rsatadi.
export const ACCOUNT_BANNED_EVENT = 'account-banned'

export interface BannedEventDetail {
    title?: string
    message?: string
}

function dispatchBanned(detail?: BannedEventDetail) {
    window.dispatchEvent(new CustomEvent<BannedEventDetail>(ACCOUNT_BANNED_EVENT, { detail }))
}

let timer: number | null = null

// ═════════════════════════════════════════════════════════════════
// MUHIM TUZATISH: avval bu funksiya HAR QANDAY muvaffaqiyatsiz javobni
// (response.ok === false) "banned" deb hisoblardi. Bu ikki BUTUNLAY
// BOSHQA holatni bir-biriga aralashtirib yuborardi:
//
//   401 — access token muddati tugagan (JwtAuthFilter shunchaki
//         authentication o'rnatmaydi, so'rov "authenticated()" qoidasiga
//         tushib, Spring Security standart 401 qaytaradi). Bu — ODDIY,
//         kutilgan holat, HAR 15 daqiqada bir marta sodir bo'ladi.
//
//   403 + {"banned": true} — foydalanuvchi HAQIQATAN HAM ban qilingan
//         (JwtAuthFilter buni ATAYLAB, aniq shu shaklda qaytaradi).
//
// Endi: 401 kelsa — avval /api/auth/refresh orqali yangi access token
// olishga urinamiz (xuddi apiFetch qiladigani kabi) va faqat REFRESH
// HAM MUVAFFAQIYATSIZ bo'lsa, "holat noaniq" (null) deb qaytaramiz —
// BANNED emas. Faqat backend aniq {"banned": true} qaytargandagina
// haqiqiy ban deb hisoblanadi.
// ═════════════════════════════════════════════════════════════════
async function fetchIsBanned(): Promise<boolean | null> {
    let token = getToken()
    if (!token) return null

    const request = (accessToken: string) =>
        fetch(`${API_BASE}/api/users/me/status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: 'include',
        }).catch(() => null)

    let response = await request(token)
    if (!response) return null // tarmoq xatosi — holat noaniq, ban emas

    if (response.status === 401) {
        // Token muddati tugagan bo'lishi mumkin — banned deb xulosa
        // chiqarishdan OLDIN yangilashga urinamiz.
        const newToken = await refreshAccessToken()

        if (!newToken) {
            // Refresh ham muvaffaqiyatsiz — sessiya haqiqatan ham
            // tugagan bo'lishi mumkin, lekin bu BAN EMAS. apiFetch
            // (boshqa har qanday so'rovda) buni allaqachon to'g'ri
            // ushlab, foydalanuvchini /sign-in'ga yo'naltiradi — bu
            // yerda faqat "noaniq" deb qaytaramiz, suspended overlay
            // ko'rsatmaymiz.
            return null
        }

        response = await request(newToken)
        if (!response) return null
    }

    if (response.status === 403) {
        // Faqat shu yerda, va faqat backend body'da aniq banned:true
        // bo'lsa, haqiqiy ban deb hisoblaymiz.
        try {
            const data = await response.json()
            return Boolean(data.banned)
        } catch {
            return false
        }
    }

    if (!response.ok) {
        // Boshqa kutilmagan xatolik (masalan 500) — holat noaniq.
        return null
    }

    const data = await response.json()
    return Boolean(data.banned)
}

function handleRestored() {
    console.log('[AccountStatus] Account restored — WebSocket qayta ulanmoqda')

    stopAccountStatusChecker()

    // permanentlyClosed=false qilib, ulanishni qayta tiklaydi.
    chatSocket.reset()

    // AppShell/useNotifications shu eventni tinglab, notification
    // ro'yxatini (shu jumladan backend saqlagan "Account restored"
    // xabarini) sahifани yangilamasdan qayta yuklaydi.
    window.dispatchEvent(new CustomEvent('account-restored'))
}

/**
 * Foydalanuvchi HOZIR banned yoki yo'qligini bir martalik tekshiradi.
 * Sahifa banned holatda qayta yuklanganda chaqiriladi — shu orqali
 * chatSocket umuman ulanishga urinmasdan (keyin qayta-qayta
 * urinaverib backendga keraksiz so'rov va WARN logi yubormasdan)
 * to'g'ridan-to'g'ri "yopiq" holatga o'tkaziladi va poller ishga
 * tushadi.
 */
export async function checkAccountStatusOnce(): Promise<void> {
    const banned = await fetchIsBanned()

    if (banned === true) {
        chatSocket.markPermanentlyClosed()
        startAccountStatusChecker()
        // Sahifa banned holatda (qayta) ochilgan — overlayni darhol
        // ko'rsatamiz, keyingi API chaqiruvining 403'ini kutmasdan.
        dispatchBanned()
    }
    // banned === false yoki null -> hech narsa qilmaymiz. Xususan,
    // null (masalan token yangilanmadi/tarmoq xatosi) ENDI overlay
    // ko'rsatmaydi — bu avvalgi xato xatti-harakat edi.
}

/**
 * Foydalanuvchi ilovada turgan paytida REAL-TIME ban qilinganda
 * chaqiriladi (WebSocket orqali ACCOUNT_BANNED/BANNED signali kelganda).
 * WS/poller holatini yangilash bilan bir qatorda ACCOUNT_BANNED_EVENT'ni
 * darhol dispatch qiladi — shu orqali AccountBannedOverlay hech qanday
 * REST so'rov yoki sahifa yangilanishisiz, xuddi shu zahoti ko'rinadi.
 */
export function markBannedNow(detail?: BannedEventDetail) {
    chatSocket.markPermanentlyClosed()
    startAccountStatusChecker()
    dispatchBanned(detail)
}

/**
 * Faqat foydalanuvchi banned bo'lganda chaqirilishi kerak (masalan
 * ACCOUNT_BANNED/BANNED signali kelganda yoki checkAccountStatusOnce
 * banned=true qaytarganda). Ban bo'lmagan holatda BU FUNKSIYA umuman
 * chaqirilmaydi — shuning uchun oddiy (ban qilinmagan) foydalanuvchi
 * uchun hech qanday davriy so'rov yuborilmaydi.
 */
export function startAccountStatusChecker() {
    if (timer !== null) return

    timer = window.setInterval(async () => {
        const banned = await fetchIsBanned()

        if (banned === false) {
            handleRestored()
        }
        // banned === true  -> hali ham banned, kutamiz
        // banned === null  -> holat noaniq (token yangilanmadi yoki
        //                      tarmoq xatosi), keyingi urinishda
        //                      tekshiramiz — "restored" deb XULOSA
        //                      chiqarmaymiz, lekin "banned" deb ham
        //                      qaytadan e'lon qilmaymiz.
    }, POLL_INTERVAL_MS)
}

export function stopAccountStatusChecker() {
    if (timer !== null) {
        clearInterval(timer)
        timer = null
    }
}
