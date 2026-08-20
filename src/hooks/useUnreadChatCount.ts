// Umumiy o'qilmagan chat xabarlar sonini kuzatuvchi hook.
//
// Dashboard sidebar'да "Chat" yonида badge sifatida ko'rsatish uchun.
// Ishlash tartibi:
//   1. Mount bo'lganda chat ro'yxatini olib, barcha unreadCount'larni
//      yig'adi
//   2. WebSocket'га ulanib, yangi xabar/seen signallari kelganda
//      qayta hisoblaydi (jonli yangilanish)
//
// Sahifa Chat emas — Dashboard'да ham ishlaydi, chunki WebSocket
// ulanishi global (chatSocket singleton).

import { useEffect, useRef, useState } from 'react'
import { chatApi } from '../lib/chatApi'
import { chatSocket } from '../lib/chatSocket'
import type { SignalMessage } from '../lib/chatTypes'

export function useUnreadChatCount(): number {
  const [count, setCount] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const load = async () => {
      try {
        // MUHIM: bu global badge — foydalanuvchining BARCHA
        // suhbatlaridagi unreadCount yig'indisi kerak, faqat
        // birinchi 20 tasiniki emas. Shuning uchun kattaroq size
        // bilan so'raymiz (bitta so'rov, sahifalash kerak emas —
        // bu faqat sonni yig'ish uchun).
        const { chats: list } = await chatApi.list(0, 500)
        if (!mountedRef.current) return
        const total = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        setCount(total)
      } catch {
        // Tarmoq xatosi — badge ko'rsatilmaydi, ilova buzilmaydi
      }
    }

    load()

    // WebSocket ulanмаган bo'lса ulaymiz (Dashboard'да Chat sahifаga
    // kirmasdan turib ham signal kelишi mumkin)
    chatSocket.connect()

    const unsub = chatSocket.subscribe((sig: SignalMessage) => {
      switch (sig.type) {
        case 'CHAT':
        case 'CHAT_SEEN':
        case 'CHAT_LIST_UPDATE':
        case 'CHAT_DELETE_FOR_EVERYONE':
          load()
          break
      }
    })

    return () => {
      mountedRef.current = false
      unsub()
    }
  }, [])

  return count
}
