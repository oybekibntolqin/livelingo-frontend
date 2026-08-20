// Writing — "Add question" modal. Har qanday foydalanuvchi o'z
// savolini qo'lda kiritadi (AI generatsiya emas — GenerateWritingModal
// bilan bir xil endpoint oilasidan emas, mavjud POST /questions'ни
// ishlatadi).
//
// ESLATMA: "Visual" (chart/table — rasm URL yoki JSON) maydoni
// ATAYLAB olib tashlangan. Foydalanuvchi tomonidan berilgan tashqi
// rasm URL'i yoki JSON'ни moderatsiyasiz butun platformaga (barcha
// o'quvchilarga) ko'rsatish xavfli edi. Rasmiy/AI-generatsiya
// qilingan savollarda Visual boshqa (admin/content-generation) oqim
// orqali qo'shiladi.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { API_BASE } from '../../lib/api'
import { getToken } from '../../lib/auth'
import UploadProgressBar from '../shared/UploadProgressBar'
import {
  TASK_TYPE_LABEL,
  type WritingTaskType,
  type WritingQuestion,
  type CefrLevel,
} from '../../lib/writing'

const TASK_OPTIONS: WritingTaskType[] = [
  'IELTS_TASK_1',
  'IELTS_TASK_2',
  'TOPIK_Q53',
  'TOPIK_Q54',
  'HSK_SENTENCE',
  'HSK_SHORT_ESSAY',
  'HSK_SUMMARY',
  'GENERAL_ESSAY',
]

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

type QuestionMode = 'paste' | 'file'

// MUHIM: backenddagi WritingServiceImpl.MAX_QUESTION_CHARS bilan bir
// xil qiymat — Writing savoli/topshirig'i tabiatan qisqa bo'lishi
// kerak (Reading matnidan farqli). Foydalanuvchi paste rejimida
// juda uzun matn (masalan butun hujjat) joylashtirsa, serverga
// yubormasdan oldin shu yerda ogohlantiramiz.
const MAX_QUESTION_CHARS = 5_000

export default function AddWritingQuestionModal({
  onClose,
  currentLang,
}: {
  onClose: () => void
  currentLang: string
}) {
  const navigate = useNavigate()

  const [question, setQuestion] = useState('')
  const [questionMode, setQuestionMode] = useState<QuestionMode>('paste')
  const [questionFile, setQuestionFile] = useState<File | null>(null)
  const [instructions, setInstructions] = useState('')
  const [languageCode, setLanguageCode] = useState(currentLang)
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('B2')
  const [certificateType, setCertificateType] = useState('GENERAL')
  const [taskType, setTaskType] = useState<WritingTaskType>('GENERAL_ESSAY')
  const [topic, setTopic] = useState('')
  const [minWords, setMinWords] = useState('')
  const [maxWords, setMaxWords] = useState('')
  const [recommendedMinutes, setRecommendedMinutes] = useState('')
  const [year, setYear] = useState('')

  const [saving, setSaving] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  // Submit bosilganda hali to'ldirilmagan majburiy maydonlarni
  // qizil bilan ko'rsatish uchun.
  const [attempted, setAttempted] = useState(false)

  const hasQuestionContent =
    questionMode === 'file' ? questionFile !== null : question.trim().length > 0
  // Paste rejimida matn juda uzun bo'lsa (masalan foydalanuvchi
  // butun bir hujjat/insho joylashtirsa) — serverga yubormasdan
  // oldin shu yerda to'xtatamiz. Fayl rejimida uzunlikni oldindan
  // bila olmaymiz — backend (sahifa/belgi soni bo'yicha) tekshiradi.
  const questionTooLong =
    questionMode === 'paste' && question.trim().length > MAX_QUESTION_CHARS
  const canSubmit = hasQuestionContent && languageCode.trim().length > 0 && !questionTooLong

  const submit = async () => {
    if (!canSubmit) {
      setAttempted(true)
      if (questionTooLong) {
        const approxWords = Math.round(question.trim().length / 6)
        setErr(
          `Savol matni juda uzun (~${approxWords} so'z, ${question.trim().length} belgi). ` +
            `Writing savoli/topshirig'i qisqa bo'lishi kerak — hujjat yoki kitob emas. ` +
            `Chegara: ${MAX_QUESTION_CHARS.toLocaleString('en-US')} belgigacha.`
        )
      }
      return
    }

    setSaving(true)
    setUploadPercent(0)
    setErr(null)
    try {
      const token = getToken()
      if (!token) {
        navigate('/sign-in', { replace: true })
        return
      }

      const form = new FormData()
      if (questionMode === 'file' && questionFile) {
        form.append('file', questionFile)
      } else {
        form.append('question', question)
      }
      form.append('languageCode', languageCode)
      form.append('cefrLevel', cefrLevel)
      if (instructions.trim()) form.append('instructions', instructions.trim())
      if (certificateType) form.append('certificateType', certificateType)
      if (taskType) form.append('taskType', taskType)
      if (topic.trim()) form.append('topic', topic.trim())
      if (minWords.trim()) form.append('minWords', minWords.trim())
      if (maxWords.trim()) form.append('maxWords', maxWords.trim())
      if (recommendedMinutes.trim()) form.append('recommendedMinutes', recommendedMinutes.trim())
      if (year.trim()) form.append('year', year.trim())

      // MUHIM TUZATISH: avval `fetch()` ishlatilardi — bu progress
      // kuzatish imkoniyati bermaydi. XMLHttpRequest'ga o'tkazildi —
      // endi haqiqiy foiz ko'rsatiladi (ayniqsa katta PDF fayllar
      // uchun foydali).
      const created = await new Promise<WritingQuestion>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${API_BASE}/api/writing/questions`)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadPercent(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText))
            } catch {
              reject(new Error('Invalid server response'))
            }
          } else if (xhr.status === 401) {
            navigate('/sign-in', { replace: true })
            reject(new Error('Unauthorized'))
          } else {
            // Backend xato javobi JSON ({"message": "..."}) formatida
            // keladi (GlobalExceptionHandler) — masalan savol matni
            // uzunligi chegaradan oshganda aniq va foydali xabar shu
            // yerdan chiqadi. Avval xom JSON matn ko'rsatilardi.
            let message = `Could not save (${xhr.status})`
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
        }
        xhr.send(form)
      })

      navigate(`/learn/writing/session/${created.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
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
          <h2 className="font-display text-xl font-bold text-ink">Add your own question</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-cream-warm hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  attempted && !hasQuestionContent ? 'text-coral-600' : 'text-ink-muted'
                }`}
              >
                Question *
              </span>
              <div className="flex gap-1 rounded-lg bg-cream-warm p-0.5">
                <button
                  type="button"
                  onClick={() => setQuestionMode('paste')}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    questionMode === 'paste' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
                  }`}
                >
                  Type
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionMode('file')}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    questionMode === 'file' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
                  }`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {questionMode === 'paste' ? (
              <>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Some people think... To what extent do you agree?"
                  rows={3}
                  className={`w-full rounded-xl border px-3.5 py-2 text-sm text-ink outline-none focus:ring-2 ${
                    (attempted && !hasQuestionContent) || questionTooLong
                      ? 'border-coral-500 bg-coral-50/40 ring-2 ring-coral-500/15'
                      : 'border-ink/10 focus:border-indigo-500 focus:ring-indigo-500/12'
                  }`}
                />
                <p
                  className={`mt-1 text-right text-[11px] font-medium ${
                    questionTooLong ? 'text-coral-600' : 'text-ink-muted'
                  }`}
                >
                  {question.trim().length.toLocaleString('en-US')} /{' '}
                  {MAX_QUESTION_CHARS.toLocaleString('en-US')} belgi
                </p>
              </>
            ) : (
              <label
                className={`grid min-h-[70px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${
                  attempted && !hasQuestionContent
                    ? 'border-coral-500 bg-coral-50/40'
                    : 'border-ink/15 bg-cream-warm hover:border-ink/30'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => setQuestionFile(e.target.files?.[0] ?? null)}
                />
                {questionFile ? (
                  <p className="text-xs font-medium text-ink">
                    {questionFile.name} <span className="text-ink-muted">· click to change</span>
                  </p>
                ) : (
                  <p className={`text-xs ${attempted && !hasQuestionContent ? 'text-coral-600' : 'text-ink-muted'}`}>
                    PDF (max 5 pages), TXT, or Word — click to choose
                  </p>
                )}
              </label>
            )}
            {attempted && !hasQuestionContent && (
              <p className="mt-1.5 text-xs font-medium text-coral-600">A question is required.</p>
            )}
            {questionTooLong && (
              <p className="mt-1.5 text-xs font-medium text-coral-600">
                Savol matni juda uzun — bu hujjat yoki kitob yuklash maydoni emas, qisqa
                topshiriq matnini yozing.
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Additional instructions (optional)
            </span>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="masalan, Give reasons and examples"
              className="w-full rounded-xl border border-ink/10 px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span
                className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${
                  attempted && languageCode.trim().length === 0 ? 'text-coral-600' : 'text-ink-muted'
                }`}
              >
                Language code *
              </span>
              <input
                type="text"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                placeholder="en"
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  attempted && languageCode.trim().length === 0
                    ? 'border-coral-500 bg-coral-50/40 ring-2 ring-coral-500/15'
                    : 'border-ink/10 focus:border-indigo-500 focus:ring-indigo-500/12'
                }`}
              />
              {attempted && languageCode.trim().length === 0 && (
                <p className="mt-1.5 text-xs font-medium text-coral-600">Language code is required.</p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Level *
              </span>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Certificate
            </span>
            <input
              type="text"
              value={certificateType}
              onChange={(e) => setCertificateType(e.target.value.toUpperCase())}
              placeholder="IELTS, TOPIK, HSK, GENERAL..."
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Task type
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {TASK_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTaskType(t)}
                  className={`rounded-xl border px-2.5 py-2 text-xs font-medium transition ${
                    taskType === t
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-ink/10 bg-white text-ink-soft hover:border-ink/25'
                  }`}
                >
                  {TASK_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Topic (optional)
            </span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="masalan, Environment"
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Min words
              </span>
              <input
                type="number"
                value={minWords}
                onChange={(e) => setMinWords(e.target.value)}
                placeholder="150"
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Max words
              </span>
              <input
                type="number"
                value={maxWords}
                onChange={(e) => setMaxWords(e.target.value)}
                placeholder="optional"
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Minutes
              </span>
              <input
                type="number"
                value={recommendedMinutes}
                onChange={(e) => setRecommendedMinutes(e.target.value)}
                placeholder="40"
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
          </div>

          {saving && questionMode === 'file' && questionFile && (
            <UploadProgressBar percent={uploadPercent} fileName={questionFile.name} />
          )}

          {err && <p className="text-xs text-coral-600">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream-warm/30 px-6 py-3.5">
          <button onClick={onClose} disabled={saving} className="btn-ghost px-4 py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="btn-primary px-5 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
