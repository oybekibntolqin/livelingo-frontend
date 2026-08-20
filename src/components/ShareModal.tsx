// ShareModal — Instagram uslubidagi share sheet.
//
// YANGILANDI: endi bir nechta userni TANLASH mumkin (checkmark bilan
// belgilanadi), pastda ixtiyoriy xabar yozish maydoni va "Send"
// tugmasi bor — bosilganda BARCHA tanlangan userlarga bir vaqtda
// yuboriladi (avvalgidek bitta bosishda darhol yuborilmaydi).
//
// MUHIM: hech qanday R2 xom URL yoki fayl ID'si tashqariga
// chiqmaydi.  Faqat bizning ilovamizning o'z sahifasiga (
// /posts/{postId}) ishora qiluvchi link ulashiladi.

import { useEffect, useMemo, useState } from 'react'
import { chatApi } from '../lib/chatApi'
import { chatSocket } from '../lib/chatSocket'
import { getPostShareUrl } from '../lib/postApi'
import type { ChatListItem } from '../lib/chatTypes'

export default function ShareModal({
  open,
  postId,
  postPreview,
  onClose,
}: {
  open: boolean
  postId: string
  postPreview: string
  onClose: () => void
}) {
  const [conversations, setConversations] = useState<ChatListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = getPostShareUrl(postId)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(new Set())
    setMessage('')
    setSending(false)
    setSent(false)
    setCopied(false)
    setLoading(true)
    chatApi
      .list()
      .then(({ chats }) => setConversations(chats))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    )
  }, [conversations, query])

  if (!open) return null

  const toggleSelect = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleSend = () => {
    if (selected.size === 0) return
    setSending(true)

    const text = `${message.trim() ? message.trim() + '\n\n' : ''}${postPreview ? postPreview + '\n\n' : ''}${shareUrl}`

    selected.forEach((userId) => {
      const tempId = `temp-${crypto.randomUUID()}`
      chatSocket.send({
        type: 'CHAT',
        to: userId,
        content: text,
        tempId,
      })
    })

    setSent(true)
    window.setTimeout(() => {
      onClose()
    }, 900)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // jim — ba'zi brauzerlarda clipboard ruxsati bo'lmasligi mumkin
    }
  }

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`${postPreview}\n\n${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareToTelegram = () => {
    const url = encodeURIComponent(shareUrl)
    const text = encodeURIComponent(postPreview)
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank')
  }

  const shareToEmail = () => {
    const subject = encodeURIComponent('LiveLingo — post')
    const body = encodeURIComponent(`${postPreview}\n\n${shareUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={sending ? undefined : onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/6 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink">Share</h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ichki qidiruv */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-ink/10 bg-cream px-4 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-muted">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              disabled={sending}
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Suhbatlar — bir nechtasini tanlash mumkin (checkmark bilan) */}
        <div className="max-h-56 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-ink-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">
              {conversations.length === 0 ? "Hali suhbatlaringiz yo'q" : 'Topilmadi'}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {filtered.map((c) => {
                const name = `${c.firstName} ${c.lastName}`.trim()
                const isSelected = selected.has(c.userId)
                return (
                  <button
                    key={c.userId}
                    onClick={() => toggleSelect(c.userId)}
                    disabled={sending}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition disabled:opacity-50 ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-cream'
                    }`}
                  >
                    <div className="relative">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-sm font-semibold text-white">
                        {(name[0] ?? 'U').toUpperCase()}
                      </div>
                      {isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-indigo-500 text-white">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-1 w-full text-[11px] text-ink-soft">{name}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Tanlangan bo'lsa — xabar yozish + Send tugmasi (Instagram uslubida) */}
        {selected.size > 0 && (
          <div className="border-t border-ink/8 px-5 py-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a message…"
              disabled={sending}
              className="mb-3 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full rounded-2xl bg-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
            >
              {sent ? 'Sent ✓' : sending ? 'Sending…' : `Send${selected.size > 1 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        )}

        {/* Tashqi ulashish variantlari */}
        <div className="grid grid-cols-4 gap-3 border-t border-ink/8 px-5 py-4">
          <ShareButton
            label={copied ? 'Copied!' : 'Copy link'}
            onClick={copyLink}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.07 0l-2.83 2.83a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            }
          />
          <ShareButton
            label="WhatsApp"
            onClick={shareToWhatsApp}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.6 6.32A8.86 8.86 0 0012 4a8.94 8.94 0 00-7.75 13.4L3 21l3.7-1.22A8.94 8.94 0 0012 21a8.94 8.94 0 006.32-15.28l-.72.6zM12 19.4a7.4 7.4 0 01-3.78-1.04l-.27-.16-2.8.92.94-2.72-.18-.28A7.42 7.42 0 1119.4 12 7.44 7.44 0 0112 19.4zm4.07-5.56c-.22-.11-1.3-.64-1.5-.71s-.35-.11-.5.11-.57.71-.7.86-.26.16-.48.05a6.1 6.1 0 01-1.79-1.1 6.7 6.7 0 01-1.24-1.54c-.13-.22 0-.34.1-.45s.22-.26.33-.38a1.5 1.5 0 00.22-.37.4.4 0 000-.39c0-.11-.5-1.2-.68-1.64s-.36-.38-.5-.38h-.43a.82.82 0 00-.6.28 2.5 2.5 0 00-.78 1.86 4.34 4.34 0 00.91 2.3 9.94 9.94 0 003.8 3.36c.53.23.94.36 1.26.47a3 3 0 001.4.09 2.3 2.3 0 001.5-1.06 1.87 1.87 0 00.13-1.06c-.06-.1-.2-.16-.4-.26z" />
              </svg>
            }
          />
          <ShareButton
            label="Telegram"
            onClick={shareToTelegram}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 4.01L2.6 11.4c-1.28.5-1.27 1.2-.23 1.52l4.92 1.54 1.9 5.86c.24.6.12.84.75.84.48 0 .7-.22 1-.5l2.36-2.3 4.9 3.63c.9.5 1.55.24 1.77-.83l3.2-15.1c.32-1.3-.5-1.9-1.3-1.55z" />
              </svg>
            }
          />
          <ShareButton
            label="Email"
            onClick={shareToEmail}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  )
}

function ShareButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 text-center transition hover:opacity-70"
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-cream text-ink">
        {icon}
      </div>
      <p className="text-[11px] text-ink-soft">{label}</p>
    </button>
  )
}
