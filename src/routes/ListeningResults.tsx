// Listening — Results.
//
// Shown after Exam submit and also reachable from the material's
// "Recent attempts" list.  Four stacked sections:
//   1. Big overall score
//   2. Section breakdown (progress bars per Task/Section)
//   3. Per-question review — user vs correct, timestamp link
//   4. Actions (retry, back to material)

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import MotivationalCard from '../components/shared/MotivationalCard'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  formatTime,
  groupBySection,
  parseOptions,
  type AnswerResult,
  type ListeningSubmission,
} from '../lib/listening'

export default function ListeningResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [submission, setSubmission] = useState<ListeningSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<ListeningSubmission>(`/api/listening/submissions/${id}`)
      .then((s) => {
        if (!cancelled) setSubmission(s)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load results.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  // Group per-answer results by section, in orderIndex order.
  const groupedAnswers = useMemo(() => {
    if (!submission) return []
    const sorted = [...submission.answers].sort(
      (a, b) => a.orderIndex - b.orderIndex
    )
    return groupBySection(sorted)
  }, [submission])

  // Per-section score breakdown.
  const sectionScores = useMemo(() => {
    return groupedAnswers.map((g) => ({
      section: g.section,
      correct: g.items.filter((a) => a.correct).length,
      total: g.items.length,
    }))
  }, [groupedAnswers])

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading your results…</p>
      </main>
    )
  }
  if (error || !submission) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">
            {error ?? 'Submission not found.'}
          </p>
          <Link to="/learn/listening" className="btn-primary">
            Back to Listening
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <Link
          to={`/learn/listening/material/${submission.materialId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Material
        </Link>
        <Logo size={28} />
      </header>

      <div className="mx-auto max-w-4xl space-y-6 pt-8">
        <div>
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
            Results
          </p>
          <h1 className="font-display text-display-md font-semibold text-ink">
            {submission.materialTitle}
          </h1>
        </div>

        {/* Overall score */}
        <ScoreCard submission={submission} />
        <MotivationalCard scorePercent={submission.scorePercent} />

        {/* Section breakdown */}
        {sectionScores.length > 1 && (
          <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-display text-base font-semibold text-ink">
              Section breakdown
            </h2>
            <div className="space-y-4">
              {sectionScores.map((s) => {
                const pct = Math.round((100 * s.correct) / s.total)
                return (
                  <div key={s.section}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <p className="text-sm font-medium text-ink">
                        {s.section}
                      </p>
                      <span className="font-mono text-xs text-ink-soft tabular-nums">
                        {s.correct} / {s.total} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cream">
                      <div
                        className={`h-full transition-[width] duration-700 ${barColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Per-question review */}
        <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
          <h2 className="mb-5 font-display text-base font-semibold text-ink">
            Review answers
          </h2>
          <div className="space-y-6">
            {groupedAnswers.map((group) => (
              <div key={group.section}>
                {sectionScores.length > 1 && (
                  <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                    {group.section}
                  </p>
                )}
                <ul className="space-y-3">
                  {group.items.map((a) => (
                    <AnswerRow
                      key={a.questionId}
                      answer={a}
                      materialId={submission.materialId}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            to={`/learn/listening/practice/${submission.materialId}`}
            className="btn-secondary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 18v-6a9 9 0 0118 0v6" />
            </svg>
            Listen again
          </Link>
          <Link
            to={`/learn/listening/material/${submission.materialId}`}
            className="btn-primary"
          >
            Back to material
          </Link>
        </div>
      </div>
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Score card
// ═════════════════════════════════════════════════════════════════
function ScoreCard({ submission }: { submission: ListeningSubmission }) {
  const pct = submission.scorePercent
  const circumference = 2 * Math.PI * 52
  const dash = (pct / 100) * circumference
  return (
    <section className="grid gap-6 rounded-3xl border border-ink/8 bg-white p-6 shadow-sm sm:grid-cols-[auto_1fr]">
      <div className="flex items-center gap-5">
        <div className="relative">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle cx="60" cy="60" r="52" stroke="#EEEEF3" strokeWidth="10" fill="none" />
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke={pct >= 80 ? '#4ECDC4' : pct >= 60 ? '#5B5FE9' : '#FF8A65'}
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
              className="transition-[stroke-dasharray] duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold text-ink">{pct}%</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
              score
            </span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-ink-muted">
            {label(pct)}
          </p>
          <p className="font-display text-lg font-semibold text-ink">
            {submission.correctCount} / {submission.totalCount} correct
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3 border-t border-ink/8 pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        {submission.timeTakenSeconds != null && (
          <div className="flex items-center gap-2 text-ink-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>
              <span className="font-medium text-ink">
                {formatTime(submission.timeTakenSeconds)}
              </span>{' '}
              spent
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-ink-soft">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>Submitted {new Date(submission.submittedAt).toLocaleString()}</span>
        </div>
      </div>
    </section>
  )
}

function label(pct: number): string {
  if (pct >= 90) return 'Excellent'
  if (pct >= 75) return 'Great job'
  if (pct >= 60) return 'Good — keep going'
  if (pct >= 40) return 'Developing'
  return 'Keep practicing'
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-mint-500'
  if (pct >= 60) return 'bg-indigo-500'
  return 'bg-coral-500'
}

// ═════════════════════════════════════════════════════════════════
// One review row
// ═════════════════════════════════════════════════════════════════
function AnswerRow({
  answer: a,
  materialId,
}: {
  answer: AnswerResult
  materialId: string
}) {
  const options = useMemo(() => parseOptions(a.options), [a.options])

  return (
    <li
      className={`rounded-2xl border p-4 ${a.correct ? 'border-mint-500/25 bg-mint-50/40' : 'border-coral-500/25 bg-coral-50/40'}`}
    >
      <div className="mb-2 flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold tabular-nums ${a.correct ? 'bg-mint-500 text-white' : 'bg-coral-500 text-white'}`}
        >
          {a.correct ? '✓' : '✗'}
        </span>
        <p className="flex-1 text-sm leading-relaxed text-ink">
          {a.orderIndex}. {a.question}
        </p>
      </div>

      <div className="space-y-1.5 pl-9 text-sm">
        <p>
          <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            You
          </span>
          <span
            className={`rounded px-1.5 py-0.5 ${a.correct ? 'bg-mint-100 text-mint-800' : 'bg-coral-100 text-coral-800'}`}
          >
            {a.userAnswer || '(no answer)'}
          </span>
        </p>
        {!a.correct && (
          <p>
            <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              Correct
            </span>
            <span className="rounded bg-mint-100 px-1.5 py-0.5 text-mint-800">
              {a.correctAnswer.split('|')[0]}
            </span>
            {a.correctAnswer.includes('|') && (
              <span className="ml-2 text-xs text-ink-muted">
                (also accepted: {a.correctAnswer.split('|').slice(1).join(', ')})
              </span>
            )}
          </p>
        )}
        {a.timestampSeconds != null && (
          <p className="pt-1">
            <Link
              to={`/learn/listening/practice/${materialId}?t=${a.timestampSeconds}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              💡 Listen at {formatTime(a.timestampSeconds)}
            </Link>
          </p>
        )}
      </div>

      {(a.questionType === 'MCQ' || a.questionType === 'TRUE_FALSE') &&
        options.length > 0 && (
          <p className="mt-2 pl-9 text-xs text-ink-muted">
            Options were: {options.join(' · ')}
          </p>
        )}
    </li>
  )
}
