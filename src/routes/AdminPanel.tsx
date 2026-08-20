// Admin Panel — Owner/Admin uchun boshqaruv markazi.
// Tablar: Overview (statistika), Users (ro'yxat + detail), Reports.
// Content generation — alohida route (/admin/content) bo'lib qoladi,
// bu yerdan havola beriladi.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'
import AdminGuard from '../components/admin/AdminGuard'
import ListeningUploadTab from '../components/admin/ListeningUploadTab'
import { getCurrentUser, hasAnyRole } from '../lib/user'
import {
  adminApi,
  type AdminStats,
  type AdminUserSummary,
  type AdminUserDetail,
  type AdminPostSummary,
  type AdminRole,
} from '../lib/adminApi'

type Tab = 'overview' | 'users' | 'reports' | 'listening'

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <AdminGuard>
    <main className="min-h-screen bg-cream pb-16">
      <header className="sticky top-0 z-20 border-b border-ink/8 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-display text-sm font-bold text-ink">Admin Panel</span>
          </div>
          <Link to="/dashboard" className="text-sm font-medium text-ink-soft hover:text-ink">
            ← Back to app
          </Link>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 px-5">
          {(
            [
              ['overview', 'Overview'],
              ['users', 'Users'],
              ['reports', 'Reports'],
              ['listening', 'Listening upload'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-medium transition ${
                tab === t ? 'text-indigo-600' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {label}
              {tab === t && (
                <motion.div
                  layoutId="admin-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-500"
                />
              )}
            </button>
          ))}
          <Link
            to="/admin/cefr-generation"
            className="ml-auto px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            AI Content Generation →
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'overview' && <OverviewTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'reports' && <ReportsTab />}
            {tab === 'listening' && <ListeningUploadTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
    </AdminGuard>
  )
}

// ═════════════════════════════════════════════════════════════════
// OVERVIEW
// ═════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>
  if (!stats) return <p className="text-sm text-coral-700">Could not load stats.</p>

  const maxWeekly = Math.max(1, ...stats.weeklyGrowth.map((p) => p.newUsers))
  const maxMonthly = Math.max(1, ...stats.monthlyGrowth.map((p) => p.newUsers))

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active users" value={stats.activeUserCount} color="indigo" />
        <StatCard label="Total users" value={stats.totalUserCount} color="mint" />
        <StatCard label="Banned" value={stats.bannedUserCount} color="coral" />
        <StatCard label="Pending reports" value={stats.pendingReportCount} color="sun" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthChart title="Weekly growth (last 8 weeks)" points={stats.weeklyGrowth} max={maxWeekly} />
        <GrowthChart title="Monthly growth (last 12 months)" points={stats.monthlyGrowth} max={maxMonthly} />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'indigo' | 'mint' | 'coral' | 'sun'
}) {
  const bg = { indigo: 'bg-indigo-50', mint: 'bg-mint-50', coral: 'bg-coral-50', sun: 'bg-sun-50' }[color]
  const text = { indigo: 'text-indigo-600', mint: 'text-mint-600', coral: 'text-coral-600', sun: 'text-sun-600' }[color]
  return (
    <div className={`rounded-3xl border border-ink/8 ${bg} p-5`}>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-bold ${text}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function GrowthChart({
  title,
  points,
  max,
}: {
  title: string
  points: { label: string; newUsers: number }[]
  max: number
}) {
  return (
    <div className="rounded-3xl border border-ink/8 bg-white p-5">
      <p className="mb-4 text-sm font-semibold text-ink">{title}</p>
      <div className="flex h-32 items-end gap-1.5">
        {points.map((p, i) => (
          <div key={i} className="group relative flex-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(4, (p.newUsers / max) * 100)}%` }}
              transition={{ duration: 0.4, delay: i * 0.02 }}
              className="w-full rounded-t-md bg-indigo-500/70 transition-colors group-hover:bg-indigo-500"
            />
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {p.newUsers}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// USERS
// ═════════════════════════════════════════════════════════════════

function UsersTab() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    adminApi
      .getUsers(debouncedSearch, 0, 30)
      .then((page) => setUsers(page.content ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  const refreshOne = (id: string, patch: Partial<AdminUserSummary>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, username, or email…"
        className="mb-5 w-full max-w-md rounded-2xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
      />

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-ink-muted">No users found.</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-ink/8 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/8 bg-cream-warm/50 text-left">
                <th className="px-4 py-3 font-medium text-ink-muted">User</th>
                <th className="px-4 py-3 font-medium text-ink-muted">Roles</th>
                <th className="px-4 py-3 font-medium text-ink-muted">Posts</th>
                <th className="px-4 py-3 font-medium text-ink-muted">Reports</th>
                <th className="px-4 py-3 font-medium text-ink-muted">Joined</th>
                <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className="cursor-pointer border-b border-ink/6 last:border-0 hover:bg-cream/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-ink-muted">@{u.username}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{u.roles.join(', ') || 'User'}</td>
                  <td className="px-4 py-3 text-ink-soft">{u.postCount}</td>
                  <td className="px-4 py-3">
                    {u.reportCount > 0 ? (
                      <span className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-semibold text-coral-600">
                        {u.reportCount}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-semibold text-coral-700">
                        Banned
                      </span>
                    ) : (
                      <span className="rounded-full bg-mint-50 px-2 py-0.5 text-xs font-semibold text-mint-700">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <UserDetailPanel
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onUserChanged={(patch) => refreshOne(selectedId, patch)}
        />
      )}
    </div>
  )
}

function UserDetailPanel({
  userId,
  onClose,
  onUserChanged,
}: {
  userId: string
  onClose: () => void
  onUserChanged: (patch: Partial<AdminUserSummary>) => void
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    getCurrentUser()
      .then((u) => setIsOwner(hasAnyRole(u, 'OWNER')))
      .catch(() => setIsOwner(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminApi
      .getUserDetail(userId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId])

  const toggleBan = async () => {
    if (!detail) return
    setBusy(true)
    try {
      if (detail.banned) {
        await adminApi.unbanUser(userId)
      } else {
        await adminApi.banUser(userId)
      }
      const nextBanned = !detail.banned
      setDetail({ ...detail, banned: nextBanned })
      onUserChanged({ banned: nextBanned })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-ink-muted">Loading…</p>
        ) : !detail ? (
          <p className="py-10 text-center text-sm text-coral-700">Could not load user.</p>
        ) : (
          <>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">
                  {detail.firstName} {detail.lastName}
                </h2>
                <p className="text-sm text-ink-muted">
                  @{detail.username} · {detail.email}
                </p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-ink-muted hover:bg-cream">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Posts" value={detail.postCount} />
              <MiniStat label="Followers" value={detail.followerCount} />
              <MiniStat label="Following" value={detail.followingCount} />
              <MiniStat label="Reports" value={detail.reportCount} danger={detail.reportCount > 0} />
            </div>

            {detail.bio && <p className="mb-4 text-sm text-ink-soft">{detail.bio}</p>}

            {detail.languageProgress.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Language progress
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.languageProgress.map((lp) => (
                    <span
                      key={lp.languageCode}
                      className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink-soft"
                    >
                      {lp.languageCode.toUpperCase()} · {lp.currentLevel} · {lp.totalXp} XP · 🔥{lp.streakDays}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 flex flex-wrap gap-2 text-xs text-ink-muted">
              <span>Joined {new Date(detail.createdAt).toLocaleDateString()}</span>
              {detail.countryCode && <span>· {detail.countryCode}</span>}
              {detail.city && <span>· {detail.city}</span>}
            </div>

            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Roles
              </p>
              <RolesEditor
                userId={userId}
                currentRoles={detail.roles}
                canEdit={isOwner}
                onSaved={(roles) => {
                  setDetail({ ...detail, roles })
                  onUserChanged({ roles })
                }}
              />
            </div>

            <UserPostsList userId={userId} />

            <button
              onClick={toggleBan}
              disabled={busy || detail.roles.some((r) => r === 'ADMIN' || r === 'OWNER')}
              className={`mt-5 w-full rounded-2xl py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                detail.banned
                  ? 'bg-mint-500 text-white hover:bg-mint-600'
                  : 'bg-coral-500 text-white hover:bg-coral-600'
              }`}
            >
              {busy ? 'Working…' : detail.banned ? 'Unban user' : 'Ban user'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

// Foydalanuvchining rollarini ko'rsatadi/tahrirlaydi. Faqat OWNER
// (canEdit=true) uchun checkbox'lar bilan tahrirlash rejimi ochiladi —
// oddiy ADMIN faqat rollarni belgi (badge) sifatida ko'radi. Haqiqiy
// himoya baribir backendda (AdminServiceImpl.updateUserRoles) — bu yerda
// faqat UI qulayligi uchun.
function RolesEditor({
  userId,
  currentRoles,
  canEdit,
  onSaved,
}: {
  userId: string
  currentRoles: string[]
  canEdit: boolean
  onSaved: (roles: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [allRoles, setAllRoles] = useState<AdminRole[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRoles))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(new Set(currentRoles))
  }, [currentRoles])

  const startEditing = () => {
    setError(null)
    setEditing(true)
    if (!allRoles) {
      adminApi
        .getAllRoles()
        // BANNED — ban/unban tugmasi orqali boshqariladi, shuning uchun
        // bu ro'yxatda ko'rsatilmaydi (backend ham uni rad etadi).
        .then((roles) => setAllRoles(roles.filter((r) => r.name !== 'BANNED')))
        .catch(() => setError('Could not load role list.'))
    }
  }

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const save = async () => {
    if (selected.size === 0) {
      setError('Select at least one role.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await adminApi.updateUserRoles(userId, Array.from(selected))
      onSaved(res.roles)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update roles.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {currentRoles.length === 0 ? (
          <span className="text-xs text-ink-muted">User</span>
        ) : (
          currentRoles.map((r) => (
            <span
              key={r}
              className="rounded-full border border-indigo-500/20 bg-indigo-500/8 px-2.5 py-1 text-xs font-semibold text-indigo-700"
            >
              {r}
            </span>
          ))
        )}
        {canEdit && (
          <button
            onClick={startEditing}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted underline decoration-dotted hover:text-ink"
          >
            Edit
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-cream/50 p-3.5">
      {!allRoles ? (
        <p className="text-xs text-ink-muted">Loading roles…</p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          {allRoles.map((role) => (
            <label
              key={role.id}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selected.has(role.name)
                  ? 'border-indigo-500 bg-indigo-500 text-white'
                  : 'border-ink/15 bg-white text-ink-soft hover:border-indigo-500/40'
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={selected.has(role.name)}
                onChange={() => toggle(role.name)}
              />
              {role.name}
            </label>
          ))}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-coral-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !allRoles}
          className="rounded-full bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => {
            setEditing(false)
            setSelected(new Set(currentRoles))
            setError(null)
          }}
          disabled={saving}
          className="rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function MiniStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${danger && value > 0 ? 'border-coral-500/20 bg-coral-50' : 'border-ink/8 bg-cream/60'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`font-display text-lg font-bold ${danger && value > 0 ? 'text-coral-600' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function UserPostsList({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<AdminPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    adminApi
      .getUserPosts(userId, 0, 10)
      .then((page) => setPosts(page.content ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [userId])

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeletingId(postId)
    try {
      await adminApi.deletePost(postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete post.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Recent posts
      </p>
      {loading ? (
        <p className="text-xs text-ink-muted">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-xs text-ink-muted">No posts.</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-ink/8 bg-cream/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs text-ink-soft">{p.content || '(no text)'}</p>
                <p className="mt-1 text-[10px] text-ink-muted">
                  ❤ {p.likeCount} · 💬 {p.commentCount} · {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="flex-shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-coral-600 transition hover:bg-coral-50 disabled:opacity-40"
              >
                {deletingId === p.id ? '…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// REPORTS — placeholder, next part
// ═════════════════════════════════════════════════════════════════

function ReportsTab() {
  return <p className="text-sm text-ink-muted">Reports tab — coming in the next part.</p>
}
