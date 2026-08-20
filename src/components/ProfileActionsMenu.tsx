// ProfileActionsMenu — Instagram uslubidagi menyular:
//   1) OtherUserMenu   — boshqa userning profilida, ism yonidagi
//      "3 nuqta" tugmasi. Bosilganda Block / Report chiqadi.
//   2) OwnSettingsMenu — o'z profilingizda "Settings" tugmasi.
//      Bosilganda Blocked / Reported / Edit profile chiqadi — har
//      biri alohida sahifaga olib boradi (popup emas).
//
// Ikkalasi ham tashqariga bosilganda yopiladi.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Ikonkalar (feather-uslubida, loyihadagi boshqa SVG'larga mos) ──

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function BlockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="3" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function BlockedListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  )
}

function ReportedListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="3" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z" />
    </svg>
  )
}

// Umumiy: tashqariga bosilganda menyuni yopadigan hook.
function useCloseOnOutsideClick(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])
  return ref
}

// ═════════════════════════════════════════════════════════════════
// 1) Boshqa userning profili — "3 nuqta" tugmasi
// ═════════════════════════════════════════════════════════════════
export function OtherUserMenu({
  blocked,
  onBlockClick,
  onReportClick,
}: {
  blocked: boolean
  onBlockClick: () => void
  onReportClick: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
      >
        <DotsIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-2xl border border-ink/8 bg-white py-1 shadow-xl">
          <button
            onClick={() => {
              setOpen(false)
              onBlockClick()
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-coral-700 transition hover:bg-coral-50"
          >
            <BlockIcon />
            {blocked ? 'Unblock' : 'Block'}
          </button>
          {!blocked && (
            <button
              onClick={() => {
                setOpen(false)
                onReportClick()
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-cream"
            >
              <FlagIcon />
              Report
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// 2) O'z profili — "Settings" tugmasi (Blocked / Reported / Edit
//    profile — har biri alohida sahifa)
// ═════════════════════════════════════════════════════════════════
export function OwnSettingsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutsideClick(open, () => setOpen(false))
  const navigate = useNavigate()

  const items: { label: string; icon: ReactNode; to: string }[] = [
    { label: 'Blocked', icon: <BlockedListIcon />, to: '/profile/blocked' },
    { label: 'Reported', icon: <ReportedListIcon />, to: '/profile/reported' },
    { label: 'Edit profile', icon: <EditIcon />, to: '/profile/edit' },
    { label: 'Settings', icon: <SettingsIcon />, to: '/settings' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3 py-1 text-xs font-medium text-ink transition hover:border-indigo-500/30 hover:bg-indigo-50"
      >
        <SettingsIcon />
        Settings
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-2xl border border-ink/8 bg-white py-1 shadow-xl">
          {items.map((item) => (
            <button
              key={item.to}
              onClick={() => {
                setOpen(false)
                navigate(item.to)
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-cream"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Block tasdiqlash modali — Instagram'даgi kabi kichik dialog
// ═════════════════════════════════════════════════════════════════
export function BlockConfirmModal({
  open,
  name,
  blocked,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean
  name: string
  blocked: boolean
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
        <div className="px-6 py-6">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-coral-50 text-coral-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M5.5 5.5l13 13" />
            </svg>
          </div>
          <h2 className="font-display text-base font-semibold text-ink">
            {blocked ? `Unblock ${name}?` : `Block ${name}?`}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {blocked
              ? "They will be able to see your profile and message you again."
              : "They won't be able to find your profile, posts or message you."}
          </p>
        </div>
        <div className="flex flex-col border-t border-ink/6">
          <button
            onClick={onConfirm}
            disabled={pending}
            className="px-4 py-3 text-sm font-semibold text-coral-700 transition hover:bg-coral-50 disabled:opacity-50"
          >
            {pending ? 'Please wait…' : blocked ? 'Unblock' : 'Block'}
          </button>
          <button
            onClick={onClose}
            disabled={pending}
            className="border-t border-ink/6 px-4 py-3 text-sm font-medium text-ink-soft transition hover:bg-cream disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
