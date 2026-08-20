// BlockedUsers — o'zim block qilgan foydalanuvchilar ro'yxati.
// Profil > Settings > Blocked orqali ochiladi — alohida sahifa
// (Instagram'даgi "Blocked accounts" sahifasiga o'xshash).

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import Avatar from '../components/Avatar'
import { isAuthenticated } from '../lib/auth'
import { blockApi, type BlockedUser } from '../lib/blockApi'

export default function BlockedUsers() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const openCompose = () => navigate('/dashboard', { state: { openCompose: true } })

  const [users, setUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    blockApi
      .getBlockedUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklanmadi."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const unblock = async (userId: string) => {
    if (pendingId) return
    setPendingId(userId)
    const prev = users
    setUsers((list) => list.filter((u) => u.id !== userId))
    try {
      await blockApi.unblock(userId)
    } catch {
      setUsers(prev)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
        <Sidebar onCreatePost={openCompose} />
        <MobileNav onCreatePost={openCompose} />

        <main className="min-w-0">
          <div className="rounded-4xl border border-ink/8 bg-white p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
                aria-label="Back"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h1 className="font-display text-lg font-semibold text-ink">Blocked accounts</h1>
            </div>

            <p className="mb-5 text-sm text-ink-muted">
              You can block people anytime from their profile.
            </p>

            {loading ? (
              <p className="py-12 text-center text-sm text-ink-muted">Loading…</p>
            ) : error ? (
              <p className="py-12 text-center text-sm text-coral-700">{error}</p>
            ) : users.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">
                Siz hech kimni block qilmagansiz.
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => {
                  const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'User'
                  return (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-cream"
                    >
                      <Avatar url={u.profilePhotoUrl} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{fullName}</p>
                        <p className="text-xs text-ink-muted">Includes other accounts they may have or create</p>
                      </div>
                      <button
                        onClick={() => unblock(u.id)}
                        disabled={pendingId === u.id}
                        className="flex-shrink-0 rounded-full border border-ink/12 bg-white px-4 py-1.5 text-xs font-semibold text-ink transition hover:border-indigo-500/30 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {pendingId === u.id ? '…' : 'Unblock'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
