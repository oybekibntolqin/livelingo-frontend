// Writing — "My Results". Practice submissions are shown one row
// each; Exam submissions (sharing an examSessionId — multiple
// tasks in one sitting) are GROUPED into a single row, matching
// how the aggregate exam-results page treats them.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import type { Page, WritingSubmission } from '../lib/writing'

interface Row {
  key: string
  isExam: boolean
  examSessionId: string | null
  submissionId: string | null // only for non-exam rows
  questionText: string | null
  score: number | null
  taskCount: number
  createdAt: string
  checked: boolean
}

function toRows(items: WritingSubmission[]): Row[] {
  const rows: Row[] = []
  const examGroups = new Map<string, WritingSubmission[]>()

  for (const s of items) {
    if (s.examSessionId) {
      const list = examGroups.get(s.examSessionId) ?? []
      list.push(s)
      examGroups.set(s.examSessionId, list)
    } else {
      rows.push({
        key: s.id,
        isExam: false,
        examSessionId: null,
        submissionId: s.id,
        questionText: s.questionText,
        score: s.overallScore,
        taskCount: 1,
        createdAt: s.createdAt,
        checked: s.checked,
      })
    }
  }

  for (const [sessionId, tasks] of examGroups) {
    const scores = tasks.map((t) => t.overallScore).filter((x): x is number => x != null)
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const latest = tasks.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
    rows.push({
      key: sessionId,
      isExam: true,
      examSessionId: sessionId,
      submissionId: null,
      questionText: null,
      score: avg,
      taskCount: tasks.length,
      createdAt: latest.createdAt,
      checked: tasks.every((t) => t.checked),
    })
  }

  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export default function WritingMyResults() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<Page<WritingSubmission>>('/api/writing/my-submissions?page=0&size=50')
      .then((page) => {
        if (!cancelled) setRows(toRows(page.content ?? []))
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load your results.')
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
          to="/learn/writing"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Writing
        </Link>
        <span className="text-sm font-medium text-ink">My Results</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-ink-muted">Loading…</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-coral-700">{error}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-ink/8 bg-white px-6 py-14 text-center">
            <p className="mb-1 font-display text-base font-semibold text-ink">
              No results yet
            </p>
            <p className="mb-5 text-sm text-ink-muted">
              Submit your first writing task and your results will show up here.
            </p>
            <Link to="/learn/writing" className="btn-primary">
              Go to Writing
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <ResultRow key={r.key} row={r} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function ResultRow({ row: r }: { row: Row }) {
  const date = new Date(r.createdAt)
  const dateLabel = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const href = r.isExam
    ? `/learn/writing/exam-results/${r.examSessionId}`
    : `/learn/writing/results/${r.submissionId}`

  return (
    <Link
      to={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-ink/8 bg-white px-5 py-4 transition hover:border-indigo-500/30 hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink">
            {r.isExam ? `Exam — ${r.taskCount} tasks` : r.questionText || 'Writing task'}
          </p>
          {r.isExam && (
            <span className="flex-shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Exam
            </span>
          )}
          {!r.checked && (
            <span className="flex-shrink-0 rounded-full bg-sun-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sun-600">
              Checking…
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          {dateLabel} · {timeLabel}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="font-display text-lg font-bold text-ink">
          {r.score != null ? r.score.toFixed(1) : '—'}
        </p>
      </div>
    </Link>
  )
}
