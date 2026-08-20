// Listening — Exam mode (v2, to'liq qayta qurilgan).
//
// Practice'дан farqi:
//   • Savollar Easy/Hard ARALASH, materialning katta pool'idan
//     TASODIFIY tanlanadi (backend: GET .../exam-start)
//   • Vaqt CHEKLANGAN — "Men tayyorman" bosilgandagina boshlanadi
//   • Audio "Men tayyorman"da AVTOMATIK ijro etiladi
//   • Vaqt tugasa — AVTOMATIK submit (bo'sh javoblar bilan ham)
//
// Oqim:
//   loading → ready (savollar KO'RINADI, lekin javob berib
//   bo'lmaydi — faqat o'qish uchun) → "Men tayyorman" → active
//   (timer + audio boshlanadi, javob berish ochiladi) → submit →
//   natija sahifasiga o'tish.
//
// Refresh himoyasi: exam boshlangandan keyin holat localStorage'da
// saqlanadi — sahifa qayta yuklansa, TIMER TO'G'RI DAVOM ETADI
// (qaytadan to'liq vaqt berilmaydi), savollar qayta so'ralmaydi
// (aks holda YANGI tasodifiy savollar kelib, avvalgi javoblar
// mos kelmay qolardi).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import AudioPlayer from '../components/listening/AudioPlayer'
import { QuestionsList } from '../components/listening/QuestionsList'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  formatTime,
  groupBySection,
  type ListeningExamStartResponse,
  type ListeningMaterial,
  type ListeningQuestionPublic,
  type SubmitListeningExamDTO,
} from '../lib/listening'

type Phase = 'loading' | 'ready' | 'active' | 'submitting' | 'error'

interface StoredExamState {
  examStartedAt: number
  timeLimitSeconds: number
  questions: ListeningQuestionPublic[]
  answers: Record<string, string>
}

const storageKey = (materialId: string) => `livelingo:exam-session:${materialId}`

export default function ListeningExam() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [phase, setPhase] = useState<Phase>('loading')
  const [material, setMaterial] = useState<ListeningMaterial | null>(null)
  const [questions, setQuestions] = useState<ListeningQuestionPublic[]>([])
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const examStartedAtRef = useRef<number | null>(null)
  const submittedRef = useRef(false) // ikki marta submit bo'lib ketmasligi uchun

  // ── Yuklash: material + exam-start (yoki localStorage'даgi davom
  // etayotgan sessiya) ──────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setPhase('loading')
      setError(null)
      try {
        const m = await api.get<ListeningMaterial>(`/api/listening/materials/${id}`)
        if (cancelled) return
        setMaterial(m)

        // Davom etayotgan sessiya bormi?
        const raw = localStorage.getItem(storageKey(id!))
        if (raw) {
          try {
            const stored = JSON.parse(raw) as StoredExamState
            const elapsed = Math.floor((Date.now() - stored.examStartedAt) / 1000)
            if (elapsed < stored.timeLimitSeconds) {
              // Hali vaqt bor — davom ettiramiz
              setQuestions(stored.questions)
              setTimeLimitSeconds(stored.timeLimitSeconds)
              setAnswers(stored.answers)
              examStartedAtRef.current = stored.examStartedAt
              setRemainingSeconds(stored.timeLimitSeconds - elapsed)
              setPhase('active')
              return
            }
            // Vaqt allaqachon tugagan — saqlangan javoblar bilan
            // avtomatik submit qilamiz
            setQuestions(stored.questions)
            setTimeLimitSeconds(stored.timeLimitSeconds)
            setAnswers(stored.answers)
            examStartedAtRef.current = stored.examStartedAt
            setPhase('active')
            setRemainingSeconds(0)
            return
          } catch {
            localStorage.removeItem(storageKey(id!))
          }
        }

        // Yangi sessiya — random savollarni so'raymiz
        const examData = await api.get<ListeningExamStartResponse>(
            `/api/listening/materials/${id}/exam-start`
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
        setError(err instanceof Error ? err.message : 'Failed to load the exam.')
        setPhase('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  const grouped = useMemo(() => groupBySection(questions), [questions])

  // ── "Men tayyorman" — timer va audio shu yerda boshlanadi ─────
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

    // Audio — foydalanuvchi bosgan tugma ичida chaqirilgani uchun
    // brauzerning autoplay bloki ishlamaydi.
    audioElRef.current?.play().catch(() => {
      /* audio yo'q yoki play muvaffaqiyatsiz — baribir davom etamiz */
    })
  }, [id, timeLimitSeconds, questions, answers])

  // ── Javob o'zgarganda localStorage'ni yangilaymiz ──────────────
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

  // ── Submit — qo'lda yoki vaqt tugaganda avtomatik ──────────────
  const submit = useCallback(async () => {
    if (!id || !material || submittedRef.current) return
    submittedRef.current = true
    setPhase('submitting')

    const timeTaken = examStartedAtRef.current
        ? Math.floor((Date.now() - examStartedAtRef.current) / 1000)
        : timeLimitSeconds

    // MUHIM: javob bermagan savollar ham yuboriladi (bo'sh matn
    // bilan) — backend buni "noto'g'ri" deb hisoblaydi (aytganingiz-
    // dek, null/bo'sh = yechilmagan).
    const payload: SubmitListeningExamDTO = {
      materialId: id,
      examMode: true,
      timeTakenSeconds: timeTaken,
      answers: questions.map((q) => ({
        questionId: q.id,
        userAnswer: answers[q.id] ?? '',
      })),
    }

    try {
      const result = await api.post<{ id: string }>('/api/listening/submit', payload)
      localStorage.removeItem(storageKey(id))
      navigate(`/learn/listening/results/${result.id}`, { replace: true })
    } catch (err) {
      submittedRef.current = false
      setPhase('active')
      setError(
          err instanceof Error
              ? err.message
              : 'Failed to submit. Please try again.'
      )
    }
  }, [id, material, questions, answers, timeLimitSeconds, navigate])

  // ── Timer — har soniyada kamayadi, 0 bo'lsa avtomatik submit ───
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
    return (
        <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
          <div>
            <p className="mb-4 text-sm text-coral-700">
              {error ?? 'Material not found.'}
            </p>
            <Link to="/learn/listening/practice" className="btn-primary">
              Back to Practice
            </Link>
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
                      timeCritical
                          ? 'animate-pulse bg-coral-500/15 text-coral-700'
                          : 'bg-indigo-500/10 text-indigo-700'
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
                <p className="mb-1 font-display text-lg font-semibold text-ink">
                  Ready for the exam?
                </p>
                <p className="mb-4 text-sm text-ink-muted">
                  {questions.length} questions · {formatTime(timeLimitSeconds)} time.
                  You can read the questions below in advance — the timer and
                  audio only start once you click "I'm ready".
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

          <div className="mb-6">
            <AudioPlayer
                src={material.audioUrl ?? ''}
                title={material.title}
                onAudioRef={(el) => {
                  audioElRef.current = el
                }}
            />
          </div>

          <QuestionsList
              grouped={grouped}
              answers={answers}
              onChangeAnswer={handleChangeAnswer}
              disabled={isReady}
          />

          {phase === 'active' && (
              <div className="mt-8 flex justify-center">
                <button
                    onClick={submit}
                    className="btn-primary px-8"
                >
                  Topshirish
                </button>
              </div>
          )}

          {phase === 'submitting' && (
              <p className="mt-8 text-center text-sm text-ink-muted">
                Submitting…
              </p>
          )}
        </div>
      </main>
  )
}
