// Upload with questions modal — user O'Z savollari bilan flow.
//
// Bu modal user o'zining tayyor savol materiallari (kursdan olingan
// PDF yoki matn) bilan ishlashi uchun:
//   • Audio (majburiy) — mp3/mpeg/mp4/wav/ogg
//   • Savollar fayli (majburiy) — PDF yoki TXT
//   • To'liq transkript (MAJBURIY!) — matn, .txt yoki .pdf
//
// OGOHLANTIRISH ko'rsatiladi: transkriptsiz user javoblarini tekshirib
// bo'lmaydi.  AI user savollarini transkript bilan taqqoslab to'g'ri
// javoblarni aniqlaydi va tekshiradi.
//
// Backend hozircha questions faylni parse qilish endpoint'iga ega emas —
// shu modal fayllarni FormData bilan yangi endpoint'ga jo'natadi:
//   POST /api/listening/materials/upload-with-questions
// (Backend keyingi bosqichda yoziladi — user "avval frontend" dedi.)

import {useCallback, useEffect, useMemo, useState} from 'react'
import {
    type CefrLevel,
    CERTS_BY_LANG,
    formatTime,
    LANG_OPTIONS,
    LEVEL_TINT,
    LEVELS,
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

const MAX_AUDIO_BYTES = 100 * 1024 * 1024
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
    'video/mp4',
]

// MUHIM: backenddagi ListeningServiceImpl.MAX_TRANSCRIPT_CHARS bilan
// bir xil qiymat — "butun kitob transkript sifatida yuklash"
// muammosining oldini serverga yubormasdan oldin olish uchun.
// Ikkala tomon ham sinxron turishi kerak.
const MAX_TRANSCRIPT_CHARS = 20_000

export default function UploadWithQuestionsModal({
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
    // MUHIM TUZATISH: avval to'liq LANG_OPTIONS ishlatilardi — user
    // o'zi o'rganmayotgan tilni ham tanlashi mumkin edi.
    const langOptions = useMemo(
        () =>
            allowedLangCodes && allowedLangCodes.length > 0
                ? LANG_OPTIONS.filter((l) => allowedLangCodes.includes(l.code))
                : LANG_OPTIONS,
        [allowedLangCodes]
    )

    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [audioDuration, setAudioDuration] = useState<number | null>(null)
    const [questionsFile, setQuestionsFile] = useState<File | null>(null)
    const [transcriptText, setTranscriptText] = useState('')
    const [pdfParsing, setPdfParsing] = useState(false)

    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    // Submit bosilganda hali to'ldirilmagan majburiy maydonlarni
    // qizil bilan ko'rsatish uchun.
    const [attempted, setAttempted] = useState(false)

    useEffect(() => {
        if (!open) return
        setTitle('')
        setLanguageCode(defaultLanguage ?? 'en')
        setCefrLevel('B2')
        setCertificateType('')
        setAudioFile(null)
        setAudioDuration(null)
        setQuestionsFile(null)
        setTranscriptText('')
        setError(null)
        setProgress(0)
        setUploading(false)
        setPdfParsing(false)
        setAttempted(false)
    }, [open, defaultLanguage])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !uploading) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, uploading, onClose])

    // Duration probe
    useEffect(() => {
        if (!audioFile) {
            setAudioDuration(null)
            return
        }
        const url = URL.createObjectURL(audioFile)
        const audio = new Audio()
        audio.src = url
        audio.preload = 'metadata'
        const onLoad = () =>
            setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : null)
        audio.addEventListener('loadedmetadata', onLoad)
        return () => {
            audio.removeEventListener('loadedmetadata', onLoad)
            URL.revokeObjectURL(url)
        }
    }, [audioFile])

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
        const extOk = AUDIO_EXTENSIONS.test(f.name)
        const mimeOk = !f.type || AUDIO_MIME_OK.includes(f.type)
        if (!extOk || !mimeOk) {
            setError(`MP3, MPEG, MP4, WAV, OGG only. Your file: ${f.name}`)
            return
        }
        setAudioFile(f)
    }, [])

    const handleQuestionsFile = useCallback((f: File | null) => {
        setError(null)
        if (!f) {
            setQuestionsFile(null)
            return
        }
        const isPdf =
            f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        const isTxt =
            f.type.startsWith('text/') || f.name.toLowerCase().endsWith('.txt')
        if (!isPdf && !isTxt) {
            setError('The questions file must be in PDF or TXT format only.')
            return
        }
        if (f.size > 20 * 1024 * 1024) {
            setError('The questions file must be under 20 MB.')
            return
        }
        setQuestionsFile(f)
    }, [])

    const handleTranscriptFile = useCallback(async (f: File) => {
        setError(null)
        if (f.size > 20 * 1024 * 1024) {
            setError('The transcript file must be under 20 MB.')
            return
        }
        const isPdf =
            f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        const isTxt =
            f.type.startsWith('text/') || f.name.toLowerCase().endsWith('.txt')

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
                        "No text found in this PDF — it may be a scanned image. Please upload a text-based PDF or a .txt file."
                    )
                } else {
                    setTranscriptText(text)
                }
            } catch (e) {
                setError(
                    e instanceof Error ? `Error reading PDF: ${e.message}` : 'Could not read the PDF.'
                )
            } finally {
                setPdfParsing(false)
            }
            return
        }
        setError('Only .txt or .pdf are accepted for the transcript.')
    }, [])

    // Transcript juda uzun bo'lsa (masalan foydalanuvchi butun bir
    // kitob/roman transkriptini joylashtirsa) — serverga yubormasdan
    // oldin shu yerda to'xtatamiz.
    const transcriptTooLong = transcriptText.trim().length > MAX_TRANSCRIPT_CHARS

    const canSubmit =
        title.trim().length > 0 &&
        languageCode &&
        cefrLevel &&
        !!audioFile &&
        !!questionsFile &&
        transcriptText.trim().length > 0 &&
        !transcriptTooLong &&
        !uploading &&
        !pdfParsing

    const submit = () => {
        if (!canSubmit || !audioFile || !questionsFile) {
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
        fd.append('questions', questionsFile)
        fd.append(
            'transcript',
            new Blob([transcriptText], {type: 'text/plain'}),
            'transcript.txt'
        )
        fd.append('title', title.trim())
        fd.append('languageCode', languageCode)
        fd.append('cefrLevel', cefrLevel)
        if (certificateType) fd.append('certificateType', certificateType)

        const xhr = new XMLHttpRequest()
        const base = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
        // Yangi endpoint — backend keyingi bosqichda yoziladi
        xhr.open('POST', `${base}/api/listening/materials/upload-with-questions`)

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
        xhr.onload = () => {
            setUploading(false)
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const material = JSON.parse(xhr.responseText) as ListeningMaterial
                    onCreated(material)
                } catch {
                    setError('Invalid server response format.')
                }
            } else if (xhr.status === 404) {
                setError(
                    'This feature is not ready on the backend yet — it will be available in a future update.'
                )
            } else {
                // Backend xato javobi JSON ({"message": "..."}) formatida
                // keladi (GlobalExceptionHandler) — masalan transcript/
                // savollar hujjati uzunligi chegaradan oshganda aniq va
                // foydali xabar shu yerdan chiqadi.
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
                onClick={uploading ? undefined : onClose}
            />

            <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-ink/6 px-6 py-4">
                    <div>
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                            Upload — with your questions
                        </p>
                        <h2 className="font-display text-lg font-semibold text-ink">
                            Audio + Questions + Transcript
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="rounded-full p-2 text-ink-muted transition hover:bg-cream hover:text-ink disabled:opacity-50"
                        aria-label="Close"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* ⚠️ OGOHLANTIRISH banner */}
                <div className="border-b border-amber-400/30 bg-amber-50 px-6 py-3">
                    <div className="flex items-start gap-2.5">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mt-0.5 flex-shrink-0 text-amber-600"
                        >
                            <path
                                d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <p className="text-xs leading-relaxed text-amber-900">
                            <strong>Important:</strong> Along with the questions file{' '}
                            <strong>Full transcript required.</strong>. The AI checks your
                            questions using this specific transcript —
                            your answers cannot be evaluated without the transcript.
                        </p>
                    </div>
                </div>

                <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
                    <div className="space-y-5">
                        {/* Title */}
                        <Field label="Title *" invalid={attempted && title.trim().length === 0}>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="My course — Unit 5 Listening"
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
                                            {l.flag} {l.name}
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

                        {/* Cert */}
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

                        {/* Audio */}
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
                                Only MP3, MPEG, MP4, WAV, OGG — max 100 MB
                            </p>
                            {attempted && !audioFile && (
                                <p className={errorTextCls}>Please choose an audio file.</p>
                            )}
                        </Field>

                        {/* Questions file */}
                        <Field
                            label="Questions file * (PDF or TXT)"
                            invalid={attempted && !questionsFile}
                        >
                            <DocDropZone
                                file={questionsFile}
                                disabled={uploading}
                                invalid={attempted && !questionsFile}
                                accept=".pdf,.txt,application/pdf,text/plain"
                                icon="doc"
                                emptyLabel="Drop the questions file or select it from your device (PDF/TXT)"
                                onFile={handleQuestionsFile}
                                onClear={() => setQuestionsFile(null)}
                            />
                            {attempted && !questionsFile && (
                                <p className={errorTextCls}>Please choose a questions file.</p>
                            )}
                            <p className="mt-1.5 text-xs text-ink-muted">
                                PDF max 20 pages — your own questions, not a full document.
                            </p>
                        </Field>

                        {/* Transcript */}
                        <Field
                            label="Full transcript * (required!)"
                            invalid={(attempted && transcriptText.trim().length === 0) || transcriptTooLong}
                        >
                            <TranscriptInput
                                text={transcriptText}
                                disabled={uploading}
                                parsing={pdfParsing}
                                invalid={(attempted && transcriptText.trim().length === 0) || transcriptTooLong}
                                maxChars={MAX_TRANSCRIPT_CHARS}
                                onChange={setTranscriptText}
                                onFile={handleTranscriptFile}
                            />
                            <p className="mt-1.5 text-xs text-ink-muted">
                                Write text or <strong>.txt / .pdf</strong> drop.
                                Your questions will be checked using this transcript — one
                                audio-length transcript, not a whole book.
                            </p>
                            {attempted && transcriptText.trim().length === 0 && (
                                <p className={errorTextCls}>Transcript is required.</p>
                            )}
                            {transcriptTooLong && (
                                <p className={errorTextCls}>
                                    Transcript is too long — upload a passage matching your audio
                                    length, not a whole book.
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
                                style={{width: `${progress}%`}}
                            />
                        </div>
                    </div>
                )}
                {error && !uploading && (
                    <div className="border-t border-coral-500/20 bg-coral-50 px-6 py-3 text-sm text-coral-700">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream/40 px-6 py-4">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={uploading || pdfParsing}
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {uploading ? 'Uploading…' : 'Upload material'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════
// PDF text extraction (transcript uchun) — pdfjs lazy import
// ═════════════════════════════════════════════════════════════════
async function extractPdfText(file: File): Promise<string> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
        .default

    const buf = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({data: buf}).promise

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

    const size = useMemo(() => {
        if (!file) return null
        const mb = file.size / (1024 * 1024)
        return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`
    }, [file])

    if (file) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-mint-500/30 bg-mint-50/60 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint-500 text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                )}
            </div>
        )
    }

    return (
        <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
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
                type="file"
                accept=".mp3,.mpeg,.mp4,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
                disabled={disabled}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="hidden"
            />
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-indigo-500/10 text-indigo-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
            </div>
            <p className="text-sm font-medium text-ink">
                Upload audio or <span className="text-indigo-600">Select</span>
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">MP3 · MPEG · MP4 · WAV · OGG</p>
        </label>
    )
}

function DocDropZone({
                         file,
                         disabled,
                         invalid,
                         accept,
                         icon,
                         emptyLabel,
                         onFile,
                         onClear,
                     }: {
    file: File | null
    disabled: boolean
    invalid?: boolean
    accept: string
    icon: 'doc'
    emptyLabel: string
    onFile: (f: File | null) => void
    onClear: () => void
}) {
    const [dragOver, setDragOver] = useState(false)

    const size = useMemo(() => {
        if (!file) return null
        const mb = file.size / (1024 * 1024)
        return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`
    }, [file])

    if (file) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-50/60 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500 text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                    <p className="text-xs text-ink-muted">{size}</p>
                </div>
                {!disabled && (
                    <button
                        onClick={onClear}
                        className="rounded-full p-1.5 text-ink-muted transition hover:bg-coral-50 hover:text-coral-600"
                        title="Remove"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                )}
            </div>
        )
    }

    return (
        <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
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
                type="file"
                accept={accept}
                disabled={disabled}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="hidden"
            />
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-indigo-500/10 text-indigo-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6"/>
                </svg>
            </div>
            <p className="text-sm font-medium text-ink">{emptyLabel}</p>
            <p className="mt-1 text-[11px] text-ink-muted">PDF · TXT</p>
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
                    <p className="text-xs font-medium text-indigo-600">PDF o'qilmoqda…</p>
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
