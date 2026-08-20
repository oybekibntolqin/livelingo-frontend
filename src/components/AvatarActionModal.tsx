// AvatarActionModal — avatar bosilganda chiqadigan action-sheet.
//
// Rasm yo'q bo'lsa: faqat "Upload photo"
// Rasm bor bo'lsa: "Update photo" + "Remove current photo"
// Har doim: "Cancel"

import { useRef, useState } from 'react'
import { profileApi, type UserProfile } from '../lib/profileApi'

export default function AvatarActionModal({
  open,
  hasPhoto,
  onClose,
  onSaved,
}: {
  open: boolean
  hasPhoto: boolean
  onClose: () => void
  onSaved: (updated: UserProfile) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!open) return null

  const handleFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const updated = await profileApi.uploadProfilePhoto(file)
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasm yuklanmadi.")
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      const updated = await profileApi.deleteProfilePhoto()
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirilmadi.")
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-xs overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="px-5 py-4 text-center">
          <p className="font-display text-base font-semibold text-ink">Change profile photo</p>
          {error && <p className="mt-2 text-xs text-coral-700">{error}</p>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="block w-full border-t border-ink/8 px-5 py-3.5 text-sm font-semibold text-indigo-600 transition hover:bg-cream disabled:opacity-50"
        >
          {busy ? 'Uploading…' : hasPhoto ? 'Update photo' : 'Upload photo'}
        </button>

        {hasPhoto && (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="block w-full border-t border-ink/8 px-5 py-3.5 text-sm font-semibold text-coral-600 transition hover:bg-coral-50 disabled:opacity-50"
          >
            Remove current photo
          </button>
        )}

        <button
          onClick={onClose}
          disabled={busy}
          className="block w-full border-t border-ink/8 px-5 py-3.5 text-sm font-medium text-ink-soft transition hover:bg-cream disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
