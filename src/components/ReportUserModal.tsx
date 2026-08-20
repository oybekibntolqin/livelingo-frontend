// ReportUserModal — sababni tanlab, ixtiyoriy izoh bilan foydalanuvchini
// shikoyat qilish. Yuborilgach qaytarib bo'lmaydi (backend ham buni
// tekshiradi — bitta userga bir marta report mumkin).

import { useState } from 'react'
import { reportApi, REPORT_REASONS, type ReportReason } from '../lib/reportApi'

export default function ReportUserModal({
  open,
  name,
  userId,
  onClose,
  onReported,
}: {
  open: boolean
  name: string
  userId: string
  onClose: () => void
  onReported: () => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Submit bosilganda, reason tanlanmagan bo'lsa — qizil bilan
  // ko'rsatish uchun.
  const [attempted, setAttempted] = useState(false)

  if (!open) return null

  const close = () => {
    if (submitting) return
    setReason(null)
    setDescription('')
    setError(null)
    setDone(false)
    setAttempted(false)
    onClose()
  }

  const submit = async () => {
    if (!reason) {
      setAttempted(true)
      return
    }
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await reportApi.reportUser(userId, { reason, description: description.trim() || undefined })
      setDone(true)
      onReported()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuborilmadi. Qayta urinib ko'ring.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/6 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink">
            {done ? 'Reported' : `Report ${name}`}
          </h2>
          <button
            onClick={close}
            className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-ink-soft">
              Thanks — your report has been submitted. You can view it under Reported in your profile settings.
            </p>
            <button onClick={close} className="btn-primary mt-5">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-[55vh] space-y-1 overflow-y-auto px-3 py-3">
              {attempted && !reason && (
                <p className="mb-1.5 px-3 text-xs font-medium text-coral-600">
                  Please select a reason.
                </p>
              )}
              <div
                className={
                  attempted && !reason
                    ? 'space-y-1 rounded-2xl border border-coral-500/40 bg-coral-50/30 p-1'
                    : 'space-y-1'
                }
              >
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setReason(r.value)
                      setAttempted(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      reason === r.value ? 'bg-indigo-50 text-indigo-700' : 'text-ink hover:bg-cream'
                    }`}
                  >
                    {r.label}
                    {reason === r.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              <div className="px-3 pt-2 pb-1">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Details (optional)</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={submitting}
                    placeholder="Tell us more…"
                    className="resize-none rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                  />
                </label>
              </div>

              {error && <p className="px-3 text-sm text-coral-700">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream/40 px-6 py-4">
              <button
                onClick={close}
                disabled={submitting}
                className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
