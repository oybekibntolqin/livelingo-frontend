// Mode A — user o'z matni VA o'z savollari bilan yuklaydi.
// AI savol generatsiya qilmaydi — faqat berilgan savollarni matnga
// qarab parse qiladi (to'g'ri javoblarni aniqlaydi).
//
// LANG_OPTIONS, CERT_OPTIONS, LEVELS — Reading.tsx'даgi mavjud
// module-level konstantalar, shu faylda qayta e'lon qilinmaydi —
// Reading.tsx ичida import qilinadi.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { API_BASE } from '../../lib/api'
import { getToken } from '../../lib/auth'
import UploadProgressBar from '../shared/UploadProgressBar'
import type { CefrLevel } from '../../lib/reading'

type InputMode = 'file' | 'paste'

// MUHIM: backenddagi ReadingServiceImpl.MAX_MATERIAL_CHARS bilan bir
// xil qiymat — foydalanuvchini serverga yubormasdan oldin, mos matn
// joylashtirganida (paste rejimida) ogohlantirish uchun. Ikkala
// tomon ham sinxron turishi kerak; backend o'zgarsa shu yerni ham
// yangilang.
const MAX_MATERIAL_CHARS = 40_000

export default function UploadWithQuestionsDialog({
  onClose,
  onUploaded,
  currentLang,
  LANG_OPTIONS,
  CERT_OPTIONS,
  LEVELS,
}: {
  onClose: () => void
  onUploaded: () => void
  currentLang: string
  LANG_OPTIONS: { code: string; countryCode: string; flag: string; name: string }[]
  CERT_OPTIONS: Record<string, { code: string; name: string }[]>
  LEVELS: CefrLevel[]
}) {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<CefrLevel>('B1')
  const [uploadLang, setUploadLang] = useState(currentLang)
  const [certType, setCertType] = useState('GENERAL')

  const [textMode, setTextMode] = useState<InputMode>('file')
  const [textFile, setTextFile] = useState<File | null>(null)
  const [textPaste, setTextPaste] = useState('')

  const [qMode, setQMode] = useState<InputMode>('file')
  const [qFile, setQFile] = useState<File | null>(null)
  const [qPaste, setQPaste] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [authExpired, setAuthExpired] = useState(false)
  // Submit bosilganda hali to'ldirilmagan majburiy maydonlarni
  // qizil bilan ko'rsatish uchun.
  const [attempted, setAttempted] = useState(false)

  const certOptions = CERT_OPTIONS[uploadLang] ?? [{ code: 'GENERAL', name: 'General' }]

  const hasMainText = textMode === 'file' ? !!textFile : textPaste.trim().length > 0
  const hasQuestions = qMode === 'file' ? !!qFile : qPaste.trim().length > 0

  // Paste rejimida matn juda uzun bo'lsa (masalan foydalanuvchi
  // butun bir kitob/romanni joylashtirsa) — serverga yubormasdan
  // oldin shu yerda to'xtatamiz. Fayl rejimida uzunlikni oldindan
  // bila olmaymiz (PDF/DOCX parse qilinmagan), shuning uchun bu
  // tekshiruv faqat paste uchun ishlaydi — fayl hali ham backendda
  // (sahifa/belgi soni bo'yicha) tekshiriladi.
  const mainTextTooLong = textMode === 'paste' && textPaste.trim().length > MAX_MATERIAL_CHARS

  const canSubmit = title.trim().length > 0 && hasMainText && hasQuestions && !mainTextTooLong

  const submit = async () => {
    if (!canSubmit) {
      setAttempted(true)
      if (mainTextTooLong) {
        const approxWords = Math.round(textPaste.trim().length / 6)
        setErr(
          `Asosiy matn juda uzun (~${approxWords} so'z, ${textPaste.trim().length} belgi). ` +
            `Reading darsi uchun bitta maqola yoki qisqa parcha joylashtiring — butun kitob ` +
            `yoki roman emas. Chegara: ${MAX_MATERIAL_CHARS.toLocaleString('en-US')} belgigacha.`
        )
      }
      return
    }
    const token = getToken()
    if (!token) {
      setAuthExpired(true)
      setErr("Yuklashdan oldin tizimga kirishingiz kerak.")
      return
    }

    setUploading(true)
    setUploadPercent(0)
    setErr(null)
    setAuthExpired(false)
    try {
      const form = new FormData()
      form.append('title', title)
      form.append('level', level)
      form.append('type', certType)
      form.append('languageCode', uploadLang)

      if (textMode === 'file' && textFile) form.append('file', textFile)
      else form.append('content', textPaste)

      if (qMode === 'file' && qFile) form.append('questionsFile', qFile)
      else form.append('questionsText', qPaste)

      // MUHIM TUZATISH: avval `fetch()` ishlatilardi — progress
      // kuzatish imkoniyati bermaydi. XMLHttpRequest'ga o'tkazildi.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${API_BASE}/api/reading/materials/upload-with-questions`)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadPercent(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
            return
          }
          if (xhr.status === 401 || xhr.status === 403) {
            setAuthExpired(true)
            reject(new Error(
              xhr.status === 401
                ? 'Sessiya muddati tugagan. Qayta kiring.'
                : "Ruxsat yo'q. Qayta kirib ko'ring."
            ))
            return
          }
          // Backend xato javobi JSON ({"message": "..."}) formatida
          // keladi (GlobalExceptionHandler) — masalan matn/PDF
          // uzunligi chegaradan oshganda aniq va foydali xabar shu
          // yerdan chiqadi. Avval xom JSON matn ko'rsatilardi.
          let message = `Yuklash muvaffaqiyatsiz (${xhr.status})`
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
          reject(new Error(message))
        }
        xhr.send(form)
      })

      onUploaded()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yuklash muvaffaqiyatsiz.')
    } finally {
      setUploading(false)
    }
  }

  const reSignIn = () => {
    localStorage.removeItem('jwt')
    navigate('/sign-in')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink/6 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">O'z savollaringiz bilan</h2>
            <p className="text-xs text-ink-muted">Matn + savollar — AI faqat javoblarni aniqlaydi</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-cream-warm hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Asosiy matn */}
          <TextOrFileField
            label="Asosiy matn *"
            mode={textMode}
            setMode={setTextMode}
            file={textFile}
            setFile={setTextFile}
            pasteValue={textPaste}
            setPasteValue={setTextPaste}
            placeholder="Reading matnini shu yerga joylashtiring…"
            hint="Bitta maqola yoki qisqa parcha yuklang — butun kitob, roman yoki she'riy to'plam emas (PDF: max 30 sahifa)."
            maxChars={MAX_MATERIAL_CHARS}
            invalid={(attempted && !hasMainText) || mainTextTooLong}
          />

          {/* Savollar */}
          <TextOrFileField
            label="Savollaringiz *"
            mode={qMode}
            setMode={setQMode}
            file={qFile}
            setFile={setQFile}
            pasteValue={qPaste}
            setPasteValue={setQPaste}
            placeholder="Savollaringizni shu yerga joylashtiring…"
            hint="AI javoblarni yuqoridagi matndan avtomatik aniqlaydi — javoblarni alohida yozish shart emas."
            invalid={attempted && !hasQuestions}
          />

          {/* Title */}
          <label className="block">
            <span
              className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${
                attempted && title.trim().length === 0 ? 'text-coral-600' : 'text-ink-muted'
              }`}
            >
              Sarlavha *
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="masalan, IELTS kursi — 3-dars"
              className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 ${
                attempted && title.trim().length === 0
                  ? 'border-coral-500 bg-coral-50/40 ring-2 ring-coral-500/15'
                  : 'border-ink/10 focus:border-indigo-500 focus:ring-indigo-500/12'
              }`}
            />
            {attempted && title.trim().length === 0 && (
              <p className="mt-1.5 text-xs font-medium text-coral-600">Sarlavha kiritilishi shart.</p>
            )}
          </label>

          {/* Til */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Til
            </span>
            <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-ink/10 bg-cream-warm/40 p-1.5 sm:grid-cols-3">
              {LANG_OPTIONS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setUploadLang(l.code)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                    uploadLang === l.code
                      ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                      : 'border-ink/10 bg-white text-ink hover:border-ink/20'
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      uploadLang === l.code ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink-soft'
                    }`}
                  >
                    {l.countryCode}
                  </span>
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
            </div>
          </label>

          {/* CEFR daraja */}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              CEFR daraja
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all ${
                    level === l
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </label>

          {/* Sertifikat */}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Sertifikat uslubi
            </span>
            <div className="flex flex-wrap gap-1.5">
              {certOptions.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCertType(c.code)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    certType === c.code
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </label>

          {uploading && (
            <UploadProgressBar
              percent={uploadPercent}
              fileName={textMode === 'file' ? textFile?.name : qMode === 'file' ? qFile?.name : undefined}
            />
          )}

          {err && (
            <div className="rounded-xl border border-coral-500/30 bg-coral-50 p-3 text-sm">
              <p className="text-xs text-coral-600">{err}</p>
              {authExpired && (
                <button
                  onClick={reSignIn}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-coral-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-coral-600"
                >
                  Qayta kirish
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink/6 bg-cream-warm/30 px-6 py-3.5">
          <p className="hidden text-[11px] text-ink-muted sm:block">
            Ikkalasi ham moderatsiyadan o'tadi
          </p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <button onClick={onClose} disabled={uploading} className="btn-ghost px-4 py-2 text-xs">
              Bekor qilish
            </button>
            <button
              onClick={submit}
              disabled={uploading}
              className="btn-primary px-5 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? 'Yuklanmoqda…' : 'Yuklash'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TextOrFileField({
  label,
  mode,
  setMode,
  file,
  setFile,
  pasteValue,
  setPasteValue,
  placeholder,
  hint,
  invalid,
  maxChars,
}: {
  label: string
  mode: InputMode
  setMode: (m: InputMode) => void
  file: File | null
  setFile: (f: File | null) => void
  pasteValue: string
  setPasteValue: (v: string) => void
  placeholder: string
  hint?: string
  invalid?: boolean
  // Belgilansa (masalan asosiy matn maydoni uchun) — paste
  // rejimida jonli belgi-hisoblagich ko'rsatiladi va chegaradan
  // oshganda qizil rangda ogohlantiradi.
  maxChars?: number
}) {
  const pasteLen = pasteValue.trim().length
  const overLimit = mode === 'paste' && typeof maxChars === 'number' && pasteLen > maxChars
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            invalid ? 'text-coral-600' : 'text-ink-muted'
          }`}
        >
          {label}
        </span>
        <div className="flex gap-1 rounded-lg bg-cream-warm p-0.5">
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              mode === 'file' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            Fayl
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              mode === 'paste' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            Matn
          </button>
        </div>
      </div>

      {mode === 'file' ? (
        <label
          className={`grid min-h-[70px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${
            invalid
              ? 'border-coral-500 bg-coral-50/40'
              : 'border-ink/15 bg-cream-warm hover:border-ink/30'
          }`}
        >
          <input
            type="file"
            accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-xs font-medium text-ink">
              {file.name} <span className="text-ink-muted">· almashtirish uchun bosing</span>
            </p>
          ) : (
            <p className={`text-xs ${invalid ? 'text-coral-600' : 'text-ink-muted'}`}>
              PDF, TXT yoki DOCX — bosib tanlang
            </p>
          )}
        </label>
      ) : (
        <>
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={`w-full rounded-xl border px-3.5 py-2 text-sm text-ink outline-none focus:ring-2 ${
              invalid
                ? 'border-coral-500 bg-coral-50/40 ring-2 ring-coral-500/15'
                : 'border-ink/10 bg-white focus:border-indigo-500 focus:ring-indigo-500/12'
            }`}
          />
          {typeof maxChars === 'number' && (
            <p
              className={`mt-1 text-right text-[11px] font-medium ${
                overLimit ? 'text-coral-600' : 'text-ink-muted'
              }`}
            >
              {pasteLen.toLocaleString('en-US')} / {maxChars.toLocaleString('en-US')} belgi
            </p>
          )}
        </>
      )}
      {hint && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
      {invalid && !overLimit && (
        <p className="mt-1 text-[11px] font-medium text-coral-600">This field is required.</p>
      )}
      {overLimit && (
        <p className="mt-1 text-[11px] font-medium text-coral-600">
          Matn juda uzun — butun kitob emas, qisqa parcha joylashtiring.
        </p>
      )}
    </div>
  )
}
