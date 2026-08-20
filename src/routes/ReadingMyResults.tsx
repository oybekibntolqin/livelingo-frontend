// Reading — "Mening natijalarim". Listening'даgi bilan bir xil
// naqsh — sodda ro'yxat, grafiksiz (Analytics sahifasiga qoldirilgan).

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import { formatTime, type ReadingSubmission } from '../lib/reading'

export default function ReadingMyResults() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [submissions, setSubmissions] = useState<ReadingSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<ReadingSubmission[]>('/api/reading/my-submissions')
      .then((list) => {
        if (!cancelled) setSubmissions(list ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Natijalarni yuklab boʻlmadi.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <main className="min-h-screen bg-cream pb-16">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link
          to="/learn/reading"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Reading
        </Link>
        <span className="text-sm font-medium text-ink">Mening natijalarim</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-ink-muted">Yuklanmoqda…</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-coral-700">{error}</p>
        ) : submissions.length === 0 ? (
          <div className="rounded-3xl border border-ink/8 bg-white px-6 py-14 text-center">
            <p className="mb-1 font-display text-base font-semibold text-ink">
              Hali natijalar yo'q
            </p>
            <p className="mb-5 text-sm text-ink-muted">
              Birinchi reading testini yechib ko'ring — natijalar shu yerda
              to'planib boradi.
            </p>
            <Link to="/learn/reading" className="btn-primary">
              Reading'ga o'tish
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <SubmissionRow key={s.id} submission={s} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function SubmissionRow({ submission: s }: { submission: ReadingSubmission }) {
  const date = new Date(s.submittedAt)
  const dateLabel = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link
      to={`/learn/reading/results/${s.id}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-ink/8 bg-white px-5 py-4 transition hover:border-indigo-500/30 hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink">{s.materialTitle}</p>
          {s.examMode && (
            <span className="flex-shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Exam
            </span>
          )}
          {s.difficulty && (
            <span
              className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                s.difficulty === 'EASY'
                  ? 'bg-mint-500/15 text-mint-700'
                  : 'bg-coral-500/15 text-coral-700'
              }`}
            >
              {s.difficulty}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          {dateLabel} · {timeLabel}
          {s.timeTakenSeconds != null && ` · ${formatTime(s.timeTakenSeconds)}`}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="font-display text-lg font-bold text-ink">
          {s.correctCount}/{s.totalCount}
        </p>
        <p
          className={`text-xs font-semibold ${
            s.scorePercent >= 70
              ? 'text-mint-600'
              : s.scorePercent >= 40
                ? 'text-sun-600'
                : 'text-coral-600'
          }`}
        >
          {s.scorePercent}%
        </p>
      </div>
    </Link>
  )
}
