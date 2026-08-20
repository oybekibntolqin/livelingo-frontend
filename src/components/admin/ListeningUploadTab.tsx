// Admin Panel — "Listening upload" tabi.
//
// Faqat OWNER/ADMIN ko'radi (butun AdminPanel AdminGuard bilan
// himoyalangan). ZIP fayl strukturasi:
//   lesson1/audio.mp3
//   lesson1/transcript.txt
//   lesson2/audio.mp3
//   lesson2/transcript.txt
//   ...
// Har bir papka — alohida listening material bo'ladi.
//
// Backend: POST /api/admin/listening/upload-batch — bu /api/admin/**
// ostida bo'lgani uchun ikkala himoya qatlami ham ishlaydi:
//   1) SecurityConfig: ADMIN yoki OWOWNER roli
//   2) AdminSessionFilter: Admin Panel paroli orqali olingan session token

import { useState } from 'react'
import { getAdminSessionToken } from '../../lib/adminAuth'
import { CERTS_BY_LANG, LANG_OPTIONS, LEVELS, type CefrLevel } from '../../lib/listening'

interface BatchResult {
  count: number
  materials: { id: string; title: string }[]
}

export default function ListeningUploadTab() {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [languageCode, setLanguageCode] = useState('en')
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('B2')
  const [certificateType, setCertificateType] = useState('')
  const [topic, setTopic] = useState('')

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)

  const certs = CERTS_BY_LANG[languageCode] ?? []

  const onFileChange = (f: File | null) => {
    setError(null)
    setResult(null)
    if (f && !/\.zip$/i.test(f.name)) {
      setError('Faqat .zip fayl qabul qilinadi.')
      setZipFile(null)
      return
    }
    setZipFile(f)
  }

  const submit = () => {
    if (!zipFile) {
      setError('Avval ZIP fayl tanlang.')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)
    setProgress(0)

    const fd = new FormData()
    fd.append('zip', zipFile)
    fd.append('languageCode', languageCode)
    fd.append('cefrLevel', cefrLevel)
    if (certificateType) fd.append('certificateType', certificateType)
    if (topic.trim()) fd.append('topic', topic.trim())

    const xhr = new XMLHttpRequest()
    const base = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
    xhr.open('POST', `${base}/api/admin/listening/upload-batch`)

    // Ikkita sarlavha kerak: oddiy login JWT (SecurityConfig rol
    // tekshiruvi uchun) VA Admin Panel session token (AdminSessionFilter
    // uchun) — biri yetishmasa 401/403 qaytadi.
    const token = localStorage.getItem('jwt') ?? ''
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    const adminSession = getAdminSessionToken()
    if (adminSession) xhr.setRequestHeader('X-Admin-Session', adminSession)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () => {
      setUploading(false)
      setError('Tarmoq xatosi. Qayta urinib ko\u2018ring.')
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as BatchResult
          setResult(data)
          setZipFile(null)
        } catch {
          setError('Server javobini o\u2018qib bo\u2018lmadi.')
        }
      } else if (xhr.status === 403) {
        setError('Ruxsat yo\u2018q — bu amal faqat Admin/Owner uchun.')
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          setError(typeof data === 'string' ? data : data.message || 'Yuklashda xatolik yuz berdi.')
        } catch {
          setError(xhr.responseText || 'Yuklashda xatolik yuz berdi.')
        }
      }
    }

    xhr.send(fd)
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 font-display text-lg font-bold text-ink">
        Listening materiallarni ZIP orqali ommaviy yuklash
      </h2>
      <p className="mb-6 text-sm text-ink-muted">
        ZIP ichida har bir papka bitta material bo'ladi — papka nomi{' '}
        <code className="rounded bg-ink/5 px-1 py-0.5 text-xs">lesson1/audio.mp3</code> va{' '}
        <code className="rounded bg-ink/5 px-1 py-0.5 text-xs">lesson1/transcript.txt</code> tarzida
        joylashgan bo'lishi kerak. Faqat mp3/wav/ogg audio va .txt transcript qabul qilinadi.
      </p>

      <div className="space-y-4 rounded-3xl border border-ink/8 bg-white p-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
            ZIP fayl
          </span>
          <input
            type="file"
            accept=".zip"
            disabled={uploading}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-indigo-500/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-500/20"
          />
          {zipFile && (
            <p className="mt-1.5 text-xs text-ink-muted">
              {zipFile.name} · {(zipFile.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Til
            </span>
            <select
              value={languageCode}
              disabled={uploading}
              onChange={(e) => {
                setLanguageCode(e.target.value)
                setCertificateType('')
              }}
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500/40"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Daraja
            </span>
            <select
              value={cefrLevel}
              disabled={uploading}
              onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500/40"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Sertifikat
            </span>
            <select
              value={certificateType}
              disabled={uploading || certs.length === 0}
              onChange={(e) => setCertificateType(e.target.value)}
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500/40"
            >
              <option value="">—</option>
              {certs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Mavzu (ixtiyoriy)
            </span>
            <input
              type="text"
              value={topic}
              disabled={uploading}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="masalan: Travel"
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500/40"
            />
          </label>
        </div>

        {uploading && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="text-sm text-coral-600">{error}</p>}

        {result && (
          <p className="text-sm text-mint-700">
            ✓ {result.count} ta material muvaffaqiyatli yuklandi.
          </p>
        )}

        <button
          onClick={submit}
          disabled={uploading || !zipFile}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? `Yuklanmoqda… ${progress}%` : 'ZIP yuklash'}
        </button>
      </div>
    </div>
  )
}
