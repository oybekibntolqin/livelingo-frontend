import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'
import { postApi, type Post, type PostLanguage, type CreatePostInput } from '../lib/postApi'
import { getUserIdFromToken } from '../lib/chatAuth'
import PostCard from '../components/PostCard'
import UploadProgressBar from '../components/shared/UploadProgressBar'
import { DashboardNav, Sidebar, RightRail, MobileNav } from '../components/AppShell'

// ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
    const navigate = useNavigate()
    const location = useLocation()

    // Auth guard
    useEffect(() => {
        if (!isAuthenticated()) {
            navigate('/sign-in', { replace: true })
        }
    }, [navigate])

    const [posts, setPosts] = useState<Post[]>([])
    const [postsLoading, setPostsLoading] = useState(true)
    const [composeOpen, setComposeOpen] = useState(false)

    useEffect(() => {
        const state = location.state as { openCompose?: boolean } | null
        if (state?.openCompose) {
            setComposeOpen(true)
            window.history.replaceState({}, '')
        }
    }, [location.state])

    useEffect(() => {
        let cancelled = false
        const requestStartedAt = Date.now()

        const load = async () => {
            try {
                const list = await postApi.feed()
                if (cancelled) return

                const enriched = await Promise.all(
                    list.map(async (p) => {
                        const [likeInfo, commentCount] = await Promise.all([
                            postApi.likeInfo(p.id).catch(() => ({ count: 0, liked: false })),
                            postApi.commentCount(p.id).catch(() => 0),
                        ])
                        return {
                            ...p,
                            likeCount: likeInfo.count,
                            liked: likeInfo.liked,
                            commentCount,
                        }
                    })
                )
                if (cancelled) return
                setPosts((prev) => {
                    const createdWhileLoading = prev.filter(
                        (p) =>
                            !enriched.some((e) => e.id === p.id) &&
                            new Date(p.createdAt).getTime() >= requestStartedAt
                    )
                    return [...createdWhileLoading, ...enriched]
                })
            } catch {
                if (!cancelled) setPosts((prev) => prev)
            } finally {
                if (!cancelled) setPostsLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [])

    return (
        <div className="min-h-screen bg-cream">
            {/* Mobile Nav Header */}
            <DashboardNav />

            {/* Chap va Tepaga yopishgan Desktop Sidebar */}
            <Sidebar onCreatePost={() => setComposeOpen(true)} />

            {/* Mobil pastki menyu */}
            <MobileNav onCreatePost={() => setComposeOpen(true)} />

            {/* Asosiy kontent maydoni: Sidebar kengligi (w-60) hisobiga lg:pl-60 berilgan — postlar hech qachon to'silmaydi */}
            <div className="min-h-screen pb-24 lg:pl-60 lg:pb-16">
                <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8">
                    <main className="min-w-0">
                        <Feed
                            posts={posts}
                            loading={postsLoading}
                            onCreatePost={() => setComposeOpen(true)}
                            onPostDeleted={(postId) =>
                                setPosts((prev) => prev.filter((p) => p.id !== postId))
                            }
                            onPostUpdated={(postId, patch) =>
                                setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)))
                            }
                        />
                    </main>
                    <RightRail />
                </div>
            </div>

            <ComposeModal
                open={composeOpen}
                onClose={() => setComposeOpen(false)}
                onCreated={(post) => {
                    setPosts((prev) => [post, ...prev])
                    setComposeOpen(false)
                }}
            />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
function Feed({
                  posts,
                  loading,
                  onCreatePost,
                  onPostDeleted,
                  onPostUpdated,
              }: {
    posts: Post[]
    loading: boolean
    onCreatePost: () => void
    onPostDeleted: (postId: string) => void
    onPostUpdated: (postId: string, patch: Partial<Post>) => void
}) {
    return (
        <div className="space-y-5">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <p className="mt-3 text-sm font-medium text-ink-muted">Loading feed…</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="group flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink/15 bg-white/70 px-6 py-12 text-center backdrop-blur-xs transition-all duration-200 hover:border-indigo-300 hover:bg-white">
                    <button
                        type="button"
                        onClick={onCreatePost}
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100 transition-all duration-200 hover:scale-105 hover:bg-indigo-600 hover:text-white active:scale-95"
                        aria-label="Create post"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </button>

                    <h3 className="mt-4 font-display text-base font-bold text-ink">
                        No posts yet
                    </h3>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
                        Be the first one to share a thought, question, or language goal with the community.
                    </p>

                    <button
                        type="button"
                        onClick={onCreatePost}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-700 active:scale-95"
                    >
                        <span>Create a post</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </button>
                </div>
            ) : (
                posts.map((post) => (
                    <PostCard key={post.id} post={post} onDeleted={onPostDeleted} onPostUpdated={onPostUpdated} />
                ))
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
const POST_LANGUAGES: { value: PostLanguage; label: string; flag: string }[] = [
    { value: 'ENGLISH', label: 'English', flag: '🇬🇧' },
    { value: 'UZBEK', label: "O'zbekcha", flag: '🇺🇿' },
    { value: 'RUSSIAN', label: 'Русский', flag: '🇷🇺' },
    { value: 'OTHER', label: 'Other', flag: '🌐' },
]

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function ComposeModal({
                          open,
                          onClose,
                          onCreated,
                      }: {
    open: boolean
    onClose: () => void
    onCreated: (post: Post) => void
}) {
    const myId = getUserIdFromToken()

    const [content, setContent] = useState('')
    const [language, setLanguage] = useState<PostLanguage>('ENGLISH')
    const [cefrLevel, setCefrLevel] = useState<string | null>(null)
    const [tagsOpen, setTagsOpen] = useState(false)
    const [tagsInput, setTagsInput] = useState('')

    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

    const [submitting, setSubmitting] = useState(false)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        if (!open) return
        setContent('')
        setLanguage('ENGLISH')
        setCefrLevel(null)
        setTagsOpen(false)
        setTagsInput('')
        setImageFile(null)
        setImagePreviewUrl(null)
        setSubmitting(false)
        setUploadPercent(0)
        setError(null)
    }, [open])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting && open) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, submitting, onClose])

    if (!open) return null

    const handlePickImage = (file: File) => {
        setError(null)
        setImageFile(file)
        setImagePreviewUrl(URL.createObjectURL(file))
    }

    const clearImage = () => {
        setImageFile(null)
        setImagePreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const canSubmit = (content.trim().length > 0 || !!imageFile) && !submitting

    const submit = async () => {
        if (!canSubmit || !myId) return

        const tags = tagsInput
            .split(/[,\s]+/)
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (t.startsWith('#') ? t : `#${t}`))

        const input: CreatePostInput = {
            content: content.trim(),
            language,
            cefrLevel: cefrLevel ?? undefined,
            tags,
            imageFile: imageFile ?? undefined,
            onUploadProgress: setUploadPercent,
        }

        setSubmitting(true)
        setUploadPercent(0)
        setError(null)

        try {
            const created = await postApi.createPost(input)
            onCreated(created)
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to publish post. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="fixed inset-0 bg-ink/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
                onClick={submitting ? undefined : onClose}
            />

            <div className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-2xl transition-all animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-ink/8 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>
                        <h2 className="font-display text-base font-bold text-ink">Create a post</h2>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink active:scale-95 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
                    <div className="rounded-2xl border border-ink/8 bg-cream/30 p-3.5 transition-all focus-within:border-indigo-500/50 focus-within:bg-white focus-within:ring-3 focus-within:ring-indigo-500/10">
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-xs">
                                U
                            </div>
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="What's on your mind? Share what you learned today, ask a grammar question, or post a goal…"
                                rows={4}
                                disabled={submitting}
                                autoFocus
                                className="w-full resize-none bg-transparent pt-1 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70 focus:outline-none"
                            />
                        </div>
                    </div>

                    {imagePreviewUrl && (
                        <div className="relative mt-4 inline-block overflow-hidden rounded-2xl border border-ink/10 bg-cream/30">
                            <img
                                src={imagePreviewUrl}
                                alt="preview"
                                className="max-h-64 w-auto rounded-2xl object-cover"
                            />
                            <button
                                onClick={clearImage}
                                disabled={submitting}
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur-xs transition-all hover:bg-ink active:scale-90 disabled:opacity-50"
                                title="Remove image"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {submitting && imageFile && (
                        <div className="mt-4">
                            <UploadProgressBar percent={uploadPercent} fileName={imageFile.name} />
                        </div>
                    )}

                    <div className="mt-4 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {POST_LANGUAGES.map((l) => {
                                const isSelected = language === l.value
                                return (
                                    <button
                                        key={l.value}
                                        type="button"
                                        onClick={() => setLanguage(l.value)}
                                        disabled={submitting}
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                                            isSelected
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                                : 'border-ink/10 bg-white text-ink-muted hover:border-ink/20 hover:text-ink'
                                        }`}
                                    >
                                        <span>{l.flag}</span>
                                        <span>{l.label}</span>
                                    </button>
                                )
                            })}

                            <span className="mx-1 h-4 w-px bg-ink/10" />

                            {CEFR_LEVELS.map((lvl) => {
                                const isSelected = cefrLevel === lvl
                                return (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => setCefrLevel((c) => (c === lvl ? null : lvl))}
                                        disabled={submitting}
                                        className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                                            isSelected
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                                : 'border-ink/10 bg-white text-ink-muted hover:border-ink/20 hover:text-ink'
                                        }`}
                                    >
                                        {lvl}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {tagsOpen && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 rounded-xl border border-ink/12 bg-cream/40 px-3 py-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20">
                                <span className="text-xs font-bold text-indigo-600">#</span>
                                <input
                                    type="text"
                                    value={tagsInput}
                                    onChange={(e) => setTagsInput(e.target.value)}
                                    placeholder="grammar, vocabulary, reading (separate with comma)"
                                    disabled={submitting}
                                    className="w-full bg-transparent text-xs text-ink placeholder:text-ink-muted/70 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-coral-200 bg-coral-50/70 px-3 py-2 text-xs font-medium text-coral-700">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {!navigator.onLine && (
                        <p className="mt-2.5 text-xs text-amber-700">
                            You are currently offline. Publishing might fail until connection is restored.
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-ink/8 bg-cream/30 px-6 py-3.5">
                    <div className="flex items-center gap-1.5">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handlePickImage(f)
                            }}
                        />
                        <ComposeButton
                            icon="image"
                            label="Photo"
                            active={!!imageFile}
                            onClick={() => fileInputRef.current?.click()}
                        />
                        <ComposeButton
                            icon="tag"
                            label="Tags"
                            active={tagsOpen}
                            onClick={() => setTagsOpen((v) => !v)}
                        />
                    </div>

                    <button
                        onClick={submit}
                        disabled={!canSubmit}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                        {submitting ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                <span>Posting…</span>
                            </>
                        ) : (
                            <span>Post</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
function ComposeButton({
                           icon,
                           label,
                           onClick,
                           active,
                       }: {
    icon: 'image' | 'tag'
    label: string
    onClick?: () => void
    active?: boolean
}) {
    const c = {
        width: 16,
        height: 16,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                active
                    ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border border-transparent text-ink-muted hover:bg-ink/5 hover:text-ink'
            }`}
        >
            {icon === 'image' ? (
                <svg {...c}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
            ) : (
                <svg {...c}>
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <circle cx="7" cy="7" r="1" />
                </svg>
            )}
            <span>{label}</span>
        </button>
    )
}