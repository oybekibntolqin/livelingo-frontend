// Writing session — the actual "sit down and write your essay" screen.
//
// Layout on desktop is a fixed split: the question and its visual live
// in the left column, the editor lives in the right. On narrow screens
// we stack vertically with the question on top (collapsed by default so
// the editor stays in reach on phones).
//
// Autosave: every change writes to localStorage under a per-question
// key. If the user closes the tab and comes back, the draft is right
// where they left it. On successful submit we clear the draft.
//
// Timer: counts down from `recommendedMinutes`. It's informational —
// we never auto-submit, because IELTS/TOPIK candidates routinely go
// over the recommended time by a couple of minutes in the real exam.
// Turns coral in the last minute so people know to wrap up.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import QuestionVisual from '../components/writing/QuestionVisual'
import {
  countUnits,
  isCharacterBased,
  LEVEL_TINT,
  type SubmissionResponse,
  type WritingQuestion,
} from '../lib/writing'

const draftKey = (questionId: string) => `livelingo:writing-draft:${questionId}`

interface Draft {
  content: string
  startedAt: number // epoch ms — used to compute time taken on submit
  updatedAt: number
}

function loadDraft(id: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function saveDraft(id: string, draft: Draft) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(draft))
  } catch {
    /* quota — ignore */
  }
}

function clearDraft(id: string) {
  try {
    localStorage.removeItem(draftKey(id))
  } catch {
    /* no-op */
  }
}

export default function WritingSession() {
  const { questionId } = useParams<{ questionId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  // ── State ─────────────────────────────────────────────────────
  const [question, setQuestion] = useState<WritingQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [content, setContent] = useState('')
  const startedAt = useRef<number | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // ── Load question + draft ────────────────────────────────────
  useEffect(() => {
    if (!questionId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    api
      .get<WritingQuestion>(`/api/writing/questions/${questionId}`)
      .then((q) => {
        if (cancelled) return
        setQuestion(q)

        // Rehydrate draft if the user was mid-way.
        const existing = loadDraft(questionId)
        if (existing) {
          setContent(existing.content)
          startedAt.current = existing.startedAt
          setSavedAt(existing.updatedAt)
        } else {
          startedAt.current = Date.now()
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setLoadError(
          err instanceof Error ? err.message : 'Could not load the question.'
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [questionId, navigate])

  // ── Autosave (debounced) ─────────────────────────────────────
  useEffect(() => {
    if (!questionId || !startedAt.current) return
    if (content.length === 0) return
    const t = setTimeout(() => {
      const now = Date.now()
      saveDraft(questionId, {
        content,
        startedAt: startedAt.current!,
        updatedAt: now,
      })
      setSavedAt(now)
    }, 800)
    return () => clearTimeout(t)
  }, [content, questionId])

  // ── Word/char counter ────────────────────────────────────────
  const units = useMemo(
    () => countUnits(content, question?.languageCode ?? 'en'),
    [content, question?.languageCode]
  )
  const unitLabel = question && isCharacterBased(question.languageCode)
    ? 'characters'
    : 'words'
  const min = question?.minWords ?? 0
  const max = question?.maxWords ?? null
  const belowMin = min > 0 && units < min
  const aboveMax = max != null && units > max

  // ── Timer countdown ──────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!question?.recommendedMinutes || !startedAt.current) return
    const totalSec = question.recommendedMinutes * 60
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.current!) / 1000)
      setSecondsLeft(Math.max(0, totalSec - elapsed))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [question?.recommendedMinutes])

  // ── Submit ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = async () => {
    if (!questionId || !question) return
    if (content.trim().length === 0) {
      setSubmitError('Write something before submitting.')
      return
    }
    if (belowMin) {
      const ok = confirm(
        `You're below the minimum (${min} ${unitLabel}). Submit anyway? Your score will suffer.`
      )
      if (!ok) return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const elapsedMin = startedAt.current
        ? Math.round((Date.now() - startedAt.current) / 60000)
        : null
      const res = await api.post<SubmissionResponse>('/api/writing/submit', {
        questionId,
        content,
        timeTakenMinutes: elapsedMin,
      })
      // Draft's job is done — clear it so a fresh visit starts clean.
      clearDraft(questionId)
      navigate(`/learn/writing/results/${res.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setSubmitError(
        err instanceof Error ? err.message : 'Could not submit — try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const abandon = useCallback(() => {
    if (!questionId) return
    const ok = confirm('Discard this draft and go back?')
    if (!ok) return
    clearDraft(questionId)
    navigate('/learn/writing')
  }, [questionId, navigate])

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading the prompt…</p>
      </main>
    )
  }
  if (loadError || !question) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">
            {loadError ?? 'This question does not exist any more.'}
          </p>
          <Link to="/learn/writing" className="btn-primary">
            Back to Writing
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-cream">
      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-ink/8 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={abandon}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="hidden items-center gap-1.5 md:flex">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[question.cefrLevel]}`}>
              {question.cefrLevel}
            </span>
            {question.certificateType && (
              <span className="rounded-full border border-ink/12 bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                {question.certificateType.replace(/_/g, ' ')}
              </span>
            )}
            {question.taskType && (
              <span className="rounded-full border border-indigo-500/20 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                {question.taskType}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {secondsLeft != null && (
            <TimerBadge seconds={secondsLeft} />
          )}
          <WordBadge
            units={units}
            unitLabel={unitLabel}
            min={min}
            max={max}
            belowMin={belowMin}
            aboveMax={aboveMax}
          />
          <Logo size={26} />
        </div>
      </header>

      {/* Body — split */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Question panel */}
        <aside className="overflow-y-auto border-b border-ink/8 bg-white p-6 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-xl space-y-5">
            {question.instructions && (
              <p className="rounded-2xl border border-indigo-500/15 bg-indigo-50/60 p-4 text-sm text-indigo-900">
                {question.instructions}
              </p>
            )}

            <div className="prose prose-sm max-w-none text-ink">
              {question.question.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="mb-3 leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            <QuestionVisual
              visualJson={question.visualJson}
              visualImageUrl={question.visualImageUrl}
            />

            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-ink/6 pt-4 text-xs text-ink-muted">
              {min > 0 && (
                <span>
                  {max != null
                    ? `${min}–${max} ${unitLabel}`
                    : `at least ${min} ${unitLabel}`}
                </span>
              )}
              {question.recommendedMinutes != null && (
                <span>{question.recommendedMinutes} minutes recommended</span>
              )}
              {question.topic && <span>Topic: {question.topic}</span>}
            </div>
          </div>
        </aside>

        {/* Editor panel */}
        <section className="flex flex-col overflow-hidden bg-cream">
          <div className="flex-1 overflow-hidden p-6">
            <div className="mx-auto flex h-full max-w-2xl flex-col">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your response…"
                autoFocus
                className="flex-1 resize-none rounded-3xl border border-ink/8 bg-white p-6 text-base leading-relaxed text-ink shadow-sm outline-none transition placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/10"
                style={{ minHeight: 300 }}
              />
              <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                <span>
                  {savedAt
                    ? `Saved ${timeAgo(savedAt)}`
                    : content.length > 0
                      ? 'Not saved yet'
                      : 'Autosaves as you type'}
                </span>
                <span className="hidden sm:inline">
                  Draft stays in your browser until you submit.
                </span>
              </div>
            </div>
          </div>

          {/* Submit bar */}
          <div className="flex-shrink-0 border-t border-ink/8 bg-white px-6 py-4">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              {submitError ? (
                <p className="flex-1 text-sm text-coral-700">{submitError}</p>
              ) : (
                <p className="flex-1 text-xs text-ink-muted">
                  You'll get a full breakdown as soon as AI grades it.
                </p>
              )}
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Grading…' : 'Submit for grading'}
                {!submitting && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Small badges
// ═════════════════════════════════════════════════════════════════
function TimerBadge({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const isCritical = seconds > 0 && seconds <= 60
  const isOut = seconds === 0
  const color = isOut
    ? 'bg-coral-500 text-white'
    : isCritical
      ? 'bg-coral-50 text-coral-700 border border-coral-500/30 animate-pulse'
      : 'bg-cream text-ink-soft border border-ink/12'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${color}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

function WordBadge({
  units,
  unitLabel,
  min,
  max,
  belowMin,
  aboveMax,
}: {
  units: number
  unitLabel: string
  min: number
  max: number | null
  belowMin: boolean
  aboveMax: boolean
}) {
  const color = belowMin
    ? 'text-coral-700 border-coral-500/30 bg-coral-50'
    : aboveMax
      ? 'text-amber-700 border-amber-500/30 bg-amber-50'
      : 'text-mint-700 border-mint-500/30 bg-mint-50'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold tabular-nums ${color}`}
    >
      {units}
      {min > 0 && ` / ${max != null ? `${min}–${max}` : min}`}
      <span className="hidden text-[10px] font-normal uppercase tracking-wider opacity-70 sm:inline">
        {unitLabel}
      </span>
    </span>
  )
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}
