import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from './Logo'
import Avatar from './Avatar'
import VerifiedBadge from './VerifiedBadge'
import { clearToken } from '../lib/auth'
import { chatSocket } from '../lib/chatSocket'
import { stopAccountStatusChecker } from '../lib/accountStatus'
import { getUserIdFromToken } from '../lib/chatAuth'
import { getCurrentUser, canGenerateWithAi, clearUserCache, type CurrentUser } from '../lib/user'
import { useUnreadChatCount } from '../hooks/useUnreadChatCount'
import { useNotifications } from '../hooks/useNotifications'
import type { AppNotification } from '../lib/notifications'
import {
    getPermissionState,
    requestNotificationPermission,
    type PermissionState,
} from '../lib/browserNotifications'
import { profileApi, type SuggestedUser, type UserProfile } from '../lib/profileApi'
import { SuggestedUserRow } from './FollowListModal'
import { api, ApiError, API_BASE } from '../lib/api'
import { fetchLearningLanguages, type LearningLanguage } from '../lib/nativeLanguages'
import type { UserProgress } from '../lib/exercises'

const PROGRESS_LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    es: 'Español',
    de: 'Deutsch',
    fr: 'Français',
    ru: 'Русский',
    ko: '한국어',
    zh: '中文',
}

// ═════════════════════════════════════════════════════════════════
// Top nav — Faqat Mobile / Tablet uchun
// ═════════════════════════════════════════════════════════════════
export function DashboardNav() {
    return (
        <header className="sticky top-0 z-30 border-b border-ink/8 bg-white/85 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
                <Link
                    to="/dashboard"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="inline-flex items-center gap-2 text-ink [&_*]:stroke-current"
                >
                    <Logo size={28} />
                </Link>
            </div>
        </header>
    )
}

// Log out yordamchi funksiyasi
//
// MUHIM O'ZGARISH: avval bu funksiya faqat localStorage'ni tozalardi —
// bu "logout" faqat vizual edi, chunki eski token backend tomonda
// hali ham 24 soat amal qilardi. Endi /api/auth/logout ham
// chaqiriladi — bu serverdagi refresh-token yozuvini bekor qiladi
// va httpOnly cookie'ni tozalaydi, shuning uchun boshqa hech kim
// (o'zi ham) shu sessiyadan yangi access token ololmaydi.
export function performLogout(navigate: (path: string, opts?: { replace?: boolean }) => void) {
    stopAccountStatusChecker()
    chatSocket.disconnect()

    // "Fire and forget" — tarmoq muammosi bo'lsa ham lokal chiqishni
    // kechiktirmaymiz, foydalanuvchi baribir darhol chiqarilishi kerak.
    fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})

    clearToken()
    clearUserCache()
    navigate('/', { replace: true })
}

// ═════════════════════════════════════════════════════════════════
// Left sidebar (Instagram Hover Expand/Collapse Style)
// ═════════════════════════════════════════════════════════════════
export function Sidebar({ onCreatePost }: { onCreatePost: () => void }) {
    const unreadChatCount = useUnreadChatCount()
    const notif = useNotifications()
    const myId = getUserIdFromToken()
    const location = useLocation()

    const [isAdmin, setIsAdmin] = useState(false)
    useEffect(() => {
        getCurrentUser()
            .then((u: CurrentUser) => setIsAdmin(canGenerateWithAi(u)))
            .catch(() => setIsAdmin(false))
    }, [])

    const [feedPulse, setFeedPulse] = useState(false)
    const triggerFeedPulse = () => {
        setFeedPulse(true)
        window.setTimeout(() => setFeedPulse(false), 900)
    }

    const [notificationsOpen, setNotificationsOpen] = useState(false)

    const mainItems = [
        { label: 'Feed', icon: 'feed', to: '/dashboard' },
        { label: 'Search', icon: 'search', to: '/search' },
        {
            label: 'Notifications',
            icon: 'bell',
            onClick: () => setNotificationsOpen((v) => !v),
            badge: notif.unreadCount > 0 ? String(notif.unreadCount > 99 ? '99+' : notif.unreadCount) : undefined,
        },
        { label: 'Create', icon: 'create', onClick: onCreatePost },
        { label: 'Learn', icon: 'learn', to: '/learn', badge: '+50 XP' },
        { label: 'Exercises', icon: 'exercise', to: '/learn/exercises' },
        { label: 'Flashcards', icon: 'cards', to: '/flashcards' },
        {
            label: 'Chat',
            icon: 'chat',
            to: '/chat',
            badge: unreadChatCount > 0 ? String(unreadChatCount > 99 ? '99+' : unreadChatCount) : undefined,
        },
        { label: 'Analytics', icon: 'analytics', to: '/analytics' },
        ...(isAdmin ? [{ label: 'Admin Panel', icon: 'admin', to: '/admin' }] : []),
        { label: 'Teacher App', icon: 'teacher', to: '#' },
        { label: 'Profile', icon: 'user', to: myId ? `/profile/${myId}` : '#' },
    ]

    const bottomItems = [
        { label: 'Settings', icon: 'settings', to: '/settings' },
    ]

    const isItemActive = (item: { to?: string }) => {
        if (!item.to || item.to === '#') return false
        if (item.to === '/dashboard') return location.pathname === '/dashboard'
        return location.pathname.startsWith(item.to)
    }

    const renderButton = (item: typeof mainItems[number], idx: number) => {
        const isFeed = item.label === 'Feed'
        const active = isItemActive(item)
        const hasClick = !!item.onClick
        const isPanelOpen = item.label === 'Notifications' && notificationsOpen
        const isXpBadge = item.badge?.includes('XP')

        const contentNode = (
            <>
                {/* Ikonka konteyneri */}
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover/item:scale-105">
                    <NavIcon kind={item.icon} active={active || isPanelOpen} />

                    {isFeed && feedPulse && (
                        <motion.span
                            key={feedPulse ? 'pulse-on' : 'pulse-off'}
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: [0.4, 1.6, 1], opacity: [0, 1, 0] }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-coral-500"
                        />
                    )}

                    {/* Sidebar yopiq (ixcham) turgandagi nuqta/badge */}
                    {item.badge && (
                        <span
                            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-xs transition-opacity duration-200 group-hover/sidebar:opacity-0 group-hover/sidebar:pointer-events-none ${
                                isXpBadge ? 'bg-orange-500' : 'bg-rose-500'
                            }`}
                        >
                            {isXpBadge ? '●' : item.badge}
                        </span>
                    )}
                </div>

                {/* Sichqoncha borganda (hover) silliq ochiluvchi matn */}
                <span className="max-w-0 opacity-0 group-hover/sidebar:max-w-xs group-hover/sidebar:opacity-100 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden text-[15px] font-semibold pl-0 group-hover/sidebar:pl-3">
                    {item.label}
                </span>

                {/* Sichqoncha borganda chiqadigan to'liq badge */}
                {item.badge && (
                    <span
                        className={`hidden group-hover/sidebar:inline-flex ml-auto rounded-full font-mono text-[10px] font-bold px-2 py-0.5 mr-1 ${
                            isXpBadge
                                ? 'bg-orange-500/15 text-orange-600 border border-orange-500/20'
                                : 'bg-rose-500 text-white shadow-xs'
                        }`}
                    >
                        {item.badge}
                    </span>
                )}
            </>
        )

        const itemClass = `group/item relative flex w-full h-11 items-center rounded-xl px-2 transition-all duration-150 ${
            active || isPanelOpen
                ? 'bg-ink text-white font-bold shadow-sm'
                : 'text-ink-soft hover:bg-ink/5 hover:text-ink active:scale-[0.98]'
        }`

        if (hasClick) {
            return (
                <button key={idx} onClick={item.onClick} className={itemClass}>
                    {contentNode}
                </button>
            )
        }

        return (
            <Link
                key={idx}
                to={item.to || '#'}
                onClick={isFeed ? triggerFeedPulse : undefined}
                className={itemClass}
            >
                {contentNode}
            </Link>
        )
    }

    return (
        <aside className="hidden lg:block">
            {/* Chap va Tepaga to'liq yopishgan, hover bo'lganda w-[72px] dan w-60 gacha kengayuvchi Sidebar */}
            <div className="group/sidebar fixed left-0 top-0 bottom-0 z-40 flex h-screen w-[72px] flex-col justify-between border-r border-ink/10 bg-white p-2.5 shadow-sm transition-all duration-300 ease-in-out hover:w-60 hover:shadow-2xl">

                {/* 1. LOGO — Ranglari to'q, oq fonda yorqin ko'rinadigan qilib to'g'rilandi */}
                <div className="flex h-14 w-full items-center px-1 text-ink [&_svg]:text-ink [&_path]:stroke-current [&_circle]:stroke-current">
                    <Link
                        to="/dashboard"
                        className="flex items-center overflow-hidden rounded-xl p-1 transition-transform active:scale-95"
                    >
                        <Logo size={32} />
                    </Link>
                </div>

                {/* 2. O'rtadagi asosiy menyular (Scrollbar ko'rinmaydi, lekin scroll ishlaydi) */}
                <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {mainItems.map(renderButton)}
                </nav>

                {/* 3. Pastki sozlamalar qismi */}
                <div className="border-t border-ink/8 pt-2">
                    {bottomItems.map(renderButton)}
                </div>
            </div>

            {/* Notifications paneli — Sidebar yonidan ochiladi */}
            <AnimatePresence>
                {notificationsOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40 bg-ink/10 backdrop-blur-[1px]"
                            onClick={() => setNotificationsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.18 }}
                            className="fixed left-[78px] top-3 z-50 w-96 overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-2xl"
                        >
                            <NotificationsPanel notif={notif} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </aside>
    )
}

// ═════════════════════════════════════════════════════════════════
// Mobile / Tablet Bottom Nav (< lg)
// ═════════════════════════════════════════════════════════════════
export function MobileNav({ onCreatePost }: { onCreatePost: () => void }) {
    const unreadChatCount = useUnreadChatCount()
    const notif = useNotifications()
    const myId = getUserIdFromToken()
    const location = useLocation()
    const navigate = useNavigate()

    const [isAdmin, setIsAdmin] = useState(false)
    useEffect(() => {
        getCurrentUser()
            .then((u: CurrentUser) => setIsAdmin(canGenerateWithAi(u)))
            .catch(() => setIsAdmin(false))
    }, [])

    const [moreOpen, setMoreOpen] = useState(false)

    const primary = [
        { label: 'Feed', icon: 'feed', to: '/dashboard' },
        { label: 'Search', icon: 'search', to: '/search' },
        { label: 'Learn', icon: 'learn', to: '/learn' },
        {
            label: 'Chat',
            icon: 'chat',
            to: '/chat',
            badge: unreadChatCount > 0 ? String(unreadChatCount > 99 ? '99+' : unreadChatCount) : undefined,
        },
    ]

    const moreItems = [
        {
            label: 'Notifications',
            icon: 'bell',
            onClick: () => {
                setMoreOpen(false)
                navigate('/notifications')
            },
            badge: notif.unreadCount > 0 ? String(notif.unreadCount > 99 ? '99+' : notif.unreadCount) : undefined,
        },
        { label: 'Create', icon: 'create', onClick: () => { setMoreOpen(false); onCreatePost() } },
        { label: 'Exercises', icon: 'exercise', to: '/learn/exercises' },
        { label: 'Flashcards', icon: 'cards', to: '/flashcards' },
        { label: 'Analytics', icon: 'analytics', to: '/analytics' },
        ...(isAdmin ? [{ label: 'Admin Panel', icon: 'admin', to: '/admin' }] : []),
        { label: 'Profile', icon: 'user', to: myId ? `/profile/${myId}` : '#' },
        { label: 'Settings', icon: 'settings', to: '/settings' },
    ]

    const isActive = (to?: string) => {
        if (!to || to === '#') return false
        if (to === '/dashboard') return location.pathname === '/dashboard'
        return location.pathname.startsWith(to)
    }

    return (
        <>
            <nav
                className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-ink/8 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
                aria-label="Primary"
            >
                {primary.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium ${
                            isActive(item.to) ? 'text-ink font-semibold' : 'text-ink-muted'
                        }`}
                    >
                        <span className="relative">
                            <NavIcon kind={item.icon} active={isActive(item.to)} />
                            {item.badge && (
                                <span
                                    className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                                        item.badge.includes('XP') ? 'bg-orange-500' : 'bg-rose-500'
                                    }`}
                                >
                                    {item.badge}
                                </span>
                            )}
                        </span>
                        {item.label}
                    </Link>
                ))}
                <button
                    onClick={() => setMoreOpen(true)}
                    className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-ink-muted"
                    aria-label="More"
                >
                    <NavIcon kind="more" active={moreOpen} />
                    More
                </button>
            </nav>

            <AnimatePresence>
                {moreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
                            onClick={() => setMoreOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-ink/8 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl lg:hidden"
                        >
                            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
                            <div className="grid grid-cols-4 gap-1.5">
                                {moreItems.map((item, idx) =>
                                    item.onClick ? (
                                        <button
                                            key={idx}
                                            onClick={item.onClick}
                                            className="flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs font-medium text-ink-soft hover:bg-cream-warm"
                                        >
                                            <span className="relative">
                                                <NavIcon kind={item.icon} />
                                                {item.badge && (
                                                    <span
                                                        className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                                                            item.badge.includes('XP') ? 'bg-orange-500' : 'bg-rose-500'
                                                        }`}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </span>
                                            {item.label}
                                        </button>
                                    ) : (
                                        <Link
                                            key={idx}
                                            to={item.to || '#'}
                                            onClick={() => setMoreOpen(false)}
                                            className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs font-medium ${
                                                isActive(item.to) ? 'text-ink font-semibold' : 'text-ink-soft'
                                            }`}
                                        >
                                            <NavIcon kind={item.icon} active={isActive(item.to)} />
                                            {item.label}
                                        </Link>
                                    )
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

export function NotificationsPanel({
    notif,
    fullPage = false,
}: {
    notif: ReturnType<typeof useNotifications>
    /** Dropdown panelning balandlik cheklovisiz, to'liq sahifa ko'rinishi */
    fullPage?: boolean
}) {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = notif
    const [permState, setPermState] = useState<PermissionState>(getPermissionState())

    const askPermission = async () => {
        const result = await requestNotificationPermission()
        setPermState(result)
    }

    const groups = groupByRecency(notifications)

    return (
        <div className={`flex flex-col p-4 ${fullPage ? '' : 'max-h-[70vh]'}`}>
            <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-base font-semibold text-ink">Notifications</p>
                {unreadCount > 0 && (
                    <button
                        onClick={() => markAllAsRead()}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        Mark all read
                    </button>
                )}
            </div>

            {permState === 'default' && (
                <button
                    onClick={askPermission}
                    className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-50 px-3 py-2.5 text-left text-xs text-indigo-700 transition hover:border-indigo-500/40"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    <span>
                        <span className="font-semibold">Enable device notifications</span> — get notified even when this tab isn't open.
                    </span>
                </button>
            )}
            {permState === 'denied' && (
                <p className="mb-3 text-[11px] text-ink-muted">
                    Device notifications are blocked. You can re-enable them in your browser's site settings.
                </p>
            )}

            <div className={`-mx-1 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${fullPage ? '' : 'overflow-y-auto'}`}>
                {loading ? (
                    <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted/50">
                            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                        <p className="text-sm text-ink-muted">Hozircha bildirishnoma yo'q</p>
                    </div>
                ) : (
                    groups.map((group) => (
                        <div key={group.label} className="mb-1">
                            <p className="px-2 pb-1.5 pt-3 text-sm font-semibold text-ink first:pt-0">
                                {group.label}
                            </p>
                            <ul>
                                {group.items.map((n) => (
                                    <li key={n.id}>
                                        <NotificationRow n={n} onRead={() => !n.read && markAsRead(n.id)} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function groupByRecency(notifications: AppNotification[]) {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000)

    const buckets: { label: string; items: AppNotification[] }[] = [
        { label: 'Today', items: [] },
        { label: 'This week', items: [] },
        { label: 'This month', items: [] },
        { label: 'Earlier', items: [] },
    ]

    for (const n of notifications) {
        const created = new Date(n.createdAt)
        if (created >= startOfToday) buckets[0].items.push(n)
        else if (created >= startOfWeek) buckets[1].items.push(n)
        else if (created >= startOfMonth) buckets[2].items.push(n)
        else buckets[3].items.push(n)
    }

    return buckets.filter((b) => b.items.length > 0)
}

function shortDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const sameYear = d.getFullYear() === now.getFullYear()
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: sameYear ? undefined : 'numeric',
    })
}

function actionSuffix(type: string): string | null {
    switch (type) {
        case 'FOLLOW':
            return 'started following you.'
        case 'LIKE':
            return 'liked your post.'
        case 'COMMENT':
            return 'commented on your post.'
        case 'COMMENT_REPLY':
            return 'replied to your comment.'
        case 'MENTION':
            return 'mentioned you.'
        default:
            return null
    }
}

function NotificationRow({ n, onRead }: { n: AppNotification; onRead: () => void }) {
    const navigate = useNavigate()
    const suffix = n.senderId ? actionSuffix(n.type) : null

    const [following, setFollowing] = useState(false)
    const [followChecked, setFollowChecked] = useState(false)
    const [followPending, setFollowPending] = useState(false)

    useEffect(() => {
        if (n.type !== 'FOLLOW' || !n.senderId) return
        let cancelled = false
        profileApi
            .isFollowing(n.senderId)
            .then((res) => {
                if (!cancelled) setFollowing(res.following)
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setFollowChecked(true)
            })
        return () => {
            cancelled = true
        }
    }, [n.type, n.senderId])

    const toggleFollow = async (e: ReactMouseEvent) => {
        e.stopPropagation()
        if (followPending || !n.senderId) return
        const next = !following
        setFollowing(next)
        setFollowPending(true)
        try {
            if (next) await profileApi.follow(n.senderId)
            else await profileApi.unfollow(n.senderId)
        } catch {
            setFollowing(!next)
        } finally {
            setFollowPending(false)
        }
    }

    const goToRef = () => {
        onRead()
        if (n.type === 'FOLLOW' && n.senderId) {
            navigate(`/profile/${n.senderId}`)
        } else if (n.referenceType === 'POST' && n.referenceId) {
            navigate(`/posts/${n.referenceId}`)
        } else if (n.senderId) {
            navigate(`/profile/${n.senderId}`)
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={goToRef}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') goToRef()
            }}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${
                n.read ? 'hover:bg-cream' : 'bg-indigo-50/60 hover:bg-indigo-50'
            }`}
        >
            {!n.read && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />}

            <Avatar url={n.senderProfilePhotoUrl} size={40} />

            <div className="min-w-0 flex-1">
                {suffix ? (
                    <p className="text-sm leading-snug text-ink">
                        <span className="font-semibold">{n.senderName || 'Someone'}</span>{' '}
                        <span className="text-ink-soft">{suffix}</span>{' '}
                        <span className="text-ink-muted">{shortDate(n.createdAt)}</span>
                    </p>
                ) : (
                    <>
                        {n.title && <p className="text-sm font-semibold text-ink">{n.title}</p>}
                        <p className="text-xs text-ink-soft">
                            {n.message} <span className="text-ink-muted">· {shortDate(n.createdAt)}</span>
                        </p>
                    </>
                )}
            </div>

            {n.type === 'FOLLOW' && followChecked ? (
                <button
                    onClick={toggleFollow}
                    disabled={followPending}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        following
                            ? 'border border-ink/12 bg-white text-ink'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                >
                    {following ? 'Following' : 'Follow Back'}
                </button>
            ) : n.referenceThumbnailUrl ? (
                <img
                    src={n.referenceThumbnailUrl}
                    alt=""
                    className="h-11 w-11 flex-shrink-0 rounded-lg object-cover"
                />
            ) : null}
        </div>
    )
}

function NavIcon({ kind, active }: { kind: string; active?: boolean }) {
    const c = {
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: active ? 2.4 : 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        className: 'transition-all duration-150'
    }
    switch (kind) {
        case 'feed':
            return (
                <svg {...c}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <path d="M9 22V12h6v10" />
                </svg>
            )
        case 'search':
            return (
                <svg {...c}>
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>
            )
        case 'bell':
            return (
                <svg {...c}>
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
            )
        case 'create':
            return (
                <svg {...c}>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
            )
        case 'learn':
            return (
                <svg {...c}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            )
        case 'exercise':
            return (
                <svg {...c}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                </svg>
            )
        case 'admin':
            return (
                <svg {...c}>
                    <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
                    <path d="M9 12l2 2 4-4" />
                </svg>
            )
        case 'cards':
            return (
                <svg {...c}>
                    <rect x="3" y="6" width="14" height="14" rx="3" />
                    <path d="M21 14V5a2 2 0 0 0-2-2H10" />
                </svg>
            )
        case 'chat':
            return (
                <svg {...c}>
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
            )
        case 'analytics':
            return (
                <svg {...c}>
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            )
        case 'teacher':
            return (
                <svg {...c}>
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
                </svg>
            )
        case 'user':
            return (
                <svg {...c}>
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            )
        case 'logout':
            return (
                <svg {...c}>
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                </svg>
            )
        case 'settings':
            return (
                <svg {...c}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15 1.65 1.65 0 003.17 14H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
            )
        case 'more':
            return (
                <svg {...c}>
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
                </svg>
            )
        default:
            return null
    }
}

// ═════════════════════════════════════════════════════════════════
// Right rail — O'ng tarafdagi kartalar
// ═════════════════════════════════════════════════════════════════
export function RightRail() {
    const navigate = useNavigate()
    const [languages, setLanguages] = useState<LearningLanguage[]>([])
    const [progressByLang, setProgressByLang] = useState<Record<string, UserProgress>>({})
    const [activeIndex, setActiveIndex] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        let cancelled = false
        fetchLearningLanguages()
            .then(async (langs) => {
                if (cancelled) return
                setLanguages(langs)

                const beginnerLangs = langs.filter(
                    (l) => l.cefrLevel === 'A1' || l.cefrLevel === 'A2'
                )
                const toFetch = beginnerLangs.length > 0 ? beginnerLangs : langs

                const entries = await Promise.all(
                    toFetch.map(async (l) => {
                        try {
                            const p = await api.get<UserProgress>(
                                `/api/exercises/progress?lang=${l.languageCode}`
                            )
                            return [l.languageCode, p] as const
                        } catch {
                            return null
                        }
                    })
                )
                if (cancelled) return
                const map: Record<string, UserProgress> = {}
                entries.forEach((e) => {
                    if (e) map[e[0]] = e[1]
                })
                setProgressByLang(map)
            })
            .catch((err) => {
                if (cancelled) return
                if (err instanceof ApiError && err.status === 401) {
                    navigate('/sign-in', { replace: true })
                    return
                }
                setError(true)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [navigate])

    const beginnerLangs = languages.filter((l) => l.cefrLevel === 'A1' || l.cefrLevel === 'A2')
    const rotation = beginnerLangs.length > 0 ? beginnerLangs : languages
    const rotationCodes = rotation.map((l) => l.languageCode)
    const activeCode = rotationCodes.length
        ? rotationCodes[activeIndex % rotationCodes.length]
        : undefined
    const activeProgress = activeCode ? progressByLang[activeCode] ?? null : null

    const handleCycle = () => {
        if (rotationCodes.length <= 1) return
        setActiveIndex((i) => (i + 1) % rotationCodes.length)
    }

    const handleProgressUpdate = (updated: UserProgress) => {
        setProgressByLang((prev) => ({ ...prev, [updated.languageCode]: updated }))
    }

    return (
        <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-5">
                <OwnProfileCard />
                <ProgressCard
                    progress={activeProgress}
                    loading={loading}
                    error={error}
                    cyclable={rotationCodes.length > 1}
                    onCycle={handleCycle}
                    dotCount={rotationCodes.length}
                    activeDot={rotationCodes.length ? activeIndex % rotationCodes.length : 0}
                />
                <SuggestedUsers />
                <DailyChallengeCard
                    progress={activeProgress}
                    loading={loading}
                    error={error}
                    onProgressUpdate={handleProgressUpdate}
                />
            </div>
        </aside>
    )
}

function OwnProfileCard() {
    const [profile, setProfile] = useState<UserProfile | null>(null)

    useEffect(() => {
        let cancelled = false
        profileApi
            .getMyProfile()
            .then((p) => {
                if (!cancelled) setProfile(p)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    if (!profile) return null

    const fullName = `${profile.firstName} ${profile.lastName}`.trim() || 'User'

    return (
        <Link
            to={`/profile/${profile.id}`}
            className="flex items-center gap-3 rounded-3xl border border-ink/8 bg-white p-3.5 transition hover:bg-cream"
        >
            <Avatar url={profile.profilePhotoUrl} size={44} />
            <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold text-ink">
                    {fullName}
                </p>
                {profile.username && (
                    <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
                        @{profile.username}
                        <VerifiedBadge username={profile.username} size={12} />
                    </p>
                )}
            </div>
        </Link>
    )
}

function SuggestedUsers() {
    const [users, setUsers] = useState<SuggestedUser[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        profileApi
            .getSuggestedUsers(5)
            .then((list) => {
                if (!cancelled) setUsers(list)
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    if (!loading && users.length === 0) return null

    return (
        <div className="rounded-3xl border border-ink/8 bg-white p-4">
            <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-ink-muted">
                People to follow
            </p>
            {loading ? (
                <p className="py-2 text-center text-xs text-ink-muted">Loading…</p>
            ) : (
                <div className="space-y-1 [&>*]:px-0">
                    {users.map((u) => (
                        <SuggestedUserRow key={u.id} user={u} />
                    ))}
                </div>
            )}
        </div>
    )
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function nextCefrLevel(level: string): string | null {
    const idx = CEFR_ORDER.indexOf(level as (typeof CEFR_ORDER)[number])
    if (idx === -1 || idx === CEFR_ORDER.length - 1) return null
    return CEFR_ORDER[idx + 1]
}

function ProgressCard({
                          progress,
                          loading,
                          error,
                          cyclable,
                          onCycle,
                          dotCount,
                          activeDot,
                      }: {
    progress: UserProgress | null
    loading: boolean
    error: boolean
    cyclable: boolean
    onCycle: () => void
    dotCount: number
    activeDot: number
}) {
    if (loading) {
        return (
            <div className="rounded-3xl border border-ink/8 bg-white p-4">
                <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-ink-muted">
                    Your progress
                </p>
                <p className="py-2 text-center text-xs text-ink-muted">Loading…</p>
            </div>
        )
    }

    if (error || !progress) return null

    const nextLevel = nextCefrLevel(progress.currentLevel)
    const isMaxLevel = !nextLevel || progress.xpToNextLevel <= 0
    const nextThreshold = progress.totalXp + Math.max(0, progress.xpToNextLevel)
    const xpSpan = nextThreshold - progress.xpForCurrentLevel
    const xpIntoLevel = progress.totalXp - progress.xpForCurrentLevel
    const percent = isMaxLevel
        ? 100
        : Math.min(100, Math.max(0, xpSpan > 0 ? (xpIntoLevel / xpSpan) * 100 : 100))
    const languageName = PROGRESS_LANGUAGE_NAMES[progress.languageCode] ?? progress.languageCode

    return (
        <div
            className={`rounded-3xl border border-ink/8 bg-white p-4 ${cyclable ? 'cursor-pointer select-none' : ''}`}
            onClick={cyclable ? onCycle : undefined}
            role={cyclable ? 'button' : undefined}
            tabIndex={cyclable ? 0 : undefined}
            onKeyDown={
                cyclable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onCycle()
                        }
                    }
                    : undefined
            }
            aria-label={cyclable ? 'Show progress for the next language' : undefined}
        >
            <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-ink-muted">
                    Your progress
                </p>
                {dotCount > 1 && (
                    <div className="flex items-center gap-1">
                        {Array.from({ length: dotCount }).map((_, i) => (
                            <span
                                key={i}
                                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                    i === activeDot ? 'bg-ink' : 'bg-ink/15'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <p className="font-mono text-2xl font-bold text-ink">{progress.currentLevel}</p>
                    <p className="text-xs text-ink-muted">Current level · {languageName}</p>
                </div>
                <div className="text-right">
                    <p className="font-display text-xl font-bold text-coral-500">{progress.streakDays}🔥</p>
                    <p className="text-xs text-ink-muted">day streak</p>
                </div>
            </div>

            <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-ink-soft">
                        {isMaxLevel ? `${progress.totalXp} XP` : `${progress.totalXp} / ${nextThreshold} XP`}
                    </span>
                    <span className="text-ink-muted">{isMaxLevel ? 'Max level' : `to ${nextLevel}`}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cream-warm">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-coral-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/8 pt-3">
                <Stat label="Today" value={`+${progress.todayXp}`} suffix="XP" />
                <Stat label="Accuracy" value={String(Math.round(progress.accuracyPercent))} suffix="%" />
                <Stat label="Cards" value={String(progress.totalExercises)} />
            </div>
        </div>
    )
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
    return (
        <div>
            <p className="text-[11px] text-ink-muted">{label}</p>
            <p className="font-mono text-base font-bold text-ink">
                {value}
                {suffix && <span className="ml-0.5 text-[10px] text-ink-muted">{suffix}</span>}
            </p>
        </div>
    )
}

const ADVANCED_LEVELS: ReadonlySet<string> = new Set(['B2', 'C1', 'C2'])

function DailyChallengeCard({
                                progress,
                                loading,
                                error,
                                onProgressUpdate,
                            }: {
    progress: UserProgress | null
    loading: boolean
    error: boolean
    onProgressUpdate: (progress: UserProgress) => void
}) {
    const navigate = useNavigate()
    const [claiming, setClaiming] = useState(false)
    const [claimError, setClaimError] = useState<string | null>(null)

    if (loading || error || !progress) return null

    const isAdvanced = ADVANCED_LEVELS.has(progress.currentLevel)

    if (isAdvanced) {
        return (
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-coral-500 via-coral-500 to-sun-500 p-4 text-white">
                <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-white/80">
                    Daily challenge
                </p>
                <p className="mt-1.5 font-display text-lg font-bold leading-snug">
                    Practice reading, writing or listening today.
                </p>
                <button
                    onClick={() => navigate('/learn')}
                    className="mt-3.5 w-full rounded-full bg-white py-2 text-xs font-semibold text-coral-600 transition-transform hover:scale-[1.02] active:scale-100"
                >
                    Explore Learn
                </button>
            </div>
        )
    }

    const done = Math.min(progress.todayExercises, progress.dailyChallengeTarget)
    const completed = progress.todayExercises >= progress.dailyChallengeTarget

    const handleClaim = () => {
        setClaiming(true)
        setClaimError(null)
        api
            .post<UserProgress>(`/api/exercises/daily-bonus/claim?lang=${progress.languageCode}`)
            .then((updated) => onProgressUpdate(updated))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                    navigate('/sign-in', { replace: true })
                    return
                }
                setClaimError('Could not claim right now — try again.')
            })
            .finally(() => setClaiming(false))
    }

    return (
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-coral-500 via-coral-500 to-sun-500 p-4 text-white">
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-white/80">
                Daily challenge
            </p>
            <p className="mt-1.5 font-display text-lg font-bold leading-snug">
                Finish {progress.dailyChallengeTarget} exercises before midnight.
            </p>
            <p className="mt-1 text-xs text-white/85">
                {done} / {progress.dailyChallengeTarget} done · +{progress.dailyBonusXp} XP bonus
            </p>
            {claimError && <p className="mt-1 text-xs text-white/90">{claimError}</p>}

            {progress.dailyBonusClaimed ? (
                <button
                    disabled
                    className="mt-3 w-full cursor-default rounded-full bg-white/70 py-2 text-xs font-semibold text-coral-600"
                >
                    Bonus claimed ✓
                </button>
            ) : progress.dailyBonusAvailable ? (
                <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="mt-3 w-full rounded-full bg-white py-2 text-xs font-semibold text-coral-600 transition-transform hover:scale-[1.02] active:scale-100 disabled:opacity-70"
                >
                    {claiming ? 'Claiming…' : `Claim +${progress.dailyBonusXp} XP`}
                </button>
            ) : (
                <button
                    onClick={() => navigate('/learn/exercises')}
                    className="mt-3 w-full rounded-full bg-white py-2 text-xs font-semibold text-coral-600 transition-transform hover:scale-[1.02] active:scale-100"
                >
                    {completed ? 'Continue' : 'Continue practicing'}
                </button>
            )}
        </div>
    )
}
