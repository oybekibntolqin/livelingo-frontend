// Notifications — to'liq sahifa ko'rinishi.
//
// Ilgari faqat Sidebar'dagi bell tugmasi bosilganda ochiladigan
// dropdown panel (NotificationsPanel) mavjud edi — u faqat lg (desktop)
// breakpointida ko'rinadigan Sidebar ichida edi. MobileNav esa
// bosilganda navigate('/notifications') chaqirar edi, lekin App.tsx'da
// bunday route yo'q edi — natijada mobil/kichraytirilgan oynada
// "Notifications" bosilganda hech qanday Route mos kelmay, <Routes>
// hech narsa render qilmay oq (blank) ekran qolib qolar edi. Orqaga
// qaytishda ham xuddi shu URL holati saqlanib qolgani uchun muammo
// davom etardi.
//
// Yechim: shu sahifani va App.tsx'да mos Route'ни qo'shish + xavfsizlik
// uchun umumiy 404 catch-all route ham qo'shildi (AppNotFound.tsx).

import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { isAuthenticated } from '../lib/auth'
import { DashboardNav, Sidebar, MobileNav, NotificationsPanel } from '../components/AppShell'
import { useNotifications } from '../hooks/useNotifications'

export default function Notifications() {
    const navigate = useNavigate()
    const notif = useNotifications()

    useEffect(() => {
        if (!isAuthenticated()) navigate('/sign-in', { replace: true })
    }, [navigate])

    return (
        <div className="min-h-screen bg-cream">
            <DashboardNav />
            <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
                <Sidebar onCreatePost={() => navigate('/dashboard', { state: { openCompose: true } })} />
                <MobileNav onCreatePost={() => navigate('/dashboard', { state: { openCompose: true } })} />

                <main className="min-w-0">
                    <div className="mx-auto max-w-xl rounded-4xl border border-ink/8 bg-white p-2 shadow-sm sm:p-4">
                        <div className="mb-1 flex items-center gap-3 px-2 pt-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
                                aria-label="Back"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                        </div>

                        <NotificationsPanel notif={notif} fullPage />
                    </div>
                </main>
            </div>
        </div>
    )
}
