// Umumiy 404 / catch-all sahifa.
//
// App.tsx'даgi <Routes> ichida mos Route topilmasa (masalan eskirgan
// link, xato yozilgan URL yoki kelajakda navigate() bilan hali
// yaratilmagan sahifaga yo'naltirilsa), React Router HECH NARSA
// render qilmaydi — foydalanuvchi butunlay oq (blank) ekranda "qotib"
// qoladi va orqaga qaytish ham yordam bermaydi, chunki URL o'zgarmagan
// bo'lsa xuddi shu bo'sh holat qayta ko'rsatiladi.
//
// Shu sahifa har doim biror narsa ko'rsatishni, foydalanuvchini
// qaytadan yo'naltira olishini kafolatlaydi.

import { Link, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'

export default function NotFound() {
    const navigate = useNavigate()
    const homePath = isAuthenticated() ? '/dashboard' : '/'

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
            <p className="font-display text-6xl font-bold text-ink/15">404</p>
            <h1 className="font-display text-xl font-semibold text-ink">Sahifa topilmadi</h1>
            <p className="max-w-xs text-sm text-ink-muted">
                Siz izlagan sahifa mavjud emas yoki ko'chirilgan bo'lishi mumkin.
            </p>
            <div className="mt-2 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white"
                >
                    Orqaga
                </button>
                <Link
                    to={homePath}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                    Bosh sahifaga
                </Link>
            </div>
        </div>
    )
}
