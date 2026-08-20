// Telegram / Plus Messenger uslubidagi ixcham oq fonli xabarlar bubble'i

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDuration, formatFileSize } from '../../lib/chatApi'
import type { ChatMessage } from '../../lib/chatTypes'

interface Props {
    message: ChatMessage
    isMine: boolean
    isSelfChat?: boolean
    prevSameSender: boolean
    onReply: () => void
    onEdit: () => void
    onDeleteForMe: () => void
    onDeleteForEveryone: () => void
    onRetry: () => void
}

function renderMessageContent(content: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = content.split(urlRegex)
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1d82e2] hover:underline break-all font-normal"
                >
                    {part}
                </a>
            )
        }
        return part
    })
}

export default function MessageBubble({
                                          message: m,
                                          isMine,
                                          isSelfChat,
                                          prevSameSender,
                                          onReply,
                                          onEdit,
                                          onDeleteForMe,
                                          onDeleteForEveryone,
                                          onRetry,
                                      }: Props) {
    const [menuOpen, setMenuOpen] = useState(false)

    if (m.messageType === 'SYSTEM') {
        return <CallSystemChip content={m.content} />
    }

    if (m.deletedForEveryone) {
        return (
            <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mt-1 px-4`}>
                <div className="max-w-[70%] rounded-[10px] bg-zinc-100 border border-zinc-200/50 px-3 py-1">
                    <p className="text-[11px] italic text-zinc-400">
                        This message was deleted
                    </p>
                </div>
            </div>
        )
    }

    const time = new Date(m.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })

    const isMediaOnly = !!(m.attachmentId && !m.content && !m.replyMessage && !(m.replyToMessageId && m.replyPreview))
    const isVoice = m.mediaType === 'VOICE' || m.messageType === 'VOICE' || m.mediaType === 'AUDIO'

    return (
        <div
            className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'} ${prevSameSender ? 'mt-[2px]' : 'mt-2'} px-4 w-full`}
            onMouseLeave={() => setMenuOpen(false)}
        >
            <div className={`flex max-w-[75%] items-end gap-1.5 ${isMine ? 'flex-row' : 'flex-row-reverse'}`}>

                {/* Hover amallar paneli */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 self-center">
                    <button
                        onClick={onReply}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                        title="Reply"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 17 4 12 9 7" />
                            <path d="M20 18v-2a4 4 0 00-4-4H4" />
                        </svg>
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen((v) => !v)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                            title="More"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>

                        {menuOpen && (
                            <div
                                className={`absolute z-20 mt-1 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg ${isMine ? 'right-0' : 'left-0'}`}
                            >
                                {isMine && m.messageType === 'TEXT' && !m.attachmentId && (
                                    <MenuItem
                                        label="Edit"
                                        onClick={() => {
                                            onEdit()
                                            setMenuOpen(false)
                                        }}
                                    />
                                )}
                                {isSelfChat ? (
                                    <MenuItem
                                        label="Delete"
                                        danger
                                        onClick={() => {
                                            onDeleteForEveryone()
                                            setMenuOpen(false)
                                        }}
                                    />
                                ) : (
                                    <>
                                        <MenuItem
                                            label="Delete for me"
                                            onClick={() => {
                                                onDeleteForMe()
                                                setMenuOpen(false)
                                            }}
                                        />
                                        {isMine && (
                                            <MenuItem
                                                label="Delete for everyone"
                                                danger
                                                onClick={() => {
                                                    onDeleteForEveryone()
                                                    setMenuOpen(false)
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Xabar Bubble tanasi */}
                <div
                    className={`relative overflow-hidden shadow-sm transition-all duration-150 ${
                        isMediaOnly
                            ? 'rounded-[12px]'
                            : isMine
                                ? 'bg-[#e2f7cb] text-[#212121] rounded-[12px] rounded-br-[2px] px-3 py-[5px]'
                                : 'bg-[#f1f1f5] text-[#212121] rounded-[12px] rounded-bl-[2px] px-3 py-[5px]'
                    }`}
                >
                    {/* Chiroyli Reply (Javob) bloki */}
                    {(m.replyMessage || (m.replyToMessageId && m.replyPreview)) && !isVoice && (
                        <div
                            className={`mb-1 flex items-stretch rounded-[6px] border-l-[3px] py-0.5 pl-2 pr-1.5 text-xs text-left ${
                                isMine
                                    ? 'border-[#7cb342] bg-[#d7ecd2]/55'
                                    : 'border-[#3f51b5] bg-zinc-200/50'
                            }`}
                        >
                            <div className="min-w-0">
                                <p className={`font-semibold text-[11px] truncate ${isMine ? 'text-[#558b2f]' : 'text-[#3f51b5]'}`}>
                                    {m.replyMessage ? m.replyMessage.senderName : 'Reply'}
                                </p>
                                <p className="truncate text-[11px] text-zinc-500">
                                    {m.replyMessage ? m.replyMessage.content : m.replyPreview}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Ovozli xabar bo'lsa maxsus va to'liq interfeysni chaqiramiz */}
                    {isVoice ? (
                        <VoiceAudioPlayer message={m} isMine={isMine} time={time} onRetry={onRetry} />
                    ) : (
                        <>
                            {m.attachmentId && <AttachmentView message={m} isMine={isMine} />}
                            {m.content && (
                                <div className="text-[13px] leading-[17px] break-words font-normal">
                                    {renderMessageContent(m.content)}
                                    <span className="float-right mt-1 ml-2.5 flex items-center gap-1 text-[9px] select-none text-zinc-400 font-normal">
                    {time}
                                        {isMine && m.seen && <span className="text-zinc-500 font-semibold lowercase">seen</span>}
                                        {isMine && !m.seen && <span className="text-zinc-400 lowercase">sent</span>}
                  </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Telegram / Plus Messenger Uslubidagi Custom Voice Player ──
function VoiceAudioPlayer({
                              message: m,
                              isMine,
                              time,
                              onRetry,
                          }: {
    message: ChatMessage
    isMine: boolean
    time: string
    onRetry: () => void
}) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)

    // To'lqin ustunlari (Waveform heights)
    const waveformBars = [
        3, 5, 8, 12, 10, 6, 8, 14, 16, 12, 10, 6, 4, 6, 10, 14, 18, 14, 10, 8, 12, 16, 12, 8, 6, 10, 14, 12, 8, 4, 6, 10, 12, 8, 5, 3
    ]

    const togglePlay = () => {
        if (!audioRef.current) return
        if (isPlaying) {
            audioRef.current.pause()
        } else {
            audioRef.current.play().catch((err) => console.warn('Audio play failed:', err))
        }
    }

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)
        const handleTimeUpdate = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100)
            }
        }
        const handleEnded = () => {
            setIsPlaying(false)
            setProgress(0)
        }

        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)
        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('ended', handleEnded)

        return () => {
            audio.removeEventListener('play', handlePlay)
            audio.removeEventListener('pause', handlePause)
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('ended', handleEnded)
        }
    }, [m.attachmentUrl])

    const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !audioRef.current.duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const percentage = clickX / rect.width
        audioRef.current.currentTime = percentage * audioRef.current.duration
    }

    const durationStr = formatDuration(m.durationSeconds ?? 0)
    const sizeStr = m.fileSize ? `, ${formatFileSize(m.fileSize)}` : ''

    return (
        <div className="flex flex-col min-w-[240px] max-w-[270px] py-1 text-left">
            <audio ref={audioRef} src={m.attachmentUrl ?? ''} preload="metadata" />

            {/* Player va To'lqinlar */}
            <div className="flex items-center gap-3">
                {/* Play / Pause tugmasi (Oltin-qum rangda) */}
                <button
                    onClick={togglePlay}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#e5c07b]/90 text-[#543d22] transition active:scale-95 shadow-sm"
                >
                    {isPlaying ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                {/* To'lqinlar va ostidagi metadata */}
                <div className="flex-1 flex flex-col">
                    {/* Ustunli Waveform Progress */}
                    <div
                        className="flex items-end gap-[1.5px] h-6 cursor-pointer"
                        onClick={handleWaveformClick}
                    >
                        {waveformBars.map((height, i) => {
                            const active = (i / waveformBars.length) * 100 <= progress
                            return (
                                <div
                                    key={i}
                                    className="w-[2px] rounded-full transition-colors duration-150"
                                    style={{
                                        height: `${height}px`,
                                        backgroundColor: active
                                            ? isMine ? '#558b2f' : '#3f51b5'
                                            : isMine ? '#c5e1a5' : '#cbd5e1'
                                    }}
                                />
                            )
                        })}
                    </div>

                    {/* Davomiylik, o'lcham va vaqt */}
                    <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400 font-normal">
                        <span>{durationStr}{sizeStr}</span>
                        <span className="flex items-center gap-1">
              {time}
                            {isMine && (
                                <>
                                    {m._failed ? (
                                        <button onClick={onRetry} className="text-red-500 font-semibold">retry</button>
                                    ) : m._pending ? (
                                        <span>...</span>
                                    ) : m.seen ? (
                                        <span className="text-zinc-500 font-semibold lowercase">seen</span>
                                    ) : (
                                        <span className="text-zinc-400 lowercase">sent</span>
                                    )}
                                </>
                            )}
            </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function withDownload(url: string): string {
    if (!url) return url
    return url + (url.includes('?') ? '&' : '?') + 'download=1'
}

// ── Rasm Lightbox ──
function ImageAttachment({
                             thumbnailUrl,
                             fullUrl,
                             tinyPreview,
                             alt,
                         }: {
    thumbnailUrl: string
    fullUrl: string
    tinyPreview?: string | null
    alt: string
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
                className="relative max-h-60 w-full cursor-pointer overflow-hidden rounded-[10px]"
                onClick={() => setOpen(true)}
            >
                {tinyPreview && !thumbLoaded && (
                    <img
                        src={tinyPreview}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg"
                    />
                )}
                <img
                    src={thumbnailUrl || fullUrl}
                    alt={alt}
                    className={`max-h-60 w-full object-cover transition-opacity duration-300 ${
                        tinyPreview && !thumbLoaded ? 'opacity-0' : 'opacity-100'
                    }`}
                    loading="lazy"
                    onLoad={() => setThumbLoaded(true)}
                />
            </div>
            {open &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    >
                        <div className="absolute right-4 top-4 flex gap-2">
                            <a
                                href={withDownload(fullUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={alt}
                                onClick={(e) => e.stopPropagation()}
                                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </a>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <img
                            src={fullUrl}
                            alt={alt}
                            className="max-h-full max-w-full rounded-lg object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>,
                    document.body
                )}
        </>
    )
}

function AttachmentView({
                            message: m,
                            isMine,
                        }: {
    message: ChatMessage
    isMine: boolean
}) {
    const url = m.attachmentUrl ?? ''
    const type = m.mediaType ?? m.messageType

    if (type === 'IMAGE') {
        return (
            <ImageAttachment
                thumbnailUrl={m.attachmentThumbnailUrl ?? url}
                fullUrl={url}
                tinyPreview={m.attachmentTinyPreview}
                alt={m.fileName ?? 'image'}
            />
        )
    }

    if (type === 'VIDEO') {
        return (
            <video
                src={url}
                controls
                className="max-h-60 w-full rounded-[10px] object-cover"
                preload="metadata"
            />
        )
    }

    return (
        <div
            className={`mb-1 flex items-center gap-2 rounded-[8px] p-2 transition ${
                isMine ? 'bg-black/5' : 'bg-zinc-200/40 border border-zinc-200/50'
            }`}
        >
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2"
            >
                <div
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg ${
                        isMine ? 'bg-[#7cb342] text-white shadow-sm' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                    }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-zinc-800">
                        {m.fileName ?? 'File'}
                    </p>
                    {m.fileSize != null && (
                        <p className="text-[9px] text-zinc-400">
                            {formatFileSize(m.fileSize)}
                        </p>
                    )}
                </div>
            </a>
            <a
                href={withDownload(url)}
                target="_blank"
                rel="noopener noreferrer"
                download={m.fileName ?? undefined}
                className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md transition hover:bg-black/5"
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            </a>
        </div>
    )
}

// ── Call System Chip ──
function CallSystemChip({ content }: { content: string }) {
    let label = 'Call'
    let isMissed = false

    if (content.startsWith('CALL_ENDED')) {
        const parts = content.split(':')
        const dur = parts[1] ? parseInt(parts[1], 10) : 0
        label = dur > 0 ? `Video call · ${formatDuration(dur)}` : 'Video call'
    } else if (content.startsWith('CALL_DECLINED')) {
        label = 'Declined call'
        isMissed = true
    } else if (content.startsWith('CALL_MISSED')) {
        label = 'Missed call'
        isMissed = true
    }

    return (
        <div className="flex justify-center py-2 w-full">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-150 bg-zinc-50 px-3.5 py-1 text-[11px] font-medium text-zinc-500 shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isMissed ? '#ef4444' : 'currentColor'} strokeWidth="2.2">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                {label}
            </div>
        </div>
    )
}

function MenuItem({
                      label,
                      onClick,
                      danger,
                  }: {
    label: string
    onClick: () => void
    danger?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={`block w-full px-3.5 py-2 text-left text-xs font-medium transition hover:bg-zinc-50 ${
                danger ? 'text-red-600 hover:bg-red-50' : 'text-zinc-700'
            }`}
        >
            {label}
        </button>
    )
}