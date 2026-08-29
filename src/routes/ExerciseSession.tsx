// Exercises — Session ekrani. Bitta checkpoint uchun N ta mashqni
// ketma-ket ko'rsatadi, har birida darhol (instant) feedback
// beradi — Duolingo'нинг asosiy o'yin tsikli.
//
// 6 ta tur, 2 ta umumiy javob UI'siga guruhlanadi:
//   • "Tanlash" (choice) — WORD_TRANSLATE, IMAGE_MATCH,
//     FILL_IN_BLANK, MULTIPLE_CHOICE — hammasi options ро'yхатидан
//     bittasini tanlash bilan ishlaydi, faqat vizual joylashuvi
//     (rasm bor-yo'qligi, savol formati) farq qiladi.
//   • TRUE_FALSE — alohida, 2 ta katta tugma.
//   • SENTENCE_BUILD — alohida, so'z-plitkalarni ketma-ket terish.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  CHECKPOINT_PATH,
  type Exercise,
  type ExerciseResult,
} from '../lib/exercises'

type Phase = 'loading' | 'answering' | 'checked' | 'done' | 'outOfHearts' | 'error'
const MAX_HEARTS = 5

export default function ExerciseSession() {
  const { checkpointId } = useParams<{ checkpointId: string }>()
  const [searchParams] = useSearchParams()
  const lang = searchParams.get('lang') ?? 'en'
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const checkpoint = useMemo(
    () => CHECKPOINT_PATH.find((c) => c.id === checkpointId),
    [checkpointId]
  )

  const [phase, setPhase] = useState<Phase>('loading')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string>('') // joriy tanlangan/terilgan javob
  const [result, setResult] = useState<ExerciseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sessiya yig'indisi
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [heartsShake, setHeartsShake] = useState(false)
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null)
  const startedAt = useState(() => Date.now())[0]

  useEffect(() => {
    if (!checkpoint) {
      setError('Unknown checkpoint.')
      setPhase('error')
      return
    }
    let cancelled = false
    setPhase('loading')
    api
      .get<Exercise[]>(
        `/api/exercises?lang=${lang}&type=${checkpoint.type}&count=${checkpoint.exerciseCount}`
      )
      .then((list) => {
        if (cancelled) return
        if (!list || list.length === 0) {
          setError('No exercises available for this checkpoint yet.')
          setPhase('error')
          return
        }
        setExercises(list)
        setPhase('answering')
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load exercises.')
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpointId, lang])

  const current = exercises[index]
  const exerciseStartedAt = useState(() => Date.now())[0]
  // RACE FIX: "Check" tugmasi tez-tez (yoki qo'shaloq) bosilganda,
  // birinchi so'rov hali javob qaytarmasdan turib ikkinchi so'rov
  // ham yuborilib ketardi — backend ikkalasini deyarli bir vaqtda
  // qabul qilib, ikkalasi ham "bu mashq hali yechilmagan" deb
  // o'ylab, ikkalasi ham yozishga urinardi. Buning natijasida baza
  // darajasidagi UNIQUE cheklov ikkinchisini rad etib, xato
  // chiqarardi. Endi so'rov "yo'lda" ekanini kuzatib, ikkinchi
  // bosishni frontendning o'zida bloklaymiz.
  const [isSubmitting, setIsSubmitting] = useState(false)

  const check = useCallback(async () => {
    if (!current || !selected.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await api.post<ExerciseResult>('/api/exercises/submit', {
        exerciseId: current.id,
        userAnswer: selected,
        timeTakenMs: Date.now() - exerciseStartedAt,
      })
      setResult(res)
      setLastResult(res)
      if (res.correct) {
        setCorrectCount((c) => c + 1)
        setXpEarned((x) => x + res.xpEarned)
      } else {
        setHearts((h) => Math.max(0, h - 1))
        setHeartsShake(true)
        setTimeout(() => setHeartsShake(false), 500)
      }
      setPhase('checked')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Could not check your answer.')
    } finally {
      setIsSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, selected, isSubmitting])

  const next = () => {
    if (hearts <= 0) {
      setPhase('outOfHearts')
      return
    }
    if (index + 1 >= exercises.length) {
      setPhase('done')
      return
    }
    setIndex((i) => i + 1)
    setSelected('')
    setResult(null)
    setPhase('answering')
  }

  const retry = () => {
    setHearts(MAX_HEARTS)
    setIndex(0)
    setSelected('')
    setResult(null)
    setCorrectCount(0)
    setXpEarned(0)
    setPhase('answering')
  }

  // ═════════════════════════════════════════════════════════════

  if (phase === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading exercises…</p>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">{error}</p>
          <Link to="/learn/exercises" className="btn-primary">
            Back to path
          </Link>
        </div>
      </main>
    )
  }

  if (phase === 'done') {
    const accuracy = exercises.length > 0 ? Math.round((correctCount / exercises.length) * 100) : 0
    const leveledUp = lastResult?.leveledUp ?? false
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5">
        <ConfettiBurst />
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative w-full max-w-sm rounded-3xl border border-ink/8 bg-white p-8 text-center shadow-xl"
        >
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 15 }}
            className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-mint-500/15 text-mint-600"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </motion.div>

          <h1 className="mb-1 font-display text-2xl font-bold text-ink">Checkpoint complete!</h1>
          <p className="mb-6 text-sm text-ink-muted">
            {correctCount}/{exercises.length} correct · {accuracy}% accuracy
          </p>

          {leveledUp && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-4 rounded-2xl bg-indigo-500 px-4 py-3 text-white"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-100">Level up!</p>
              <p className="font-display text-lg font-bold">Now {lastResult?.newLevel}</p>
            </motion.div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-2.5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl bg-sun-50 px-3 py-3"
            >
              <CountUp value={xpEarned} className="font-display text-xl font-bold text-sun-600" prefix="+" suffix=" XP" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="rounded-2xl bg-coral-50 px-3 py-3"
            >
              <p className="flex items-center justify-center gap-1 font-display text-xl font-bold text-coral-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.2 1.6 6.7 4.6 5.4c2-.86 4-.2 5.4 1.5C11.4 5.2 13.4 4.54 15.4 5.4c3 1.3 3.8 4.8 1.9 7.5C19.7 16.65 12 21 12 21z" />
                </svg>
                {hearts}
              </p>
              <p className="text-[11px] font-medium text-coral-500">hearts left</p>
            </motion.div>
          </div>

          <Link to="/learn/exercises" className="btn-primary block">
            Back to path
          </Link>
        </motion.div>
      </main>
    )
  }

  if (phase === 'outOfHearts') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-3xl border border-ink/8 bg-white p-8 text-center shadow-lg"
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, -8, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-coral-500/15 text-coral-600"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 .96.24 1.86.66 2.65M13 21s-.5-.3-1.3-.85M9 9l6 6M15 9l-6 6" />
            </svg>
          </motion.div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">Out of hearts!</h1>
          <p className="mb-6 text-sm text-ink-muted">
            You've made too many mistakes. Try this checkpoint again from the start.
          </p>
          <button onClick={retry} className="btn-primary mb-2.5 block w-full">
            Try again
          </button>
          <Link
            to="/learn/exercises"
            className="block rounded-2xl border border-ink/12 py-2.5 text-sm font-medium text-ink-soft hover:border-ink/25"
          >
            Back to path
          </Link>
        </motion.div>
      </main>
    )
  }

  if (!current) return null

  const progress = ((index + (phase === 'checked' ? 1 : 0)) / exercises.length) * 100

  return (
    <main className="min-h-screen bg-cream pb-32">
      <header className="sticky top-0 z-20 border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link to="/learn/exercises" className="text-ink-muted hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Link>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/8">
            <motion.div
              className="h-full rounded-full bg-mint-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <motion.span
            animate={heartsShake ? { x: [0, -4, 4, -4, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-bold text-coral-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.2 1.6 6.7 4.6 5.4c2-.86 4-.2 5.4 1.5C11.4 5.2 13.4 4.54 15.4 5.4c3 1.3 3.8 4.8 1.9 7.5C19.7 16.65 12 21 12 21z" />
            </svg>
            {hearts}
          </motion.span>
          <Logo size={22} />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            <ExerciseRenderer
              exercise={current}
              selected={selected}
              onSelect={setSelected}
              disabled={phase === 'checked'}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pastki panel — Check / feedback */}
      <div
        className={`fixed inset-x-0 bottom-0 border-t px-5 py-4 transition-colors ${
          phase === 'checked'
            ? result?.correct
              ? 'border-mint-500/20 bg-mint-50'
              : 'border-coral-500/20 bg-coral-50'
            : 'border-ink/8 bg-white'
        }`}
      >
        <div className="mx-auto max-w-lg">
          {phase === 'checked' && result ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-white ${
                    result.correct ? 'bg-mint-500' : 'bg-coral-500'
                  }`}
                >
                  {result.correct ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className={`text-sm font-bold ${result.correct ? 'text-mint-700' : 'text-coral-700'}`}>
                    {result.correct ? 'Correct!' : `Correct answer: ${result.correctAnswer}`}
                  </p>
                  {result.explanation && (
                    <p className="text-xs text-ink-soft">{result.explanation}</p>
                  )}
                </div>
              </div>
              <button
                onClick={next}
                className={`w-full rounded-2xl py-3 text-sm font-bold text-white transition ${
                  result.correct ? 'bg-mint-500 hover:bg-mint-600' : 'bg-coral-500 hover:bg-coral-600'
                }`}
              >
                Continue
              </button>
            </div>
          ) : (
            <button
              onClick={check}
              disabled={!selected.trim() || isSubmitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? 'Checking…' : 'Check'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Mashq turiga qarab to'g'ri javob UI'sini tanlaydi
// ═════════════════════════════════════════════════════════════════

function ExerciseRenderer({
  exercise,
  selected,
  onSelect,
  disabled,
}: {
  exercise: Exercise
  selected: string
  onSelect: (v: string) => void
  disabled: boolean
}) {
  if (exercise.type === 'TRUE_FALSE') {
    return <TrueFalseAnswer exercise={exercise} selected={selected} onSelect={onSelect} disabled={disabled} />
  }
  if (exercise.type === 'SENTENCE_BUILD') {
    return <SentenceBuildAnswer exercise={exercise} selected={selected} onSelect={onSelect} disabled={disabled} />
  }
  // WORD_TRANSLATE, IMAGE_MATCH, FILL_IN_BLANK, MULTIPLE_CHOICE
  return <ChoiceAnswer exercise={exercise} selected={selected} onSelect={onSelect} disabled={disabled} />
}

function QuestionHeader({ exercise }: { exercise: Exercise }) {
  const labels: Record<string, string> = {
    WORD_TRANSLATE: 'Translate',
    IMAGE_MATCH: 'What do you see?',
    FILL_IN_BLANK: 'Complete the sentence',
    MULTIPLE_CHOICE: 'Choose the correct answer',
  }
  return (
    <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-indigo-600">
      {labels[exercise.type] ?? 'Answer'}
    </p>
  )
}

function ChoiceAnswer({
  exercise,
  selected,
  onSelect,
  disabled,
}: {
  exercise: Exercise
  selected: string
  onSelect: (v: string) => void
  disabled: boolean
}) {
  const options = exercise.options ?? []
  return (
    <div>
      <QuestionHeader exercise={exercise} />

      {exercise.type === 'IMAGE_MATCH' && exercise.mediaUrl && (
        <div className="mb-5 overflow-hidden rounded-3xl border border-ink/8 bg-white">
          <img src={exercise.mediaUrl} alt="" className="h-56 w-full object-cover" />
        </div>
      )}

      <h1 className="mb-6 font-display text-2xl font-bold leading-snug text-ink">
        {exercise.question}
      </h1>

      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const isSelected = selected === opt
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onSelect(opt)}
              className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-ink/10 bg-white text-ink hover:border-indigo-500/30'
              } ${disabled ? 'cursor-not-allowed' : ''}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TrueFalseAnswer({
  exercise,
  selected,
  onSelect,
  disabled,
}: {
  exercise: Exercise
  selected: string
  onSelect: (v: string) => void
  disabled: boolean
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-indigo-600">
        True or False?
      </p>
      <h1 className="mb-8 font-display text-2xl font-bold leading-snug text-ink">
        {exercise.question}
      </h1>
      <div className="grid grid-cols-2 gap-3">
        {['True', 'False'].map((opt) => {
          const isSelected = selected === opt
          return (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => onSelect(opt)}
              className={`rounded-2xl border-2 py-6 text-base font-bold transition ${
                isSelected
                  ? opt === 'True'
                    ? 'border-mint-500 bg-mint-50 text-mint-700'
                    : 'border-coral-500 bg-coral-50 text-coral-700'
                  : 'border-ink/10 bg-white text-ink hover:border-indigo-500/30'
              } ${disabled ? 'cursor-not-allowed' : ''}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SentenceBuildAnswer({
  exercise,
  selected,
  onSelect,
  disabled,
}: {
  exercise: Exercise
  selected: string
  onSelect: (v: string) => void
  disabled: boolean
}) {
  const allWords = exercise.options ?? []
  const chosenWords = selected ? selected.split(' ') : []
  // Bank'да — hali tanlanmagan so'zlar (tanlangandan ONE INSTANCE
  // olib tashlanadi, takroriy so'zlar to'g'ri ishlashi uchun)
  const bankWords = useMemo(() => {
    const remaining = [...allWords]
    for (const w of chosenWords) {
      const idx = remaining.indexOf(w)
      if (idx !== -1) remaining.splice(idx, 1)
    }
    return remaining
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWords.join('|'), selected])

  const addWord = (w: string) => {
    if (disabled) return
    onSelect([...chosenWords, w].join(' '))
  }
  const removeAt = (i: number) => {
    if (disabled) return
    const next = [...chosenWords]
    next.splice(i, 1)
    onSelect(next.join(' '))
  }

  return (
    <div>
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-indigo-600">
        Build the sentence
      </p>
      <h1 className="mb-6 font-display text-lg font-semibold leading-snug text-ink">
        {exercise.question}
      </h1>

      {/* Yig'ilayotgan gap */}
      <div className="mb-6 min-h-[56px] rounded-2xl border-2 border-dashed border-ink/15 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {chosenWords.map((w, i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => removeAt(i)}
              className="rounded-xl bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white"
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* So'z banki */}
      <div className="flex flex-wrap gap-2">
        {bankWords.map((w, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => addWord(w)}
            className="rounded-xl border-2 border-ink/10 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo-500/30 disabled:cursor-not-allowed"
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Lesson Complete uchun kichik effektlar
// ═════════════════════════════════════════════════════════════════

const CONFETTI_COLORS = ['#5B5FE9', '#FF8A65', '#4ECDC4', '#FFD93D']

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        angle: (i / 24) * Math.PI * 2,
        distance: 90 + Math.random() * 90,
        rotate: Math.random() * 360,
        delay: Math.random() * 0.15,
      })),
    []
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance + 60,
            opacity: 0,
            rotate: p.rotate,
          }}
          transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
          className="absolute h-2 w-2 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  )
}

function CountUp({
  value,
  className,
  prefix = '',
  suffix = '',
}: {
  value: number
  className?: string
  prefix?: string
  suffix?: string
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value <= 0) {
      setDisplay(0)
      return
    }
    const durationMs = 600
    const stepMs = 25
    const steps = Math.max(1, Math.round(durationMs / stepMs))
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setDisplay(Math.round((value * i) / steps))
      if (i >= steps) clearInterval(timer)
    }, stepMs)
    return () => clearInterval(timer)
  }, [value])

  return (
    <p className={className}>
      {prefix}
      {display}
      {suffix}
    </p>
  )
}
