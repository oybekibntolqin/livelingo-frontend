// PostCard — real backend'ga ulangan, like/comment SODDA tarzda.
//
// SODDALASHTIRILDI: Outbox/IndexedDB olib tashlandi.
//   • Like/comment bosilgach UI DARHOL yangilanadi (optimistik)
//   • Bitta so'rov yuboriladi
//   • Muvaffaqiyatli bo'lsa — shu holicha qoladi
//   • Muvaffaqiyatsiz bo'lsa — ANIQ ko'rsatiladi (like: holat orqaga
//     qaytadi; comment: "Yuborilmadi — qayta urinish" tugmasi chiqadi)
//   • Hech qanday avtomatik background retry, hech qanday
//     IndexedDB — barcha holat shu komponent hayoti davomida
//     xotirada saqlanadi

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { postApi, type Post, type PostComment } from '../lib/postApi'
import { getUserIdFromToken } from '../lib/chatAuth'
import { chatSocket } from '../lib/chatSocket'
import type { SignalMessage } from '../lib/chatTypes'
import ShareModal from './ShareModal'
import Avatar from './Avatar'
import VerifiedBadge from './VerifiedBadge'

export default function PostCard({
  post,
  onDeleted,
  onPostUpdated,
}: {
  post: Post
  // Post o'chirilgach ota-komponent (Feed, Profile grid) uni
  // ro'yxatidan olib tashlashi uchun — ixtiyoriy, berilmasa shunchaki
  // chaqirilmaydi (masalan PostDetail sahifasida kerak emas).
  onDeleted?: (postId: string) => void
  // Like/comment holati o'zgarganda ota-komponentdagi post ro'yxatini
  // (masalan Profile'даgi grid) ham yangilash uchun — ixtiyoriy.
  // Buni bermasak, o'zgarish faqat shu komponentning ichki state'ida
  // qolib ketardi va ro'yxat/kartochka faqat sahifa refresh
  // qilingandan keyingina to'g'ri qiymatni ko'rsatardi.
  onPostUpdated?: (postId: string, patch: Partial<Post>) => void
}) {
  const myId = getUserIdFromToken()

  // Rasmli post bo'lsa — uni Body ичida ko'rsatamiz, fon oq qoladi.
  // Matn-only post bo'lsa — "premium" rangli fon beramiz.
  const imageAttachment = post.attachments.find((a) => a.mediaType === 'IMAGE')

  const [liked, setLiked] = useState(post.liked ?? false)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [likePending, setLikePending] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [realCommentsFetched, setRealCommentsFetched] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement | null>(null)
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null)

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

  // ── liked/likeCount/commentCount o'zgargan sari — ota-komponentga
  // (masalan Profile'даgi grid) xabar beramiz. Birinchi render'da
  // chaqirmaymiz (hali hech narsa o'zgargani yo'q).
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    onPostUpdated?.(post.id, { liked, likeCount, commentCount })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, likeCount, commentCount])

  // ── Real-time: like/comment o'zgarishlari boshqa foydalanuvchilardan
  // kelganda ham darhol ekranga chiqishi uchun WebSocket'ga obuna
  // bo'lamiz (reload kutish shart emas).
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
          // O'zimiz yozgan comment allaqachon optimistik ko'rsatilgan —
          // broadcast orqali qayta qo'shib, dublikat hosil qilmaymiz.
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

  // ── Like/unlike — optimistik, BITTA urinish, xato bo'lsa orqaga qaytadi ──
  const toggleLike = async () => {
    if (likePending) return
    const next = !liked
    const prevCount = likeCount

    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    setLikePending(true)

    try {
      if (next) {
        await postApi.like(post.id)
      } else {
        await postApi.unlike(post.id)
      }
    } catch {
      // Muvaffaqiyatsiz — holatni ANIQ orqaga qaytaramiz.
      // Foydalanuvchi shunchaki qayta bossa, bu tabiiy "qayta urinish".
      setLiked(!next)
      setLikeCount(prevCount)
    } finally {
      setLikePending(false)
    }
  }

  // ── Comment bo'limini ochish — birinchi marta tarixni yuklaymiz ──
  const openComments = async () => {
    setCommentsOpen((v) => !v)
    if (!commentsOpen && !realCommentsFetched) {
      setCommentsLoading(true)
      try {
        const list = await postApi.comments(post.id)
        setComments((prev) => {
          // Hali "pending/failed" bo'lgan mahalliy commentlarni saqlab
          // qolamiz, serverdan kelganlar bilan birlashtiramiz.
          const localOnly = prev.filter((c) => c._pending || c._failed)
          const localIds = new Set(localOnly.map((c) => c.id))
          const serverOnly = list.filter((c) => !localIds.has(c.id))
          return [...serverOnly, ...localOnly]
        })
        setRealCommentsFetched(true)
      } catch {
        // jim — mavjud ro'yxat bilan qoladi
      } finally {
        setCommentsLoading(false)
      }
    }
  }

  // ── Comment yuborish — optimistik, BITTA urinish ──
  const sendComment = async (tempId: string, text: string) => {
    try {
      await postApi.addComment(post.id, text, tempId)
      // Muvaffaqiyat — optimistik yozuvni "muvaffaqiyatli" deb belgilaymiz
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, _pending: false, _failed: false } : c))
      )
    } catch {
      // Muvaffaqiyatsiz — ANIQ ko'rsatamiz, foydalanuvchi qayta urinishi mumkin
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
      authorFirstName: 'You',
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`overflow-hidden rounded-4xl border border-ink/8 ${
        imageAttachment ? 'bg-white' : premiumBackground(post.id)
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <Link
          to={`/profile/${post.authorId}`}
          className="group flex items-center gap-3"
        >
          <Avatar
            url={post.authorProfileDTO?.thumbnailUrl || post.authorProfileDTO?.url || null}
            size={44}
            className="ring-2 ring-white/50 transition group-hover:ring-white"
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-ink transition-colors group-hover:text-indigo-600">
                {post.authorName}
              </p>
              <VerifiedBadge username={post.username} size={14} />
              {post.cefrLevel && <span className="pill text-[10px]">{post.cefrLevel}</span>}
            </div>
            <p className="text-xs text-ink-muted">
              {post.username ? `@${post.username} · ` : ''}
              {formatTimeAgo(post.createdAt)}
            </p>
          </div>
        </Link>

        <PostMenu post={post} onDeleted={onDeleted} onShare={() => setShareOpen(true)} />
      </div>

      {/* Body */}
      <div className="px-5 pb-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            {languageLabel(post.language)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {post.content}
        </p>
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {imageAttachment?.url && (
          <PostImage
            thumbnailUrl={imageAttachment.thumbnailUrl || imageAttachment.url}
            fullUrl={imageAttachment.url}
            tinyPreview={imageAttachment.tinyPreview}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-ink/8 px-3 py-2">
        <ActionButton
          onClick={toggleLike}
          active={liked}
          pending={likePending}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          }
          activeColor="text-coral-500"
          label={`${likeCount}`}
        />
        <ActionButton
          onClick={openComments}
          active={commentsOpen}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
          label={`${commentCount}`}
        />
        <ActionButton
          onClick={() => setShareOpen(true)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          }
        />
      </div>

      <ShareModal
        open={shareOpen}
        postId={post.id}
        postPreview={post.content}
        onClose={() => setShareOpen(false)}
      />

      {/* Comment bo'limi */}
      {commentsOpen && (
        <div className="border-t border-ink/8 bg-cream/40 px-5 py-4">
          {commentsLoading ? (
            <p className="py-2 text-center text-xs text-ink-muted">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="py-2 text-center text-xs text-ink-muted">
              No comments yet. Be the first.
            </p>
          ) : (
            <div className="mb-3 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Link
                    to={`/profile/${c.authorId}`}
                    className="flex-shrink-0"
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
                  <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2">
                    <div className="flex items-baseline gap-1.5">
                      <Link
                        to={`/profile/${c.authorId}`}
                        className="text-xs font-semibold text-ink transition-colors hover:text-indigo-600"
                      >
                        {c.authorFirstName} {c.authorLastName}
                      </Link>
                      <VerifiedBadge username={c.authorUsername} size={12} />
                      {c._pending && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
                          <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          sending
                        </span>
                      )}
                      {c._failed && (
                        <button
                          onClick={() => retryComment(c)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-coral-600 hover:text-coral-700"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 4v6h6M23 20v-6h-6" />
                            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                          </svg>
                          not sent — retry
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-ink-soft">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment yozish */}
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment()
              }}
              placeholder="Write a comment…"
              className="flex-1 rounded-full border border-ink/12 bg-white px-4 py-2 pr-9 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
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
              <div className="absolute bottom-full right-0 z-20 mb-2 shadow-lg" ref={emojiPickerRef}>
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setCommentText((t) => t + emojiData.emoji)
                    setEmojiOpen(false)
                  }}
                  emojiStyle={EmojiStyle.NATIVE}
                  theme={Theme.LIGHT}
                  width={300}
                  height={360}
                  searchDisabled={false}
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
      )}
    </motion.article>
  )
}

// ═════════════════════════════════════════════════════════════════
function ActionButton({
  icon,
  label,
  onClick,
  active,
  pending,
  activeColor = 'text-indigo-500',
}: {
  icon: React.ReactNode
  label?: string
  onClick?: () => void
  active?: boolean
  pending?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait ${
        active ? activeColor : 'text-ink-soft hover:bg-cream-warm hover:text-ink'
      }`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

// Matn-only postlarga "premium" ko'rinish — postId'dan deterministik
// tanlangan, ilovaning o'z ranglar oilasidan (indigo/coral/mint/sun)
// yumshoq gradient fon.  Har safar bir xil post bir xil rangda
// ko'rinadi (postId hash'iga bog'liq, tasodifiy emas).
const PREMIUM_BACKGROUNDS = [
  'bg-gradient-to-br from-indigo-50 via-white to-white',
  'bg-gradient-to-br from-coral-50 via-white to-white',
  'bg-gradient-to-br from-mint-50 via-white to-white',
  'bg-gradient-to-br from-sun-50 via-white to-white',
  'bg-gradient-to-br from-indigo-50 via-white to-coral-50/40',
]

export function premiumBackground(postId: string): string {
  let hash = 0
  for (let i = 0; i < postId.length; i++) {
    hash = (hash * 31 + postId.charCodeAt(i)) & 0xffffffff
  }
  const index = Math.abs(hash) % PREMIUM_BACKGROUNDS.length
  return PREMIUM_BACKGROUNDS[index]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase() || 'U'
}

export function languageLabel(lang: Post['language']): string {
  switch (lang) {
    case 'ENGLISH':
      return 'English'
    case 'UZBEK':
      return "O'zbekcha"
    case 'RUSSIAN':
      return 'Русский'
    default:
      return 'Other'
  }
}

export function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d`
  return new Date(iso).toLocaleDateString()
}

// ═════════════════════════════════════════════════════════════════
// Post rasmi — Chat'даgi bilan bir xil "blur-up" pattern:
//   1. Xira, kichik base64 placeholder DARHOL ko'rinadi (tarmoq
//      so'rovisiz — matn bilan birga keladi)
//   2. Kichik (480px) thumbnail fonda yuklanadi, yuklangach xira
//      holatning ustidan sharp ravishda chiqadi
//   3. Bosilsa — asl, to'liq sifatli rasm lightbox'da ochiladi
// ═════════════════════════════════════════════════════════════════
function PostImage({
  thumbnailUrl,
  fullUrl,
  tinyPreview,
}: {
  thumbnailUrl: string
  fullUrl: string
  tinyPreview?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [thumbLoaded, setThumbLoaded] = useState(false)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <div
        className="relative mt-3 max-h-96 w-full cursor-pointer overflow-hidden rounded-3xl border border-ink/8"
        onClick={() => setOpen(true)}
      >
        {tinyPreview && !thumbLoaded && (
          <img
            src={tinyPreview}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
          />
        )}
        <img
          src={thumbnailUrl}
          alt=""
          className={`max-h-96 w-full object-cover transition-opacity duration-300 ${
            tinyPreview && !thumbLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
          onLoad={() => setThumbLoaded(true)}
        />
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setOpen(false)}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-white/80 transition hover:text-white"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <a
              href={fullUrl}
              download
              onClick={(e) => e.stopPropagation()}
              className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <path d="M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download
            </a>
            <img
              src={fullUrl}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
            />
          </div>,
          document.body
        )}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════
// 3-nuqta menyu — Delete (faqat post egasi), Share, Download (rasm
// bo'lsa)
// ═════════════════════════════════════════════════════════════════
function PostMenu({
  post,
  onDeleted,
  onShare,
}: {
  post: Post
  onDeleted?: (postId: string) => void
  onShare: () => void
}) {
  const myId = getUserIdFromToken()
  const isOwner = post.authorId === myId
  const image = post.attachments.find((a) => a.mediaType === 'IMAGE')

  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  // useEffect ichidagi close() closure eskirgan (stale) `deleting`
  // qiymatini ko'rmasligi uchun — ref orqali doim eng so'nggi qiymatni
  // o'qiymiz.
  const deletingRef = useRef(false)

  const openMenu = () => {
    const btn = triggerRef.current
    if (btn) {
      const rect = btn.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const close = () => {
      // O'chirish so'rovi ketayotganda menyuni HECH QACHON yopmaymiz —
      // aks holda scroll yoki boshqa hodisa "Delete" bosilgan zahoti
      // handleDelete ishga tushishidan OLDIN yoki O'RNIGA menyuni yopib
      // qo'yishi mumkin edi (aynan shu bug sodir bo'lgan edi).
      if (deletingRef.current) return
      setOpen(false)
      setConfirmDelete(false)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-post-menu]') && !target.closest('[data-post-menu-portal]')) {
        close()
      }
    }
    const onScroll = () => close()
    document.addEventListener('click', onClick)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const handleDelete = async () => {
    deletingRef.current = true
    setDeleting(true)
    setDeleteError(null)
    try {
      await postApi.deletePost(post.id)
      onDeleted?.(post.id)
      setOpen(false)
    } catch (err) {
      // Avval xato JIM yutilardi — foydalanuvchi hech narsa
      // ko'rmasdi, "delete ishlamayapti" degan taassurot qolardi.
      // Endi aniq xato ko'rsatiladi.
      setDeleteError(
        err instanceof Error ? err.message : 'Could not delete. Please try again.'
      )
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const handleDownload = async () => {
    if (!image?.url) return
    setDownloading(true)
    try {
      // to'g'ridan-to'g'ri <a download> ba'zi brauzerlarda CORS
      // sababli shunchaki yangi tabda ochib yuboradi — shuning uchun
      // fayl sifatida blob orqali yuklaymiz.
      const res = await fetch(image.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = image.fileName || `livelingo-post-${post.id}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // jim — brauzer o'zi xato ko'rsatadi agar fayl ochilmasa
    } finally {
      setDownloading(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative" data-post-menu>
      <button
        ref={triggerRef}
        onClick={openMenu}
        className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && menuPos && createPortal(
        <div
          data-post-menu-portal
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="z-[90] w-44 overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-lg"
        >
          {!confirmDelete ? (
            <>
              {isOwner && (
                <button
                  onClick={() => {
                    setDeleteError(null)
                    setConfirmDelete(true)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-coral-600 transition hover:bg-coral-50"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                  </svg>
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false)
                  onShare()
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition hover:bg-cream"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                Share
              </button>
              {image?.url && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition hover:bg-cream disabled:opacity-50"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <path d="M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {downloading ? 'Downloading…' : 'Download'}
                </button>
              )}
            </>
          ) : (
            <div className="p-3">
              <p className="mb-2.5 text-xs text-ink-soft">Delete this post?</p>
              {deleteError && (
                <p className="mb-2.5 text-[11px] text-coral-700">{deleteError}</p>
              )}
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
        </div>,
        document.body
      )}
    </div>
  )
}
