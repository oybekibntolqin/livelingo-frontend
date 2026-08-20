// PostDetail — /posts/:postId
//
// Share qilingan link shu yerga ochiladi.  R2/CDN xom URL emas —
// bizning ilovaning o'z sahifasi, xuddi Instagram'ning
// instagram.com/reel/{id} kabi.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import PostCard from '../components/PostCard'
import { isAuthenticated } from '../lib/auth'
import { postApi, enrichPostsWithCounts, type Post } from '../lib/postApi'

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) {
      // Ulashilgan link'ni bosib kelgan, lekin hisobi yo'q/kirmagan
      // foydalanuvchi — avval kirishi kerak.  Kirgandan keyin shu
      // postga qaytishi uchun manzilni saqlaymiz.
      navigate('/sign-in', { replace: true, state: { redirectTo: `/posts/${postId}` } })
    }
  }, [navigate, postId])

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!postId) return
    setLoading(true)
    setError(null)
    postApi
      .getPostById(postId)
      // MUHIM TUZATISH: backend PostDTO'да likeCount/commentCount/liked
      // YO'Q — Dashboard va Search sahifalarida bo'lgani kabi, postni
      // alohida so'rovlar bilan "boyitish" kerak. Avval bu qadam
      // yo'q edi, shuning uchun notification'dan (like/comment)
      // kelib bitta postni ochganda like/comment ikonkasi va soni
      // doim 0 ko'rinardi.
      .then(async (p) => {
        const [enriched] = await enrichPostsWithCounts([p])
        return enriched
      })
      .then(setPost)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Post topilmadi.')
      )
      .finally(() => setLoading(false))
  }, [postId])

  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
        <Sidebar onCreatePost={() => navigate('/dashboard', { state: { openCompose: true } })} />
        <MobileNav onCreatePost={() => navigate('/dashboard', { state: { openCompose: true } })} />

        <main className="mx-auto w-full max-w-lg min-w-0">
          {loading ? (
            <p className="py-16 text-center text-sm text-ink-muted">Loading…</p>
          ) : error || !post ? (
            <div className="rounded-4xl border border-ink/8 bg-white px-6 py-10 text-center">
              <p className="mb-4 text-sm text-coral-700">{error ?? 'Post topilmadi.'}</p>
              <Link to="/dashboard" className="btn-primary">
                Dashboard
              </Link>
            </div>
          ) : (
            <PostCard post={post} />
          )}
        </main>
      </div>
    </div>
  )
}
