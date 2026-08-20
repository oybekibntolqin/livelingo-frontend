// Writing browse page.
//
// Layout mirrors the Reading page so the two feel like siblings:
//   • Language dropdown + level chips + certificate chips + task-type chips
//   • Question card grid
//   • "Random question" primary action
//   • "Add question" button for TEACHER / ADMIN / OWNER
//   • "Generate with AI" button for ADMIN / OWNER only (calls the
//     existing /api/admin/content/writing endpoint)
//
// Cards navigate to /learn/writing/session/:id where the user actually
// writes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import GenerateWritingModal from '../components/writing/GenerateWritingModal'
import AddWritingQuestionModal from '../components/writing/AddWritingQuestionModal'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  getCurrentUser,
  canGenerateWithAi,
  type CurrentUser,
} from '../lib/user'
import {
  LANG_OPTIONS,
  CERTS_BY_LANG,
  LEVELS,
  LEVEL_TINT,
  isCharacterBased,
  type CefrLevel,
  type Page,
  type WritingQuestion,
} from '../lib/writing'

// Task types worth surfacing as filter chips. AI or teacher input can
// stuff anything into this field, so we treat it as free-text but
// suggest common ones per language for a nicer UX.
const COMMON_TASKS_BY_LANG: Record<string, string[]> = {
  en: ['Task 1', 'Task 2', 'Email', 'Discussion', 'Letter', 'Essay'],
  ko: ['Q52', 'Q53', 'Q54'],
  de: ['Brief', 'E-Mail', 'Aufsatz'],
  fr: ['Postcard', 'Email', 'Letter', 'Essay', 'Report'],
  es: ['Mensaje', 'Carta', 'Ensayo', 'Informe'],
  zh: ['Task 1', 'Task 2', 'Essay'],
  ja: ['Essay'],
  ru: ['Letter', 'Essay'],
  uz: ['Essay', 'Letter'],
}

export default function Writing() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  // Filters
  const [lang, setLang] = useState('en')
  const [level, setLevel] = useState<CefrLevel | ''>('')
  const [cert, setCert] = useState('')
  const [task, setTask] = useState('')

  // Data
  const [questions, setQuestions] = useState<WritingQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Role — decides which action buttons appear.
  const [user, setUser] = useState<CurrentUser | null>(null)
  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {
        // Non-fatal: we just hide the extra buttons.
      })
  }, [])

  // Prefer the user's actively-learning language as the initial filter.
  useEffect(() => {
    let cancelled = false
    api
      .get<{
        languageCode: string
        languageRole: 'NATIVE' | 'LEARNING'
      }[]>('/api/languages')
      .then((langs) => {
        if (cancelled) return
        const learning = langs.filter((l) => l.languageRole === 'LEARNING')
        if (learning.length > 0) setLang(learning[0].languageCode)
      })
      .catch(() => {
        /* keep default lang='en' */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reset cert + task if the language changed so we don't hold onto a
  // filter that's meaningless for the new language.
  useEffect(() => {
    setCert('')
    setTask('')
  }, [lang])

  // ── Load questions ────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ lang, page: '0', size: '60' })
      if (level) qs.set('level', level)
      if (cert) qs.set('cert', cert)
      const page = await api.get<Page<WritingQuestion>>(
        `/api/writing/questions?${qs}`
      )
      let list = page.content ?? []
      // Task-type filter is client-side because the backend doesn't
      // take it on the questions endpoint yet.
      if (task) list = list.filter((q) => (q.taskType ?? '').toLowerCase() === task.toLowerCase())
      setQuestions(list)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load questions.')
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [lang, level, cert, task, navigate])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  // ── Random question ───────────────────────────────────────────
  const openRandom = async () => {
    try {
      const qs = new URLSearchParams({ lang })
      if (cert) qs.set('cert', cert)
      if (task) qs.set('task', task)
      const q = await api.get<WritingQuestion>(
        `/api/writing/questions/random?${qs}`
      )
      if (q?.id) navigate(`/learn/writing/session/${q.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No question matched.')
    }
  }

  const availableCerts = CERTS_BY_LANG[lang] ?? ['GENERAL']
  const availableTasks = COMMON_TASKS_BY_LANG[lang] ?? []

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-0 top-60 h-72 w-72 rounded-full bg-coral-500/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Learn
        </Link>
        <div className="flex items-center gap-4">
          <Link
              to="/learn/writing/my-results"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            My Results
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Logo size={28} />
        </div>
      </header>

      <div className="mx-auto max-w-6xl pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
              Writing
            </p>
            <h1 className="font-display text-display-md font-semibold text-ink">
              Real exam prompts, marked by AI.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              Pick a prompt, write your response, and get a full band-score
              breakdown with line-by-line corrections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/learn/writing/exam"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-coral-500/20 bg-coral-500/10 px-4 py-2 text-sm font-medium text-coral-700 transition hover:border-coral-500/40 hover:bg-coral-500 hover:text-white"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              Take Exam
            </Link>
            {canGenerateWithAi(user) && (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="btn-secondary"
                title="ADMIN / OWNER only — generate questions via Claude"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Generate with AI
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add question
            </button>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            {/* Language */}
            <label className="flex flex-col gap-2 text-xs font-medium text-ink-soft">
              Language
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full min-w-[180px] rounded-xl border border-ink/12 bg-cream px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag}  {l.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Chips */}
            <div className="flex flex-col gap-4">
              <ChipRow
                label="Level"
                options={LEVELS as unknown as string[]}
                value={level}
                onChange={(v) => setLevel(v as CefrLevel | '')}
                tintFor={(v) => (v ? LEVEL_TINT[v as CefrLevel] : '')}
              />
              <ChipRow
                label="Certificate"
                options={availableCerts}
                value={cert}
                onChange={setCert}
                normalize={(v) => v.replace(/_/g, ' ')}
              />
              {availableTasks.length > 0 && (
                <ChipRow
                  label="Task"
                  options={availableTasks}
                  value={task}
                  onChange={setTask}
                />
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/6 pt-4">
            <p className="text-xs text-ink-muted">
              {loading
                ? 'Loading…'
                : `${questions.length} question${questions.length === 1 ? '' : 's'}${
                    isCharacterBased(lang) ? ' · character-based counts' : ''
                  }`}
            </p>
            <button
              onClick={openRandom}
              disabled={loading || questions.length === 0}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M8 12h.01M12 12h.01M16 12h.01" />
              </svg>
              Random question
            </button>
          </div>
        </section>

        {/* ── Grid ──────────────────────────────────────────────── */}
        <section className="mt-8">
          {error && (
            <div className="rounded-2xl border border-coral-500/20 bg-coral-50 px-4 py-3 text-sm text-coral-700">
              {error}
            </div>
          )}
          {!error && !loading && questions.length === 0 && (
            <div className="rounded-3xl border border-dashed border-ink/12 bg-white/50 p-10 text-center">
              <p className="text-sm text-ink-soft">
                No questions here yet. Try a different filter, or ask an
                admin to generate some.
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} langCode={lang} />
            ))}
          </div>
        </section>
      </div>

      {showGenerateModal && (
        <GenerateWritingModal
          onClose={() => setShowGenerateModal(false)}
          currentLang={lang}
        />
      )}
      {showAddModal && (
        <AddWritingQuestionModal
          onClose={() => setShowAddModal(false)}
          currentLang={lang}
        />
      )}
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Filter chip row
// ═════════════════════════════════════════════════════════════════
function ChipRow({
  label,
  options,
  value,
  onChange,
  tintFor,
  normalize,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  tintFor?: (v: string) => string
  normalize?: (v: string) => string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={value === ''} onClick={() => onChange('')}>
          All
        </Chip>
        {options.map((opt) => (
          <Chip
            key={opt}
            active={value === opt}
            tint={tintFor?.(opt)}
            onClick={() => onChange(value === opt ? '' : opt)}
          >
            {normalize ? normalize(opt) : opt}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  tint,
  children,
}: {
  active: boolean
  onClick: () => void
  tint?: string
  children: React.ReactNode
}) {
  const base = 'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition'
  if (active) {
    return (
      <button
        onClick={onClick}
        className={`${base} border-indigo-500 bg-indigo-500 text-white shadow-sm`}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      className={`${base} ${tint ?? 'border-ink/12 bg-white text-ink-soft hover:border-indigo-500/30 hover:bg-indigo-50'}`}
    >
      {children}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════
// Question card
// ═════════════════════════════════════════════════════════════════
function QuestionCard({
  question: q,
  langCode,
}: {
  question: WritingQuestion
  langCode: string
}) {
  const hasVisual = !!(q.visualJson || q.visualImageUrl)
  const unitLabel = isCharacterBased(langCode) ? 'chars' : 'words'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        to={`/learn/writing/session/${q.id}`}
        className="group flex h-full flex-col rounded-3xl border border-ink/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md"
      >
        {/* Meta row */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[q.cefrLevel]}`}
          >
            {q.cefrLevel}
          </span>
          {q.certificateType && (
            <span className="rounded-full border border-ink/12 bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              {q.certificateType.replace(/_/g, ' ')}
            </span>
          )}
          {q.taskType && (
            <span className="rounded-full border border-indigo-500/20 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              {q.taskType}
            </span>
          )}
          {hasVisual && (
            <span
              title="Has a chart or image"
              className="inline-flex items-center gap-1 rounded-full border border-coral-500/20 bg-coral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-coral-700"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 15l6-6 4 4 8-8" />
              </svg>
              Visual
            </span>
          )}
        </div>

        {/* Question preview */}
        <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-ink">
          {q.question}
        </p>

        {/* Bottom meta */}
        <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-3">
            {q.minWords != null && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                {q.maxWords != null
                  ? `${q.minWords}–${q.maxWords} ${unitLabel}`
                  : `${q.minWords}+ ${unitLabel}`}
              </span>
            )}
            {q.recommendedMinutes != null && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {q.recommendedMinutes} min
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
            Start
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
