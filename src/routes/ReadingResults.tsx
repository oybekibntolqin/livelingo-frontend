// Reading — bitta submission'нинг to'liq natijasi.
// Exam topshirilgandan keyin, yoki "Mening natijalarim"дan kirilganda
// ishlatiladi.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import MotivationalCard from '../components/shared/MotivationalCard'
import { api, ApiError } from '../lib/api'
import { formatTime, type ReadingSubmission } from '../lib/reading'

export default function ReadingResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [result, setResult] = useState<ReadingSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<ReadingSubmission>(`/api/reading/submissions/${id}`)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Natijani yuklab boʻlmadi.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Yuklanmoqda…</p>
      </main>
    )
  }

  if (error || !result) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">{error ?? 'Natija topilmadi.'}</p>
          <Link to="/learn/reading" className="btn-primary">
            Reading'ga qaytish
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link to="/learn/reading" className="text-sm font-medium text-ink-soft hover:text-ink">
          ← Reading
        </Link>
        <span className="text-sm font-medium text-ink">Natija</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-2 flex items-center justify-center gap-2">
          {result.examMode && (
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Exam
            </span>
          )}
          {result.difficulty && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                result.difficulty === 'EASY'
                  ? 'bg-mint-500/15 text-mint-700'
                  : 'bg-coral-500/15 text-coral-700'
              }`}
            >
              {result.difficulty}
            </span>
          )}
        </div>
        <p className="mb-6 text-center text-sm text-ink-muted">{result.materialTitle}</p>

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
          {result.timeTakenSeconds != null && (
            <p className="mt-1 text-xs text-ink-muted">
              Vaqt: {formatTime(result.timeTakenSeconds)}
            </p>
          )}
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
                Sizning javobingiz: <strong>{a.userAnswer || "(bo'sh)"}</strong>
              </p>
              {!a.correct && (
                <p className="pl-7 text-xs text-ink-soft">
                  To'g'ri javob: <strong>{a.correctAnswer}</strong>
                </p>
              )}
              {a.explanation && (
                <p className="mt-1 pl-7 text-xs italic text-ink-muted">{a.explanation}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Link to="/learn/reading/my-results" className="btn-primary">
            Barcha natijalarim
          </Link>
          <Link
            to="/learn/reading"
            className="rounded-2xl border border-ink/12 px-5 py-2.5 text-sm font-medium text-ink-soft hover:border-ink/25"
          >
            Reading'ga qaytish
          </Link>
        </div>
      </div>
    </main>
  )
}
