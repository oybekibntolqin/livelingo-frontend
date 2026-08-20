// Listening Practice — session (v3).
//
// LAYOUT (Silliq Flexbox animatsiyasi orqali):
//
//   Transkript YOPIQ:
//   ┌─────────────────────────────────────┐
//   │        [ AUDIO — markazda ]         │
//   │      [ Transkriptni koʻrish ]       │
//   │        [ Savollar pastda ]          │
//   └─────────────────────────────────────┘
//
//   Transkript OCHIQ (500ms silliq o'tish):
//   ┌──────────────┬──────────────────────┐
//   │ [ AUDIO ]    │  [ TRANSKRIPT ]      │
//   │  chapga      │   o'ngdan sirg'anib  │
//   │  suriladi    │   va kengayib kiradi │
//   ├──────────────┴──────────────────────┤
//   │        [ Savollar pastda ]          │
//   └─────────────────────────────────────┘

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import AudioPlayer from '../components/listening/AudioPlayer'
import GenerateQuestionsModal from '../components/listening/GenerateQuestionsModal'
import { QuestionsList } from '../components/listening/QuestionsList'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  groupBySection,
  LEVEL_TINT,
  type ListeningExamResponse,
  type ListeningMaterial,
  type ListeningQuestionPublic,
  type ListeningSubmission,
  type SubmitListeningExamDTO,
} from '../lib/listening'

const answersKey = (id: string) => `livelingo:practice-answers:${id}`

export default function ListeningPracticeSession() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [material, setMaterial] = useState<ListeningMaterial | null>(null)
  const [questions, setQuestions] = useState<ListeningQuestionPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Faqat "Generate with AI" materiallarida kerak — 10 ta variant
  // (5 Easy + 5 Hard) bo'lsa, foydalanuvchi avval qiyinlikni
  // tanlashi kerak.  Mode A (variantsiz) materiallarda bular
  // ishlatilmaydi (needsDifficulty hech qachon true bo'lmaydi).
  const [needsDifficulty, setNeedsDifficulty] = useState(false)
  const [difficulty, setDifficulty] = useState<'EASY' | 'HARD' | null>(null)
  const [variantIndex, setVariantIndex] = useState<number | null>(null)
  const [totalVariants, setTotalVariants] = useState(0)

  // Transcript states
  const [transcript, setTranscript] = useState<string | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const startedAt = useRef<number>(Date.now())

  // Draft restore
  useEffect(() => {
    if (!id) return
    try {
      const saved = localStorage.getItem(answersKey(id))
      if (saved) setAnswers(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [id])

  // Autosave
  useEffect(() => {
    if (!id) return
    try {
      localStorage.setItem(answersKey(id), JSON.stringify(answers))
    } catch { /* quota */ }
  }, [id, answers])

  const loadMaterialAndQuestions = useCallback(async (chosenDifficulty?: 'EASY' | 'HARD') => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const materialPromise = api.get<ListeningMaterial>(`/api/listening/materials/${id}`)

      const qsUrl = chosenDifficulty
          ? `/api/listening/materials/${id}/exam-questions?difficulty=${chosenDifficulty}`
          : `/api/listening/materials/${id}/exam-questions`

      const [m, examResp] = await Promise.all([
        materialPromise,
        api.get<ListeningExamResponse>(qsUrl).catch((err) => {
          // 400 — bu material Easy/Hard variantlarga ega, difficulty
          // tanlanishi kerak.  Bu XATO emas — foydalanuvchiga tanlov
          // ekranini ko'rsatish signali.
          if (err instanceof ApiError && err.status === 400 && !chosenDifficulty) {
            return null
          }
          throw err
        }),
      ])

      setMaterial(m)

      if (examResp === null) {
        // Difficulty tanlash kerak — savollarni hali yuklamaymiz
        setNeedsDifficulty(true)
        setQuestions([])
      } else {
        setNeedsDifficulty(false)
        setDifficulty(examResp.difficulty)
        setVariantIndex(examResp.variantIndex)
        setTotalVariants(examResp.totalVariants)
        setQuestions(examResp.questions ?? [])
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Materialni yuklab boʻlmadi.')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  // Foydalanuvchi Easy/Hard tanlaganda chaqiriladi
  const selectDifficulty = (d: 'EASY' | 'HARD') => {
    loadMaterialAndQuestions(d)
  }

  useEffect(() => {
    loadMaterialAndQuestions()
  }, [loadMaterialAndQuestions])

  // ── Transcript toggle ────────────────────────────────────────
  const toggleTranscript = useCallback(async () => {
    if (transcript != null) {
      setTranscriptOpen((v) => !v)
      return
    }
    if (!id) return
    setTranscriptLoading(true)
    setTranscriptError(null)
    try {
      const t = await api.get<string | { transcript?: string }>(
          `/api/listening/materials/${id}/transcript`
      )
      const text =
          typeof t === 'string'
              ? t
              : typeof t === 'object' && t !== null
                  ? (t.transcript ?? '')
                  : ''
      setTranscript(text)
      setTranscriptOpen(true)
      if (!text) setTranscriptError("The transcript is empty or unavailable.")
    } catch (err) {
      setTranscriptError(
          err instanceof ApiError && err.status === 404
              ? "This material has no transcript."
              : err instanceof Error
                  ? err.message
                  : 'Could not open the transcript.'
      )
      setTranscriptOpen(true)
    } finally {
      setTranscriptLoading(false)
    }
  }, [id, transcript])

  // Clipboard'ga nusxalash
  const handleCopyTranscript = () => {
    if (!transcript) return
    navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── AI generation — modal orqali ────────────────────────────
  const [genModalOpen, setGenModalOpen] = useState(false)

  // ── Submit ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const totalAnswered = Object.values(answers).filter(
      (v) => v.trim().length > 0
  ).length

  const submit = async () => {
    if (!material || questions.length === 0) return
    if (totalAnswered < questions.length) {
      const ok = confirm(
          `You've answered ${totalAnswered} / ${questions.length} questions. Submit anyway?`
      )
      if (!ok) return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const dto: SubmitListeningExamDTO = {
        materialId: material.id,
        timeTakenSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        answers: questions.map((q) => ({
          questionId: q.id,
          userAnswer: (answers[q.id] ?? '').trim(),
        })),
      }
      const res = await api.post<ListeningSubmission>(
          '/api/listening/submit',
          dto
      )
      try {
        localStorage.removeItem(answersKey(material.id))
      } catch {}
      navigate(`/learn/listening/results/${res.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong while submitting.')
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = useMemo(() => {
    const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex)
    return groupBySection(sorted)
  }, [questions])

  if (loading) {
    return (
        <main className="grid min-h-screen place-items-center bg-cream">
          <p className="text-sm text-ink-muted">Loading…</p>
        </main>
    )
  }
  if (error || !material) {
    return (
        <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
          <div>
            <p className="mb-4 text-sm text-coral-700">
              {error ?? 'Material not found.'}
            </p>
            <Link to="/learn/listening/practice" className="btn-primary">
              Back to Practice
            </Link>
          </div>
        </main>
    )
  }

  // Bu material AI tomonidan 10 ta variant (5 Easy + 5 Hard) bilan
  // tayyorlangan — davom etishdan oldin foydalanuvchi qiyinlikni
  // tanlashi kerak.
  if (needsDifficulty && !difficulty) {
    return (
        <main className="grid min-h-screen place-items-center bg-cream px-5">
          <div className="w-full max-w-md text-center">
            <p className="mb-1 font-display text-lg font-semibold text-ink">
              {material.title}
            </p>
            <p className="mb-8 text-sm text-ink-muted">
              Choose a difficulty level
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                  onClick={() => selectDifficulty('EASY')}
                  className="group rounded-3xl border-2 border-mint-500/30 bg-white p-6 text-left transition hover:border-mint-500 hover:shadow-lift"
              >
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-mint-500/15 text-mint-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 6L3 12l5 6M16 6l5 6-5 6" />
                  </svg>
                </div>
                <p className="font-display text-base font-semibold text-ink">Easy</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Standard difficulty — listen and check the key facts
                </p>
              </button>

              <button
                  onClick={() => selectDifficulty('HARD')}
                  className="group rounded-3xl border-2 border-coral-500/30 bg-white p-6 text-left transition hover:border-coral-500 hover:shadow-lift"
              >
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-coral-500/15 text-coral-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                  </svg>
                </div>
                <p className="font-display text-base font-semibold text-ink">Hard</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Harder — requires inference and careful listening
                </p>
              </button>
            </div>

            <Link
                to="/learn/listening/practice"
                className="mt-6 inline-block text-xs font-medium text-ink-muted hover:text-ink"
            >
              ← Back to Practice
            </Link>
          </div>
        </main>
    )
  }

  return (
      <main className="min-h-screen bg-cream pb-24">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
          <Link
              to="/learn/listening/practice"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <span className="rounded-full border border-mint-500/25 bg-mint-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mint-700">
          Practice
        </span>
          <Logo size={26} />
        </header>

        {/* Asosiy konteyner */}
        <div className="mx-auto max-w-6xl px-5 py-6">
          {/* Meta ma'lumotlar */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[material.cefrLevel]}`}
          >
            {material.cefrLevel}
          </span>
            {material.certificateType && (
                <span className="rounded-full border border-ink/12 bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              {material.certificateType.replace(/_/g, ' ')}
            </span>
            )}
          </div>
          <h1 className="mb-1 font-display text-xl font-semibold text-ink">
            {material.title}
          </h1>
          {difficulty && variantIndex && (
              <p className="mb-6 flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                    className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${
                        difficulty === 'EASY'
                            ? 'bg-mint-500/15 text-mint-700'
                            : 'bg-coral-500/15 text-coral-700'
                    }`}
                >
                  {difficulty}
                </span>
                Variant {variantIndex}/{totalVariants}
              </p>
          )}
          {!(difficulty && variantIndex) && <div className="mb-6" />}

          {/* ═══ AUDIO + TRANSKRIPT FLEX LAYOUT — MUTLOQ SILLIQ ═══ */}
          <div className="flex flex-col lg:flex-row gap-6 items-start justify-center w-full">

            {/* CHAP TOMON — Audio pleyer (O'lchami silliq o'zgaradi va chapga suriladi) */}
            <div
                className="w-full transition-all duration-500 ease-in-out"
                style={{
                  maxWidth: transcriptOpen ? '500px' : '720px',
                  marginLeft: transcriptOpen ? '0' : 'auto',
                  marginRight: transcriptOpen ? '0' : 'auto',
                }}
            >
              <AudioPlayer
                  src={material.audioUrl}
                  title={material.title}
                  subtitle={material.topic ?? undefined}
              />

              {/* Transkriptni yoqish/o'chirish tugmasi */}
              <button
                  onClick={toggleTranscript}
                  disabled={transcriptLoading}
                  className={`mt-4 w-full rounded-2xl border px-4 py-3 text-left text-sm shadow-sm transition-all duration-300 disabled:cursor-wait ${
                      transcriptOpen
                          ? 'border-indigo-500 bg-indigo-500/5 text-indigo-700'
                          : 'border-ink/8 bg-white hover:border-indigo-500/30 hover:bg-indigo-50'
                  }`}
              >
              <span className="inline-flex items-center gap-2 font-display font-semibold text-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
                {transcriptLoading
                    ? 'Loading transcript…'
                    : transcriptOpen
                        ? 'Hide Transcript'
                        : 'View Transcript'}
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`ml-auto transition-transform duration-300 ${transcriptOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
              </button>
            </div>

            {/* O'NG TOMON — Transkript (O'ta silliq kengayish va paydo bo'lish) */}
            <aside
                className="w-full rounded-3xl border border-ink/8 bg-white shadow-md overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  maxWidth: transcriptOpen ? '580px' : '0px',
                  opacity: transcriptOpen ? 1 : 0,
                  transform: transcriptOpen ? 'translateX(0) scale(1)' : 'translateX(30px) scale(0.96)',
                  visibility: transcriptOpen ? 'visible' : 'hidden',
                  maxHeight: transcriptOpen ? '600px' : '0px',
                }}
            >
              {/* Sarlavha qismi */}
              <div className="flex items-center justify-between border-b border-ink/6 bg-cream/60 px-5 py-3.5">
                <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  Transcript
                </h2>
                <div className="flex items-center gap-1.5">
                  {/* Nusxa olish tugmasi */}
                  {transcript && (
                      <button
                          onClick={handleCopyTranscript}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-indigo-600 bg-zinc-100/60 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-all"
                          title="Copy"
                      >
                        {copied ? 'Copied!' : "Copy"}
                      </button>
                  )}
                  <button
                      onClick={() => setTranscriptOpen(false)}
                      className="rounded-full p-1 text-ink-muted transition hover:bg-cream hover:text-ink"
                      aria-label="Close"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Matn joylashadigan qism */}
              <div className="max-h-[460px] overflow-y-auto px-6 py-5 bg-zinc-50/30 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-zinc-100">
                {transcriptError ? (
                    <p className="text-sm text-coral-700">{transcriptError}</p>
                ) : transcript ? (
                    <p className="whitespace-pre-line font-serif text-[15px] leading-loose text-zinc-800 antialiased selection:bg-amber-100">
                      {transcript}
                    </p>
                ) : (
                    <p className="text-sm text-ink-muted">Transcript is empty.</p>
                )}
              </div>
            </aside>
          </div>

          {/* ═══ SAVOLLAR — pastda ═══ */}
          <div className="mt-8">
            {questions.length === 0 ? (
                <GenerateQuestionsPanel onOpen={() => setGenModalOpen(true)} />
            ) : (
                <QuestionsList
                    grouped={grouped}
                    answers={answers}
                    onChangeAnswer={(qid, v) =>
                        setAnswers((prev) => ({ ...prev, [qid]: v }))
                    }
                />
            )}
          </div>
        </div>

        {/* AI orqali savollar yaratish modali */}
        {material && (
            <GenerateQuestionsModal
                open={genModalOpen}
                material={material}
                onClose={() => setGenModalOpen(false)}
                onGenerated={loadMaterialAndQuestions}
            />
        )}

        {/* Pastki topshirish paneli */}
        {questions.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 border-t border-ink/8 bg-white px-5 py-4 shadow-lg z-15">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                {submitError ? (
                    <p className="flex-1 text-sm text-coral-700">{submitError}</p>
                ) : (
                    <p className="flex-1 text-xs text-ink-muted">
                      {totalAnswered} / {questions.length} questions answered
                    </p>
                )}
                <button
                    onClick={submit}
                    disabled={submitting}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'AI is checking…' : 'Submit for Checking'}
                  {!submitting && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                  )}
                </button>
              </div>
            </div>
        )}
      </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Generate panel — savol yo'q bo'lganda (Tugma modal ochadi)
// ═════════════════════════════════════════════════════════════════
function GenerateQuestionsPanel({ onOpen }: { onOpen: () => void }) {
  return (
      <section className="rounded-3xl border-2 border-dashed border-indigo-500/25 bg-indigo-50/50 p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-white text-indigo-600 shadow-sm">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v1M12 20v1M4.22 4.22l.707.707M18.36 18.36l.707.707M2 12h1M21 12h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        </div>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">
          No questions yet
        </h2>
        <p className="mx-auto mb-6 max-w-md text-sm text-ink-soft">
          AI will generate questions from this material's transcript — Short Answer, Multiple Choice, and True/False types.
        </p>
        <button onClick={onOpen} className="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <path d="M12 3v1M12 20v1M4.22 4.22l.707.707M18.36 18.36l.707.707M2 12h1M21 12h1M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          Generate with AI
        </button>
      </section>
  )
}
