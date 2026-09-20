// Suhbat oynasi — o'ng panel.
//
// Qamrov: xabarlar ro'yxati, real-time qabul, yuborish (optimistik),
// reply, edit, delete, seen ✓✓, typing indikatori, attachment (rasm/
// video/audio/fayl), voice message, call system chiplar, header'da
// call tugmasi.
//
// Call paytida ham input ochiq qoladi — foydalanuvchi gaplashib turib
// yozishi mumkin (parallel).

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {chatApi} from '../../lib/chatApi'
import {chatSocket} from '../../lib/chatSocket'
import type {ChatListItem, ChatMessage, SignalMessage,} from '../../lib/chatTypes'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import Avatar from '../Avatar'
import VerifiedBadge from '../VerifiedBadge'
import { parseServerDate } from '../../lib/dateUtils'

interface Props {
    myId: string
    peer: ChatListItem
    isPeerOnline: boolean
    inCall: boolean
    onBack: () => void
    onStartCall: () => void
    onMessageSent: () => void
}

export default function ConversationView({
                                             myId,
                                             peer,
                                             isPeerOnline,
                                             inCall,
                                             onBack,
                                             onStartCall,
                                             onMessageSent,
                                         }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [peerTyping, setPeerTyping] = useState(false)
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
    const [editing, setEditing] = useState<ChatMessage | null>(null)

    // ── Tepaga skroll qilganda eski xabarlarni yuklash ──
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [loadingOlder, setLoadingOlder] = useState(false)
    // Eski xabarlar tepaga QO'SHILGANDA, ko'rinish sakramasligi
    // uchun — qo'shishdan OLDINGI scrollHeight shu yerda saqlanadi,
    // DOM yangilangач scrollTop shunga moslab tiklanadi (auto-scroll-
    // pastga effekti esa BU holatda ATAYLAB o'tkazib yuboriladi).
    const pendingScrollRestoreRef = useRef<number | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const typingTimer = useRef<number | null>(null)
    // Har "pending" xabar uchun timeout — CHAT_SENT ack kelmasa
    // "yuborilmadi" deb belgilash uchun.  IndexedDB emas — shunchaki
    // xotirada, komponent hayoti davomida.
    const pendingTimeouts = useRef<Map<string, number>>(new Map())

    // Komponent unmount bo'lganda (masalan boshqa suhbatga o'tilganda)
    // barcha kutilayotgan timeout'larni tozalaymiz — xotira oqishi
    // (memory leak) va unmount'дан keyin setState chaqirilishining
    // oldini olish uchun.
    useEffect(() => {
        const timeouts = pendingTimeouts.current
        return () => {
            timeouts.forEach((t) => clearTimeout(t))
            timeouts.clear()
        }
    }, [])

    // ── Tarixni yuklash (eng yangi sahifa — page 0) ──
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setPage(0)
        setHasMore(false)
        chatApi
            .conversation(peer.userId, 0)
            .then(({ messages: msgs, hasMore: more }) => {
                if (cancelled) return
                setMessages(msgs)
                setHasMore(more)
                // Ko'rilmagan xabarlarni bitta signalда seen deb belgilaymiz.
                // Backend messageIds (massiv) kutadi.
                const unseenIds = msgs
                    .filter((m) => m.senderId === peer.userId && !m.seen)
                    .map((m) => m.id)
                if (unseenIds.length > 0) {
                    chatSocket.send({
                        type: 'CHAT_SEEN',
                        to: peer.userId,
                        messageIds: unseenIds,
                    })
                }
            })
            .catch(() => setMessages([]))
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [peer.userId])

    // ── Real-time signallar (shu suhbatga tegishli) ──
    useEffect(() => {
        const unsub = chatSocket.subscribe((sig: SignalMessage) => {
            switch (sig.type) {
                case 'CHAT': {
                    // Faqat shu peer bilan bog'liq xabar
                    const relevant =
                        sig.from === peer.userId || sig.to === peer.userId
                    if (!relevant) return
                    // To'liq DTO payload'da yoki alohida maydonlarda kelishi mumkin
                    const msg = extractMessage(sig)
                    if (msg) {
                        setMessages((prev) => {
                            const existingIndex = prev.findIndex((m) => m.id === msg.id)
                            if (existingIndex !== -1) {
                                // O'zimiz yuborgan xabar tasdiqlandi — pending/failed
                                // holatini tozalaymiz va server ma'lumotlari bilan
                                // birlashtiramiz.
                                const next = [...prev]
                                next[existingIndex] = {
                                    ...next[existingIndex],
                                    ...msg,
                                    _pending: false,
                                    _failed: false,
                                }
                                return next
                            }
                            // Tempid orqali moslashtirish (agar tempId qaytarilsa)
                            if (sig.tempId) {
                                const tempIndex = prev.findIndex((m) => m.id === sig.tempId)
                                if (tempIndex !== -1) {
                                    const next = [...prev]
                                    next[tempIndex] = {...msg, _pending: false, _failed: false}
                                    return next
                                }
                            }
                            return [...prev, msg]
                        })
                        // Timeout'ni tozalaymiz — xabar allaqachon tasdiqlandi
                        const t = pendingTimeouts.current.get(msg.id) ?? (sig.tempId ? pendingTimeouts.current.get(sig.tempId) : undefined)
                        if (t) {
                            clearTimeout(t)
                            pendingTimeouts.current.delete(msg.id)
                            if (sig.tempId) pendingTimeouts.current.delete(sig.tempId)
                        }
                        // Kelgan xabarni darhol seen (massiv formatда)
                        if (sig.from === peer.userId) {
                            chatSocket.send({
                                type: 'CHAT_SEEN',
                                to: peer.userId,
                                messageIds: [msg.id],
                            })
                        }
                    }
                    break
                }
                case 'CHAT_SENT': {
                    // Backend xabarni saqlagach FAQAT yuboruvchiga shu
                    // signalni yuboradi (tempId + to'liq payload). Buni
                    // e'tiborga olmasak, optimistik xabar hech qachon
                    // tasdiqlanmaydi va 8 sek'dan keyin "yuborilmadi" deb
                    // belgilanib qoladi — garchi DB'da saqlangan va
                    // peer'ga yetib borgan bo'lsa ham.
                    const msg = extractMessage(sig)
                    if (!msg) break
                    setMessages((prev) => {
                        const tempKey = sig.tempId
                        const tempIndex = tempKey
                            ? prev.findIndex((m) => m.id === tempKey)
                            : -1
                        if (tempIndex !== -1) {
                            const next = [...prev]
                            next[tempIndex] = {...msg, _pending: false, _failed: false}
                            return next
                        }
                        // tempId topilmadi (masalan komponent qayta
                        // yaratilgan) — real id bo'yicha ham tekshiramiz,
                        // aks holda duplikat qo'shmaymiz
                        const existingIndex = prev.findIndex((m) => m.id === msg.id)
                        if (existingIndex !== -1) {
                            const next = [...prev]
                            next[existingIndex] = {...next[existingIndex], ...msg, _pending: false, _failed: false}
                            return next
                        }
                        return prev
                    })
                    const key = sig.tempId ?? msg.id
                    const t = pendingTimeouts.current.get(key)
                    if (t) {
                        clearTimeout(t)
                        pendingTimeouts.current.delete(key)
                    }
                    break
                }
                // MUHIM TUZATISH: avval backend xato yuz berganda
                // (bloklangan, DB xatosi va h.k.) HECH QANDAY javob
                // yubormasdi — frontend faqat 8 soniyalik timeout
                // orqali "failed" deb belgilardi. Agar shu orada
                // foydalanuvchi sahifani yangilasa, xabar hech qanday
                // iz qoldirmasdan yo'qolib ketardi. Endi backend ANIQ
                // CHAT_FAILED yuboradi — darhol, timeout kutmasdan
                // "yuborilmadi" deb belgilanadi.
                case 'CHAT_FAILED': {
                    const tempKey = sig.tempId
                    if (tempKey) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempKey ? {...m, _pending: false, _failed: true} : m
                            )
                        )
                        const t = pendingTimeouts.current.get(tempKey)
                        if (t) {
                            clearTimeout(t)
                            pendingTimeouts.current.delete(tempKey)
                        }
                    }
                    break
                }
                case 'CHAT_SEEN':
                    if (sig.from === peer.userId) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.senderId === myId ? {...m, seen: true, delivered: true} : m
                            )
                        )
                    }
                    break
                case 'CHAT_DELIVERED':
                    if (sig.from === peer.userId && sig.messageId) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === sig.messageId ? {...m, delivered: true} : m
                            )
                        )
                    }
                    break
                case 'CHAT_EDIT': {
                    const msg = extractMessage(sig)
                    if (msg) {
                        setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? {...m, ...msg} : m))
                        )
                    }
                    break
                }
                case 'CHAT_DELETE_FOR_EVERYONE':
                    if (sig.messageId) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === sig.messageId
                                    ? {...m, deletedForEveryone: true, content: ''}
                                    : m
                            )
                        )
                    }
                    break
                case 'TYPING':
                    if (sig.from === peer.userId) setPeerTyping(true)
                    break
                case 'STOP_TYPING':
                    if (sig.from === peer.userId) setPeerTyping(false)
                    break
            }
        })
        return unsub
    }, [peer.userId, myId])

    // ── Skroll boshqaruvi — ikki holat ──
    //   1. Oddiy holat (yangi xabar, dastlabki yuklash) — pastga
    //      avtomatik tushadi (eskidek).
    //   2. Eski xabarlar TEPAGA qo'shilgandan keyin — foydalanuvchi
    //      ko'rayotgan joyi "sakramasligi" kerak, shuning uchun
    //      scrollTop DOM balandligi o'zgarishiga moslab tiklanadi.
    // useLayoutEffect — brauzer chizishdan OLDIN ishlaydi, shuning
    // uchun ko'zga tashlanadigan "milt etish" bo'lmaydi.
    useLayoutEffect(() => {
        const el = scrollRef.current
        if (!el) return
        if (pendingScrollRestoreRef.current !== null) {
            const prevScrollHeight = pendingScrollRestoreRef.current
            el.scrollTop = el.scrollHeight - prevScrollHeight
            pendingScrollRestoreRef.current = null
            return
        }
        el.scrollTop = el.scrollHeight
    }, [messages, peerTyping])

    // ── Tepaga skroll qilinganda — eski sahifani yuklaydi ──
    const loadOlderMessages = useCallback(async () => {
        if (loadingOlder || !hasMore) return
        const el = scrollRef.current
        setLoadingOlder(true)
        try {
            const nextPage = page + 1
            const { messages: older, hasMore: more } = await chatApi.conversation(
                peer.userId,
                nextPage
            )
            if (older.length > 0 && el) {
                // DOM yangilanishidan OLDINGI balandlikni saqlaymiz —
                // useLayoutEffect shu asosda scrollTop'ni tiklaydi.
                pendingScrollRestoreRef.current = el.scrollHeight
                setMessages((prev) => {
                    const existingIds = new Set(prev.map((m) => m.id))
                    const newOnes = older.filter((m) => !existingIds.has(m.id))
                    return [...newOnes, ...prev]
                })
            }
            setPage(nextPage)
            setHasMore(more)
        } catch {
            // Jim — foydalanuvchi qayta tepaga skroll qilsa, qayta urinadi
        } finally {
            setLoadingOlder(false)
        }
    }, [loadingOlder, hasMore, page, peer.userId])

    const handleScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        // Tepaga ~80px qolganda — oldindan yuklashni boshlaymiz
        // (foydalanuvchi eng tepaga yetguncha kutmasdan, silliq
        // his qilinishi uchun).
        if (el.scrollTop < 80 && hasMore && !loadingOlder) {
            loadOlderMessages()
        }
    }, [hasMore, loadingOlder, loadOlderMessages])

    // ── Typing yuborish ──
    const notifyTyping = useCallback(() => {
        chatSocket.send({type: 'TYPING', to: peer.userId})
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = window.setTimeout(() => {
            chatSocket.send({type: 'STOP_TYPING', to: peer.userId})
        }, 2000)
    }, [peer.userId])

    // ── Matn xabar yuborish (optimistik) ──
    const sendText = useCallback(
        (text: string) => {
            const trimmed = text.trim()
            if (!trimmed) return

            // Edit rejimi
            if (editing) {
                chatApi.edit(editing.id, trimmed).catch(() => {
                })
                chatSocket.send({
                    type: 'CHAT_EDIT',
                    to: peer.userId,
                    messageId: editing.id,
                    content: trimmed,
                })
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === editing.id
                            ? {...m, content: trimmed, edited: true}
                            : m
                    )
                )
                setEditing(null)
                return
            }

            const tempId = `temp-${crypto.randomUUID()}`
            const optimistic: ChatMessage = {
                id: tempId,
                senderId: myId,
                receiverId: peer.userId,
                content: trimmed,
                createdAt: new Date().toISOString(),
                seen: false,
                delivered: false,
                messageType: 'TEXT',
                edited: false,
                deletedForEveryone: false,
                replyToMessageId: replyTo?.id ?? null,
                replyPreview: replyTo?.content ?? null,
                _pending: true,
            }
            setMessages((prev) => [...prev, optimistic])

            const sent = chatSocket.send({
                type: 'CHAT',
                to: peer.userId,
                content: trimmed,
                tempId,
                replyToMessageId: replyTo?.id,
            })

            // MUHIM (soddalashtirilgan model): hech qanday IndexedDB, hech
            // qanday avtomatik background retry.  Faqat: ulanish yo'q bo'lsa
            // — darhol "yuborilmadi" deb belgilaymiz; ulanish bor bo'lsa —
            // bir muddat (8 sek) CHAT_SENT tasdig'ini kutamiz, kelmasa ham
            // "yuborilmadi" deymiz.  Foydalanuvchi ko'rib, xohlasa qayta
            // (retryMessage orqali) bosadi — bu ANIQ va ishonchli.
            if (!sent) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === tempId ? {...m, _pending: false, _failed: true} : m))
                )
            } else {
                const timeout = window.setTimeout(() => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId && m._pending ? {...m, _pending: false, _failed: true} : m
                        )
                    )
                }, 8000)
                pendingTimeouts.current.set(tempId, timeout)
            }

            setReplyTo(null)
            onMessageSent()
        },
        [editing, replyTo, peer.userId, myId, onMessageSent]
    )

    // ── Muvaffaqiyatsiz xabarni qayta yuborish ──
    const retryMessage = useCallback(
        (message: ChatMessage) => {
            setMessages((prev) =>
                prev.map((m) => (m.id === message.id ? {...m, _pending: true, _failed: false} : m))
            )

            const sent = chatSocket.send({
                type: 'CHAT',
                to: peer.userId,
                content: message.content,
                tempId: message.id,
                attachmentId: message.attachmentId ?? undefined,
                replyToMessageId: message.replyToMessageId ?? undefined,
            })

            if (!sent) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === message.id ? {...m, _pending: false, _failed: true} : m))
                )
                return
            }

            const timeout = window.setTimeout(() => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === message.id && m._pending ? {...m, _pending: false, _failed: true} : m
                    )
                )
            }, 8000)
            pendingTimeouts.current.set(message.id, timeout)
        },
        [peer.userId]
    )

    // ── Attachment xabar yuborish ──
    const sendAttachment = useCallback(
        (attachmentId: string, caption: string, localPreview: Partial<ChatMessage>) => {
            const tempId = `temp-${crypto.randomUUID()}`
            const optimistic: ChatMessage = {
                id: tempId,
                senderId: myId,
                receiverId: peer.userId,
                content: caption,
                createdAt: new Date().toISOString(),
                seen: false,
                delivered: false,
                messageType: (localPreview.messageType as ChatMessage['messageType']) ?? 'FILE',
                edited: false,
                deletedForEveryone: false,
                attachmentId,
                _pending: true,
                ...localPreview,
            }
            setMessages((prev) => [...prev, optimistic])

            const sent = chatSocket.send({
                type: 'CHAT',
                to: peer.userId,
                content: caption,
                tempId,
                attachmentId,
                replyToMessageId: replyTo?.id,
            })

            if (!sent) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === tempId ? {...m, _pending: false, _failed: true} : m))
                )
            } else {
                const timeout = window.setTimeout(() => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId && m._pending ? {...m, _pending: false, _failed: true} : m
                        )
                    )
                }, 8000)
                pendingTimeouts.current.set(tempId, timeout)
            }

            setReplyTo(null)
            onMessageSent()
        },
        [peer.userId, myId, replyTo, onMessageSent]
    )

    // ── O'chirish ──
    const deleteForEveryone = useCallback((m: ChatMessage) => {
        chatApi.deleteForEveryone(m.id).catch(() => {
        })
        chatSocket.send({
            type: 'CHAT_DELETE_FOR_EVERYONE',
            to: peer.userId,
            messageId: m.id,
        })
        setMessages((prev) =>
            prev.map((x) =>
                x.id === m.id ? {...x, deletedForEveryone: true, content: ''} : x
            )
        )
    }, [peer.userId])

    const deleteForMe = useCallback((m: ChatMessage) => {
        chatApi.deleteForMe(m.id).catch(() => {
        })
        setMessages((prev) => prev.filter((x) => x.id !== m.id))
    }, [])

    const isSelfChat = peer.userId === myId
    const isDeleted = !isSelfChat && !!peer.deletedAccount
    // MUHIM: real-time online/offline signali (USER_ONLINE/OFFLINE)
    // butun tarmoqqa broadcast qilinadi — kim kimni bloklagani yoki
    // kim maxfiylikni yoqqanidan qat'iy nazar. Shuning uchun bu yerda
    // backend'dan kelgan `presenceHidden` bayrog'i BILAN qo'shib
    // tekshiramiz — aks holda WebSocket orqali blok qilingan
    // foydalanuvchining "haqiqiy" onlayn holatini bilib olish mumkin
    // bo'lib qolardi (backend faqat REST javobda yashiradi).
    const effectivePeerOnline = !isDeleted && !peer.presenceHidden && isPeerOnline
    const name = isSelfChat
        ? 'Saved Messages'
        : isDeleted
            ? 'Deleted Account'
            : `${peer.firstName} ${peer.lastName}`.trim() || 'User'

    return (
        <div className="flex h-full flex-col bg-cream">
            {/* Peer header */}
            <header className="flex flex-shrink-0 items-center gap-3 border-b border-ink/8 bg-white px-4 py-2.5">
                <button
                    onClick={onBack}
                    className="rounded-full p-1.5 text-ink-soft transition hover:bg-cream sm:hidden"
                    aria-label="Back"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>

                <Link
                    to={`/profile/${peer.userId}`}
                    className="relative flex-shrink-0"
                    title={name}
                >
                    <Avatar url={peer.profilePhotoUrl} size={36} deleted={isDeleted}/>
                    {!isDeleted && effectivePeerOnline && (
                        <span
                            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-mint-500"/>
                    )}
                    {!isDeleted && !effectivePeerOnline && peer.presenceHidden && (
                        <span
                            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink"/>
                    )}
                </Link>

                <div className="min-w-0 flex-1">
                    <Link
                        to={`/profile/${peer.userId}`}
                        className={`flex items-center gap-1 truncate font-display text-sm font-semibold transition-colors ${
                            isDeleted ? 'text-ink-muted' : 'text-ink hover:text-indigo-600'
                        }`}
                    >
                        <span className="truncate">{name}</span>
                        {!isSelfChat && !isDeleted && <VerifiedBadge username={peer.username} size={13} />}
                    </Link>
                    <p className="text-[11px] text-ink-muted">
                        {isDeleted ? (
                            ''
                        ) : isSelfChat ? (
                            "Messages to yourself"
                        ) : peerTyping ? (
                            <span className="text-indigo-600">typing…</span>
                        ) : effectivePeerOnline ? (
                            'online'
                        ) : peer.presenceHidden && peer.lastSeenLabel ? (
                            peer.lastSeenLabel
                        ) : (
                            'offline'
                        )}
                    </p>
                </div>

                {/* Call tugma — self-chat va Deleted Account'да yo'q */}
                {!isSelfChat && !isDeleted && (
                    <button
                        onClick={onStartCall}
                        disabled={inCall}
                        className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-40"
                        title="Video call"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 7l-7 5 7 5V7z"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                    </button>
                )}
            </header>

            {/* Call davom etayotganini bildiruvchi tasma */}
            {inCall && (
                <div
                    className="flex flex-shrink-0 items-center justify-center gap-2 bg-mint-500/10 py-1.5 text-xs font-medium text-mint-700">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-mint-500"/>
                    Call in progress — you can keep typing
                </div>
            )}

            {/* Xabarlar */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4"
            >
                {loadingOlder && (
                    <div className="flex justify-center py-2">
                        <span className="text-xs text-ink-muted">Loading older messages…</span>
                    </div>
                )}
                {loading ? (
                    <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
                ) : messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-muted">
                        No messages yet. Be the first to write.
                    </p>
                ) : (
                    messages.map((m, i) => {
                        const showDateSeparator =
                            i === 0 ||
                            !isSameDay(messages[i - 1].createdAt, m.createdAt)
                        return (
                            <div key={m.id}>
                                {showDateSeparator && (
                                    <DateSeparator dateStr={m.createdAt} />
                                )}
                                <MessageBubble
                                    message={m}
                                    isMine={m.senderId === myId}
                                    isSelfChat={isSelfChat}
                                    prevSameSender={
                                        !showDateSeparator &&
                                        i > 0 &&
                                        messages[i - 1].senderId === m.senderId
                                    }
                                    onReply={() => setReplyTo(m)}
                                    onEdit={() => setEditing(m)}
                                    onDeleteForMe={() => deleteForMe(m)}
                                    onDeleteForEveryone={() => deleteForEveryone(m)}
                                    onRetry={() => retryMessage(m)}
                                />
                            </div>
                        )
                    })
                )}
            </div>

            {/* Composer */}
            <MessageComposer
                peerId={peer.userId}
                replyTo={replyTo}
                editing={editing}
                onCancelReply={() => setReplyTo(null)}
                onCancelEdit={() => {
                    setEditing(null)
                }}
                onSendText={sendText}
                onSendAttachment={sendAttachment}
                onTyping={notifyTyping}
            />
        </div>
    )
}

// ── Ikki sana bir xil kunga tegishlimi (mahalliy vaqt bo'yicha) ──
function isSameDay(a: string, b: string): boolean {
    const da = parseServerDate(a)
    const db = parseServerDate(b)
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    )
}

// ── Telegram uslubidagi sana yorlig'i: "Today" / "Yesterday" / "August 17" ──
function formatDateLabel(dateStr: string): string {
    const date = parseServerDate(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'

    const sameYear = date.getFullYear() === now.getFullYear()
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: sameYear ? undefined : 'numeric',
    })
}

// ── Xabarlar orasidagi "sana ajratkichi" — Telegram uslubida ──
function DateSeparator({dateStr}: { dateStr: string }) {
    return (
        <div className="sticky top-0 z-10 flex justify-center py-2">
            <span className="rounded-full bg-ink/85 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-sm">
                {formatDateLabel(dateStr)}
            </span>
        </div>
    )
}

// ── WebSocket signal'dan ChatMessage yasab olish ──
function extractMessage(sig: SignalMessage): ChatMessage | null {
    // Backend to'liq DTO'ni payload'da yuborishi mumkin
    if (sig.payload && typeof sig.payload === 'object') {
        return sig.payload as ChatMessage
    }
    // Yoki alohida maydonlar bilan — minimal xabar quramiz
    if (sig.messageId && (sig.content != null || sig.attachmentId)) {
        return {
            id: sig.messageId,
            senderId: sig.from ?? '',
            receiverId: sig.to ?? '',
            content: sig.content ?? '',
            createdAt: new Date().toISOString(),
            seen: false,
            delivered: true,
            messageType: 'TEXT',
            edited: false,
            deletedForEveryone: false,
            attachmentId: sig.attachmentId ?? null,
            replyToMessageId: sig.replyToMessageId ?? null,
        }
    }
    return null
}
