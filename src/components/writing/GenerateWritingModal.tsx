// Writing — "Generate with AI" modal.  Admin/Owner tanlaydi: qaysi
// task turi, qaysi sertifikat/daraja/til — AI yangi savol o'ylab
// topadi (checkWriting'дан farqli — bu yerda AI insho yozmaydi).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api, ApiError } from '../../lib/api'
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

export default function GenerateWritingModal({
  onClose,
  currentLang,
}: {
  onClose: () => void
  currentLang: string
}) {
  const navigate = useNavigate()

  const [taskType, setTaskType] = useState<WritingTaskType>('IELTS_TASK_2')
  const [certificateType, setCertificateType] = useState('GENERAL')
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('B2')
  const [languageCode, setLanguageCode] = useState(currentLang)
  const [topicHint, setTopicHint] = useState('')

  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Submit bosilganda hali to'ldirilmagan majburiy maydonlarni
  // qizil bilan ko'rsatish uchun.
  const [attempted, setAttempted] = useState(false)

  const canSubmit = languageCode.trim().length > 0 && certificateType.trim().length > 0

  const submit = async () => {
    if (!canSubmit) {
      setAttempted(true)
      return
    }
    setGenerating(true)
    setErr(null)
    try {
      const qs = new URLSearchParams({
        taskType,
        certificateType,
        cefrLevel,
        languageCode,
      })
      if (topicHint.trim()) qs.set('topicHint', topicHint.trim())

      const question = await api.post<WritingQuestion>(
        `/api/writing/generate-question?${qs}`,
        {}
      )
      navigate(`/learn/writing/session/${question.id}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setErr(e instanceof Error ? e.message : 'Generatsiya muvaffaqiyatsiz.')
    } finally {
      setGenerating(false)
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
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">AI bilan savol yaratish</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-cream-warm hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Task turi
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span
                className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${
                  attempted && languageCode.trim().length === 0 ? 'text-coral-600' : 'text-ink-muted'
                }`}
              >
                Til *
              </span>
              <input
                type="text"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                placeholder="en"
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  attempted && languageCode.trim().length === 0
                    ? 'border-coral-500 bg-coral-50/40 ring-2 ring-coral-500/15'
                    : 'border-ink/10 focus:border-indigo-500'
                }`}
              />
              {attempted && languageCode.trim().length === 0 && (
                <p className="mt-1 text-xs font-medium text-coral-600">Til kiritilishi shart.</p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Daraja
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
            <span
              className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${
                attempted && certificateType.trim().length === 0 ? 'text-coral-600' : 'text-ink-muted'
              }`}
            >
              Sertifikat *
            </span>
            <input
              type="text"
              value={certificateType}
              onChange={(e) => setCertificateType(e.target.value.toUpperCase())}
              placeholder="IELTS, TOPIK, HSK, GENERAL..."
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
                attempted && certificateType.trim().length === 0
                  ? 'border-coral-500 bg-coral-50/40 ring-2 ring-coral-500/15'
                  : 'border-ink/10 focus:border-indigo-500'
              }`}
            />
            {attempted && certificateType.trim().length === 0 && (
              <p className="mt-1 text-xs font-medium text-coral-600">Sertifikat turi kiritilishi shart.</p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Mavzu (ixtiyoriy)
            </span>
            <input
              type="text"
              value={topicHint}
              onChange={(e) => setTopicHint(e.target.value)}
              placeholder="masalan, Environment"
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </label>

          {err && <p className="text-xs text-coral-600">{err}</p>}

          <button
            onClick={submit}
            disabled={generating}
            className="btn-primary w-full disabled:opacity-60"
          >
            {generating ? 'Yaratilmoqda…' : 'Yaratish'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
