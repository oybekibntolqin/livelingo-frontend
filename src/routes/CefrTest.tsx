import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'

// ─────────────────────────────────────────────────────────────────
// Types — match the backend's response shapes.
// ─────────────────────────────────────────────────────────────────
type QuestionType = 'MULTIPLE_CHOICE' | 'FILL_IN_THE_BLANK' | 'TRUE_FALSE' | 'MATCHING'
type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

interface CefrQuestion {
  id: string
  question: string
  languageCode: string
  cefrLevel: CefrLevel
  certificateType: string
  questionType: QuestionType
  options: string[] | null
}

interface QuestionResult {
  questionId: string
  question: string
  userAnswer: string | null
  correctAnswer: string
  explanation: string | null
  correct: boolean
}

interface CefrTestResult {
  id: string
  languageCode: string
  certificateType: string
  totalQuestions: number
  correctAnswers: number
  scorePercent: number
  determinedLevel: CefrLevel
  takenAt: string
  questionResults: QuestionResult[]
}

// ─────────────────────────────────────────────────────────────────
// MUHIM O'ZGARISH: sertifikat tanlovi olib tashlandi — foydalanuvchi
// endi IELTS/TOEFL/Goethe va h.k. tanlamaydi, tizim doim "GENERAL"
// turini ishlatadi (bazada faqat shu tur uchun savollar mavjud).
// ─────────────────────────────────────────────────────────────────

const LEVEL_TINT: Record<CefrLevel, { bg: string; text: string; ring: string }> = {
  A1: { bg: 'bg-mint-50', text: 'text-mint-600', ring: 'ring-mint-500/40' },
  A2: { bg: 'bg-mint-50', text: 'text-mint-600', ring: 'ring-mint-500/40' },
  B1: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-500/40' },
  B2: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-500/40' },
  C1: { bg: 'bg-coral-50', text: 'text-coral-600', ring: 'ring-coral-500/40' },
  C2: { bg: 'bg-coral-50', text: 'text-coral-600', ring: 'ring-coral-500/40' },
}

type Phase = 'setup' | 'loading' | 'testing' | 'submitting' | 'results'

// ─────────────────────────────────────────────────────────────────
// YANGI: sahifa refresh qilinganda test boshidan boshlanib qolmasligi
// uchun, "testing" bosqichidagi holat (savollar, joriy savol raqami,
// javoblar, boshlangan vaqt) localStorage'da saqlanadi. Til bo'yicha
// alohida kalit ishlatiladi (bir vaqtda bir nechta tilni sinab
// ko'rish holatini aralashtirib yubormaslik uchun).
// ─────────────────────────────────────────────────────────────────
interface PersistedProgress {
  questions: CefrQuestion[]
  currentIdx: number
  answers: Record<string, string>
  startedAt: number
}

function progressKey(lang: string) {
  return `cefrTestProgress_v1_${lang}`
}

function loadProgress(lang: string): PersistedProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedProgress
    if (!parsed?.questions?.length) return null
    return parsed
  } catch {
    return null
  }
}

function saveProgress(lang: string, data: PersistedProgress) {
  try {
    localStorage.setItem(progressKey(lang), JSON.stringify(data))
  } catch {
    // localStorage to'lgan yoki mavjud emas — jim o'tkazib yuboramiz,
    // bu faqat "qulaylik" xususiyati, test ishlashiga ta'sir qilmaydi.
  }
}

function clearProgress(lang: string) {
  try {
    localStorage.removeItem(progressKey(lang))
  } catch {
    /* jim */
  }
}

export default function CefrTest() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // ?onboarding=1 means we still need to call /api/onboarding/step3 with
  // the determined level after the user views their results. Without
  // this flag we just send them back to the dashboard.
  const fromOnboarding = params.get('onboarding') === '1'
  // Default to English if no language passed; in real flow you'd pull
  // this from the current user's profile.
  const learningLang = params.get('lang') || 'en'

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [phase, setPhase] = useState<Phase>('setup')
  const [error, setError] = useState<string | null>(null)
  // MUHIM O'ZGARISH: sertifikat tanlovi (IELTS/TOEFL/Cambridge) olib
  // tashlandi — bazada faqat "GENERAL" turi uchun savollar mavjud
  // bo'lgani sababli, boshqa turlarni tanlash doimo "savol topilmadi"
  // xatosiga olib kelardi. Endi foydalanuvchi hech qanday tanlov
  // qilmaydi — til tanlab bo'lingach, avtomatik "GENERAL" ishlatiladi.
  const selectedCert = 'GENERAL'

  const [questions, setQuestions] = useState<CefrQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CefrTestResult | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)

  // ── Sahifa birinchi ochilganda — avval saqlangan (tugallanmagan)
  // test bor-yo'qligini tekshiramiz. Bo'lsa, "setup"dan boshlash
  // o'rniga, to'g'ridan-to'g'ri "testing" bosqichiga, saqlangan
  // savol/javoblar bilan qaytamiz.
  useEffect(() => {
    const saved = loadProgress(learningLang)
    if (saved) {
      setQuestions(saved.questions)
      setCurrentIdx(saved.currentIdx)
      setAnswers(saved.answers)
      setStartedAt(saved.startedAt)
      setPhase('testing')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Testing bosqichida har bir o'zgarishni (savol, javob) darhol
  // localStorage'ga yozib boramiz — shunda refresh qilinganda
  // hech narsa yo'qolmaydi.
  useEffect(() => {
    if (phase !== 'testing' || questions.length === 0 || startedAt === null) return
    saveProgress(learningLang, { questions, currentIdx, answers, startedAt })
  }, [phase, questions, currentIdx, answers, startedAt, learningLang])

  // ── Fetch questions and start test ─────────────────────────────
  const startTest = async () => {
    setError(null)
    setPhase('loading')
    try {
      const qs = await api.get<CefrQuestion[]>(
        `/api/cefr-test/questions?lang=${encodeURIComponent(learningLang)}&cert=${selectedCert}&count=25`
      )
      if (!qs || qs.length === 0) {
        setError("No questions are available yet for this combination. Your admin needs to generate test content first.")
        setPhase('setup')
        return
      }
      setQuestions(qs)
      setCurrentIdx(0)
      setAnswers({})
      setStartedAt(Date.now())
      setPhase('testing')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        setError("No questions are available yet for this language and certificate. Pick another or ask your admin to generate content.")
      } else {
        setError(err instanceof Error ? err.message : 'Could not load questions.')
      }
      setPhase('setup')
    }
  }

  // ── Submit the whole test ──────────────────────────────────────
  const submitTest = async () => {
    setError(null)
    setPhase('submitting')
    try {
      const data = await api.post<CefrTestResult>('/api/cefr-test/submit', {
        languageCode: learningLang,
        certificateType: selectedCert,
        answers,
      })
      // Test muvaffaqiyatli topshirildi — saqlangan (tugallanmagan)
      // holatni tozalaymiz, aks holda keyingi safar sahifaga
      // kirganda eski, allaqachon topshirilgan testga qaytarib
      // qo'yardi.
      clearProgress(learningLang)
      setResult(data)
      setPhase('results')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Could not submit your test.')
      setPhase('testing')
    }
  }

  // ── Finish: mark onboarding complete (if applicable) and go home
  const finish = async () => {
    if (fromOnboarding && result) {
      try {
        await api.post('/api/onboarding/step3', {
          beginner: false,
          cefrLevel: result.determinedLevel,
          languageCode: learningLang,
        })
      } catch (err) {
        // Non-fatal — they can retry from settings if needed.
        console.error('Failed to mark onboarding step 3 complete:', err)
      }
    }
    // If the user came from onboarding and there are still more
    // learning languages waiting to have their level set, hand them
    // back to onboarding so it can ask about the next one. Otherwise
    // we're done — straight to the dashboard.
    const remaining = params.get('remaining')
    if (fromOnboarding && remaining) {
      navigate(`/onboarding?resumeStep3=${remaining}`, { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -right-20 top-40 h-96 w-96 rounded-full bg-coral-500/10 blur-[120px]" />
      </div>

      <Link to="/dashboard" className="absolute left-6 top-6">
        <Logo size={32} />
      </Link>

      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <SetupPhase
            key="setup"
            learningLang={learningLang}
            onStart={startTest}
            error={error}
          />
        )}

        {phase === 'loading' && (
          <LoadingPhase key="loading" message="Preparing your test…" />
        )}

        {phase === 'testing' && startedAt !== null && (
          <TestingPhase
            key="testing"
            questions={questions}
            currentIdx={currentIdx}
            setCurrentIdx={setCurrentIdx}
            answers={answers}
            setAnswers={setAnswers}
            onSubmit={submitTest}
            error={error}
            startedAt={startedAt}
          />
        )}

        {phase === 'submitting' && (
          <LoadingPhase key="submitting" message="Checking your answers…" />
        )}

        {phase === 'results' && result && (
          <ResultsPhase
            key="results"
            result={result}
            onContinue={finish}
            fromOnboarding={fromOnboarding}
            remaining={params.get('remaining') ?? ''}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────
// Setup phase — pick a certificate type and start
// ─────────────────────────────────────────────────────────────────
function SetupPhase({
  learningLang,
  onStart,
  error,
}: {
  learningLang: string
  onStart: () => void
  error: string | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl pt-16"
    >
      <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
        Placement test · {learningLang.toUpperCase()}
      </p>
      <h1 className="font-display text-display-md font-semibold text-ink">
        Let's find your level.
      </h1>
      <p className="mt-3 text-ink-soft">
        25 questions, about 10 minutes. Be honest — guessing won't help.
        We'll place you at the right CEFR level so you don't waste time on
        material that's too easy or too hard.
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-coral-500/30 bg-coral-50 p-4 text-sm text-coral-600">
          {error}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Link to="/onboarding" className="text-sm font-medium text-ink-soft hover:text-ink">
          ← Back to onboarding
        </Link>
        <button onClick={onStart} className="btn-primary">
          Start the test
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Loading phase — between setup→testing and testing→results
// ─────────────────────────────────────────────────────────────────
function LoadingPhase({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid min-h-[60vh] place-items-center"
    >
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
        <p className="mt-4 text-sm text-ink-soft">{message}</p>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Testing phase — questions one at a time + progress + timer
// ─────────────────────────────────────────────────────────────────
function TestingPhase({
  questions,
  currentIdx,
  setCurrentIdx,
  answers,
  setAnswers,
  onSubmit,
  error,
  startedAt,
}: {
  questions: CefrQuestion[]
  currentIdx: number
  setCurrentIdx: (n: number) => void
  answers: Record<string, string>
  setAnswers: (a: Record<string, string>) => void
  onSubmit: () => void
  error: string | null
  startedAt: number
}) {
  const q = questions[currentIdx]
  const isLast = currentIdx === questions.length - 1
  const currentAnswer = answers[q.id] ?? ''
  const progressPct = ((currentIdx + 1) / questions.length) * 100

  // Count-up timer — informational, no pressure / auto-submit.
  // MUHIM: startedAt endi TASHQARIDAN (ota-komponentdan) keladi va
  // sahifa refresh qilinganda ham saqlanadi (localStorage orqali) —
  // shuning uchun refresh qilinganda hisoblagich 0'dan emas, test
  // haqiqatan boshlangan vaqtdan davom etadi.
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000))
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  const setAnswer = (val: string) => {
    setAnswers({ ...answers, [q.id]: val })
  }

  const next = () => {
    if (isLast) onSubmit()
    else setCurrentIdx(currentIdx + 1)
  }
  const prev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl pt-16"
    >
      {/* Top bar: question count + timer */}
      <div className="mb-3 flex items-center justify-between text-xs font-mono uppercase tracking-widest text-ink-muted">
        <span>
          Question {currentIdx + 1} of {questions.length}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-mint-500 animate-pulse-dot" />
          {mm}:{ss}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-ink/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-coral-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Question card — keyed so it animates on change */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="rounded-4xl border border-ink/8 bg-white p-7 sm:p-10"
        >
          <div className="mb-5 flex items-center gap-2">
            <span className="pill">{q.cefrLevel}</span>
            <span className="pill">
              {q.questionType
                .toLowerCase()
                .split('_')
                .map((w) => w[0].toUpperCase() + w.slice(1))
                .join(' ')}
            </span>
          </div>

          <p className="font-display text-2xl font-semibold leading-snug text-ink sm:text-3xl">
            {q.question}
          </p>

          <div className="mt-7">
            {q.questionType === 'MULTIPLE_CHOICE' && (
              <MultipleChoice
                options={q.options ?? []}
                value={currentAnswer}
                onChange={setAnswer}
              />
            )}

            {q.questionType === 'TRUE_FALSE' && (
              <TrueFalse value={currentAnswer} onChange={setAnswer} />
            )}

            {(q.questionType === 'FILL_IN_THE_BLANK' || q.questionType === 'MATCHING') && (
              <input
                type="text"
                value={currentAnswer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                autoFocus
                className="w-full rounded-2xl border border-ink/10 bg-white px-5 py-4 text-base text-ink placeholder:text-ink-muted focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/12"
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {error && (
        <div className="mt-4 rounded-2xl border border-coral-500/30 bg-coral-50 p-3 text-sm text-coral-600">
          {error}
        </div>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={prev}
          disabled={currentIdx === 0}
          className="btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          onClick={next}
          disabled={!currentAnswer.trim()}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLast ? 'Submit test' : 'Next'}
          {!isLast && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </motion.div>
  )
}

function MultipleChoice({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']
  return (
    <div className="grid gap-2.5">
      {options.map((opt, i) => {
        const selected = value === opt
        return (
          <button
            key={opt + i}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
              selected
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-ink/10 bg-white hover:border-ink/30'
            }`}
          >
            <span
              className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full font-mono text-sm font-semibold ${
                selected
                  ? 'bg-indigo-500 text-white'
                  : 'bg-cream-warm text-ink-soft'
              }`}
            >
              {letters[i] ?? '?'}
            </span>
            <span className={`text-base ${selected ? 'text-indigo-600 font-medium' : 'text-ink'}`}>
              {opt}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TrueFalse({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const opts: { label: string; val: string; accent: 'mint' | 'coral' }[] = [
    { label: 'True', val: 'TRUE', accent: 'mint' },
    { label: 'False', val: 'FALSE', accent: 'coral' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {opts.map((o) => {
        const selected = value === o.val
        const tints = {
          mint: selected ? 'border-mint-500 bg-mint-50 text-mint-600' : 'border-ink/10 bg-white hover:border-mint-500/40',
          coral: selected ? 'border-coral-500 bg-coral-50 text-coral-600' : 'border-ink/10 bg-white hover:border-coral-500/40',
        }[o.accent]
        return (
          <button
            key={o.val}
            type="button"
            onClick={() => onChange(o.val)}
            className={`rounded-2xl border-2 py-5 text-lg font-semibold transition-all ${tints} ${selected ? '' : 'text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Results phase — score, level, per-question breakdown
// ─────────────────────────────────────────────────────────────────
function ResultsPhase({
  result,
  onContinue,
  fromOnboarding,
  remaining,
}: {
  result: CefrTestResult
  onContinue: () => void
  fromOnboarding: boolean
  remaining: string
}) {
  const tint = LEVEL_TINT[result.determinedLevel] ?? LEVEL_TINT.A1

  // Animate the score number on mount.
  const [animatedScore, setAnimatedScore] = useState(0)
  useEffect(() => {
    const target = Math.round(result.scorePercent)
    const start = Date.now()
    const dur = 900
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimatedScore(Math.round(target * eased))
      if (t >= 1) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [result.scorePercent])

  const [reviewing, setReviewing] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl pt-16"
    >
      <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
        Your result
      </p>
      <h1 className="font-display text-display-md font-semibold text-ink">
        Here's where you are.
      </h1>

      {/* Hero score card */}
      <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-4xl border border-ink/8 bg-white p-7">
          <p className="text-sm text-ink-muted">Score</p>
          <p className="mt-1 font-display text-6xl font-semibold text-ink">
            {animatedScore}
            <span className="text-3xl text-ink-muted">%</span>
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            You answered{' '}
            <span className="font-semibold text-ink">{result.correctAnswers}</span>{' '}
            out of{' '}
            <span className="font-semibold text-ink">{result.totalQuestions}</span>{' '}
            correctly.
          </p>
        </div>

        <div className={`flex flex-col items-center justify-center rounded-4xl border border-ink/8 p-7 ring-4 ${tint.ring} ${tint.bg}`}>
          <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
            CEFR level
          </p>
          <p className={`mt-1 font-mono text-6xl font-bold ${tint.text}`}>
            {result.determinedLevel}
          </p>
        </div>
      </div>

      {/* Review toggle */}
      <button
        onClick={() => setReviewing((r) => !r)}
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        {reviewing ? 'Hide' : 'Review'} all {result.totalQuestions} answers
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform ${reviewing ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {reviewing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-3">
              {result.questionResults.map((qr, i) => (
                <QuestionResultCard key={qr.questionId} qr={qr} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {fromOnboarding && remaining
            ? `Saved. ${remaining.split(',').length} more language${
                remaining.split(',').length === 1 ? '' : 's'
              } to go.`
            : fromOnboarding
            ? "We'll save this as your starting level."
            : 'You can retake this test anytime from your profile.'}
        </p>
        <button onClick={onContinue} className="btn-primary">
          {fromOnboarding && remaining
            ? 'Continue setup'
            : fromOnboarding
            ? 'Continue to Dashboard'
            : 'Back to Dashboard'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}

function QuestionResultCard({ qr, index }: { qr: QuestionResult; index: number }) {
  return (
    <div
      className={`rounded-3xl border p-5 ${
        qr.correct ? 'border-mint-500/30 bg-mint-50/40' : 'border-coral-500/30 bg-coral-50/40'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Q{index + 1}
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            qr.correct
              ? 'bg-mint-500/15 text-mint-600'
              : 'bg-coral-500/15 text-coral-600'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${qr.correct ? 'bg-mint-500' : 'bg-coral-500'}`} />
          {qr.correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      <p className="text-sm font-medium text-ink">{qr.question}</p>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex gap-2">
          <span className="w-20 flex-shrink-0 text-ink-muted">Your answer:</span>
          <span className={qr.correct ? 'text-mint-600 font-medium' : 'text-coral-600 font-medium'}>
            {qr.userAnswer || <em className="text-ink-muted">no answer</em>}
          </span>
        </div>
        {!qr.correct && (
          <div className="flex gap-2">
            <span className="w-20 flex-shrink-0 text-ink-muted">Correct:</span>
            <span className="text-mint-600 font-medium">{qr.correctAnswer}</span>
          </div>
        )}
      </div>

      {qr.explanation && (
        <p className="mt-3 border-l-2 border-ink/10 pl-3 text-sm italic text-ink-soft">
          {qr.explanation}
        </p>
      )}
    </div>
  )
}
