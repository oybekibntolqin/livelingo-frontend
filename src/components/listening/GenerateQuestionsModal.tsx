// Generate questions modal — Upload modal bilan BIR XIL dizayn.
//
// Session sahifasida "Generate questions with AI" bosilganda ochiladi.
// Material allaqachon mavjud — shuning uchun maydonlar avtomatik
// to'ldirilgan (o'zgartirib bo'lmaydi), transkript backend'dan yuklanib
// preview ko'rsatiladi, foydalanuvchi faqat SAVOLLAR SONI'ni tanlaydi.
//
// Ko'rinish (upload modal bilan bir xil):
//   ┌────────────────────────────────────┐
//   │ GENERATE WITH AI                 ✕ │
//   │ Savol yaratish                     │
//   ├────────────────────────────────────┤
//   │ ℹ Bu rejimda AI savol yaratadi...  │
//   ├────────────────────────────────────┤
//   │ Title *        [material.title]    │
//   │ Language *     Level *             │
//   │ Certificate    Topic               │
//   │ Transcript ✓   [preview...]        │
//   │ Savollar soni * [10 ta savol ▼]    │
//   ├────────────────────────────────────┤
//   │              [Cancel] [Generate]   │
//   └────────────────────────────────────┘

import { useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api'
import {
  LANG_OPTIONS,
  LEVELS,
  LEVEL_TINT,
  type ListeningMaterial,
} from '../../lib/listening'

interface Props {
  open: boolean
  material: ListeningMaterial
  onClose: () => void
  /** Muvaffaqiyatli generatsiyadan keyin — ro'yxatni yangilash */
  onGenerated: () => void
}

export default function GenerateQuestionsModal({
  open,
  material,
  onClose,
  onGenerated,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Transcript holati — mavjudligini tekshirish va preview
  const [transcript, setTranscript] = useState<string | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [transcriptMissing, setTranscriptMissing] = useState(false)

  // Reset + transcript'ni yuklash
  useEffect(() => {
    if (!open) return
    setGenerating(false)
    setError(null)
    setTranscript(null)
    setTranscriptMissing(false)

    let cancelled = false
    setTranscriptLoading(true)
    api
      .get<string | { transcript?: string }>(
        `/api/listening/materials/${material.id}/transcript`
      )
      .then((t) => {
        if (cancelled) return
        const text =
          typeof t === 'string'
            ? t
            : typeof t === 'object' && t !== null
              ? (t.transcript ?? '')
              : ''
        setTranscript(text)
        setTranscriptMissing(text.trim().length === 0)
      })
      .catch((err) => {
        if (cancelled) return
        setTranscriptMissing(true)
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(
            err instanceof Error ? err.message : 'Could not check transcript.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setTranscriptLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, material.id])

  // Escape closes (generatsiya paytida emas)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generating) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, generating, onClose])

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await api.post(
        `/api/listening/materials/${material.id}/generate-questions`,
        {}
      )
      onGenerated()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI could not generate questions.'
      setError(
        msg.includes('403')
          ? "Not authorized (403). The generate-questions endpoint may not be open in the backend SecurityConfig."
          : msg
      )
    } finally {
      setGenerating(false)
    }
  }

  const langInfo = LANG_OPTIONS.find((l) => l.code === material.languageCode)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={generating ? undefined : onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-ink/6 px-6 py-4">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
              Generate with AI
            </p>
            <h2 className="font-display text-lg font-semibold text-ink">
              Generate Questions
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-full p-2 text-ink-muted transition hover:bg-cream hover:text-ink disabled:opacity-50"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info banner */}
        <div className="border-b border-indigo-500/15 bg-indigo-50/70 px-6 py-3">
          <p className="text-xs leading-relaxed text-indigo-800">
            <strong>AI generates questions in this mode.</strong> From the
            material's transcript below, <strong>10 variants</strong> (5 Easy
            + 5 Hard) will be created — a mix of Task 1 (Short Answer), Task 2
            (Multiple Choice), Task 3 (True/False). This takes about 1–2 minutes.
          </p>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Title — readonly */}
            <Field label="Title *">
              <input
                type="text"
                value={material.title}
                readOnly
                className={`${inputCls} bg-cream/60 text-ink-soft`}
              />
            </Field>

            {/* Language + Level — readonly */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Language *">
                <div className={`${inputCls} bg-cream/60 text-ink-soft`}>
                  {langInfo ? `${langInfo.flag}  ${langInfo.name}` : material.languageCode}
                </div>
              </Field>
              <Field label="Level *">
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l) => {
                    const active = material.cefrLevel === l
                    return (
                      <span
                        key={l}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                          active
                            ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                            : `${LEVEL_TINT[l]} opacity-40`
                        }`}
                      >
                        {l}
                      </span>
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* Cert + Topic — readonly */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Certificate">
                <div className={`${inputCls} bg-cream/60 text-ink-soft`}>
                  {material.certificateType
                    ? material.certificateType.replace(/_/g, ' ')
                    : '— Any —'}
                </div>
              </Field>
              <Field label="Topic">
                <div className={`${inputCls} bg-cream/60 text-ink-soft`}>
                  {material.topic || '—'}
                </div>
              </Field>
            </div>

            {/* Transcript holati + preview */}
            <Field label="Transcript *">
              {transcriptLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-ink/8 bg-cream/60 px-4 py-3">
                  <svg className="animate-spin text-indigo-500" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs text-ink-muted">
                    Checking transcript…
                  </span>
                </div>
              ) : transcriptMissing ? (
                <div className="rounded-2xl border border-coral-500/25 bg-coral-50 px-4 py-3">
                  <p className="text-xs font-medium text-coral-700">
                    ⚠ This material has no transcript — AI cannot generate questions.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-mint-500/25 bg-mint-50/50 p-3">
                  <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-mint-700">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Transcript available · {transcript?.length ?? 0} characters
                  </p>
                  <p className="line-clamp-3 text-xs leading-relaxed text-ink-soft">
                    {transcript?.slice(0, 220)}
                    {(transcript?.length ?? 0) > 220 && '…'}
                  </p>
                </div>
              )}
            </Field>
          </div>
        </div>

        {/* Generating banner */}
        {generating && (
          <div className="flex items-center gap-2.5 border-t border-indigo-500/15 bg-indigo-50 px-6 py-3">
            <svg className="animate-spin text-indigo-600" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium text-indigo-700">
              AI is preparing 10 variants (Easy + Hard)… please wait ~1–2 minutes
            </p>
          </div>
        )}
        {error && !generating && (
          <div className="border-t border-coral-500/20 bg-coral-50 px-6 py-3 text-sm text-coral-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream/40 px-6 py-4">
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={generating || transcriptLoading || transcriptMissing}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating
              ? 'AI is working…'
              : 'Generate 10 variants'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
const inputCls =
  'w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none transition'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
