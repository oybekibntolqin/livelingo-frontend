// FollowListModal — Followers yoki Following ro'yxatini ko'rsatadi.
// Agar ro'yxat bo'sh bo'lsa (count 0) — "hali follower/following yo'q"
// deb, o'rniga tavsiya etilgan foydalanuvchilar (Follow tugmasi bilan)
// ko'rsatiladi.

import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import Avatar from './Avatar'
import VerifiedBadge from './VerifiedBadge'
import {type FollowUser, profileApi, type SuggestedUser,} from '../lib/profileApi'

type Mode = 'followers' | 'following'

export default function FollowListModal({
                                            open,
                                            userId,
                                            mode,
                                            onClose,
                                        }: {
    open: boolean
    userId: string
    mode: Mode
    onClose: () => void
}) {
    const [users, setUsers] = useState<FollowUser[]>([])
    const [loading, setLoading] = useState(true)

    const [suggested, setSuggested] = useState<SuggestedUser[]>([])
    const [suggestedLoading, setSuggestedLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        let cancelled = false

        setLoading(true)
        setUsers([])
        setSuggested([])

        const fetcher = mode === 'followers' ? profileApi.getFollowers : profileApi.getFollowing

        fetcher(userId)
            .then(async (list) => {
                if (cancelled) return

                setUsers(list)
                setLoading(false)

                if (list.length === 0) {
                    setSuggestedLoading(true)

                    try {
                        const s = await profileApi.getSuggestedUsers(20)

                        if (!cancelled) {
                            setSuggested(s)
                        }
                    } catch {
                        // jim — bo'sh holatda qoladi
                    } finally {
                        if (!cancelled) {
                            setSuggestedLoading(false)
                        }
                    }
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [open, userId, mode])

    if (!open) return null

    const title = mode === 'followers' ? 'Followers' : 'Following'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose}/>
            <div
                className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-ink/6 px-5 py-4">
                    <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto px-2 py-2">
                    {loading ? (
                        <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
                    ) : users.length > 0 ? (
                        <div className="space-y-1">
                            {users.map((u) => (
                                <FollowUserRow key={u.id} user={u} onNavigate={onClose}/>
                            ))}
                        </div>
                    ) : (
                        <div className="px-3 py-2">
                            <p className="mb-3 text-center text-sm text-ink-muted">
                                {mode === 'followers'
                                    ? "Sizda hali follower yo'q."
                                    : "Siz hali hech kimni follow qilmagansiz."}
                            </p>
                            <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-ink-muted">
                                People to follow
                            </p>
                            {suggestedLoading ? (
                                <p className="py-4 text-center text-xs text-ink-muted">Loading…</p>
                            ) : suggested.length === 0 ? (
                                <p className="py-4 text-center text-xs text-ink-muted">
                                    Tavsiya topilmadi.
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {suggested.map((u) => (
                                        <SuggestedUserRow key={u.id} user={u} onNavigate={onClose}/>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function FollowUserRow({user, onNavigate}: { user: FollowUser; onNavigate: () => void }) {
    const [following, setFollowing] = useState(false)
    const [checked, setChecked] = useState(false)
    const [pending, setPending] = useState(false)

    useEffect(() => {
        profileApi
            .isFollowing(user.id)
            .then((res) => setFollowing(res.following))
            .catch(() => {
            })
            .finally(() => setChecked(true))
    }, [user.id])

    const toggle = async () => {
        if (pending) return
        const next = !following
        setFollowing(next)
        setPending(true)
        try {
            if (next) await profileApi.follow(user.id)
            else await profileApi.unfollow(user.id)
        } catch {
            setFollowing(!next)
        } finally {
            setPending(false)
        }
    }

    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User'

    return (
        <div className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-cream">
            <Link to={`/profile/${user.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar url={user.profilePhotoUrl} size={40}/>
                <p className="truncate text-sm font-medium text-ink">{fullName}</p>
            </Link>
            {checked && (
                <button
                    onClick={toggle}
                    disabled={pending}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        following
                            ? 'border border-ink/12 bg-white text-ink hover:border-coral-500/30 hover:text-coral-600'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                >
                    {following ? 'Following' : 'Follow'}
                </button>
            )}
        </div>
    )
}

export function SuggestedUserRow({
                                     user,
                                     onNavigate,
                                 }: {
    user: SuggestedUser
    onNavigate?: () => void
}) {
    const [following, setFollowing] = useState(false)
    const [pending, setPending] = useState(false)
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        profileApi
            .isFollowing(user.id)
            .then((res) => setFollowing(res.following))
            .catch(() => {})
            .finally(() => setChecked(true))
    }, [user.id])

    const toggle = async () => {
        if (pending) return

        const next = !following
        setFollowing(next)
        setPending(true)

        try {
            if (next) await profileApi.follow(user.id)
            else await profileApi.unfollow(user.id)
        } catch {
            setFollowing(!next)
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-cream">
            <Link to={`/profile/${user.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
                               <Avatar url={user.avatar} size={40}/>
                <Avatar url={user.avatar} size={40}/>
                <div className="min-w-0">
                    {user.username && (
                        <div className="flex items-center gap-1 min-w-0">
                            <p className="truncate text-sm font-medium text-ink">@{user.username}</p>
                            <VerifiedBadge username={user.username} size={13} />
                        </div>
                    )}
                    {(user.name || user.lastName) && (
                        <p className="truncate text-[11px] text-ink-muted">
                            {`${user.name ?? ''} ${user.lastName ?? ''}`.trim()}
                        </p>
                    )}
                </div>
            </Link>
            {checked && (
                <button
                    onClick={toggle}
                    disabled={pending}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        following
                            ? 'border border-ink/12 bg-white text-ink'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                >
                    {following ? 'Following' : 'Follow'}
                </button>
            )}
        </div>
    )
}
