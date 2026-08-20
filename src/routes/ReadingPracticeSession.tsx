// Reading Practice — session.
//
// Listening'даgi ListeningPracticeSession bilan bir xil naqsh, lekin:
//   • Audio o'rniga MATN (scroll qilinadigan panel)
//   • Natijalar SHU SAHIFANING O'ZIDA ko'rsatiladi (alohida
//     natija sahifasiga o'tilmaydi — soddalashtirish uchun)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import MotivationalCard from '../components/shared/MotivationalCard'
import { ReadingQuestionsList } from '../components/reading/ReadingQuestionsList'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  LEVEL_TINT,
  type ReadingExamResponse,
  type ReadingMaterial,
  type ReadingQuestionPublic,
  type ReadingSubmission,
  type SubmitReadingExamDTO,
} from '../lib/reading'

const answersKey = (id: string) => `livelingo:reading-practice-answers:${id}`

export default function ReadingPracticeSession() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [material, setMaterial] = useState<ReadingMaterial | null>(null)
  const [questions, setQuestions] = useState<ReadingQuestionPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [needsDifficulty, setNeedsDifficulty] = useState(false)
  const [difficulty, setDifficulty] = useState<'EASY' | 'HARD' | null>(null)
  const [variantIndex, setVariantIndex] = useState<number | null>(null)
  const [totalVariants, setTotalVariants] = useState(0)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [result, setResult] = useState<ReadingSubmission | null>(null)

  const startedAt = useState(() => Date.now())[0]

  const loadMaterialAndQuestions = useCallback(
    async (chosenDifficulty?: 'EASY' | 'HARD') => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const materialPromise = api.get<ReadingMaterial>(`/api/reading/materials/${id}`)

        const qsUrl = chosenDifficulty
          ? `/api/reading/materials/${id}/exam-questions?difficulty=${chosenDifficulty}`
          : `/api/reading/materials/${id}/exam-questions`

        const [m, examResp] = await Promise.all([
          materialPromise,
          api.get<ReadingExamResponse>(qsUrl).catch((err) => {
            if (err instanceof ApiError && err.status === 400 && !chosenDifficulty) {
              return null
            }
            throw err
          }),
        ])

        setMaterial(m)

        if (examResp === null) {
          setNeedsDifficulty(true)
          setQuestions([])
        } else {
          setNeedsDifficulty(false)
          setDifficulty(examResp.difficulty)
          setVariantIndex(examResp.variantIndex)
          setTotalVariants(examResp.totalVariants)
          setQuestions(examResp.questions ?? [])

          try {
            const saved = localStorage.getItem(answersKey(id))
            if (saved) setAnswers(JSON.parse(saved))
          } catch {}
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load the material.')
      } finally {
        setLoading(false)
      }
    },
    [id, navigate]
  )

  const selectDifficulty = (d: 'EASY' | 'HARD') => {
    loadMaterialAndQuestions(d)
  }

  const handleGenerate = async () => {
    if (!id) return
    setGenerating(true)
    setGenerateError(null)
    try {
      await api.post(`/api/reading/materials/${id}/generate-questions`, {})
      // Generatsiya tugagach, savollarni qayta so'raymiz
      await loadMaterialAndQuestions()
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : 'An error occurred during generation.'
      )
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadMaterialAndQuestions()
  }, [loadMaterialAndQuestions])

  const handleChangeAnswer = useCallback(
    (qid: string, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [qid]: value }
        if (id) {
          try {
            localStorage.setItem(answersKey(id), JSON.stringify(next))
          } catch {}
        }
        return next
      })
    },
    [id]
  )

  const totalAnswered = useMemo(
    () => Object.values(answers).filter((v) => v && v.trim().length > 0).length,
    [answers]
  )

  const submit = async () => {
    if (!material || questions.length === 0) return
    if (totalAnswered < questions.length) {
      const ok = confirm(
        `You've answered ${totalAnswered} / ${questions.length} questions. Submit anyway?`
      )
      if (!ok) return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const dto: SubmitReadingExamDTO = {
        materialId: material.id,
        examMode: false,
        timeTakenSeconds: Math.round((Date.now() - startedAt) / 1000),
        answers: questions.map((q) => ({
          questionId: q.id,
          userAnswer: (answers[q.id] ?? '').trim(),
        })),
      }
      const res = await api.post<ReadingSubmission>('/api/reading/submit', dto)
      try {
        localStorage.removeItem(answersKey(material.id))
      } catch {}
      setResult(res)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong while submitting.')
    } finally {
      setSubmitting(false)
    }
  }

  // ═════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  if (error || !material) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">{error ?? 'Material not found.'}</p>
          <Link to="/learn/reading" className="btn-primary">
            Back to Reading
          </Link>
        </div>
      </main>
    )
  }

  // Easy/Hard tanlov ekrani
  if (needsDifficulty && !difficulty) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5">
        <div className="w-full max-w-md text-center">
          <p className="mb-1 font-display text-lg font-semibold text-ink">{material.title}</p>
          <p className="mb-8 text-sm text-ink-muted">Choose a difficulty level</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => selectDifficulty('EASY')}
              className="group rounded-3xl border-2 border-mint-500/30 bg-white p-6 text-left transition hover:border-mint-500 hover:shadow-lift"
            >
              <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-mint-500/15 text-mint-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 6L3 12l5 6M16 6l5 6-5 6" />
                </svg>
              </div>
              <p className="font-display text-base font-semibold text-ink">Easy</p>
              <p className="mt-1 text-xs text-ink-muted">Standard difficulty</p>
            </button>

            <button
              onClick={() => selectDifficulty('HARD')}
              className="group rounded-3xl border-2 border-coral-500/30 bg-white p-6 text-left transition hover:border-coral-500 hover:shadow-lift"
            >
              <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-coral-500/15 text-coral-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                </svg>
              </div>
              <p className="font-display text-base font-semibold text-ink">Hard</p>
              <p className="mt-1 text-xs text-ink-muted">Harder — requires drawing conclusions</p>
            </button>
          </div>

          <Link to="/learn/reading" className="mt-6 inline-block text-xs font-medium text-ink-muted hover:text-ink">
            ← Back to Reading
          </Link>
        </div>
      </main>
    )
  }

  // Savollar hali generatsiya qilinmagan
  if (!needsDifficulty && questions.length === 0 && !result) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div className="max-w-md rounded-3xl border border-ink/8 bg-white px-6 py-10">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v1M12 20v1M4.22 4.22l.707.707M18.36 18.36l.707.707M2 12h1M21 12h1M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          </div>
          <p className="mb-1 font-display text-base font-semibold text-ink">No questions yet</p>
          <p className="mb-5 text-sm text-ink-muted">
            AI will generate questions from this material's text — 10
            variants (5 Easy + 5 Hard). This takes about 1-2 minutes.
          </p>

          {generateError && (
            <p className="mb-3 text-xs text-coral-700">{generateError}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary w-full disabled:opacity-60"
          >
            {generating ? 'Generating… (~1-2 min)' : 'Generate with AI'}
          </button>
          <Link to={`/learn/reading/${material.id}`} className="mt-4 inline-block text-xs font-medium text-ink-muted hover:text-ink">
            ← Back to Material
          </Link>
        </div>
      </main>
    )
  }

  // Natija ekrani (shu sahifaning o'zida)
  if (result) {
    return (
      <main className="min-h-screen bg-cream pb-24">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
          <Link to="/learn/reading" className="text-sm font-medium text-ink-soft hover:text-ink">
            ← Reading
          </Link>
          <span className="text-sm font-medium text-ink">Result</span>
          <Logo size={26} />
        </header>

        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-6 rounded-3xl border border-ink/8 bg-white p-6 text-center">
            <p className="font-display text-4xl font-bold text-ink">
              {result.correctCount}/{result.totalCount}
            </p>
            <p
              className={`mt-1 text-lg font-semibold ${
                result.scorePercent >= 70
                  ? 'text-mint-600'
                  : result.scorePercent >= 40
                    ? 'text-sun-600'
                    : 'text-coral-600'
              }`}
            >
              {result.scorePercent}%
            </p>
          </div>

          <MotivationalCard scorePercent={result.scorePercent} />

          <div className="space-y-3">
            {result.answers.map((a) => (
              <div
                key={a.questionId}
                className={`rounded-2xl border p-4 ${
                  a.correct ? 'border-mint-500/20 bg-mint-500/5' : 'border-coral-500/20 bg-coral-500/5'
                }`}
              >
                <div className="mb-1 flex items-start gap-2">
                  <span
                    className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${
                      a.correct ? 'bg-mint-500' : 'bg-coral-500'
                    }`}
                  >
                    {a.correct ? '✓' : '✕'}
                  </span>
                  <p className="text-sm font-medium text-ink">{a.question}</p>
                </div>
                <p className="pl-7 text-xs text-ink-soft">
                  Your answer: <strong>{a.userAnswer || '(empty)'}</strong>
                </p>
                {!a.correct && (
                  <p className="pl-7 text-xs text-ink-soft">
                    Correct answer: <strong>{a.correctAnswer}</strong>
                  </p>
                )}
                {a.explanation && (
                  <p className="mt-1 pl-7 text-xs italic text-ink-muted">{a.explanation}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link to={`/learn/reading/practice/${material.id}`} className="btn-primary" onClick={() => window.location.reload()}>
              Try Again
            </Link>
            <Link to="/learn/reading" className="rounded-2xl border border-ink/12 px-5 py-2.5 text-sm font-medium text-ink-soft hover:border-ink/25">
              Back to Reading
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Asosiy — matn + savollar
  return (
    <main className="min-h-screen bg-cream pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link to="/learn/reading" className="text-sm font-medium text-ink-soft hover:text-ink">
          ← Reading
        </Link>
        <span className="text-sm font-medium text-ink">Practice</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${LEVEL_TINT[material.cefrLevel]}`}>
            {material.cefrLevel}
          </span>
          {difficulty && variantIndex && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                difficulty === 'EASY' ? 'bg-mint-500/15 text-mint-700' : 'bg-coral-500/15 text-coral-700'
              }`}
            >
              {difficulty} · Variant {variantIndex}/{totalVariants}
            </span>
          )}
        </div>
        <h1 className="mb-6 font-display text-xl font-semibold text-ink">{material.title}</h1>

        <div className="mb-6 max-h-96 overflow-y-auto rounded-3xl border border-ink/8 bg-white p-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {material.content}
          </p>
        </div>

        <ReadingQuestionsList questions={questions} answers={answers} onChangeAnswer={handleChangeAnswer} />

        {submitError && (
          <div className="mt-4 rounded-2xl border border-coral-500/20 bg-coral-500/10 px-4 py-3 text-sm text-coral-700">
            {submitError}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button onClick={submit} disabled={submitting} className="btn-primary px-8 disabled:opacity-60">
            {submitting ? 'Submitting…' : `Submit (${totalAnswered}/${questions.length})`}
          </button>
        </div>
      </div>
    </main>
  )
}
