import {useCallback, useEffect, useRef, useState} from 'react'
import {Link, useLocation, useNavigate} from 'react-router-dom'
import Logo from '../components/Logo'
import {Sidebar} from '../components/AppShell'
import ChatList from '../components/chat/ChatList'
import ConversationView from '../components/chat/ConversationView'
import {useCall} from '../context/CallContext'
import {chatApi} from '../lib/chatApi'
import {chatSocket} from '../lib/chatSocket'
import {isAuthenticated} from '../lib/auth'
import {getUserIdFromToken} from '../lib/chatAuth'
import type {ChatListItem, SignalMessage} from '../lib/chatTypes'

export default function Chat() {
    const navigate = useNavigate()
    const location = useLocation()
    const myId = getUserIdFromToken()

    useEffect(() => {
        if (!isAuthenticated()) navigate('/sign-in', {replace: true})
    }, [navigate])

    const CHAT_LIST_PAGE_SIZE = 20

    const [chats, setChats] = useState<ChatListItem[]>([])
    const [loadingList, setLoadingList] = useState(true)
    const listWindowSizeRef = useRef(CHAT_LIST_PAGE_SIZE)
    const [hasMoreChats, setHasMoreChats] = useState(true)
    const [loadingMoreChats, setLoadingMoreChats] = useState(false)
    const [activePeerId, setActivePeerId] = useState<string | null>(null)
    const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
    const [socketReady, setSocketReady] = useState(false)

    // MUHIM (Problem 2 fix uchun kerak): WebSocket signal handler'ning
    // closure'i eskirib qolmasligi uchun (ref orqali doim eng so'nggi
    // qiymatni o'qiymiz — signal handler effect faqat [loadList] ga bog'liq,
    // activePeerId o'zgarishida qayta yaratilmaydi).
    const activePeerIdRef = useRef<string | null>(null)
    useEffect(() => {
        activePeerIdRef.current = activePeerId
    }, [activePeerId])

    const activePeer = chats.find((c) => c.userId === activePeerId) ?? null

    const handleSelectNewUser = useCallback(
        (user: {
            id: string;
            firstName: string;
            lastName: string;
            username?: string;
            profilePhotoUrl?: string | null
        }) => {
            setChats((prev) => {
                if (prev.some((c) => c.userId === user.id)) return prev
                const isMe = user.id === myId
                const stub: ChatListItem = {
                    userId: user.id,
                    firstName: isMe ? 'Saved Messages' : user.firstName,
                    lastName: isMe ? '' : user.lastName,
                    profilePhotoUrl: isMe ? null : user.profilePhotoUrl,
                    online: false,
                    lastMessage: '',
                    lastMessageTime: null,
                    lastMessageSeen: false,
                    lastMessageDelivered: false,
                    unreadCount: 0,
                }
                return [stub, ...prev]
            })
            setActivePeerId(user.id)
        },
        [myId]
    )

    useEffect(() => {
        const openUser = (location.state as {
            openUser?: {
                id: string;
                firstName: string;
                lastName: string;
                username?: string;
                profilePhotoUrl?: string | null
            }
        } | null)?.openUser
        if (openUser) {
            handleSelectNewUser(openUser)
            window.history.replaceState({}, '')
        }
    }, [location.state, handleSelectNewUser])

    useEffect(() => {
        chatSocket.connect()
        // Socket allaqachon ulangan bo'lishi mumkin (masalan boshqa
        // sahifadan meros) — bunday holda ONLINE_USERS_LIST avtomatik
        // qayta kelmaydi, shuning uchun aniq so'raymiz (batafsil:
        // lib/chatSocket.ts -> requestOnlineUsersRefresh izohi).
        chatSocket.requestOnlineUsersRefresh()
        const offStatus = chatSocket.onStatus((connected) => {
            setSocketReady(connected)
            if (connected) chatSocket.requestOnlineUsersRefresh()
        })
        return () => offStatus()
    }, [])

    const loadList = useCallback(async (size?: number) => {
        const requestSize = size ?? listWindowSizeRef.current
        try {
            const { chats: list, hasMore } = await chatApi.list(0, requestSize)

            const mapped = list.map((c) => {
                if (c.userId === myId) {
                    return {
                        ...c,
                        firstName: 'Saved Messages',
                        lastName: '',
                        profilePhotoUrl: null,
                    }
                }
                return c
            })

            // Telegram kabi: "Saved Messages" (o'ziga yozish) har doim
            // ro'yxatda ko'rinib turishi kerak — hatto hali birorta ham
            // xabar yozilmagan bo'lsa ham (backend bunday holda uni
            // /api/chats/list ichida qaytarmaydi). Shuning uchun bo'lmasa
            // frontendda "bo'sh" stub sifatida qo'shib qo'yamiz va doim
            // ro'yxat boshiga qadaymiz (pin).
            const hasSelf = mapped.some((c) => c.userId === myId)
            const withSelf: ChatListItem[] =
                hasSelf || !myId
                    ? mapped
                    : [
                          {
                              userId: myId,
                              firstName: 'Saved Messages',
                              lastName: '',
                              profilePhotoUrl: null,
                              online: false,
                              lastMessage: '',
                              lastMessageTime: null,
                              lastMessageSeen: false,
                              lastMessageDelivered: false,
                              unreadCount: 0,
                          },
                          ...mapped,
                      ]

            const pinned = myId
                ? [
                      ...withSelf.filter((c) => c.userId === myId),
                      ...withSelf.filter((c) => c.userId !== myId),
                  ]
                : withSelf

            // MUHIM FIX (Problem 1: "Profildan Message bosilganda suhbat
            // ochilmay, qidiruvga qaytarib qo'yishi"):
            // Avval bu yerda `setChats(pinned)` serverdan kelgan ro'yxatni
            // TO'LIQ almashtirar edi. Agar foydalanuvchi profildan "Message"
            // bosgan bo'lsa, `handleSelectNewUser` allaqachon shu odam uchun
            // vaqtinchalik "stub" yozuvni ro'yxat boshiga qo'shib bo'lgan va
            // `activePeerId`ni shunga o'rnatgan bo'ladi — lekin bu odam bilan
            // hali haqiqiy xabar almashinmagani uchun backend uni
            // /api/chats/list javobida hali qaytarmaydi. Component mount
            // bo'lishi bilan ishga tushadigan `loadList()` keyinroq (server
            // javobi kelgach) `setChats(pinned)` chaqirsa, bu stub yozuv
            // ro'yxatdan butunlay YO'QOLIB QOLARDI — natijada
            // `activePeerId` hech narsaga mos kelmay qolib, suhbat ekrani
            // "tanlanmagan" holatga qaytardi (garchi foydalanuvchi allaqachon
            // "Message"ni bosgan bo'lsa ham).
            //
            // Yechim: serverdan kelmagan, lekin lokal ro'yxatda mavjud bo'lgan
            // (hali persist qilinmagan) yozuvlarni saqlab qolamiz — ular
            // ro'yxat boshiga, server natijalaridan oldin qo'shiladi.
            setChats((prev) => {
                const serverIds = new Set(pinned.map((c) => c.userId))
                const localOnlyStubs = prev.filter((c) => !serverIds.has(c.userId))
                return [...localOnlyStubs, ...pinned]
            })
            setHasMoreChats(hasMore)
            setOnlineIds((prev) => {
                const next = new Set(prev)
                mapped.forEach((c) => {
                    if (c.online) next.add(c.userId)
                })
                return next
            })
        } catch {
            // Error handling
        } finally {
            setLoadingList(false)
            setLoadingMoreChats(false)
        }
    }, [myId])

    useEffect(() => {
        loadList(CHAT_LIST_PAGE_SIZE)
    }, [loadList])

    const loadMoreChats = useCallback(() => {
        if (loadingMoreChats || !hasMoreChats) return
        const nextSize = listWindowSizeRef.current + CHAT_LIST_PAGE_SIZE
        listWindowSizeRef.current = nextSize
        setLoadingMoreChats(true)
        loadList(nextSize)
    }, [loadList, loadingMoreChats, hasMoreChats])

    useEffect(() => {
        return chatSocket.subscribe((sig: SignalMessage) => {
            switch (sig.type) {
                case 'ONLINE_USERS_LIST': {
                    let ids: unknown = sig.payload
                    if (ids == null && sig.content) {
                        try {
                            ids = JSON.parse(sig.content)
                        } catch {
                            ids = []
                        }
                    }
                    if (Array.isArray(ids)) setOnlineIds(new Set(ids as string[]))
                    break
                }
                // MUHIM: backend endi USER_ONLINE/USER_OFFLINE bilan birga
                // `presenceHidden` va `lastSeenLabel`ni ham yuboradi (har bir
                // viewer uchun shaxsiylashtirilgan). Shuning uchun bu yerda
                // faqat onlineIds Set'ini emas, balki `chats` ro'yxatidagi mos
                // itemning presenceHidden/lastSeenLabel'ini ham real-time
                // yangilaymiz — aks holda "Show when I'm online" o'chirilganda/
                // yoqilganda foydalanuvchi buni faqat sahifa refresh qilingach
                // ko'rar edi.
                case 'USER_ONLINE':
                case 'USER_OFFLINE': {
                    const fromId = sig.from
                    if (!fromId) break

                    const hidden = !!sig.presenceHidden
                    const isOnline = sig.type === 'USER_ONLINE' && !hidden

                    setOnlineIds((p) => {
                        const n = new Set(p)
                        if (isOnline) n.add(fromId)
                        else n.delete(fromId)
                        return n
                    })

                    setChats((prev) =>
                        prev.map((c) =>
                            c.userId === fromId
                                ? {
                                      ...c,
                                      presenceHidden: hidden,
                                      lastSeenLabel: hidden ? (sig.lastSeenLabel ?? c.lastSeenLabel) : null,
                                  }
                                : c
                        )
                    )
                    break
                }

                case 'CHAT':
                case 'CHAT_SENT':
                case 'CHAT_DELIVERED':
                case 'CHAT_SEEN':
                case 'CHAT_LIST_UPDATE':
                case 'CHAT_DELETE_FOR_EVERYONE':
                // Qo'ng'iroq tugagach (rad etilgan/tugatilgan/o'tkazib
                // yuborilgan/band) backend chatga system xabar qo'shadi —
                // ro'yxatni yangilaymiz (Problem: bu ilgari CallProvider'ning
                // onCallSettled callback'i orqali qilinardi, lekin
                // CallProvider endi global bo'lgani uchun bu sahifaga
                // bog'liq bo'lolmaydi).
                case 'REJECT':
                case 'END':
                case 'MISSED':
                case 'USER_BUSY':
                    loadList().then(() => {
                        // MUHIM FIX (Problem 2: "qo'ng'iroq tugagach shu
                        // suhbat ochiq turgan bo'lsa ham xabar o'qilmagan
                        // bo'lib qolishi"):
                        // Bu xabar (masalan CALL_ENDED) backend tomonidan
                        // 'CHAT' turidagi signal sifatida ikkala tomonga ham
                        // yuboriladi. Aynan shu vaqtda ConversationView (agar
                        // ochiq bo'lsa) alohida, ASINXRON ravishda backend'ga
                        // "CHAT_SEEN" signalini yuboradi. Muammo shundaki,
                        // yuqoridagi loadList() server javobi ko'pincha o'sha
                        // CHAT_SEEN backend tomonidan qayta ishlanishidan
                        // OLDINROQ kelib qoladi — natijada serverdan hali
                        // "o'qilmagan" (unreadCount > 0) holat qaytadi va buni
                        // hech kim keyinchalik tuzatmaydi (chunki boshqa
                        // hech qanday keyingi loadList() chaqirilmaydi).
                        //
                        // Yechim: suhbat HOZIR aynan ochiq turgan bo'lsa,
                        // uning unreadCount'ini serverdan qat'i nazar,
                        // darhol lokal 0'ga tushiramiz — chunki foydalanuvchi
                        // uni allaqachon jonli ko'rib turibdi.
                        const relatedPeerId = sig.from === myId ? sig.to : sig.from
                        if (relatedPeerId && relatedPeerId === activePeerIdRef.current) {
                            setChats((prev) =>
                                prev.map((c) =>
                                    c.userId === relatedPeerId && c.unreadCount
                                        ? { ...c, unreadCount: 0 }
                                        : c
                                )
                            )
                        }
                    })
                    break
            }
        })
    }, [loadList])

    return (
        <ChatShell
            myId={myId}
            chats={chats}
            loadingList={loadingList}
            hasMoreChats={hasMoreChats}
            loadingMoreChats={loadingMoreChats}
            onLoadMoreChats={loadMoreChats}
            activePeerId={activePeerId}
            activePeer={activePeer}
            onlineIds={onlineIds}
            socketReady={socketReady}
            onSelectPeer={setActivePeerId}
            onSelectNewUser={handleSelectNewUser}
            onMessageSent={loadList}
        />
    )
}

interface ChatShellProps {
    myId: string | null
    chats: ChatListItem[]
    loadingList: boolean
    hasMoreChats: boolean
    loadingMoreChats: boolean
    onLoadMoreChats: () => void
    activePeerId: string | null
    activePeer: ChatListItem | null
    onlineIds: Set<string>
    socketReady: boolean
    onSelectPeer: (id: string | null) => void
    onSelectNewUser: (user: {
        id: string;
        firstName: string;
        lastName: string;
        username?: string;
        profilePhotoUrl?: string | null
    }) => void
    onMessageSent: () => void
}

function ChatShell({
                       myId,
                       chats,
                       loadingList,
                       hasMoreChats,
                       loadingMoreChats,
                       onLoadMoreChats,
                       activePeerId,
                       activePeer,
                       onlineIds,
                       socketReady,
                       onSelectPeer,
                       onSelectNewUser,
                       onMessageSent,
                   }: ChatShellProps) {
    const {call, startCall} = useCall()
    const navigate = useNavigate()

    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

    const openCompose = () => {
        navigate('/dashboard', {state: {openCompose: true}})
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 antialiased font-sans">

            {/* CHAP PANEL - SIDEBAR KONTEYNERI */}
            <div
                onMouseEnter={() => setIsSidebarExpanded(true)}
                onMouseLeave={() => setIsSidebarExpanded(false)}
                className={`chat-sidebar-wrapper hidden md:flex flex-col shrink-0 h-full bg-white border-r border-slate-200 transition-all duration-300 ease-in-out relative z-30 ${
                    isSidebarExpanded ? 'w-[245px]' : 'w-[73px]'
                }`}
            >
                <div className="w-full h-full overflow-hidden">
                    <Sidebar onCreatePost={openCompose}/>
                </div>
            </div>

            {/* ASOSIY CHAT MAYDONI */}
            <main
                className="flex-1 flex h-full overflow-hidden bg-white relative z-10 transition-all duration-300 ease-in-out">

                {/* Custom CSS: Layout uslublarini to'g'rilash (CSS selektorlari chat-list-aside'ga chegaralangan) */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                /* 0. SIDEBAR NI TO'LIQ EKRANGA PASTGA CHO'ZISH VA SOYASINI OLIB TASHALASH */
                /* MUHIM: selektor faqat sidebar konteyneri/nav/aside'ning o'ziga
                   qaratilgan — "> " (bevosita bola) kombinatorlari bilan. Avval bu yerda
                   ".chat-sidebar-wrapper div" (barcha ichki div'larga mos keladigan)
                   umumiy selektor bor edi — u aside ichida "position: fixed" bilan
                   ko'rsatiladigan Notifications paneliga ham (DOM jihatidan u ham
                   aside'ning bolasi) tegib, height:100% !important'ni majburlab,
                   panelni butunlay buzib qo'yardi (Chat sahifasida bo'sh ko'rinishi
                   shundan edi). Endi faqat aniq yo'l orqali maqsadli elementlarga tegadi. */
                .chat-sidebar-wrapper,
                .chat-sidebar-wrapper > div,
                .chat-sidebar-wrapper > div > aside,
                .chat-sidebar-wrapper > div > aside > nav {
                    height: 100% !important;
                    max-height: 100vh !important;
                    border-radius: 0px !important;
                    box-shadow: none !important;
                    margin: 0px !important;
                }

                /* 1. Chat wallpaper fonini to'liq tozalash */
                .chat-wallpaper-container > div,
                .chat-wallpaper-container [class*="overflow-y-auto"],
                .chat-wallpaper-container [class*="overflow-auto"] {
                    background-color: #ffffff !important;
                    background-image: none !important;
                }

                /* 2. Chap panel (ChatList) kartochkalari — Instagram dagi kabi tekis va soyasiz */
                aside.chat-list-aside [role="button"], 
                aside.chat-list-aside li, 
                aside.chat-list-aside [class*="cursor-pointer"] {
                    background-color: transparent !important;
                    border-radius: 0px !important;
                    border: none !important;
                    box-shadow: none !important;
                    margin-bottom: 0px !important;
                    padding: 0.75rem 1.25rem !important;
                    transition: background-color 0.15s ease !important;
                }
                aside.chat-list-aside [role="button"]:hover, 
                aside.chat-list-aside li:hover, 
                aside.chat-list-aside [class*="cursor-pointer"]:hover {
                    background-color: #f8f9fa !important;
                }

                /* Aktiv tanlangan chat */
                aside.chat-list-aside [class*="bg-slate-100"], 
                aside.chat-list-aside [class*="bg-slate-50"], 
                aside.chat-list-aside [class*="bg-blue-50"], 
                aside.chat-list-aside [class*="bg-indigo-50"],
                aside.chat-list-aside [class*="active"] {
                    background-color: #efefef !important;
                    box-shadow: none !important;
                    transform: none !important;
                    border: none !important;
                }

                /* O'QILMAGAN XABARLAR SONI BADJI */
                aside.chat-list-aside [class*="unread-count"],
                aside.chat-list-aside [class*="unread"],
                aside.chat-list-aside [class*="count"],
                aside.chat-list-aside [class*="bg-red-"], 
                aside.chat-list-aside [class*="bg-rose-"],
                aside.chat-list-aside span.rounded-full {
                    background-color: #e4e4e7 !important;
                    color: #000000 !important;
                    width: auto !important;
                    min-width: 18px !important;
                    height: 18px !important;
                    border-radius: 9999px !important;
                    padding: 2px 6px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }

                /* Qidiruv tizimi (Search input) */
                aside.chat-list-aside input[type="search"], 
                aside.chat-list-aside [class*="search-input"] {
                    background-color: #efefef !important;
                    border: none !important;
                    border-radius: 0.75rem !important;
                    box-shadow: none !important;
                    padding: 0.65rem 1rem !important;
                }

                /* 3. O'ng panel (Suhbat oynasi) - To'liq oq fonda, chetlari tekis */
                section.chat-wallpaper-container {
                    background-color: #ffffff !important;
                    border-radius: 0px !important;
                    margin: 0px !important;
                    box-shadow: none !important;
                    border: none !important;
                    display: flex;
                    flex-direction: column;
                    height: 100% !important;
                }

                /* Chat header (Tepa qism) */
                .chat-wallpaper-container header,
                .chat-wallpaper-container [class*="border-b"] {
                    background-color: #ffffff !important;
                    border-bottom: 1px solid #efefef !important;
                    padding: 0.85rem 1.5rem !important;
                    height: 75px !important;
                    display: flex !important;
                    align-items: center !important;
                }

                /* 4. SIZ YUBORGAN XABARLAR */
                .chat-wallpaper-container .justify-end [class*="bg-"] {
                    background: linear-gradient(135deg, #0095f6 0%, #7b3bf2 100%) !important;
                    color: #ffffff !important;
                    border-radius: 1.15rem !important;
                    padding: 0.55rem 1rem !important;
                    font-size: 0.92rem !important;
                    box-shadow: none !important;
                    border: none !important;
                }
                .chat-wallpaper-container .justify-end [class*="bg-"] p,
                .chat-wallpaper-container .justify-end [class*="bg-"] span {
                    color: #ffffff !important;
                }

                /* 5. SIZGA KELGAN XABARLAR */
                .chat-wallpaper-container .justify-start [class*="bg-"] {
                    background-color: #efefef !important;
                    color: #000000 !important;
                    border-radius: 1.15rem !important;
                    padding: 0.55rem 1rem !important;
                    font-size: 0.92rem !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .chat-wallpaper-container .justify-start [class*="bg-"] p,
                .chat-wallpaper-container .justify-start [class*="bg-"] span {
                    color: #000000 !important;
                }

                /* 6. Matn kiritish oynasi (Composer input form) */
                .chat-wallpaper-container form,
                .chat-wallpaper-container [class*="border-t"] {
                    background-color: #ffffff !important;
                    border-top: none !important;
                    padding: 1rem 1.5rem !important;
                }
                .chat-wallpaper-container form > div,
                .chat-wallpaper-container [class*="border-t"] > div {
                    background-color: #ffffff !important;
                    border: 1px solid #dbdbdb !important;
                    border-radius: 2rem !important;
                    padding: 0.4rem 1rem !important;
                    display: flex !important;
                    align-items: center !important;
                    width: 100% !important;
                }
                .chat-wallpaper-container form input,
                .chat-wallpaper-container [class*="border-t"] input {
                    background-color: transparent !important;
                    border: none !important;
                    font-size: 0.92rem !important;
                    padding: 0.4rem 0.5rem !important;
                    outline: none !important;
                    box-shadow: none !important;
                }
            `
                }}/>

                {/* Chap panel - ChatList (chat-list-aside klassi biriktirildi) */}
                <aside
                    className={`chat-list-aside h-full border-r border-slate-200 bg-white flex flex-col transition-all duration-300 ease-in-out w-full sm:w-[350px] md:w-[398px] sm:flex-shrink-0 ${
                        activePeerId ? 'hidden sm:flex' : 'flex'
                    }`}
                >
                    {/* Chat ro'yxati sarlavhasi */}
                    <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <Link to="/dashboard" className="text-slate-500 hover:text-black transition-colors">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"
                                     viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                                </svg>
                            </Link>
                            <Logo size={26}/>
                        </div>
                        <button onClick={openCompose} className="text-slate-950 hover:text-slate-600 transition-colors">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                            </svg>
                        </button>
                    </div>

                    <div className="flex h-full min-h-0 flex-1 flex-col pt-3">
                        <ChatList
                            chats={chats}
                            loading={loadingList}
                            hasMore={hasMoreChats}
                            loadingMore={loadingMoreChats}
                            onLoadMore={onLoadMoreChats}
                            activePeerId={activePeerId}
                            onlineIds={onlineIds}
                            myId={myId}
                            onSelect={onSelectPeer}
                            onSelectNew={onSelectNewUser}
                        />
                    </div>
                </aside>

                {/* O'ng panel (Suhbat oynasi) */}
                <section
                    className="chat-wallpaper-container relative min-w-0 flex-1 h-full transition-all duration-300 ease-in-out">
                    {activePeer && myId ? (
                        <ConversationView
                            key={activePeer.userId}
                            myId={myId}
                            peer={activePeer}
                            isPeerOnline={onlineIds.has(activePeer.userId)}
                            inCall={call?.peerId === activePeer.userId && call.state === 'connected'}
                            onBack={() => onSelectPeer(null)}
                            onStartCall={() =>
                                startCall(activePeer.userId, `${activePeer.firstName} ${activePeer.lastName}`.trim())
                            }
                            onMessageSent={onMessageSent}
                        />
                    ) : (
                        <div className="hidden h-full place-items-center px-4 sm:grid bg-white">
                            <div className="text-center">
                                <div
                                    className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 border-black">
                                    <svg className="h-12 w-12 text-black" fill="none" stroke="currentColor"
                                         strokeWidth="1" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                                    </svg>
                                </div>
                                <h3 className="text-xl font-medium text-black">Mavjud xabarlaringiz</h3>
                                <p className="mt-1 text-sm text-slate-500">Do'stingizga shaxsiy xabar yoki rasm
                                    yuboring.</p>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}
