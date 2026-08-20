// Xabar yozish paneli — input, attachment picker, voice recorder,
// reply/edit preview.

import { useEffect, useRef, useState } from 'react'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import {
  detectMediaType,
  formatDuration,
  uploadChatAttachment,
} from '../../lib/chatApi'
import type { ChatMessage } from '../../lib/chatTypes'

interface Props {
  peerId: string
  replyTo: ChatMessage | null
  editing: ChatMessage | null
  onCancelReply: () => void
  onCancelEdit: () => void
  onSendText: (text: string) => void
  onSendAttachment: (
    attachmentId: string,
    caption: string,
    localPreview: Partial<ChatMessage>
  ) => void
  onTyping: () => void
}

export default function MessageComposer({
  peerId,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSendText,
  onSendAttachment,
  onTyping,
}: Props) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)

  // ── Yuklash paytida tasodifiy refresh'дан himoya ──
  // MUHIM: agar rasm/audio hali serverga yuklanayotganda foydalanuvchi
  // sahifani yangilasa (F5) — brauzer joriy so'rovni "tashlab ketadi",
  // lekin agar so'rov ALLAQACHON serverga yetib borgan bo'lsa, server
  // ishlov berishni davom ettirib, baribir muvaffaqiyatli saqlaydi.
  // Foydalanuvchi esa hech narsa ko'rmagani uchun QAYTA yuklaydi —
  // natijada bir xil fayl serverda ikki (yoki undan ko'p) marta
  // saqlanib qoladi.  Shu sababli yuklash paytida brauzer standart
  // "Are you sure you want to leave?" ogohlantirishini ko'rsatamiz.
  useEffect(() => {
    if (!uploading) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploading])
  const [uploadPct, setUploadPct] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Emoji picker ──
  const [showEmoji, setShowEmoji] = useState(false)
  const emojiPanelRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  // Tashqariga bosilganda picker'ni yopamiz
  useEffect(() => {
    if (!showEmoji) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        emojiPanelRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target)
      ) {
        return
      }
      setShowEmoji(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showEmoji])

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const el = inputRef.current
    if (el) {
      const start = el.selectionStart ?? text.length
      const end = el.selectionEnd ?? text.length
      const next = text.slice(0, start) + emojiData.emoji + text.slice(end)
      setText(next)
      // Kursorni qo'shilgan emoji'dan keyin qo'yish
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + emojiData.emoji.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      setText((t) => t + emojiData.emoji)
    }
    onTyping()
  }

  // Edit rejimida input'ni to'ldiramiz
  useEffect(() => {
    if (editing) {
      setText(editing.content)
      inputRef.current?.focus()
    }
  }, [editing])

  const submit = () => {
    if (text.trim()) {
      onSendText(text)
      setText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // ── Fayl tanlash ──
  const handleFilePicked = async (file: File) => {
    if (!file) return
    setUploading(true)
    setUploadPct(0)
    try {
      const mediaType = detectMediaType(file)
      const result = await uploadChatAttachment(
        file,
        mediaType,
        undefined,
        setUploadPct
      )
      // Optimistik preview uchun local URL
      const localUrl = URL.createObjectURL(file)
      onSendAttachment(result.attachmentId, text.trim(), {
        messageType:
          mediaType === 'IMAGE'
            ? 'IMAGE'
            : mediaType === 'VIDEO'
              ? 'VIDEO'
              : mediaType === 'AUDIO'
                ? 'AUDIO'
                : 'FILE',
        mediaType,
        attachmentUrl: result.url || localUrl,
        // Server thumbnail generatsiya qilib ulgurmagan bo'lsa ham,
        // lokal preview (localUrl) bilan darhol ko'rsatiladi.
        attachmentThumbnailUrl: result.thumbnailUrl || localUrl,
        attachmentTinyPreview: result.tinyPreview || null,
        fileName: result.fileName,
        fileSize: result.size,
        mimeType: result.contentType,
      })
      setText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload error')
    } finally {
      setUploading(false)
      setUploadPct(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Voice recorder ──
  const {
    recording,
    seconds: recSeconds,
    start: startRec,
    stop: stopRec,
    cancel: cancelRec,
  } = useVoiceRecorder(async (blob, duration) => {
    setUploading(true)
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, {
        type: 'audio/webm',
      })
      const result = await uploadChatAttachment(
        file,
        'VOICE',
        duration,
        setUploadPct
      )
      onSendAttachment(result.attachmentId, '', {
        messageType: 'AUDIO',
        mediaType: 'VOICE',
        attachmentUrl: result.url,
        durationSeconds: Math.round(duration),
        fileName: 'Voice message',
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Voice message not sent')
    } finally {
      setUploading(false)
      setUploadPct(0)
    }
  })

  const hasText = text.trim().length > 0

  return (
    <div className="flex-shrink-0 border-t border-ink/8 bg-white">
      {/* Reply / Edit preview */}
      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-b border-ink/6 px-4 py-2">
          <div className="h-8 w-1 rounded-full bg-indigo-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-indigo-600">
              {editing ? 'Editing' : 'Replying to'}
            </p>
            <p className="truncate text-xs text-ink-soft">
              {(editing ?? replyTo)?.content || 'attachment'}
            </p>
          </div>
          <button
            onClick={editing ? onCancelEdit : onCancelReply}
            className="rounded-full p-1 text-ink-muted transition hover:bg-cream hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="px-4 pt-2">
          <div className="h-1 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full bg-indigo-500 transition-[width]"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Recording holati */}
      {recording ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-coral-500" />
          <span className="flex-1 font-mono text-sm text-ink tabular-nums">
            {formatDuration(recSeconds)}
          </span>
          <button
            onClick={cancelRec}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-coral-600 transition hover:bg-coral-50"
          >
            Cancel
          </button>
          <button
            onClick={stopRec}
            className="grid h-10 w-10 place-items-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600"
            title="Send voice"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Attachment */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFilePicked(f)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-cream disabled:opacity-40"
            title="Attach file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Emoji tugmasi */}
          <div className="relative flex-shrink-0">
            <button
              ref={emojiButtonRef}
              onClick={() => setShowEmoji((s) => !s)}
              disabled={uploading}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:bg-cream disabled:opacity-40"
              title="Emoji"
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>

            {showEmoji && (
              <div
                ref={emojiPanelRef}
                className="absolute bottom-12 left-0 z-20 shadow-xl"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.LIGHT}
                  autoFocusSearch={false}
                  height={380}
                  width={320}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              onTyping()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-ink/12 bg-cream px-4 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
          />

          {/* Send YOKI voice */}
          {hasText ? (
            <button
              onClick={submit}
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600"
              title="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          ) : (
            <button
              onMouseDown={startRec}
              onMouseUp={stopRec}
              onMouseLeave={() => recording && stopRec()}
              onTouchStart={startRec}
              onTouchEnd={stopRec}
              disabled={uploading}
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-cream disabled:opacity-40"
              title="Hold to record"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Voice recorder hook (MediaRecorder, hold-to-record) ──
function useVoiceRecorder(
  onComplete: (blob: Blob, durationSeconds: number) => void
) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const cancelledRef = useRef(false)

  const start = async () => {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      cancelledRef.current = false

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (!cancelledRef.current && duration >= 1) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          onComplete(blob, duration)
        }
      }

      recorderRef.current = recorder
      recorder.start()
      startTimeRef.current = Date.now()
      setRecording(true)
      setSeconds(0)
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1)
      }, 1000)
    } catch {
      alert('Microphone access is required')
    }
  }

  const stop = () => {
    if (!recording) return
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stop()
    setRecording(false)
  }

  const cancel = () => {
    cancelledRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stop()
    setRecording(false)
    setSeconds(0)
  }

  return { recording, seconds, start, stop, cancel }
}
