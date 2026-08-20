// Profile — Instagram uslubida, chapga tekislangan (desktop Instagram
// layout'iga o'xshash).  Dashboard bilan bir xil Sidebar/Nav qobig'i
// ishlatiladi — orqaga qaytish tugmasi shart emas.

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import Avatar from '../components/Avatar'
import PostGrid from '../components/PostGrid'
import FollowListModal from '../components/FollowListModal'
import AvatarActionModal from '../components/AvatarActionModal'
import { OtherUserMenu, OwnSettingsMenu, BlockConfirmModal } from '../components/ProfileActionsMenu'
import ReportUserModal from '../components/ReportUserModal'
import { isAuthenticated } from '../lib/auth'
import { getUserIdFromToken } from '../lib/chatAuth'
import { profileApi, type UserProfile } from '../lib/profileApi'
import { blockApi } from '../lib/blockApi'
import { postApi, type Post } from '../lib/postApi'

export default function Profile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const myId = getUserIdFromToken()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const isOwnProfile = !!userId && userId === myId

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [following, setFollowing] = useState(false)
  const [followPending, setFollowPending] = useState(false)

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)

  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  // ── Block / Report — faqat boshqa userning profilida ishlaydi ──
  const [blocked, setBlocked] = useState(false)
  const [blockPending, setBlockPending] = useState(false)
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const p = await profileApi.getProfile(userId)
      setProfile(p)

      if (!isOwnProfile) {
        const [{ following: isFollowing }, isBlocked] = await Promise.all([
          profileApi.isFollowing(userId),
          blockApi.isBlocked(userId).catch(() => false),
        ])
        setFollowing(isFollowing)
        setBlocked(isBlocked)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil yuklanmadi.')
    } finally {
      setLoading(false)
    }
  }, [userId, isOwnProfile])

  // userId o'zgarganda (masalan boshqa userga o'tilganda) qayta yuklaymiz
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setPostsLoading(true)
    profileApi
      .getUserPosts(userId)
      .then(async (list) => {
        if (cancelled) return
        // Dashboard'даgi Feed bilan bir xil — backend PostDTO'da
        // likeCount/commentCount yo'q, ular alohida so'raladi.
        // Buni qo'shmasak, Profile'даgi kartochkalarda doim 0
        // ko'rinardi (hozirgi bug aynan shu edi).
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
        if (!cancelled) setPosts(enriched)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const toggleFollow = async () => {
    if (!userId || followPending) return
    const next = !following
    setFollowing(next)
    setFollowPending(true)
    setProfile((p) => (p ? { ...p, followersCount: p.followersCount + (next ? 1 : -1) } : p))
    try {
      if (next) await profileApi.follow(userId)
      else await profileApi.unfollow(userId)
    } catch {
      setFollowing(!next)
      setProfile((p) => (p ? { ...p, followersCount: p.followersCount + (next ? -1 : 1) } : p))
    } finally {
      setFollowPending(false)
    }
  }

  const confirmBlockToggle = async () => {
    if (!userId || blockPending) return
    const next = !blocked
    setBlockPending(true)
    try {
      if (next) await blockApi.block(userId)
      else await blockApi.unblock(userId)
      setBlocked(next)
      setBlockConfirmOpen(false)
    } catch {
      // jim — modal ochiq qoladi, foydalanuvchi qayta urinishi mumkin
    } finally {
      setBlockPending(false)
    }
  }

  const openMessage = () => {
    if (!profile) return
    navigate('/chat', {
      state: {
        openUser: {
          id: profile.id,
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          username: profile.username ?? undefined,
        },
      },
    })
  }

  const openCompose = () => {
    navigate('/dashboard', { state: { openCompose: true } })
  }

  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
        <Sidebar onCreatePost={openCompose} />
        <MobileNav onCreatePost={openCompose} />

        <main className="min-w-0">
          {loading ? (
            <p className="py-16 text-center text-sm text-ink-muted">Loading…</p>
          ) : error || !profile ? (
            <div className="rounded-4xl border border-ink/8 bg-white px-6 py-10 text-center">
              <p className="text-sm text-coral-700">{error ?? 'Profil topilmadi.'}</p>
            </div>
          ) : (
            <ProfileContent
              profile={profile}
              isOwnProfile={isOwnProfile}
              following={following}
              followPending={followPending}
              onToggleFollow={toggleFollow}
              onMessage={openMessage}
              onFollowersClick={() => setFollowModal('followers')}
              onFollowingClick={() => setFollowModal('following')}
              onAvatarClick={() => setAvatarModalOpen(true)}
              blocked={blocked}
              onBlockClick={() => setBlockConfirmOpen(true)}
              onReportClick={() => setReportOpen(true)}
              posts={posts}
              postsLoading={postsLoading}
              onPostDeleted={(postId) => {
                setPosts((prev) => prev.filter((p) => p.id !== postId))
                setProfile((p) => (p ? { ...p, postCount: Math.max(0, p.postCount - 1) } : p))
              }}
              onPostUpdated={(postId, patch) => {
                setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)))
              }}
            />
          )}
        </main>
      </div>

      {profile && isOwnProfile && (
        <AvatarActionModal
          open={avatarModalOpen}
          hasPhoto={!!profile.profilePhotoUrl}
          onClose={() => setAvatarModalOpen(false)}
          onSaved={(updated) => {
            setProfile(updated)
            setAvatarModalOpen(false)
          }}
        />
      )}

      {profile && !isOwnProfile && (
        <>
          <BlockConfirmModal
            open={blockConfirmOpen}
            name={fullNameOf(profile)}
            blocked={blocked}
            pending={blockPending}
            onConfirm={confirmBlockToggle}
            onClose={() => setBlockConfirmOpen(false)}
          />
          <ReportUserModal
            open={reportOpen}
            name={fullNameOf(profile)}
            userId={profile.id}
            onClose={() => setReportOpen(false)}
            onReported={() => setReportOpen(false)}
          />
        </>
      )}

      {profile && followModal && (
        <FollowListModal
          open={!!followModal}
          userId={profile.id}
          mode={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}
    </div>
  )
}

// Ism-familiyani (yo'q bo'lsa "User") qaytaradi — Block/Report
// modallarida ko'rsatish uchun.
function fullNameOf(profile: UserProfile) {
  const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
  return name || 'User'
}

// ═════════════════════════════════════════════════════════════════
// Profil kontenti — chapga tekislangan (Instagram desktop uslubi)
// ═════════════════════════════════════════════════════════════════
function ProfileContent({
  profile,
  isOwnProfile,
  following,
  followPending,
  onToggleFollow,
  onMessage,
  onFollowersClick,
  onFollowingClick,
  onAvatarClick,
  blocked,
  onBlockClick,
  onReportClick,
  posts,
  postsLoading,
  onPostDeleted,
  onPostUpdated,
}: {
  profile: UserProfile
  isOwnProfile: boolean
  following: boolean
  followPending: boolean
  onToggleFollow: () => void
  onMessage: () => void
  onFollowersClick: () => void
  onFollowingClick: () => void
  onAvatarClick: () => void
  blocked: boolean
  onBlockClick: () => void
  onReportClick: () => void
  posts: Post[]
  postsLoading: boolean
  onPostDeleted: (postId: string) => void
  onPostUpdated: (postId: string, patch: Partial<Post>) => void
}) {
  const firstName = profile.firstName ?? ''
  const lastName = profile.lastName ?? ''
  const fullName = `${firstName} ${lastName}`.trim()
  const displayTitle = profile.username ? `@${profile.username}` : fullName || 'User'

  return (
    <div className="rounded-4xl border border-ink/8 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar — chapda */}
        <div className="flex justify-center sm:justify-start">
          {isOwnProfile ? (
            <button onClick={onAvatarClick} className="group relative rounded-full">
              <Avatar url={profile.profilePhotoUrl} size={112} />
              <div className="absolute inset-0 grid place-items-center rounded-full bg-ink/0 transition group-hover:bg-ink/40">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </button>
          ) : (
            <Avatar url={profile.profilePhotoUrl} size={112} />
          )}
        </div>

        {/* Info — chapga tekislangan */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-1.5 sm:justify-start">
            <h1 className="font-display text-2xl font-bold text-ink">{displayTitle}</h1>
            {!isOwnProfile && (
              <OtherUserMenu blocked={blocked} onBlockClick={onBlockClick} onReportClick={onReportClick} />
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            {fullName && <p className="text-sm text-ink-soft">{fullName}</p>}

            {isOwnProfile ? (
              <OwnSettingsMenu />
            ) : blocked ? (
              <span className="rounded-full border border-ink/12 bg-cream px-4 py-1 text-xs font-semibold text-ink-muted">
                Blocked
              </span>
            ) : (
              <>
                <button
                  onClick={onToggleFollow}
                  disabled={followPending}
                  className={`rounded-full px-4 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                    following
                      ? 'border border-ink/12 bg-white text-ink hover:border-coral-500/30 hover:bg-coral-50 hover:text-coral-600'
                      : 'bg-indigo-500 text-white hover:bg-indigo-600'
                  }`}
                >
                  {following ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  onClick={onMessage}
                  className="rounded-full border border-ink/12 bg-white px-4 py-1 text-xs font-semibold text-ink transition hover:border-indigo-500/30 hover:bg-indigo-50"
                >
                  Message
                </button>
              </>
            )}
          </div>

          {/* Post / followers / following soni */}
          <div className="mt-4 flex items-center justify-center gap-5 sm:justify-start">
            <div>
              <span className="font-display text-base font-bold text-ink">{profile.postCount}</span>{' '}
              <span className="text-sm text-ink-muted">posts</span>
            </div>
            <button
              onClick={onFollowersClick}
              className="rounded-full transition hover:opacity-70"
            >
              <span className="font-display text-base font-bold text-ink">{profile.followersCount}</span>{' '}
              <span className="text-sm text-ink-muted">followers</span>
            </button>
            <button
              onClick={onFollowingClick}
              className="rounded-full transition hover:opacity-70"
            >
              <span className="font-display text-base font-bold text-ink">{profile.followingCount}</span>{' '}
              <span className="text-sm text-ink-muted">following</span>
            </button>
          </div>

          {/* Bio — null bo'lsa hech narsa chiqmaydi, link bo'lsa bosilib ochiladi */}
          {profile.bio && (
            <p className="mx-auto mt-4 max-w-lg whitespace-pre-wrap text-sm leading-relaxed text-ink-soft sm:mx-0">
              {renderBioWithLinks(profile.bio)}
            </p>
          )}
        </div>
      </div>

      {/* Postlar */}
      <div className="mt-8 border-t border-ink/8 pt-6">
        <p className="mb-4 font-display text-lg font-semibold text-ink">Posts</p>
        {postsLoading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            {isOwnProfile ? "Hali post yo'q." : "Postlar yo'q."}
          </p>
        ) : (
          <PostGrid posts={posts} onPostDeleted={onPostDeleted} onPostUpdated={onPostUpdated} />
        )}
      </div>
    </div>
  )
}

// URL'larni topib, bosilsa yangi tabda ochiladigan <a> qilib qaytaradi.
// Qolgan matn oddiy tekst sifatida qoladi.
function renderBioWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-600 hover:underline"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}
