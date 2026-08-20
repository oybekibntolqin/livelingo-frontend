// CallLayer — CallProvider/CallOverlay'ni butun ilova bo'ylab, joriy
// route'dan MUSTAQIL ravishda faol tutadi.
//
// Ilgari CallProvider faqat Chat.tsx ichida mount qilingandi — shu sabab
// qo'ng'iroq faqat ikkala foydalanuvchi ham /chat sahifasida bo'lgandagina
// ishlar edi (Provider unmount bo'lsa, u chatSocket signal obunasidan ham
// chiqib ketadi). Endi bu Provider App darajasida — barcha sahifalarni
// o'rab turadi, shuning uchun foydalanuvchi istalgan sahifada (chat,
// dashboard, learn, profile va h.k.) qo'ng'iroq qila oladi va qabul qila
// oladi.
//
// Faqat quyidagi holatlarda CallProvider ATAYIN mount qilinmaydi:
//   • Foydalanuvchi hali autentifikatsiyadan o'tmagan (landing, sign-in,
//     yoki log out qilingandan keyin — token yo'q)
//   • Onboarding sahifasida (profil hali to'liq sozlanmagan)

import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'
import CallOverlay from '../components/chat/CallOverlay'
import CallProvider from './CallProvider'

const EXCLUDED_PATHS = new Set(['/onboarding'])

export default function CallLayer({ children }: { children: ReactNode }) {
  const location = useLocation()

  const active = isAuthenticated() && !EXCLUDED_PATHS.has(location.pathname)

  if (!active) {
    return <>{children}</>
  }

  return (
    <CallProvider>
      {children}
      <CallOverlay />
    </CallProvider>
  )
}
