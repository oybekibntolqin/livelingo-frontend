// Writing results — post-submission feedback view.
//
// Composed of five stacked sections, top to bottom:
//   1. Overall score card (big number, IELTS-style)
//   2. Criteria breakdown (four horizontal bars)
//   3. Line-by-line errors (accordion)
//   4. Improvement suggestions (bulleted card)
//   5. Next-level tip (highlighted callout)
//
// The backend returns the submission bundled with a `feedback` object.
// If, for any reason, feedback is missing (e.g. the AI service went
// down mid-submit and only the raw submission was saved), we still
// render what we have and surface a friendly note.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import MotivationalCard from '../components/shared/MotivationalCard'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import type {
  SubmissionResponse,
  WritingErrorItem,
  WritingFeedback,
} from '../lib/writing'

// Rubric criteria used by IELTS-style scoring. We map each one to a
// label the user actually recognises. Other exams either reuse this
// set or leave the extra fields null; either way this renders fine.
const CRITERIA: Array<{
  key: keyof Pick<
    WritingFeedback,
    'taskAchievementScore' | 'coherenceScore' | 'lexicalScore' | 'grammarScore'
  >
  label: string
  hint: string
}> = [
  {
    key: 'taskAchievementScore',
    label: 'Task Achievement',
    hint: 'Did you answer the prompt fully and stay on topic?',
  },
  {
    key: 'coherenceScore',
    label: 'Coherence & Cohesion',
    hint: 'How well ideas flow and connect between sentences and paragraphs.',
  },
  {
    key: 'lexicalScore',
    label: 'Lexical Resource',
    hint: 'Range and accuracy of vocabulary.',
  },
  {
    key: 'grammarScore',
    label: 'Grammatical Range & Accuracy',
    hint: 'Variety of structures and freedom from errors.',
  },
]

export default function WritingResults() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [submission, setSubmission] = useState<SubmissionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!submissionId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<SubmissionResponse>(`/api/writing/submissions/${submissionId}`)
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
  }, [submissionId, navigate])

  // Feedback can live under `feedback` (new shape) or be inlined on the
  // submission itself (older shape). We normalise both here.
  const feedback = useMemo<WritingFeedback | null>(() => {
    if (!submission) return null
    if (submission.feedback) return submission.feedback

    // Fallback — reconstruct from the submission columns directly.
    let parsedErrors: WritingErrorItem[] = []
    if (submission.errors) {
      try {
        const raw = JSON.parse(submission.errors)
        if (Array.isArray(raw)) parsedErrors = raw as WritingErrorItem[]
      } catch {
        /* ignore */
      }
    }
    return {
      overallScore: submission.overallScore,
      taskAchievementScore: submission.taskAchievementScore,
      coherenceScore: submission.coherenceScore,
      lexicalScore: submission.lexicalScore,
      grammarScore: submission.grammarScore,
      generalFeedback: submission.aiFeedback,
      errors: parsedErrors,
      improvements: [],
      nextLevelTip: null,
    }
  }, [submission])

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading your feedback…</p>
      </main>
    )
  }
  if (error || !submission || !feedback) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">
            {error ?? 'That submission is missing.'}
          </p>
          <Link to="/learn/writing" className="btn-primary">
            Back to Writing
          </Link>
        </div>
      </main>
    )
  }

  // IELTS caps at 9, general at 10 — we auto-detect by looking at the
  // scores we have. Anything above 9 → general 10-scale.
  const maxScore = detectMaxScore(feedback)

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <Link
          to="/learn/writing"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Writing
        </Link>
        <Logo size={28} />
      </header>

      <div className="mx-auto max-w-4xl space-y-6 pt-8">
        <div>
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
            Results
          </p>
          <h1 className="font-display text-display-md font-semibold text-ink">
            Your writing, marked.
          </h1>
          {submission.questionText && (
            <p className="mt-3 line-clamp-2 text-sm text-ink-soft">
              <span className="font-medium text-ink">Prompt:</span>{' '}
              {submission.questionText}
            </p>
          )}
        </div>

        {/* Overall score */}
        <ScoreCard
          score={feedback.overallScore}
          maxScore={maxScore}
          wordCount={submission.wordCount}
          minutes={submission.timeTakenMinutes}
        />

        {/* MUHIM: Writing balli 0-9 (IELTS) yoki 0-10 (GENERAL) —
        Reading/Listening'даgi 0-100% dan farqli.  70% chegarasi
        universal bo'lishi uchun, maxScore'ga nisbatan foizga
        aylantiriladi. */}
        <MotivationalCard scorePercent={((feedback.overallScore ?? 0) / maxScore) * 100} />

        {/* Criteria breakdown */}
        <CriteriaCard feedback={feedback} maxScore={maxScore} />

        {/* General feedback */}
        {feedback.generalFeedback && (
          <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-display text-base font-semibold text-ink">
              Examiner's take
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {feedback.generalFeedback}
            </p>
          </section>
        )}

        {/* Errors */}
        {feedback.errors.length > 0 && (
          <ErrorsCard errors={feedback.errors} />
        )}

        {/* Improvements */}
        {feedback.improvements.length > 0 && (
          <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-display text-base font-semibold text-ink">
              How to improve
            </h2>
            <ul className="space-y-2 text-sm text-ink-soft">
              {feedback.improvements.map((tip, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mint-500" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Next-level tip */}
        {feedback.nextLevelTip && (
          <section className="rounded-3xl border border-coral-500/20 bg-gradient-to-br from-coral-50 to-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-coral-700">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
              </svg>
              <h2 className="font-display text-base font-semibold text-ink">
                Path to the next level
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">
              {feedback.nextLevelTip}
            </p>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link to="/learn/writing" className="btn-secondary">
            All questions
          </Link>
          <button
            onClick={() => window.print()}
            className="text-xs font-medium text-ink-muted hover:text-ink"
          >
            Save as PDF
          </button>
        </div>
      </div>
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Overall score card
// ═════════════════════════════════════════════════════════════════
function ScoreCard({
  score,
  maxScore,
  wordCount,
  minutes,
}: {
  score: number | null
  maxScore: number
  wordCount: number
  minutes: number | null
}) {
  const displayScore = score == null ? '—' : score.toFixed(1)
  const percent = score == null ? 0 : Math.min(100, (score / maxScore) * 100)
  return (
    <section className="grid gap-6 rounded-3xl border border-ink/8 bg-white p-6 shadow-sm sm:grid-cols-[auto_1fr]">
      <div className="flex items-center gap-5">
        <div className="relative">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke="#EEEEF3"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke="#5B5FE9"
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${(percent / 100) * 326.7} 326.7`}
              strokeLinecap="round"
              className="transition-[stroke-dasharray] duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold text-ink">
              {displayScore}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
              / {maxScore}
            </span>
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-mono uppercase tracking-widest text-ink-muted">
            Overall band
          </p>
          <p className="font-display text-lg font-semibold text-ink">
            {scoreLabel(score, maxScore)}
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3 border-t border-ink/8 pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <div className="flex items-center gap-2 text-ink-soft">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          <span>
            <span className="font-medium text-ink">{wordCount}</span> words
          </span>
        </div>
        {minutes != null && (
          <div className="flex items-center gap-2 text-ink-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>
              <span className="font-medium text-ink">{minutes}</span> minutes
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

function scoreLabel(score: number | null, max: number): string {
  if (score == null) return 'Not scored'
  const pct = score / max
  if (pct >= 0.85) return 'Excellent'
  if (pct >= 0.7) return 'Strong'
  if (pct >= 0.55) return 'Competent'
  if (pct >= 0.4) return 'Developing'
  return 'Needs work'
}

// ═════════════════════════════════════════════════════════════════
// Criteria breakdown
// ═════════════════════════════════════════════════════════════════
function CriteriaCard({
  feedback,
  maxScore,
}: {
  feedback: WritingFeedback
  maxScore: number
}) {
  const hasAny = CRITERIA.some((c) => feedback[c.key] != null)
  if (!hasAny) return null
  return (
    <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
      <h2 className="mb-5 font-display text-base font-semibold text-ink">
        Criteria breakdown
      </h2>
      <div className="space-y-5">
        {CRITERIA.map((c) => {
          const val = feedback[c.key]
          if (val == null) return null
          const pct = Math.min(100, (val / maxScore) * 100)
          return (
            <div key={c.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{c.label}</p>
                  <p className="text-xs text-ink-muted">{c.hint}</p>
                </div>
                <span className="font-display text-lg font-semibold text-ink tabular-nums">
                  {val.toFixed(1)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ═════════════════════════════════════════════════════════════════
// Errors card
// ═════════════════════════════════════════════════════════════════
function ErrorsCard({ errors }: { errors: WritingErrorItem[] }) {
  return (
    <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-baseline justify-between font-display text-base font-semibold text-ink">
        <span>Line-by-line corrections</span>
        <span className="text-xs font-mono text-ink-muted">
          {errors.length} found
        </span>
      </h2>
      <ul className="space-y-3">
        {errors.map((err, i) => (
          <li
            key={i}
            className="rounded-2xl border border-ink/8 bg-cream/60 p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={typeChip(err.errorType)}>{err.errorType}</span>
            </div>
            <div className="mb-2 space-y-1 text-sm">
              <p>
                <span className="mr-2 text-xs font-mono uppercase text-ink-muted">
                  From:
                </span>
                <span className="rounded bg-coral-100 px-1.5 py-0.5 text-coral-800 line-through decoration-coral-500/50">
                  {err.original}
                </span>
              </p>
              <p>
                <span className="mr-2 text-xs font-mono uppercase text-ink-muted">
                  To:
                </span>
                <span className="rounded bg-mint-100 px-1.5 py-0.5 text-mint-800">
                  {err.corrected}
                </span>
              </p>
            </div>
            {err.explanation && (
              <p className="text-xs text-ink-soft">{err.explanation}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function typeChip(t: string): string {
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider'
  const key = t?.toLowerCase() ?? ''
  if (key.includes('gramm'))
    return `${base} border-indigo-500/25 bg-indigo-50 text-indigo-700`
  if (key.includes('vocab') || key.includes('lex'))
    return `${base} border-coral-500/25 bg-coral-50 text-coral-700`
  if (key.includes('spell'))
    return `${base} border-amber-500/25 bg-amber-50 text-amber-700`
  if (key.includes('punct'))
    return `${base} border-mint-500/25 bg-mint-50 text-mint-700`
  return `${base} border-ink/15 bg-white text-ink-soft`
}

// ═════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════
function detectMaxScore(f: WritingFeedback): number {
  const highest = Math.max(
    ...([
      f.overallScore,
      f.taskAchievementScore,
      f.coherenceScore,
      f.lexicalScore,
      f.grammarScore,
    ].filter((n): n is number => typeof n === 'number'))
  )
  if (highest > 9) return 10
  return 9
}
