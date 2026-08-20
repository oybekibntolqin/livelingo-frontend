// Reading — Exam mode.
//
// Listening'даgi ListeningExam bilan bir xil naqsh, lekin:
//   • Audio yo'q — "Men tayyorman"да faqat TIMER boshlanadi
//   • Savollar backend'даgi ReadingExamFormat orqali — material
//     qaysi CertificateType'ga tegishli bo'lsa, o'sha HAQIQIY
//     imtihon o'lchamida (masalan IELTS'da 40 ta)

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { ReadingQuestionsList } from '../components/reading/ReadingQuestionsList'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  formatTime,
  type ReadingExamStartResponse,
  type ReadingMaterial,
  type ReadingQuestionPublic,
  type SubmitReadingExamDTO,
} from '../lib/reading'

type Phase = 'loading' | 'ready' | 'active' | 'submitting' | 'error'

interface StoredExamState {
  examStartedAt: number
  timeLimitSeconds: number
  questions: ReadingQuestionPublic[]
  answers: Record<string, string>
}

const storageKey = (materialId: string) => `livelingo:reading-exam-session:${materialId}`

export default function ReadingExam() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [phase, setPhase] = useState<Phase>('loading')
  const [material, setMaterial] = useState<ReadingMaterial | null>(null)
  const [questions, setQuestions] = useState<ReadingQuestionPublic[]>([])
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const examStartedAtRef = useRef<number | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    loadExam(cancelled)

    return () => {
      cancelled = true
    }
  }, [id, navigate])

  const loadExam = useCallback(
    async (cancelled = false) => {
      if (!id) return
      setPhase('loading')
      setError(null)
      try {
        const m = await api.get<ReadingMaterial>(`/api/reading/materials/${id}`)
        if (cancelled) return
        setMaterial(m)

        const raw = localStorage.getItem(storageKey(id))
        if (raw) {
          try {
            const stored = JSON.parse(raw) as StoredExamState
            const elapsed = Math.floor((Date.now() - stored.examStartedAt) / 1000)
            setQuestions(stored.questions)
            setTimeLimitSeconds(stored.timeLimitSeconds)
            setAnswers(stored.answers)
            examStartedAtRef.current = stored.examStartedAt
            setPhase('active')
            setRemainingSeconds(Math.max(0, stored.timeLimitSeconds - elapsed))
            return
          } catch {
            localStorage.removeItem(storageKey(id))
          }
        }

        const examData = await api.get<ReadingExamStartResponse>(
          `/api/reading/materials/${id}/exam-start`
        )
        if (cancelled) return
        setQuestions(examData.questions)
        setTimeLimitSeconds(examData.timeLimitSeconds)
        setPhase('ready')
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Exam yuklanmadi.')
        setPhase('error')
      }
    },
    [id, navigate]
  )

  const handleGenerate = async () => {
    if (!id) return
    setGenerating(true)
    setError(null)
    try {
      await api.post(`/api/reading/materials/${id}/generate-questions`, {})
      await loadExam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during generation.')
    } finally {
      setGenerating(false)
    }
  }

  const handleReady = useCallback(() => {
    if (!id) return
    const now = Date.now()
    examStartedAtRef.current = now
    setRemainingSeconds(timeLimitSeconds)
    setPhase('active')

    localStorage.setItem(
      storageKey(id),
      JSON.stringify({
        examStartedAt: now,
        timeLimitSeconds,
        questions,
        answers,
      } as StoredExamState)
    )
  }, [id, timeLimitSeconds, questions, answers])

  const handleChangeAnswer = useCallback(
    (qid: string, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [qid]: value }
        if (id && examStartedAtRef.current) {
          localStorage.setItem(
            storageKey(id),
            JSON.stringify({
              examStartedAt: examStartedAtRef.current,
              timeLimitSeconds,
              questions,
              answers: next,
            } as StoredExamState)
          )
        }
        return next
      })
    },
    [id, timeLimitSeconds, questions]
  )

  const submit = useCallback(async () => {
    if (!id || !material || submittedRef.current) return
    submittedRef.current = true
    setPhase('submitting')

    const timeTaken = examStartedAtRef.current
      ? Math.floor((Date.now() - examStartedAtRef.current) / 1000)
      : timeLimitSeconds

    const payload: SubmitReadingExamDTO = {
      materialId: id,
      examMode: true,
      timeTakenSeconds: timeTaken,
      answers: questions.map((q) => ({
        questionId: q.id,
        userAnswer: answers[q.id] ?? '',
      })),
    }

    try {
      const result = await api.post<{ id: string }>('/api/reading/submit', payload)
      localStorage.removeItem(storageKey(id))
      navigate(`/learn/reading/results/${result.id}`, { replace: true })
    } catch (err) {
      submittedRef.current = false
      setPhase('active')
      setError(err instanceof Error ? err.message : "Something went wrong while submitting.")
    }
  }, [id, material, questions, answers, timeLimitSeconds, navigate])

  useEffect(() => {
    if (phase !== 'active') return
    if (remainingSeconds <= 0) {
      submit()
      return
    }
    const t = setTimeout(() => setRemainingSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, remainingSeconds, submit])

  // ═════════════════════════════════════════════════════════════

  if (phase === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  if (phase === 'error' || !material) {
    // MUHIM: backend xato xabari hali ikkala tilda (eski/yangi)
    // bo'lishi mumkin — shuning uchun ikkalasini ham tekshiramiz.
    const noQuestions =
      (error?.toLowerCase().includes('savol') ||
        error?.toLowerCase().includes('question')) ??
      false
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div className="max-w-md rounded-3xl border border-ink/8 bg-white px-6 py-10">
          <p className="mb-4 text-sm text-coral-700">{error ?? 'Material not found.'}</p>
          {noQuestions && material ? (
            <>
              <p className="mb-4 text-xs text-ink-muted">
                AI will prepare 10 variants (5 Easy + 5 Hard) — ~1-2 minutes.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full disabled:opacity-60"
              >
                {generating ? 'Generating…' : 'Generate with AI'}
              </button>
            </>
          ) : (
            <Link to="/learn/reading" className="btn-primary">
              Reading'ga qaytish
            </Link>
          )}
        </div>
      </main>
    )
  }

  const isReady = phase === 'ready'
  const timeCritical = phase === 'active' && remainingSeconds <= 60

  return (
    <main className="min-h-screen bg-cream pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
          Exam
        </span>
        <span className="text-sm font-medium text-ink">{material.title}</span>
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

      <div className="mx-auto max-w-3xl px-5 py-6">
        {isReady && (
          <div className="mb-6 rounded-3xl border-2 border-indigo-500/20 bg-indigo-50/60 p-6 text-center">
            <p className="mb-1 font-display text-lg font-semibold text-ink">Ready for the exam?</p>
            <p className="mb-4 text-sm text-ink-muted">
              {questions.length} questions · {formatTime(timeLimitSeconds)} time.
              You can read the passage and questions in advance — the timer
              only starts once you click "I'm ready".
            </p>
            <button onClick={handleReady} className="btn-primary">
              I'm ready — Start
            </button>
          </div>
        )}

        {error && phase === 'active' && (
          <div className="mb-4 rounded-2xl border border-coral-500/20 bg-coral-500/10 px-4 py-3 text-sm text-coral-700">
            {error}
          </div>
        )}

        <h1 className="mb-4 font-display text-xl font-semibold text-ink">{material.title}</h1>

        <div className="mb-6 max-h-96 overflow-y-auto rounded-3xl border border-ink/8 bg-white p-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {material.content}
          </p>
        </div>

        <ReadingQuestionsList
          questions={questions}
          answers={answers}
          onChangeAnswer={handleChangeAnswer}
          disabled={isReady}
        />

        {phase === 'active' && (
          <div className="mt-8 flex justify-center">
            <button onClick={submit} className="btn-primary px-8">
              Topshirish
            </button>
          </div>
        )}

        {phase === 'submitting' && (
          <p className="mt-8 text-center text-sm text-ink-muted">Submitting…</p>
        )}
      </div>
    </main>
  )
}
