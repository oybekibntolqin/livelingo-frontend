// Chat va Call uchun tiplar — backend DTO'lariga aniq mos.

export type SignalType =
    | 'CALL' | 'ACCEPT' | 'REJECT' | 'END' | 'OFFER' | 'ANSWER' | 'ICE' | 'MISSED' | 'ICE_FAILED'
    | 'ONLINE_USERS_LIST' | 'USER_ONLINE' | 'USER_OFFLINE' | 'USER_BUSY' | 'GET_ONLINE_USERS'
    | 'CHAT' | 'CHAT_EDIT' | 'CHAT_SENT' | 'CHAT_FAILED' | 'CHAT_DELIVERED' | 'CHAT_SEEN'
    | 'CHAT_DELETE_FOR_ME' | 'CHAT_DELETE_FOR_EVERYONE' | 'CHAT_LIST_UPDATE'
    | 'TYPING' | 'STOP_TYPING' | 'NOTIFICATION' | 'ACCOUNT_BANNED'
    | 'POST_LIKE_UPDATE' | 'POST_COMMENT_NEW' | 'POST_COMMENT_EDITED' | 'POST_COMMENT_DELETED'
    | 'LANGUAGE_STAT' | 'LANGUAGE_WARNING'

// WebSocket orqali boradigan/keladigan signal
export interface SignalMessage {
    type: SignalType

    from?: string
    to?: string

    // WebRTC call signalizatsiyasi uchun (backend haqiqatda yuboradi,
    // lekin oldin bu interfeysda e'lon qilinmagan edi — shuning uchun
    // CallProvider/useWebRTC'da TS xatolari chiqqan).
    callId?: string
    sdp?: string
    candidate?: string | RTCIceCandidateInit
    reason?: string

    content?: string
    createdAt?: string

    messageId?: string
    messageIds?: string[]
    tempId?: string
    userIds?: string[]

    attachmentId?: string

    replyToMessageId?: string

    replyMessage?: ReplyMessage | null;   // <-- SHUNI QO'SH

    fromName?: string

    chatListItem?: unknown

    payload?: ChatMessage | unknown;                // unknown emas

    // USER_ONLINE / USER_OFFLINE endi backend'da har bir viewer uchun
    // shaxsiylashtirilgan holda yuboriladi (qarang: backend PresenceService
    // #broadcastPresenceChange). `presenceHidden` true bo'lsa, `type` maydoni
    // (ONLINE/OFFLINE) e'tiborsiz qoldirilishi va `lastSeenLabel` ko'rsatilishi
    // kerak — bu holat targetning "Show when I'm online" sozlamasi o'chirilgan
    // yoki u bizni bloklagan bo'lganda yuz beradi.
    presenceHidden?: boolean
    lastSeenLabel?: string | null
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM'

// Bitta xabar — GET /api/chats/conversation/{id}
export interface ReplyMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
}

export interface ChatMessage {
    id: string;

    senderId: string;
    receiverId: string;

    senderName?: string;

    content: string;

    createdAt: string;

    seen: boolean;
    delivered: boolean;

    seenAt?: string;
    deliveredAt?: string;

    messageType: string;

    attachmentId?: string | null;
    attachmentUrl?: string | null;
    // IMAGE uchun kichik, tez yuklanadigan preview. Boshqa turlarda
    // yoki eski xabarlarda attachmentUrl bilan bir xil bo'lishi mumkin.
    attachmentThumbnailUrl?: string | null;
    // Telegram uslubidagi darhol ko'rinadigan xira placeholder
    // (base64 data URI) — tarmoq so'rovisiz, xabar bilan birga keladi.
    attachmentTinyPreview?: string | null;

    mediaType?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;

    durationSeconds?: number | null;

    edited: boolean;
    editedAt?: string | null;

    deletedForEveryone: boolean;
    deletedAt?: string | null;

    replyMessage?: ReplyMessage | null;

    // Optimistik (lokal) reply ko'rsatish uchun — server tasdiqlagunga
    // qadar to'liq replyMessage obyekti hali yo'q, shuning uchun
    // ConversationView shu ikkita "yassi" maydondan foydalanadi.
    replyToMessageId?: string | null;
    replyPreview?: string | null;

    _pending?: boolean;
    // CHAT_SENT tasdig'i vaqtida (8 sek) kelmasa yoki socket.send()
    // muvaffaqiyatsiz bo'lsa — "yuborilmadi, qayta urinish" holati.
    _failed?: boolean;
}

// Chat ro'yxati elementi — GET /api/chats/list
export interface ChatListItem {
    userId: string
    firstName: string
    lastName: string
    username?: string | null
    profilePhotoUrl?: string | null
    online: boolean
    // Ko'ring: backend PresenceVisibilityService
    presenceHidden?: boolean
    lastSeenLabel?: string | null
    deletedAccount?: boolean
    lastMessage: string
    lastMessageTime: string | null
    lastMessageSeen: boolean
    lastMessageDelivered: boolean
    unreadCount: number
}

// Attachment yuklashdan qaytadigan javob — POST /api/chat/attachments
export interface AttachmentUploadResult {
    attachmentId: string
    url: string
    thumbnailUrl: string
    tinyPreview: string
    fileName: string
    contentType: string
    size: number
    mediaType: MediaType
    durationSeconds: number
}

export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'FILE'

// User qidiruv natijasi — GET /api/users/search
// Backend to'liq User obyektini qaytarishi mumkin — profilePhotoUrl/bio/online
// har doim kelmasligi mumkin bo'lgani uchun optional qilib qo'yildi (UI
// buni yo'q bo'lsa ham default avatar bilan ishlata oladi).
export interface UserSearchResult {
    id: string
    firstName: string
    lastName: string
    username?: string
    profilePhotoUrl?: string | null
    bio?: string | null
    online?: boolean
    // Ko'ring: backend PresenceVisibilityService — true bo'lsa, bu
    // foydalanuvchining haqiqiy online holati bizdan yashirilgan
    // (blok yoki maxfiylik sozlamasi tufayli), `lastSeenLabel`
    // ko'rsatilishi kerak.
    presenceHidden?: boolean
    lastSeenLabel?: string | null
    deletedAccount?: boolean
}

// Call holati
export type CallState =
    | 'idle'
    | 'calling'      // biz qo'ng'iroq qilyapmiz, javob kutyapmiz
    | 'incoming'     // bizga qo'ng'iroq kelyapti
    | 'connected'    // gaplashyapmiz
    | 'ended'

export interface ActiveCall {
    callId: string
    peerId: string
    peerName: string
    state: CallState
    startedAt?: number
    // true = biz qo'ng'iroq qildik (OFFER yuboramiz)
    // false = bizga qo'ng'iroq keldi (ANSWER qaytaramiz)
    isCaller: boolean
}
