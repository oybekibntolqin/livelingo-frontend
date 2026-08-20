// RequireCompletedProfile — YAGONA, markazlashtirilgan route guard.
//
// MUHIM (nima uchun bu komponent kerak):
// Avval har bir sahifa (~40 ta route fayli) faqat "isAuthenticated()"ni
// alohida-alohida tekshirardi, "profileCompleted"ni esa HECH BIRI
// tekshirmasdi. Natijada onboarding tugallanmagan foydalanuvchi ham
// login qilgan zahoti manzil satriga to'g'ridan-to'g'ri
// `localhost:5173/#/dashboard` deb yozib, onboarding orqali
// o'tmasdan ilovaga kirib ketaverardi.
//
// Bu komponent App.tsx'da BITTA marta, himoyalanishi kerak bo'lgan
// barcha route'larning umumiy "layout" ota-komponenti sifatida
// ishlatiladi (<Route element={<RequireCompletedProfile/>}>...
// ichidagi route'lar</Route>). Shunday qilib har bir alohida sahifaga
// qayta-qayta shu tekshiruvni yozish shart emas — xuddi backend
// tomonidagi JwtAuthFilter markaziy tekshiruviga mos keladigan
// frontend hamkori.
//
// Backend — GET /api/users/me/status — YAGONA haqiqat manbai
// (profileCompleted qiymati shu yerdan olinadi, JWT ichida SAQLANMAYDI,
// chunki onboarding tugagach eski token hali ham amal qiladi va
// tokenni qayta chiqarish shart emas).
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'
import { profileApi } from '../lib/profileApi'

type GuardState = 'checking' | 'allowed' | 'needs-sign-in' | 'needs-onboarding'

export default function RequireCompletedProfile() {
  const location = useLocation()
  const [state, setState] = useState<GuardState>('checking')

  useEffect(() => {
    let cancelled = false

    if (!isAuthenticated()) {
      setState('needs-sign-in')
      return
    }

    setState('checking')

    profileApi
      .getMyStatus()
      .then((status) => {
        if (cancelled) return
        setState(status.profileCompleted ? 'allowed' : 'needs-onboarding')
      })
      .catch(() => {
        // Token yaroqsiz/muddati tugagan va refresh ham muvaffaqiyatsiz
        // bo'ldi (apiFetch bu holda tokenni allaqachon tozalagan) —
        // yoki tarmoq xatosi. Ikkalasida ham xavfsiz tomonga: sign-in.
        if (!cancelled) setState('needs-sign-in')
      })

    return () => {
      cancelled = true
    }
    // Faqat guard'ga birinchi marta kirilganda tekshiramiz — layout
    // route sifatida bu komponent ichidagi barcha sahifalar orasida
    // navigatsiya qilinganda QAYTA MOUNT bo'lmaydi, shuning uchun
    // location o'zgarishi bilan qayta so'rov yubormaymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (state === 'needs-sign-in') {
    return <Navigate to="/sign-in" replace state={{ redirectTo: location.pathname }} />
  }

  if (state === 'needs-onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
