// Umumiy notification holatini kuzatuvchi hook — ro'yxat, o'qilmagan
// soni, va real-time yangilanish.
//
// useUnreadChatCount.ts bilan bir xil naqsh: mount bo'lganda
// ro'yxatni oladi, keyin WebSocket'даgi global chatSocket (aynan
// o'sha singleton — signaling kanali chat/call/notification'нинг
// hammasi uchun umumiy) orqali NOTIFICATION signalini kutadi.
//
// Yangi notification kelganda — ro'yxat qayta yuklanadi VA (agar
// ruxsat berilgan bo'lsa) brauzer push ko'rsatiladi.

import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsApi, type AppNotification } from '../lib/notifications'
import { showBrowserNotification } from '../lib/browserNotifications'
import { chatSocket } from '../lib/chatSocket'
import type { SignalMessage } from '../lib/chatTypes'

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const [page, unread] = await Promise.all([
        notificationsApi.list(0, 20),
        notificationsApi.unreadCount(),
      ])
      if (!mountedRef.current) return
      setNotifications(page.content ?? [])
      setUnreadCount(unread.count ?? 0)
    } catch {
      // Tarmoq xatosi — ilova buzilmaydi, shunchaki eski holat qoladi
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()

    // WebSocket ulanmagan bo'lsa ulaymiz — Dashboard'да Notifications
    // panelini ochmasdan turib ham signal kelishi mumkin (masalan
    // Exercises'даgi streak reminder kechqurun kelishi mumkin).
    chatSocket.connect()

    const unsub = chatSocket.subscribe((sig: SignalMessage) => {
      if (sig.type !== 'NOTIFICATION') return

      const payload = sig.payload as Partial<AppNotification> | undefined
      if (payload?.title || payload?.message) {
        showBrowserNotification(
          payload.title || 'LiveLingo',
          payload.message || ''
        )
      }

      // MUHIM: BANNED notification kelganda foydalanuvchi backend
      // darajasida ALLAQACHON banned (JwtAuthFilter — qarang
      // AdminServiceImpl.banUser: DBga yozish sendSystem'dan OLDIN
      // sodir bo'ladi). Shuning uchun pastdagi load() (REST) shu payt
      // 403 bilan muvaffaqiyatsiz tugaydi va ro'yxat/badge yangilanmay
      // qoladi — aynan shu sababli bell panelida ban xabari
      // ko'rinmasdi. Buni oldini olish uchun WS orqali kelgan
      // notification'ni REST natijasini kutmasdan to'g'ridan-to'g'ri
      // (optimistik) ro'yxatga qo'shamiz — bu har doim ishlaydi,
      // chunki WS payload'ning o'zi to'liq NotificationDTO.
      if (payload?.id) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === payload.id)) return prev
          return [payload as AppNotification, ...prev]
        })
        if (!payload.read) {
          setUnreadCount((c) => c + 1)
        }
      }

      // Ban bo'lmagan oddiy holatlarda bu REST orqali ro'yxatni
      // serverdagi haqiqiy holat bilan sinxronlaydi (masalan boshqa
      // tabда o'qilgan bo'lsa). Ban holatida xato bo'lsa ham (catch
      // load() ichida) — yuqoridagi optimistik qo'shish tufayli
      // foydalanuvchi baribir xabarni ko'radi.
      load()
    })

    // Unban bo'lganda ("Account restored") backendda notification
    // yaratiladi, lekin o'sha payt WebSocket ulanishi yopiq bo'ladi
    // (ban paytida yopilgan) — shuning uchun bu xabar signal orqali
    // KELMAYDI. lib/accountStatus.ts qayta ulanish paytida shu eventni
    // yuboradi, biz esa ro'yxatni oddiy REST orqali qayta yuklaymiz —
    // sahifani yangilamasdan bell/notifications panelida ko'rinadi.
    const onAccountRestored = () => {
      load()
      showBrowserNotification(
        'Account restored',
        'Your account has been restored. Welcome back!'
      )
    }
    window.addEventListener('account-restored', onAccountRestored)

    return () => {
      mountedRef.current = false
      unsub()
      window.removeEventListener('account-restored', onAccountRestored)
    }
  }, [load])

  const markAsRead = useCallback(async (id: string) => {
    // Optimistik yangilanish — kutmasdan UI'da darhol o'qilgan
    // ko'rsatiladi, so'ngra backend'gа yuboriladi
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await notificationsApi.markAsRead(id)
    } catch {
      load() // xato bo'lsa — haqiqiy holatni qayta yuklab tiklaymiz
    }
  }, [load])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await notificationsApi.markAllAsRead()
    } catch {
      load()
    }
  }, [load])

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: load }
}
