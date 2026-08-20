// PostDetailModal — Instagram'ning post-detail modal'iga o'xshash
// oynada postni ochish: chap tomonda katta rasm, o'ng tomonda
// header + caption + commentlar + like/comment/share + comment
// yozish maydoni. Sahifadan chiqmasdan (route o'zgarmasdan), joriy
// sahifa (masalan Search) ustida overlay sifatida ochiladi.
//
// Explore grid'dagi kabi bir nechta post orasida chap/o'ng strelka
// bilan (yoki klaviatura ←/→) o'tish qo'llab-quvvatlanadi.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { postApi, type Post, type PostComment } from '../lib/postApi'
import { getUserIdFromToken } from '../lib/chatAuth'
import { chatSocket } from '../lib/chatSocket'
import type { SignalMessage } from '../lib/chatTypes'
import ShareModal from './ShareModal'
import { formatTimeAgo, initials, languageLabel, premiumBackground } from './PostCard'

export default function PostDetailModal({
  post,
  onClose,
  onDeleted,
  onPostUpdated,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  post: Post
  onClose: () => void
  // Post o'chirilgach ota-komponent (masalan Explore grid) uni
  // ro'yxatidan olib tashlashi uchun — ixtiyoriy.
  onDeleted?: (postId: string) => void
  // Like/comment holati o'zgarganda ota-komponentdagi post ro'yxatini
  // ham yangilash uchun — ixtiyoriy (bo'lmasa faqat modal ichida
  // yangilanib, ro'yxat/grid refresh'gacha eski qiymatni ko'rsatadi).
  onPostUpdated?: (postId: string, patch: Partial<Post>) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}) {
  const myId = getUserIdFromToken()
  const imageAttachment = post.attachments.find((a) => a.mediaType === 'IMAGE')

  const [liked, setLiked] = useState(post.liked ?? false)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [likePending, setLikePending] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const [comments, setComments] = useState<PostComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0)
  const [commentText, setCommentText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement | null>(null)
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const commentInputRef = useRef<HTMLInputElement | null>(null)

  const isOwner = post.authorId === myId

  // ── Post almashganda holatni shu postnikiga qayta o'rnatamiz ──
  useEffect(() => {
    setLiked(post.liked ?? false)
    setLikeCount(post.likeCount ?? 0)
    setCommentCount(post.commentCount ?? 0)
    setComments([])
    setCommentsLoading(true)
    setCommentText('')
    setEmojiOpen(false)
    setMenuOpen(false)
    setConfirmDelete(false)
    setDeleteError(null)
    setThumbLoaded(false)

    let cancelled = false
    postApi
      .comments(post.id)
      .then((list) => {
        if (!cancelled) setComments(list)
      })
      .catch(() => {
        if (!cancelled) setComments([])
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [post.id])

  // ── Body scroll'ni bloklash + klaviatura (Esc / ←/→) ──
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onPrev?.()
      else if (e.key === 'ArrowRight' && hasNext) onNext?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  // ── liked/likeCount/commentCount o'zgargan sari — ota-komponentga
  // xabar beramiz. `post.id` almashganda (prev/next strelka) shu
  // postning boshlang'ich qiymatlari uchun qayta chaqirmaymiz — faqat
  // haqiqiy o'zgarishlarda.
  const lastReportedPostIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastReportedPostIdRef.current !== post.id) {
      lastReportedPostIdRef.current = post.id
      return
    }
    onPostUpdated?.(post.id, { liked, likeCount, commentCount })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, likeCount, commentCount])

  // ── Real-time like/comment yangilanishlari ──
  useEffect(() => {
    const unsub = chatSocket.subscribe((sig: SignalMessage) => {
      switch (sig.type) {
        case 'POST_LIKE_UPDATE': {
          const payload = sig.payload as { postId?: string; count?: number } | undefined
          if (payload?.postId === post.id && typeof payload.count === 'number') {
            setLikeCount(payload.count)
          }
          break
        }
        case 'POST_COMMENT_NEW': {
          const c = sig.payload as PostComment | undefined
          if (!c || c.postId !== post.id) break
          if (c.authorId === myId) break
          setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]))
          setCommentCount((n) => n + 1)
          break
        }
        case 'POST_COMMENT_EDITED': {
          const c = sig.payload as PostComment | undefined
          if (!c || c.postId !== post.id) break
          setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)))
          break
        }
        case 'POST_COMMENT_DELETED': {
          const payload = sig.payload as { postId?: string; commentId?: string } | undefined
          if (payload?.postId !== post.id || !payload.commentId) break
          setComments((prev) => prev.filter((x) => x.id !== payload.commentId))
          setCommentCount((n) => Math.max(0, n - 1))
          break
        }
      }
    })
    return unsub
  }, [post.id, myId])

  // Emoji panel tashqarisiga bosilsa — yopamiz.
  useEffect(() => {
    if (!emojiOpen) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        emojiPickerRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target)
      ) {
        return
      }
      setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [emojiOpen])

  const toggleLike = async () => {
    if (likePending) return
    const next = !liked
    const prevCount = likeCount
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    setLikePending(true)
    try {
      if (next) await postApi.like(post.id)
      else await postApi.unlike(post.id)
    } catch {
      setLiked(!next)
      setLikeCount(prevCount)
    } finally {
      setLikePending(false)
    }
  }

  const sendComment = async (tempId: string, text: string) => {
    try {
      await postApi.addComment(post.id, text, tempId)
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, _pending: false, _failed: false } : c))
      )
    } catch {
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, _pending: false, _failed: true } : c))
      )
    }
  }

  const submitComment = () => {
    const text = commentText.trim()
    if (!text || !myId) return
    const tempId = crypto.randomUUID()
    const optimistic: PostComment = {
      id: tempId,
      postId: post.id,
      authorId: myId,
      authorFirstName: 'Siz',
      authorLastName: '',
      authorProfileDTO: null,
      content: text,
      edited: false,
      editedAt: null,
      createdAt: new Date().toISOString(),
      _pending: true,
    }
    setComments((prev) => [...prev, optimistic])
    setCommentCount((c) => c + 1)
    setCommentText('')
    sendComment(tempId, text)
  }

  const retryComment = (comment: PostComment) => {
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, _pending: true, _failed: false } : c))
    )
    sendComment(comment.id, comment.content)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await postApi.deletePost(post.id)
      onDeleted?.(post.id)
      onClose()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "O'chirilmadi. Qayta urinib ko'ring.")
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async () => {
    if (!imageAttachment?.url) return
    setDownloading(true)
    try {
      const res = await fetch(imageAttachment.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = imageAttachment.fileName || `livelingo-post-${post.id}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // jim — brauzer o'zi xato ko'rsatadi
    } finally {
      setDownloading(false)
      setMenuOpen(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/90 p-3 sm:p-6"
        onClick={onClose}
      >
        {/* Yopish tugmasi */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/80 transition hover:text-white"
          aria-label="Close"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Chap strelka */}
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPrev?.()
            }}
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow-lg transition hover:scale-105 hover:bg-white sm:left-5 sm:block"
            aria-label="Previous post"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {/* O'ng strelka */}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNext?.()
            }}
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow-lg transition hover:scale-105 hover:bg-white sm:right-5 sm:block"
            aria-label="Next post"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Modal panel */}
        <motion.div
          key={post.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => e.stopPropagation()}
          className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:h-[85vh] md:flex-row"
        >
          {/* ── Chap: rasm ── */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black md:w-[62%] md:flex-none">
            {imageAttachment?.url ? (
              <>
                {imageAttachment.tinyPreview && !thumbLoaded && (
                  <img
                    src={imageAttachment.tinyPreview}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                  />
                )}
                <img
                  src={imageAttachment.url}
                  alt=""
                  onLoad={() => setThumbLoaded(true)}
                  className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                    imageAttachment.tinyPreview && !thumbLoaded ? 'opacity-0' : 'opacity-100'
                  }`}
                />
              </>
            ) : (
              <div className={`flex h-full w-full items-center justify-center p-10 text-center ${premiumBackground(post.id)}`}>
                <p className="line-clamp-[12] font-display text-xl font-medium leading-snug text-ink">
                  {post.content}
                </p>
              </div>
            )}
          </div>

          {/* ── O'ng: header / caption / commentlar / actions ── */}
          <div className="flex min-h-0 flex-1 flex-col md:w-[38%]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3">
              <Link to={`/profile/${post.authorId}`} onClick={onClose} className="group flex items-center gap-3 min-w-0">
                {post.authorProfileDTO?.url ? (
                  <img
                    src={post.authorProfileDTO.thumbnailUrl || post.authorProfileDTO.url}
                    alt=""
                    className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-2 ring-white/50"
                  />
                ) : (
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-xs font-semibold text-white">
                    {initials(post.authorName)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink group-hover:text-indigo-600">
                    {post.authorName}
                    {post.cefrLevel && <span className="pill ml-2 text-[10px] align-middle">{post.cefrLevel}</span>}
                  </p>
                </div>
              </Link>

              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
                  aria-label="More options"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="12" cy="19" r="1.7" />
                  </svg>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-lg">
                      {!confirmDelete ? (
                        <>
                          {isOwner && (
                            <button
                              onClick={() => setConfirmDelete(true)}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-coral-600 transition hover:bg-coral-50"
                            >
                              Delete
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setMenuOpen(false)
                              setShareOpen(true)
                            }}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition hover:bg-cream"
                          >
                            Share
                          </button>
                          {imageAttachment?.url && (
                            <button
                              onClick={handleDownload}
                              disabled={downloading}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition hover:bg-cream disabled:opacity-50"
                            >
                              {downloading ? 'Downloading…' : 'Download'}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="p-3">
                          <p className="mb-2.5 text-xs text-ink-soft">Postni o'chirasizmi?</p>
                          {deleteError && <p className="mb-2.5 text-[11px] text-coral-700">{deleteError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDelete(false)}
                              disabled={deleting}
                              className="flex-1 rounded-xl border border-ink/10 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-cream disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleDelete}
                              disabled={deleting}
                              className="flex-1 rounded-xl bg-coral-500 py-1.5 text-xs font-semibold text-white transition hover:bg-coral-600 disabled:opacity-50"
                            >
                              {deleting ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Scroll qilinadigan tana: caption + commentlar */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-1 flex flex-wrap gap-1.5">
                <span className="pill text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {languageLabel(post.language)}
                </span>
              </div>

              {/* Caption — Instagram'da birinchi "comment" sifatida ko'rinadi */}
              <div className="flex items-start gap-2.5 py-2.5">
                {post.authorProfileDTO?.url ? (
                  <img
                    src={post.authorProfileDTO.thumbnailUrl || post.authorProfileDTO.url}
                    alt=""
                    className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-[10px] font-semibold text-white">
                    {initials(post.authorName)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    <span className="font-semibold">{post.authorName}</span>{' '}
                    {post.content}
                  </p>
                  {post.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-sm font-medium text-indigo-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-ink-muted">{formatTimeAgo(post.createdAt)}</p>
                </div>
              </div>

              <div className="my-1 border-t border-ink/6" />

              {/* Commentlar ro'yxati */}
              {commentsLoading ? (
                <p className="py-6 text-center text-xs text-ink-muted">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-muted">Hali comment yo'q. Birinchi bo'ling.</p>
              ) : (
                <div className="space-y-3 py-2">
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Link
                        to={`/profile/${c.authorId}`}
                        className="mt-0.5 flex-shrink-0"
                        title={`${c.authorFirstName} ${c.authorLastName}`}
                      >
                        {c.authorProfileDTO?.url ? (
                          <img
                            src={c.authorProfileDTO.thumbnailUrl || c.authorProfileDTO.url}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                            {initials(`${c.authorFirstName} ${c.authorLastName}`)}
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <Link
                            to={`/profile/${c.authorId}`}
                            className="text-xs font-semibold text-ink transition-colors hover:text-indigo-600"
                          >
                            {c.authorFirstName} {c.authorLastName}
                          </Link>
                          {c._pending && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
                              <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                              yuborilmoqda
                            </span>
                          )}
                          {c._failed && (
                            <button
                              onClick={() => retryComment(c)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-coral-600 hover:text-coral-700"
                            >
                              yuborilmadi — qayta urinish
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-ink-soft">{c.content}</p>
                        <p className="mt-0.5 text-[10px] text-ink-muted">{formatTimeAgo(c.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-ink/8">
              <div className="flex items-center gap-1 px-2 pt-1.5">
                <ActionButton
                  onClick={toggleLike}
                  active={liked}
                  pending={likePending}
                  activeColor="text-coral-500"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  }
                />
                <ActionButton
                  onClick={() => commentInputRef.current?.focus()}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  }
                />
                <ActionButton
                  onClick={() => setShareOpen(true)}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  }
                />
              </div>
              <div className="px-4 pb-1.5">
                <p className="text-sm font-semibold text-ink">
                  {likeCount.toLocaleString()} like{likeCount === 1 ? '' : 's'}
                </p>
                {commentCount > 0 && (
                  <p className="text-[11px] text-ink-muted">
                    {commentCount} comment{commentCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>

              {/* Comment yozish */}
              <div className="relative flex items-center gap-2 border-t border-ink/8 px-4 py-2.5">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitComment()
                  }}
                  placeholder="Comment yozing…"
                  className="flex-1 rounded-full border border-ink/12 bg-cream px-4 py-2 pr-9 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                />
                <button
                  ref={emojiButtonRef}
                  onClick={() => setEmojiOpen((v) => !v)}
                  className="absolute right-[52px] top-1/2 -translate-y-1/2 text-base leading-none opacity-70 transition hover:opacity-100"
                  title="Emoji"
                >
                  🙂
                </button>
                {emojiOpen && (
                  <div className="absolute bottom-full right-4 z-20 mb-2 shadow-lg" ref={emojiPickerRef}>
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setCommentText((t) => t + emojiData.emoji)
                        setEmojiOpen(false)
                      }}
                      emojiStyle={EmojiStyle.NATIVE}
                      theme={Theme.LIGHT}
                      width={300}
                      height={360}
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:opacity-40"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <ShareModal open={shareOpen} postId={post.id} postPreview={post.content} onClose={() => setShareOpen(false)} />
    </AnimatePresence>,
    document.body
  )
}

function ActionButton({
  icon,
  onClick,
  active,
  pending,
  activeColor = 'text-indigo-500',
}: {
  icon: React.ReactNode
  onClick?: () => void
  active?: boolean
  pending?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`rounded-full p-2 transition-colors disabled:cursor-wait ${
        active ? activeColor : 'text-ink-soft hover:bg-cream-warm hover:text-ink'
      }`}
    >
      {icon}
    </button>
  )
}
