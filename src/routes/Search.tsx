// Search — Instagram'ning Explore/Search sahifasiga o'xshash, alohida
// (route sifatida) sahifa.
//
// - Eng tepada doim ko'rinadigan (sticky) qidiruv inputi.
// - Input bo'sh bo'lganda: "Explore" — barcha postlar Instagram
//   uslubidagi notekis (ba'zi kataklar 2x2) grid'da.
// - Yozila boshlaganda: "Accounts" — ism, familiya yoki username
//   bo'yicha topilgan foydalanuvchilar, premium ro'yxat ko'rinishida.

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import Avatar from '../components/Avatar'
import PostDetailModal from '../components/PostDetailModal'
import { postApi, enrichPostsWithCounts, type Post } from '../lib/postApi'
import { searchApi } from '../lib/searchApi'
import type { UserSearchResult } from '../lib/chatTypes'
import { isAuthenticated } from '../lib/auth'

const PAGE_SIZE = 30

export default function Search() {
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated()) navigate('/sign-in', { replace: true })
    }, [navigate])

    const openCompose = () => navigate('/dashboard', { state: { openCompose: true } })

    // ── Qidiruv holati (foydalanuvchilar) ──
    const [query, setQuery] = useState('')
    const [debounced, setDebounced] = useState('')
    const [users, setUsers] = useState<UserSearchResult[]>([])
    const [usersLoading, setUsersLoading] = useState(false)
    const requestId = useRef(0)

    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(query.trim()), 280)
        return () => window.clearTimeout(t)
    }, [query])

    useEffect(() => {
        if (debounced.length === 0) {
            setUsers([])
            setUsersLoading(false)
            return
        }
        const myId = ++requestId.current
        setUsersLoading(true)
        searchApi
            .searchUsers(debounced)
            .then((res) => {
                if (requestId.current !== myId) return
                setUsers(res)
            })
            .catch(() => {
                if (requestId.current !== myId) return
                setUsers([])
            })
            .finally(() => {
                if (requestId.current !== myId) return
                setUsersLoading(false)
            })
    }, [debounced])

    // ── Explore grid holati (postlar) ──
    const [posts, setPosts] = useState<Post[]>([])
    const [page, setPage] = useState(0)
    const [exploreLoading, setExploreLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)

    useEffect(() => {
        let cancelled = false
        setExploreLoading(true)
        postApi
            .feed(0, PAGE_SIZE, 'explore')
            .then(async (list) => {
                if (cancelled) return
                const enriched = await enrichPostsWithCounts(list)
                if (cancelled) return
                setPosts(enriched)
                setHasMore(list.length === PAGE_SIZE)
            })
            .catch(() => {
                if (!cancelled) setPosts([])
            })
            .finally(() => {
                if (!cancelled) setExploreLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const loadMore = async () => {
        if (loadingMore || !hasMore) return
        setLoadingMore(true)
        try {
            const next = page + 1
            const list = await postApi.feed(next, PAGE_SIZE, 'explore')
            const enriched = await enrichPostsWithCounts(list)
            setPosts((prev) => [...prev, ...enriched])
            setPage(next)
            setHasMore(list.length === PAGE_SIZE)
        } catch {
            setHasMore(false)
        } finally {
            setLoadingMore(false)
        }
    }

    // ── Post detail modal ──
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    const openPostAt = (index: number) => setOpenIndex(index)
    const closePost = () => setOpenIndex(null)

    const goPrev = () => setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i))
    const goNext = () => {
        setOpenIndex((i) => {
            if (i === null) return i
            if (i < posts.length - 1) return i + 1
            return i
        })
        if (openIndex !== null && openIndex >= posts.length - 1 && hasMore) {
            loadMore()
        }
    }

    const handlePostDeleted = (postId: string) => {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
        setOpenIndex(null)
    }

    // Modal ichida like bosilganda yoki comment yozilganda — grid'даgi
    // (va openIndex orqali modal'ga qayta uzatiladigan) postni ham
    // yangilaymiz. Buni qilmasak, modalni yopib qaytadan ochganda
    // (yoki grid hover'даgi sonlar) faqat sahifa refresh qilingandan
    // keyin to'g'ri ko'rinardi.
    const handlePostUpdated = (postId: string, patch: Partial<Post>) => {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)))
    }

    const isSearching = debounced.length > 0

    // ── Skrol bo'yicha yashirish/ko'rsatish ──
    const [isAtTop, setIsAtTop] = useState(true)

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY < 24) {
                setIsAtTop(true)
            } else {
                setIsAtTop(false)
            }
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const showHeader = isAtTop || isSearching

    return (
        <div className="min-h-screen bg-cream">
            <DashboardNav />
            <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
                <Sidebar onCreatePost={openCompose} />
                <MobileNav onCreatePost={openCompose} />

                <main className="min-w-0">
                    {/* ── Minimalistik Sticky Qidiruv paneli (Katta oq quti olib tashlandi) ── */}
                    <div
                        className={`sticky top-20 z-20 mb-6 bg-cream pb-3 pt-1 transition-all duration-300 ease-in-out ${
                            showHeader
                                ? 'opacity-100 translate-y-0 pointer-events-auto'
                                : 'opacity-0 -translate-y-[120%] pointer-events-none'
                        }`}
                    >
                        <SearchInput value={query} onChange={setQuery} />
                    </div>

                    <AnimatePresence mode="wait">
                        {isSearching ? (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                            >
                                <AccountResults query={debounced} users={users} loading={usersLoading} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="explore"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                            >
                                <ExploreGrid
                                    posts={posts}
                                    loading={exploreLoading}
                                    loadingMore={loadingMore}
                                    hasMore={hasMore}
                                    onLoadMore={loadMore}
                                    onOpenPost={openPostAt}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>

            {openIndex !== null && posts[openIndex] && (
                <PostDetailModal
                    post={posts[openIndex]}
                    onClose={closePost}
                    onDeleted={handlePostDeleted}
                    onPostUpdated={handlePostUpdated}
                    onPrev={goPrev}
                    onNext={goNext}
                    hasPrev={openIndex > 0}
                    hasNext={openIndex < posts.length - 1 || hasMore}
                />
            )}
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════
// Instagram Minimal-Oq Qidiruv Inputi (Ko'k chiziqlarsiz)
// ═════════════════════════════════════════════════════════════════
function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="group flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 focus-within:border-neutral-350 focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {/* Qidiruv Ikonkasi */}
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-neutral-400 transition-colors group-focus-within:text-neutral-500"
            >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
            </svg>

            {/* Input Maydoni (Barcha brauzer ko'k chiziqlari va ramkalari olib tashlandi) */}
            <input
                autoFocus
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search"
                className="w-full border-none bg-transparent text-[14px] font-normal text-neutral-800 placeholder:text-neutral-400 outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            />

            {/* Tozalash (Clear) tugmasi */}
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="shrink-0 rounded-full bg-neutral-200 p-0.5 text-neutral-500 transition hover:bg-neutral-300 hover:text-neutral-700"
                    aria-label="Clear search"
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            )}
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════
// Accounts natijalari
// ═════════════════════════════════════════════════════════════════
function AccountResults({
                            query,
                            users,
                            loading,
                        }: {
    query: string
    users: UserSearchResult[]
    loading: boolean
}) {
    if (loading) {
        return (
            <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3.5 rounded-2xl px-3 py-2.5">
                        <div className="h-12 w-12 shrink-0 rounded-full bg-ink/8" />
                        <div className="space-y-2">
                            <div className="h-3 w-32 rounded-full bg-ink/8" />
                            <div className="h-2.5 w-20 rounded-full bg-ink/6" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-ink/5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                </div>
                <p className="font-display text-base font-medium text-ink">No results found</p>
                <p className="max-w-xs text-sm text-ink-muted">
                    We couldn't find anyone matching "{query}". Try a different name or username.
                </p>
            </div>
        )
    }

    return (
        <div>
            <p className="mb-2 px-3 font-mono text-[10px] font-medium uppercase tracking-widest text-ink-muted">
                {users.length} account{users.length === 1 ? '' : 's'} found
            </p>
            <div className="space-y-0.5">
                {users.map((u, i) => (
                    <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.2) }}
                    >
                        <AccountRow user={u} />
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

function AccountRow({ user }: { user: UserSearchResult }) {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User'
    return (
        <Link
            to={`/profile/${user.id}`}
            className="flex items-center gap-3.5 rounded-2xl px-3 py-2.5 transition hover:bg-white hover:shadow-[0_1px_0_rgba(20,20,43,0.04)]"
        >
            <Avatar url={user.profilePhotoUrl} size={48} />
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
                {user.username ? (
                    <p className="truncate text-xs text-ink-muted">@{user.username}</p>
                ) : (
                    <p className="truncate text-xs text-ink-muted">LiveLingo user</p>
                )}
            </div>
        </Link>
    )
}

// ═════════════════════════════════════════════════════════════════
// Explore grid (Instagram uslubida — ba'zi kataklar 2x2)
// ═════════════════════════════════════════════════════════════════

function isFeatured(index: number): boolean {
    return index % 6 === 4
}

function ExploreGrid({
                         posts,
                         loading,
                         loadingMore,
                         hasMore,
                         onLoadMore,
                         onOpenPost,
                     }: {
    posts: Post[]
    loading: boolean
    loadingMore: boolean
    hasMore: boolean
    onLoadMore: () => void
    onOpenPost: (index: number) => void
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-3 gap-1 [grid-auto-flow:dense] sm:gap-1.5">
                {Array.from({ length: 18 }).map((_, i) => (
                    <div
                        key={i}
                        className={`aspect-square animate-pulse rounded-sm bg-ink/6 sm:rounded-md ${
                            isFeatured(i) ? 'col-span-2 row-span-2' : ''
                        }`}
                    />
                ))}
            </div>
        )
    }

    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-ink/5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                </div>
                <p className="font-display text-base font-medium text-ink">Nothing to explore yet</p>
                <p className="max-w-xs text-sm text-ink-muted">Posts from the community will show up here.</p>
            </div>
        )
    }

    return (
        <div>
            <div className="grid grid-cols-3 gap-1 [grid-auto-flow:dense] sm:gap-1.5">
                {posts.map((post, i) => (
                    <ExploreTile
                        key={post.id}
                        post={post}
                        featured={isFeatured(i)}
                        index={i}
                        onOpen={() => onOpenPost(i)}
                    />
                ))}
            </div>

            {hasMore && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-6 py-2.5 text-sm font-semibold text-ink transition-all duration-200 hover:border-ink/20 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                    >
                        {loadingMore && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />}
                        {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                </div>
            )}
        </div>
    )
}

function ExploreTile({
                         post,
                         featured,
                         index,
                         onOpen,
                     }: {
    post: Post
    featured: boolean
    index: number
    onOpen: () => void
}) {
    const image = post.attachments.find((a) => a.mediaType === 'IMAGE')

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: Math.min((index % 18) * 0.015, 0.15) }}
            className={featured ? 'col-span-2 row-span-2' : ''}
        >
            <Link
                to={`/posts/${post.id}`}
                onClick={(e) => {
                    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                        return
                    }
                    e.preventDefault()
                    onOpen()
                }}
                className="group relative block aspect-square overflow-hidden rounded-sm bg-ink/5 sm:rounded-md"
            >
                {image?.url ? (
                    <img
                        src={image.thumbnailUrl || image.url}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="relative flex h-full w-full flex-col justify-center border border-ink/8 bg-white p-3">
                        <svg width={featured ? 20 : 16} height={featured ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-3 text-ink-muted/40">
                            <path d="M4 6h16M4 12h10M4 18h7" />
                        </svg>
                        <p className={`line-clamp-5 text-center font-display font-medium leading-snug text-ink ${featured ? 'text-base' : 'text-xs'}`}>
                            {post.content}
                        </p>
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-4 bg-ink/40 opacity-0 transition [@media(hover:hover)]:flex group-hover:opacity-100">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
              {post.likeCount ?? 0}
          </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
                        {post.commentCount ?? 0}
          </span>
                </div>
            </Link>
        </motion.div>
    )
}