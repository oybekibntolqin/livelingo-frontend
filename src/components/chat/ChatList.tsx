// Chat ro'yxati — chap panel.  Telegram uslubidagi qidiruv:
//   • Bo'sh qidiruv → mavjud suhbatlar
//   • Qidiruv yozilganda:
//       - mavjud chatlar ichidan filtr (darhol)
//       - + backend'dan userlar (hali chatlashmaganlar ham) — debounce
//       - takrorlar (allaqachon chatda bor) chiqarib tashlanadi
//
// Yangi odamga bosilsa — onSelectNew chaqiriladi (bo'sh suhbat ochiladi).

import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { Link } from 'react-router-dom'
import { chatApi } from '../../lib/chatApi'
import type { ChatListItem, UserSearchResult } from '../../lib/chatTypes'
import Avatar from '../Avatar'

interface Props {
  chats: ChatListItem[]
  loading: boolean
  // Suhbatlar ro'yxati (backend'dan) uchun sahifalash — global
  // qidiruv natijalariga tegishli emas.
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  activePeerId: string | null
  onlineIds: Set<string>
  myId: string | null
  onSelect: (peerId: string) => void
  onSelectNew: (user: UserSearchResult) => void
}

export default function ChatList({
  chats,
  loading,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  activePeerId,
  onlineIds,
  myId,
  onSelect,
  onSelectNew,
}: Props) {
  const [search, setSearch] = useState('')
  const [remoteUsers, setRemoteUsers] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // "Saved Messages" (o'ziga yozish) — Telegram kabi har doim ro'yxatda
  // ko'rinib turishi va qidiruvda ham topilishi kerak. Shuning uchun u
  // matn filtridan mustasno: faqat boshqa nomzod so'zlarga (masalan
  // "saved", "eslatma", "men") ham javob beradi, VA hech qachon
  // filtrlanib yo'qolib qolmaydi.
  const SAVED_MESSAGES_KEYWORDS = ['saved', 'eslatma', "o'zim", 'ozim', 'men']

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase()
    const selfChat = myId ? chats.find((c) => c.userId === myId) : undefined
    const others = myId ? chats.filter((c) => c.userId !== myId) : chats

    if (!q) {
      return selfChat ? [selfChat, ...others] : others
    }

    const matchedOthers = others.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    )

    if (!selfChat) return matchedOthers

    const selfMatches =
      'saved messages'.includes(q) ||
      SAVED_MESSAGES_KEYWORDS.some((k) => k.includes(q) || q.includes(k))

    return selfMatches ? [selfChat, ...matchedOthers] : matchedOthers
  }, [chats, search, myId])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setRemoteUsers([])
      setSearching(false)
      return
    }
    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const users = await chatApi.searchUsers(q)
        setRemoteUsers(users)
      } catch {
        setRemoteUsers([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const chatUserIds = useMemo(
    () => new Set(chats.map((c) => c.userId)),
    [chats]
  )
  const newUsers = useMemo(
    () => remoteUsers.filter((u) => !chatUserIds.has(u.id)),
    [remoteUsers, chatUserIds]
  )

  const isSearching = search.trim().length >= 2

  // Pastga scroll qilib ko'proq (eskiroq) suhbatlarni yuklash.
  // Faqat "oddiy" ro'yxat rejimida (qidiruv YO'Q paytda) ishlaydi —
  // qidiruv paytida ro'yxat filtrlangan/global bo'ladi, backend
  // sahifalash bunga aloqasi yo'q.
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (isSearching || !onLoadMore || !hasMore || loadingMore) return
    const el = e.currentTarget
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 150) {
      onLoadMore()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-ink/6 p-3">
        <div className="relative">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-ink/12 bg-cream py-2 pl-9 pr-8 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-ink/8"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="p-4 text-center text-sm text-ink-muted">Loading...</div>
        ) : (
          <>
            {filteredChats.length > 0 && (
              <>
                {isSearching && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Suhbatlar
                  </p>
                )}
                {filteredChats.map((c) => (
                  <ChatRow
                    key={c.userId}
                    userId={c.userId}
                    name={
                      c.deletedAccount
                        ? 'Deleted Account'
                        : `${c.firstName} ${c.lastName}`.trim() || 'User'
                    }
                    firstName={c.firstName}
                    lastName={c.lastName}
                    photoUrl={c.profilePhotoUrl}
                    deleted={c.deletedAccount}
                    online={!c.presenceHidden && onlineIds.has(c.userId)}
                    presenceHidden={c.presenceHidden}
                    active={c.userId === activePeerId}
                    lastMessage={c.lastMessage}
                    lastMessageTime={c.lastMessageTime}
                    unreadCount={c.unreadCount}
                    onClick={() => onSelect(c.userId)}
                  />
                ))}
              </>
            )}

            {isSearching && newUsers.length > 0 && (
              <>
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Global qidiruv
                </p>
                {newUsers.map((u) => {
                  const isSelf = u.id === myId
                  return (
                    <ChatRow
                      key={u.id}
                      userId={u.id}
                      name={
                        isSelf
                          ? 'Saved Messages'
                          : u.deletedAccount
                            ? 'Deleted Account'
                            : `${u.firstName} ${u.lastName}`.trim() || u.username || 'User'
                      }
                      firstName={isSelf ? 'S' : u.firstName}
                      lastName={isSelf ? 'M' : u.lastName}
                      photoUrl={isSelf ? null : u.profilePhotoUrl}
                      deleted={!isSelf && u.deletedAccount}
                      online={!isSelf && !u.presenceHidden && (onlineIds.has(u.id) || !!u.online)}
                      presenceHidden={!isSelf && u.presenceHidden}
                      active={u.id === activePeerId}
                      subtitle={
                        isSelf
                          ? "O'zingizga xabarlar"
                          : u.deletedAccount
                            ? undefined
                            : u.presenceHidden && u.lastSeenLabel
                              ? u.lastSeenLabel
                              : u.username
                                ? `@${u.username}`
                                : 'Tap to message'
                      }
                      onClick={() => onSelectNew(u)}
                    />
                  )
                })}
              </>
            )}

            {isSearching && searching && (
              <p className="p-3 text-center text-xs text-ink-muted">
                Qidirilmoqda...
              </p>
            )}

            {!loading &&
              filteredChats.length === 0 &&
              newUsers.length === 0 &&
              !searching && (
                <p className="p-4 text-center text-sm text-ink-muted">
                  {isSearching ? 'Foydalanuvchi topilmadi' : "Hozircha suhbat yo'q"}
                </p>
              )}

            {!isSearching && loadingMore && (
              <p className="p-3 text-center text-xs text-ink-muted">
                Yuklanmoqda...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ChatRow({
  userId,
  name,
  photoUrl,
  online,
  presenceHidden,
  deleted,
  active,
  lastMessage,
  lastMessageTime,
  unreadCount,
  subtitle,
  onClick,
}: {
  userId: string
  name: string
  firstName: string
  lastName: string
  photoUrl?: string | null
  online: boolean
  presenceHidden?: boolean
  deleted?: boolean
  active: boolean
  lastMessage?: string
  lastMessageTime?: string | null
  unreadCount?: number
  subtitle?: string
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      className={`flex w-full cursor-pointer items-center gap-3 border-b border-ink/4 px-3 py-3 text-left transition ${
        active ? 'bg-indigo-50' : 'hover:bg-cream'
      }`}
    >
      <Link
        to={`/profile/${userId}`}
        // Avatar bosilganda faqat profilega o'tsin — chatni tanlash
        // (row onClick) ishga tushmasligi uchun to'xtatamiz.
        onClick={(e) => e.stopPropagation()}
        className="relative flex-shrink-0"
      >
        <Avatar url={photoUrl} size={44} deleted={deleted} />
        {!deleted && online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-mint-500" />
        )}
        {/* Blok qilingan/maxfiylik tufayli yashirilgan holat — Telegram
            uslubida kichik QORA nuqta (yashil "online"dan farqli, aniq
            "offline"dan ham farqli — chunki bu haqiqiy holat emas). */}
        {!deleted && !online && presenceHidden && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-ink" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            to={`/profile/${userId}`}
            onClick={(e) => e.stopPropagation()}
            className={`truncate font-display text-sm font-semibold transition-colors ${
              deleted ? 'text-ink-muted' : 'text-ink hover:text-indigo-600'
            }`}
          >
            {name}
          </Link>
          {lastMessageTime && (
            <span className="flex-shrink-0 text-[10px] text-ink-muted">
              {formatListTime(lastMessageTime)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-ink-soft">
            {subtitle ?? lastMessage ?? 'No messages yet'}
          </p>
          {unreadCount != null && unreadCount > 0 && (
            <span className="flex-shrink-0 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function initials(first: string, last: string): string {
  const a = (first?.[0] ?? '').toUpperCase()
  const b = (last?.[0] ?? '').toUpperCase()
  return a + b || 'U'
}

function formatListTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
}
