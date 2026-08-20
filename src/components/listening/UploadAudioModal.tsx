// Upload audio modal — "Generate with AI" flow.
//
// Bu modal AI generation uchun: user FAQAT audio + transcript yuklaydi.
// Material yaratilgach session sahifasida "Generate questions with AI"
// tugmasi bilan savol yaratadi.
//
// Qoidalar (v3):
//   • Audio faqat: mp3, mpeg, mp4/m4a, wav, ogg
//   • Transcript: matn yozish, .txt yoki .pdf fayl
//   • PDF transcript client-side pdfjs bilan parse qilinadi
//   • Transcript MAJBURIY — usiz AI savol yarata olmaydi

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CERTS_BY_LANG,
  formatTime,
  LANG_OPTIONS,
  LEVELS,
  LEVEL_TINT,
  type CefrLevel,
  type ListeningMaterial,
} from '../../lib/listening'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (material: ListeningMaterial) => void
  defaultLanguage?: string
  // Foydalanuvchining o'z LEARNING tillari bilan cheklash uchun —
  // berilmasa (yoki bo'sh bo'lsa) to'liq LANG_OPTIONS ko'rsatiladi.
  allowedLangCodes?: string[]
}

const MAX_AUDIO_BYTES = 100 * 1024 * 1024 // 100 MB

// MUHIM: backenddagi ListeningServiceImpl.MAX_TRANSCRIPT_CHARS bilan
// bir xil qiymat — "butun kitob transkript sifatida yuklash"
// muammosining oldini serverga yubormasdan oldin olish uchun.
// Ikkala tomon ham sinxron turishi kerak.
const MAX_TRANSCRIPT_CHARS = 20_000

// Faqat shu formatlar (user talabi: mp3, mpeg, mp4, wav, ogg)
const AUDIO_EXTENSIONS = /\.(mp3|mpeg|mp4|m4a|wav|ogg)$/i
const AUDIO_MIME_OK = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'video/mp4', // ba'zi brauzerlar m4a ni video/mp4 deb ko'rsatadi
]

export default function UploadAudioModal({
  open,
  onClose,
  onCreated,
  defaultLanguage,
  allowedLangCodes,
}: Props) {
  const [title, setTitle] = useState('')
  const [languageCode, setLanguageCode] = useState(defaultLanguage ?? 'en')
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('B2')
  const [certificateType, setCertificateType] = useState('')
  // MUHIM TUZATISH: avval bu yerda to'liq LANG_OPTIONS ishlatilardi —
  // user o'zi o'rganmayotgan tilni ham tanlab audio yuklashi mumkin
  // edi. Endi faqat foydalanuvchining o'z learning tillari ko'rsatiladi
  // (allowedLangCodes bo'sh bo'lsa — to'liq ro'yxatga tushamiz).
  const langOptions = useMemo(
      () =>
          allowedLangCodes && allowedLangCodes.length > 0
              ? LANG_OPTIONS.filter((l) => allowedLangCodes.includes(l.code))
              : LANG_OPTIONS,
      [allowedLangCodes]
  )
  const [topic, setTopic] = useState('')

  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [pdfParsing, setPdfParsing] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Submit bosilganda, hali to'ldirilmagan majburiy maydonlarni
  // qizil bilan ko'rsatish uchun — foydalanuvchi biror narsa
  // o'zgartirguncha shu holat saqlanadi.
  const [attempted, setAttempted] = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setTitle('')
    setLanguageCode(defaultLanguage ?? 'en')
    setCefrLevel('B2')
    setCertificateType('')
    setTopic('')
    setAudioFile(null)
    setAudioDuration(null)
    setTranscriptText('')
    setError(null)
    setProgress(0)
    setUploading(false)
    setGenerating(false)
    setPdfParsing(false)
    setAttempted(false)
  }, [open, defaultLanguage])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading && !generating) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, uploading, generating, onClose])

  // Audio duration probe
  useEffect(() => {
    if (!audioFile) {
      setAudioDuration(null)
      return
    }
    const url = URL.createObjectURL(audioFile)
    const audio = new Audio()
    audio.src = url
    audio.preload = 'metadata'
    const onLoad = () => {
      setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : null)
    }
    audio.addEventListener('loadedmetadata', onLoad)
    return () => {
      audio.removeEventListener('loadedmetadata', onLoad)
      URL.revokeObjectURL(url)
    }
  }, [audioFile])

  // ── Audio validation ────────────────────────────────────────
  const handleAudioSelected = useCallback((f: File | null) => {
    setError(null)
    if (!f) {
      setAudioFile(null)
      return
    }
    if (f.size > MAX_AUDIO_BYTES) {
      setError('Audio must not exceed 100 MB.')
      return
    }
    // Qat'iy format tekshiruvi — faqat ruxsat berilgan formatlar
    const extOk = AUDIO_EXTENSIONS.test(f.name)
    const mimeOk = !f.type || AUDIO_MIME_OK.includes(f.type)
    if (!extOk || !mimeOk) {
      setError(
        `Only MP3, MPEG, MP4, WAV, OGG are accepted. Your file: ${f.name}`
      )
      return
    }
    setAudioFile(f)
  }, [])

  // ── Transcript file (txt yoki pdf) ──────────────────────────
  const handleTranscriptFile = useCallback(async (f: File) => {
    setError(null)
    if (f.size > 20 * 1024 * 1024) {
      setError('Transcript file is too large (must be under 20 MB).')
      return
    }

    const isPdf =
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    const isTxt = f.type.startsWith('text/') || f.name.toLowerCase().endsWith('.txt')

    if (isTxt) {
      const reader = new FileReader()
      reader.onload = () => setTranscriptText(String(reader.result ?? ''))
      reader.onerror = () => setError('Error reading the transcript.')
      reader.readAsText(f)
      return
    }

    if (isPdf) {
      setPdfParsing(true)
      try {
        const text = await extractPdfText(f)
        if (text.trim().length === 0) {
          setError(
            'No text found in this PDF — it may be a scanned image. Please upload a text-based PDF or a .txt file.'
          )
        } else {
          setTranscriptText(text)
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? `Error reading PDF: ${e.message}`
            : 'Could not read the PDF.'
        )
      } finally {
        setPdfParsing(false)
      }
      return
    }

    setError('Only .txt or .pdf files are accepted for the transcript.')
  }, [])

  // ── Submit ───────────────────────────────────────────────────
  const transcriptTooLong = transcriptText.trim().length > MAX_TRANSCRIPT_CHARS

  const canSubmit =
    title.trim().length > 0 &&
    languageCode &&
    cefrLevel &&
    !!audioFile &&
    transcriptText.trim().length > 0 &&
    !transcriptTooLong &&
    !uploading &&
    !generating &&
    !pdfParsing

  const submit = () => {
    if (!canSubmit || !audioFile) {
      // Majburiy maydonlar to'ldirilmagan — ularni qizil bilan
      // ko'rsatamiz va yubormaymiz.
      setAttempted(true)
      if (transcriptTooLong) {
        const approxWords = Math.round(transcriptText.trim().length / 6)
        setError(
          `Transcript juda uzun (~${approxWords} so'z, ${transcriptText.trim().length} belgi). ` +
            `Listening darsi uchun bitta audio-uzunlikdagi matn yuklang — butun kitob emas. ` +
            `Chegara: ${MAX_TRANSCRIPT_CHARS.toLocaleString('en-US')} belgigacha.`
        )
      }
      return
    }
    setUploading(true)
    setError(null)
    setProgress(0)

    const fd = new FormData()
    fd.append('audio', audioFile)
    fd.append(
      'transcript',
      new Blob([transcriptText], { type: 'text/plain' }),
      'transcript.txt'
    )
    fd.append('title', title.trim())
    fd.append('languageCode', languageCode)
    fd.append('cefrLevel', cefrLevel)
    if (certificateType) fd.append('certificateType', certificateType)
    if (topic.trim()) fd.append('topic', topic.trim())

    const xhr = new XMLHttpRequest()
    const base = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
    xhr.open('POST', `${base}/api/listening/materials/upload/singel`)

    const token = localStorage.getItem('jwt') ?? ''
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setError('Network error.')
    }
    xhr.onload = async () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        let material: ListeningMaterial
        try {
          material = JSON.parse(xhr.responseText) as ListeningMaterial
        } catch {
          setError('Invalid server response format.')
          return
        }

        // ── Bosqich 2: AI savol yaratish (10 ta variant: 5 Easy + 5
        // Hard) — backend audio uzunligiga qarab savollar sonini
        // o'zi hisoblaydi, "count" parametri endi kerak emas ────
        setGenerating(true)
        try {
          const genResp = await fetch(
            `${base}/api/listening/materials/${material.id}/generate-questions`,
            {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          )
          if (!genResp.ok) {
            // Material yaratildi, lekin AI ishlamadi — sessiyaga
            // baribir eltamiz, u yerda qayta urinish tugmasi bor.
            console.warn('AI generation failed:', genResp.status)
          }
        } catch {
          /* material bor, savolsiz sessiyaga o'tamiz */
        } finally {
          setGenerating(false)
          onCreated(material)
        }
      } else {
        // Backend xato javobi JSON ({"message": "..."}) formatida
        // keladi (GlobalExceptionHandler) — masalan transcript
        // uzunligi chegaradan oshganda aniq va foydali xabar shu
        // yerdan chiqadi. Avval xom JSON matn ko'rsatilardi.
        let message = `Upload error (${xhr.status})`
        try {
          const parsed = JSON.parse(xhr.responseText)
          if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
            message = parsed.message
          } else if (xhr.responseText) {
            message = xhr.responseText
          }
        } catch {
          if (xhr.responseText) message = xhr.responseText
        }
        setError(message)
      }
    }

    xhr.send(fd)
  }

  const availableCerts = CERTS_BY_LANG[languageCode] ?? ['GENERAL']

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={uploading || generating ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-ink/6 px-6 py-4">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
              Generate with AI
            </p>
            <h2 className="font-display text-lg font-semibold text-ink">
              Upload audio + transcript
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
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
            <strong>AI generates questions in this mode.</strong> Upload the
            audio and its full transcript — once the material is created, AI
            will prepare
            <strong> 10 variants</strong> from the transcript (5 Easy + 5 Hard),
            with the number of questions in each set automatically based on
            audio length (10–30). This takes about 1–2 minutes.
          </p>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Title */}
            <Field label="Title *" invalid={attempted && title.trim().length === 0}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="IELTS Practice Test 12 — Section 1"
                disabled={uploading}
                className={`${inputCls} ${
                  attempted && title.trim().length === 0 ? invalidCls : ''
                }`}
              />
              {attempted && title.trim().length === 0 && (
                <p className={errorTextCls}>This field is required.</p>
              )}
            </Field>

            {/* Language + Level */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Language *">
                <select
                  value={languageCode}
                  onChange={(e) => {
                    setLanguageCode(e.target.value)
                    setCertificateType('')
                  }}
                  disabled={uploading}
                  className={selectCls}
                >
                  {langOptions.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag}  {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Level *">
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l) => {
                    const active = cefrLevel === l
                    return (
                      <button
                        key={l}
                        type="button"
                        disabled={uploading}
                        onClick={() => setCefrLevel(l)}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                            : LEVEL_TINT[l]
                        }`}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* Cert + Topic */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Certificate">
                <select
                  value={certificateType}
                  onChange={(e) => setCertificateType(e.target.value)}
                  disabled={uploading}
                  className={selectCls}
                >
                  <option value="">— Any —</option>
                  {availableCerts.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Topic">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="university, travel…"
                  disabled={uploading}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Audio drop zone */}
            <Field label="Audio file *" invalid={attempted && !audioFile}>
              <AudioDropZone
                file={audioFile}
                duration={audioDuration}
                disabled={uploading}
                invalid={attempted && !audioFile}
                onFile={handleAudioSelected}
                onClear={() => {
                  setAudioFile(null)
                  setAudioDuration(null)
                }}
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                MP3, MPEG, MP4, WAV, OGG only — max 100 MB
              </p>
              {attempted && !audioFile && (
                <p className={errorTextCls}>Please choose an audio file.</p>
              )}
            </Field>

            {/* Transcript */}
            <Field
              label="Transcript * (AI generates questions from this text)"
              invalid={(attempted && transcriptText.trim().length === 0) || transcriptTooLong}
            >
              <TranscriptInput
                text={transcriptText}
                disabled={uploading || generating}
                parsing={pdfParsing}
                invalid={(attempted && transcriptText.trim().length === 0) || transcriptTooLong}
                maxChars={MAX_TRANSCRIPT_CHARS}
                onChange={setTranscriptText}
                onFile={handleTranscriptFile}
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                Type the text, or drop a <strong>.txt / .pdf</strong> file — one audio-length
                transcript, not a whole book.
              </p>
              {attempted && transcriptText.trim().length === 0 && (
                <p className={errorTextCls}>Transcript is required.</p>
              )}
              {transcriptTooLong && (
                <p className={errorTextCls}>
                  Transcript is too long — upload a passage matching your audio length, not a
                  whole book.
                </p>
              )}
            </Field>
          </div>
        </div>

        {/* Progress + error */}
        {uploading && (
          <div className="border-t border-ink/6 bg-cream/60 px-6 py-3">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink">Uploading…</span>
              <span className="font-mono text-ink-muted tabular-nums">
                {progress}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full bg-indigo-500 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
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
        {error && !uploading && !generating && (
          <div className="border-t border-coral-500/20 bg-coral-50 px-6 py-3 text-sm text-coral-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream/40 px-6 py-4">
          <button
            onClick={onClose}
            disabled={uploading || generating}
            className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={uploading || generating || pdfParsing}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading
              ? 'Uploading…'
              : generating
                ? 'AI is working…'
                : 'Upload material'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// PDF text extraction — pdfjs-dist lazy import
// ═════════════════════════════════════════════════════════════════
async function extractPdfText(file: File): Promise<string> {
  // pdfjs faqat kerak bo'lganda yuklanadi — bundle'ni katta qilmaslik uchun
  const pdfjs = await import('pdfjs-dist')
  // Worker sozlash — Vite uchun url import
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
    .default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise

  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ')
    parts.push(pageText)
  }
  return parts.join('\n\n').replace(/\s+\n/g, '\n').trim()
}

// ═════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════

const inputCls =
  'w-full rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60'

const selectCls =
  'w-full rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60'

// To'ldirilmagan majburiy maydon uchun — qizil chegara/fon
const invalidCls = '!border-coral-500 !ring-2 !ring-coral-500/15 bg-coral-50/40'
const errorTextCls = 'mt-1.5 text-xs font-medium text-coral-600'

function Field({
  label,
  invalid,
  children,
}: {
  label: string
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-xs font-medium ${invalid ? 'text-coral-600' : 'text-ink-soft'}`}>
        {label}
      </span>
      {children}
    </label>
  )
}

function AudioDropZone({
  file,
  duration,
  disabled,
  invalid,
  onFile,
  onClear,
}: {
  file: File | null
  duration: number | null
  disabled: boolean
  invalid?: boolean
  onFile: (f: File | null) => void
  onClear: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const size = useMemo(() => {
    if (!file) return null
    const mb = file.size / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`
  }, [file])

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-mint-500/30 bg-mint-50/60 p-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint-500 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-ink-muted">
            {size}
            {duration != null && ` · ${formatTime(duration)}`}
          </p>
        </div>
        {!disabled && (
          <button
            onClick={onClear}
            className="rounded-full p-1.5 text-ink-muted transition hover:bg-coral-50 hover:text-coral-600"
            title="Remove"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
        dragOver
          ? 'border-indigo-500 bg-indigo-50/60'
          : invalid
            ? 'border-coral-500 bg-coral-50/40'
            : 'border-ink/12 bg-cream/60 hover:border-indigo-500/40'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (disabled) return
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.mpeg,.mp4,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-indigo-500/10 text-indigo-500">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      </div>
      <p className="text-sm font-medium text-ink">
        Drag audio here, or <span className="text-indigo-600">browse</span>
      </p>
      <p className="mt-1 text-[11px] text-ink-muted">MP3 · MPEG · MP4 · WAV · OGG</p>
    </label>
  )
}

function TranscriptInput({
  text,
  disabled,
  parsing,
  invalid,
  maxChars,
  onChange,
  onFile,
}: {
  text: string
  disabled: boolean
  parsing: boolean
  invalid?: boolean
  // Belgilansa — hisoblagich chegaradan oshganda qizil rangda
  // ko'rsatiladi.
  maxChars?: number
  onChange: (v: string) => void
  onFile: (f: File) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      className={`relative rounded-2xl border transition ${
        dragOver
          ? 'border-indigo-500 bg-indigo-50/40'
          : invalid
            ? 'border-coral-500 bg-coral-50/30'
            : 'border-ink/12 bg-white'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled && !parsing) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (disabled || parsing) return
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste transcript here, or drop a .txt / .pdf file…"
        rows={5}
        disabled={disabled || parsing}
        className="w-full resize-none rounded-2xl bg-transparent p-3 text-sm text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
      />
      {parsing && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/80">
          <p className="text-xs font-medium text-indigo-600">
            Reading PDF…
          </p>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-ink/6 px-3 py-1.5 text-xs text-ink-muted">
        <span
          className={
            typeof maxChars === 'number' && text.trim().length > maxChars
              ? 'font-medium text-coral-600'
              : undefined
          }
        >
          {text.length.toLocaleString('en-US')} characters
          {typeof maxChars === 'number' ? ` / ${maxChars.toLocaleString('en-US')} max` : ''}
        </span>
        {text.length > 0 && !disabled && (
          <button onClick={() => onChange('')} className="hover:text-ink">
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
