// Writing — Exam mode.  Bir nechta vazifa (masalan IELTS Task 1 +
// Task 2) ketma-ket, umumiy examSessionId bilan.  Har bir vazifa
// o'zining vaqt limitiga ega; barchasi topshirilgach, yig'ma
// natija sahifasiga o'tadi.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import QuestionVisual from '../components/writing/QuestionVisual'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  CERTS_BY_LANG,
  LANG_OPTIONS,
  LEVELS,
  TASK_TYPE_LABEL,
  countUnits,
  type CefrLevel,
  type WritingExamStartResponse,
} from '../lib/writing'

type Phase = 'setup' | 'loading' | 'ready' | 'active' | 'submitting' | 'error'

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function WritingExam() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [phase, setPhase] = useState<Phase>('setup')
  const [languageCode, setLanguageCode] = useState('en')
  const [certificateType, setCertificateType] = useState('IELTS')
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('B2')

  const [examData, setExamData] = useState<WritingExamStartResponse | null>(null)
  const [taskIndex, setTaskIndex] = useState(0)
  const [content, setContent] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const taskStartedAtRef = useRef<number | null>(null)
  const submittedTasksRef = useRef<Set<number>>(new Set())

  const availableCerts = CERTS_BY_LANG[languageCode] ?? ['GENERAL']

  const startExam = async () => {
    setPhase('loading')
    setError(null)
    try {
      const qs = new URLSearchParams({
        certificateType,
        cefrLevel,
        languageCode,
      })
      const data = await api.get<WritingExamStartResponse>(`/api/writing/exam-start?${qs}`)
      setExamData(data)
      setTaskIndex(0)
      setPhase('ready')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Exam boshlanmadi.')
      setPhase('error')
    }
  }

  const handleReady = useCallback(() => {
    taskStartedAtRef.current = Date.now()
    setRemainingSeconds(examData?.tasks[taskIndex]?.timeLimitSeconds ?? 0)
    setContent('')
    setPhase('active')
  }, [examData, taskIndex])

  const submitCurrentTask = useCallback(async () => {
    if (!examData || submittedTasksRef.current.has(taskIndex)) return
    submittedTasksRef.current.add(taskIndex)
    setPhase('submitting')

    const task = examData.tasks[taskIndex]
    const timeTaken = taskStartedAtRef.current
      ? Math.round((Date.now() - taskStartedAtRef.current) / 60000)
      : Math.round(task.timeLimitSeconds / 60)

    try {
      await api.post('/api/writing/submit', {
        questionId: task.question.id,
        examSessionId: examData.examSessionId,
        content,
        timeTakenMinutes: timeTaken,
      })

      const nextIndex = taskIndex + 1
      if (nextIndex < examData.tasks.length) {
        setTaskIndex(nextIndex)
        setPhase('ready')
      } else {
        navigate(`/learn/writing/exam-results/${examData.examSessionId}`, { replace: true })
      }
    } catch (err) {
      submittedTasksRef.current.delete(taskIndex)
      setError(err instanceof Error ? err.message : 'Topshirishda xatolik yuz berdi.')
      setPhase('active')
    }
  }, [examData, taskIndex, content, navigate])

  // Timer
  useEffect(() => {
    if (phase !== 'active') return
    if (remainingSeconds <= 0) {
      submitCurrentTask()
      return
    }
    const t = setTimeout(() => setRemainingSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, remainingSeconds, submitCurrentTask])

  // ═════════════════════════════════════════════════════════════

  if (phase === 'setup') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5">
        <div className="w-full max-w-md rounded-3xl border border-ink/8 bg-white p-6">
          <p className="mb-1 font-display text-lg font-semibold text-ink">Writing Exam</p>
          <p className="mb-6 text-sm text-ink-muted">
            Sertifikatga mos vazifalar ketma-ket beriladi, umumiy natija hisoblanadi.
          </p>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Til
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {LANG_OPTIONS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguageCode(l.code)
                    setCertificateType((CERTS_BY_LANG[l.code] ?? ['GENERAL'])[0])
                  }}
                  className={`rounded-xl border px-2 py-1.5 text-xs font-medium ${
                    languageCode === l.code
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-ink/10 text-ink-soft'
                  }`}
                >
                  {l.flag} {l.name}
                </button>
              ))}
            </div>
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Sertifikat
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableCerts.map((c) => (
                <button
                  key={c}
                  onClick={() => setCertificateType(c)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    certificateType === c
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-ink/10 text-ink-soft'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </label>

          <label className="mb-6 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Daraja
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setCefrLevel(l)}
                  className={`rounded-xl border py-1.5 font-mono text-xs font-semibold ${
                    cefrLevel === l
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-ink/10 text-ink-soft'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </label>

          <button onClick={startExam} className="btn-primary w-full">
            Boshlash
          </button>
          <Link to="/learn/writing" className="mt-4 block text-center text-xs text-ink-muted hover:text-ink">
            ← Writing'ga qaytish
          </Link>
        </div>
      </main>
    )
  }

  if (phase === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Yuklanmoqda…</p>
      </main>
    )
  }

  if (phase === 'error' || !examData) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">{error ?? 'Xatolik yuz berdi.'}</p>
          <Link to="/learn/writing" className="btn-primary">
            Writing'ga qaytish
          </Link>
        </div>
      </main>
    )
  }

  const task = examData.tasks[taskIndex]
  const q = task.question
  const isReady = phase === 'ready'
  const timeCritical = phase === 'active' && remainingSeconds <= 60
  const units = countUnits(content, languageCode)

  return (
    <main className="min-h-screen bg-cream pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <span className="text-sm font-medium text-ink-soft">
          Task {taskIndex + 1}/{examData.tasks.length} · {TASK_TYPE_LABEL[q.taskType ?? 'GENERAL_ESSAY']}
        </span>
        <span className="text-sm font-medium text-ink">Writing Exam</span>
        {phase === 'active' || phase === 'submitting' ? (
          <span
            className={`rounded-full px-3 py-1 font-mono text-sm font-bold tabular-nums ${
              timeCritical ? 'animate-pulse bg-coral-500/15 text-coral-700' : 'bg-indigo-500/10 text-indigo-700'
            }`}
          >
            {formatTime(remainingSeconds)}
          </span>
        ) : (
          <Logo size={26} />
        )}
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {isReady && (
          <div className="mb-6 rounded-3xl border-2 border-indigo-500/20 bg-indigo-50/60 p-6 text-center">
            <p className="mb-1 font-display text-lg font-semibold text-ink">
              Task {taskIndex + 1} tayyormisiz?
            </p>
            <p className="mb-4 text-sm text-ink-muted">
              {formatTime(task.timeLimitSeconds)} vaqt beriladi. Savolni oldindan
              o'qib chiqishingiz mumkin — vaqt faqat boshlagach ishga tushadi.
            </p>
            <button onClick={handleReady} className="btn-primary">
              Boshlash
            </button>
          </div>
        )}

        <div className="mb-4 rounded-3xl border border-ink/8 bg-white p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.question}</p>
          {q.instructions && <p className="mt-2 text-xs text-ink-muted">{q.instructions}</p>}
          {(q.visualJson || q.visualImageUrl) && (
            <div className="mt-4">
              <QuestionVisual visualJson={q.visualJson} visualImageUrl={q.visualImageUrl} />
            </div>
          )}
        </div>

        {error && phase === 'active' && (
          <div className="mb-4 rounded-2xl border border-coral-500/20 bg-coral-500/10 px-4 py-3 text-sm text-coral-700">
            {error}
          </div>
        )}

        <textarea
          value={content}
          disabled={!(phase === 'active')}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isReady ? "Yozish 'Boshlash' bosilgandan keyin ochiladi…" : 'Shu yerga yozing…'}
          rows={14}
          className="w-full rounded-2xl border border-ink/10 bg-white p-4 text-sm text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-cream"
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-ink-muted">
          <span>
            {units} {q.minWords != null && `/ ${q.minWords}+`}
          </span>
        </div>

        {phase === 'active' && (
          <div className="mt-6 flex justify-center">
            <button onClick={submitCurrentTask} className="btn-primary px-8">
              {taskIndex + 1 < examData.tasks.length ? 'Keyingi vazifa' : 'Yakunlash'}
            </button>
          </div>
        )}
        {phase === 'submitting' && (
          <p className="mt-6 text-center text-sm text-ink-muted">Baholanmoqda…</p>
        )}
      </div>
    </main>
  )
}
