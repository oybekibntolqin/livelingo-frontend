// PostGrid — Instagram uslubida kvadrat kartochkalar.
//
// Rasmli post — rasmning o'zi (object-cover, kvadrat kesilgan).
// Matn-only post — toza, neytral (oq fon + ink rangli matn) plitka,
// Threads/Instagram'даgi matn-post uslubiga o'xshab. Avval har xil
// rangli gradient fon ishlatilar edi — ko'rinishi "shovqinli" va
// brendga mos kelmasdi.
//
// Hover'da like/comment soni ko'rinadi (referens rasmdagi kabi) —
// FAQAT sichqonchali (hover qo'llaydigan) qurilmalarda. Touch
// qurilmalarda hover holati tap'dan keyin "yopishib qolib", matn
// ustiga tushib chalkash ko'rinish berardi — shu sabab endi faqat
// @media(hover:hover) ostida ko'rsatiladi.
//
// Bosilsa — to'liq post modal ичida ochiladi.

import { useState } from 'react'
import type { Post } from '../lib/postApi'
import PostCard from './PostCard'

export default function PostGrid({
  posts,
  onPostDeleted,
  onPostUpdated,
}: {
  posts: Post[]
  onPostDeleted?: (postId: string) => void
  // Like/comment holati modal ichida o'zgarganda ota-komponentdagi
  // (Profile) post ro'yxatini ham yangilash uchun — ixtiyoriy.
  onPostUpdated?: (postId: string, patch: Partial<Post>) => void
}) {
  const [selected, setSelected] = useState<Post | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {posts.map((post) => (
          <PostTile key={post.id} post={post} onClick={() => setSelected(post)} />
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-lg">
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-10 right-0 rounded-full p-2 text-white/80 transition hover:text-white"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <PostCard
              post={selected}
              onDeleted={(postId) => {
                setSelected(null)
                onPostDeleted?.(postId)
              }}
              onPostUpdated={onPostUpdated}
            />
          </div>
        </div>
      )}
    </>
  )
}

function PostTile({ post, onClick }: { post: Post; onClick: () => void }) {
  const image = post.attachments.find((a) => a.mediaType === 'IMAGE')

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-md bg-ink/5 sm:rounded-xl"
    >
      {image?.url ? (
        <img
          src={image.thumbnailUrl || image.url}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="relative flex h-full w-full flex-col justify-center border border-ink/8 bg-white p-4">
          {/* "Matn post" belgisi — Instagram/Threads'даgi kabi ozgina ажратиб турадиган belgi */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-3 text-ink-muted/40">
            <path d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          <p className="line-clamp-5 text-center font-display text-sm font-medium leading-snug text-ink sm:text-base">
            {post.content}
          </p>
        </div>
      )}

      {/* Hover overlay — like/comment soni. Faqat haqiqiy hover qo'llab-quvvatlaydigan
          (sichqonchali) qurilmalarda ishlaydi — aks holda mobil/touch'да tap qilgach
          "yopishib qolgan" hover holati matn ustiga tushib chalkash ko'rinish berardi. */}
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
    </button>
  )
}
