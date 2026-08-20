// Writing Exam — yig'ma natija (bir necha vazifa birlashtirilgan).

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import MotivationalCard from '../components/shared/MotivationalCard'
import { api, ApiError } from '../lib/api'
import { type WritingExamSessionResult } from '../lib/writing'

export default function WritingExamResults() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [result, setResult] = useState<WritingExamSessionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setLoading(true)
    api
      .get<WritingExamSessionResult>(`/api/writing/exam-session/${sessionId}`)
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
  }, [sessionId, navigate])

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
          <Link to="/learn/writing" className="btn-primary">
            Writing'ga qaytish
          </Link>
        </div>
      </main>
    )
  }

  const scorePercent = (result.overallScore / result.maxScore) * 100

  return (
    <main className="min-h-screen bg-cream pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link to="/learn/writing" className="text-sm font-medium text-ink-soft hover:text-ink">
          ← Writing
        </Link>
        <span className="text-sm font-medium text-ink">Exam natijasi</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-6 rounded-3xl border border-ink/8 bg-white p-6 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-ink-muted">Umumiy ball</p>
          <p className="font-display text-5xl font-bold text-ink">
            {result.overallScore.toFixed(1)}
            <span className="text-2xl text-ink-muted">/{result.maxScore}</span>
          </p>
        </div>

        <MotivationalCard scorePercent={scorePercent} />

        <div className="space-y-4">
          {result.tasks.map((t) => (
            <div key={t.id} className="rounded-3xl border border-ink/8 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-ink">
                  {/* taskType ma'lumoti submission'da yo'q — questionText orqali kontekst beramiz */}
                  Vazifa
                </p>
                <p className="font-display text-lg font-bold text-ink">
                  {t.overallScore != null ? t.overallScore.toFixed(1) : '—'}
                </p>
              </div>
              {t.questionText && (
                <p className="mb-2 line-clamp-2 text-xs text-ink-muted">{t.questionText}</p>
              )}
              {t.aiFeedback && <p className="text-sm text-ink-soft">{t.aiFeedback}</p>}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Link to="/learn/writing/exam" className="btn-primary">
            Yana urinib ko'rish
          </Link>
          <Link
            to="/learn/writing"
            className="rounded-2xl border border-ink/12 px-5 py-2.5 text-sm font-medium text-ink-soft hover:border-ink/25"
          >
            Writing'ga qaytish
          </Link>
        </div>
      </div>
    </main>
  )
}
