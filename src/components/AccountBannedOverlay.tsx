// Foydalanuvchi ban qilinganda REAL-TIME ko'rsatiladigan to'liq ekranli
// overlay.
//
// MUHIM: bu ilgari faqat sahifa refresh qilingandan yoki boshqa sahifaga
// o'tgandan keyin (keyingi API so'rovi backend'dan 403 "Your account has
// been suspended." qaytargandan keyin) ko'rinar edi. Endi
// lib/accountStatus.ts ACCOUNT_BANNED_EVENT eventini ban signali (WS)
// kelgan zahoti dispatch qiladi — shu componentga hech qanday
// so'rov/refresh kerak emas.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_BANNED_EVENT, type BannedEventDetail } from '../lib/accountStatus'
import { performLogout } from './AppShell'

const DEFAULT_TITLE = 'Account suspended'
const DEFAULT_MESSAGE =
    'Your account has been suspended for violating our community guidelines.'

export default function AccountBannedOverlay() {
    const [visible, setVisible] = useState(false)
    const [detail, setDetail] = useState<BannedEventDetail>({})
    const navigate = useNavigate()

    useEffect(() => {
        const onBanned = (event: Event) => {
            const custom = event as CustomEvent<BannedEventDetail>
            setDetail(custom.detail ?? {})
            setVisible(true)
        }

        // Unban bo'lganda (lib/accountStatus.ts -> handleRestored)
        // overlayni yashiramiz — foydalanuvchi qayta login/refresh
        // qilmasdan ilovadan darhol foydalana oladi.
        const onRestored = () => setVisible(false)

        window.addEventListener(ACCOUNT_BANNED_EVENT, onBanned)
        window.addEventListener('account-restored', onRestored)

        return () => {
            window.removeEventListener(ACCOUNT_BANNED_EVENT, onBanned)
            window.removeEventListener('account-restored', onRestored)
        }
    }, [])

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-ink/60 px-5 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral-50 text-coral-600">
                    <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                </div>
                <h1 className="mb-2 font-display text-lg font-semibold text-ink">
                    {detail.title || DEFAULT_TITLE}
                </h1>
                <p className="mb-5 text-sm text-ink-soft">
                    {detail.message || DEFAULT_MESSAGE}
                </p>
                <button
                    onClick={() => performLogout(navigate)}
                    className="w-full rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600"
                >
                    Sign out
                </button>
            </div>
        </div>
    )
}
