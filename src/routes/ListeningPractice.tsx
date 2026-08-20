// Listening — Practice mode (redesigned).
//
// Layout when transcript is CLOSED:
//   • Audio player centered, max-w-2xl
//   • Below: A-B loop panel, notes, questions panel (with reveal answer)
//
// Layout when transcript is OPEN:
//   • Audio player slides left (max-w-md), animated
//   • Transcript slides in from right on desktop, becomes overlay on mobile
//   • Notes/questions remain below
//
// Key differences from the old file:
//   • Transcript endpoint returns PLAIN TEXT — we no longer expect
//     { transcript: "..." } object.
//   • Questions panel added — teachers/admins see full questions
//     (with correct answer), users see the exam version and can
//     click "Show answer" to reveal it.
//   • Uses the new AudioPlayer component (black theme, working
//     volume/repeat/skip).
//
// Deep-linking: results page sends users here with ?t=45 to
// jump straight to that timestamp.  The initial position is set
// on the audio element via `onAudioRef`.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom'
import Logo from '../components/Logo'
import AudioPlayer from '../components/listening/AudioPlayer'
import {api, ApiError} from '../lib/api'
import {isAuthenticated} from '../lib/auth'
import {
    formatTime,
    groupBySection,
    LEVEL_TINT,
    type ListeningMaterial,
    type ListeningProgress,
    type ListeningQuestionFull,
    type ListeningQuestionPublic,
    parseOptions,
} from '../lib/listening'

const notesKey = (id: string) => `livelingo:listening-notes:${id}`

export default function ListeningPractice() {
    const {id} = useParams<{ id: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated()) navigate('/sign-in', {replace: true})
    }, [navigate])

    const [material, setMaterial] = useState<ListeningMaterial | null>(null)
    const [transcript, setTranscript] = useState<string | null>(null)
    const [transcriptOpen, setTranscriptOpen] = useState(false)
    const [transcriptLoading, setTranscriptLoading] = useState(false)
    const [transcriptError, setTranscriptError] = useState<string | null>(null)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (!id) return
        let cancelled = false
        setLoading(true)
        setError(null)

        Promise.all([
            api.get<ListeningMaterial>(`/api/listening/materials/${id}`),
            api
                .get<ListeningProgress>(`/api/listening/materials/${id}/progress`)
                .catch(() => null),
        ])
            .then(([m, p]) => {
                if (cancelled) return
                setMaterial(m)
                if (p) initialProgressRef.current = p
            })
            .catch((err) => {
                if (cancelled) return
                if (err instanceof ApiError && err.status === 401) {
                    navigate('/sign-in', {replace: true})
                    return
                }
                setError(err instanceof Error ? err.message : 'Could not load audio.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        try {
            setNotes(localStorage.getItem(notesKey(id)) ?? '')
        } catch { /* no-op */
        }

        return () => {
            cancelled = true
        }
    }, [id, navigate])

    useEffect(() => {
        if (!id) return
        const t = setTimeout(() => {
            try {
                localStorage.setItem(notesKey(id), notes)
            } catch { /* quota */
            }
        }, 500)
        return () => clearTimeout(t)
    }, [id, notes])

    // ── Audio ref bridging (A-B loop needs the underlying <audio>) ─
    const audioElRef = useRef<HTMLAudioElement | null>(null)
    const initialProgressRef = useRef<ListeningProgress | null>(null)
    const initialSeekAppliedRef = useRef(false)

    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    const [loopA, setLoopA] = useState<number | null>(null)
    const [loopB, setLoopB] = useState<number | null>(null)
    const [loopEnabled, setLoopEnabled] = useState(false)

    const jumpToRef = useRef<number | null>(null)

    const handleAudioRef = useCallback((el: HTMLAudioElement | null) => {
        audioElRef.current = el
    }, [])

    const handleTimeUpdate = useCallback(
        (t: number) => {
            setCurrentTime(t)
            const el = audioElRef.current
            if (
                el &&
                loopEnabled &&
                loopA != null &&
                loopB != null &&
                loopB > loopA &&
                t >= loopB
            ) {
                el.currentTime = loopA
            }
        },
        [loopA, loopB, loopEnabled]
    )

    const handleDuration = useCallback((d: number) => {
        setDuration(d)

        // Once we know duration, apply saved progress (once).
        const el = audioElRef.current
        if (!el || initialSeekAppliedRef.current) return
        initialSeekAppliedRef.current = true

        // Priority: deep-link ?t=… > saved lastPositionSeconds
        const deepLink = Number(searchParams.get('t'))
        if (Number.isFinite(deepLink) && deepLink > 0 && deepLink < d - 2) {
            el.currentTime = deepLink
            jumpToRef.current = deepLink
            return
        }
        const saved = initialProgressRef.current
        if (saved) {
            if (saved.lastPositionSeconds > 0 && saved.lastPositionSeconds < d - 5) {
                el.currentTime = saved.lastPositionSeconds
            }
            if (saved.playbackSpeed && saved.playbackSpeed !== 1) {
                el.playbackRate = saved.playbackSpeed
            }
            if (saved.loopStartSeconds != null) setLoopA(saved.loopStartSeconds)
            if (saved.loopEndSeconds != null) setLoopB(saved.loopEndSeconds)
            if (saved.transcriptViewed) setTranscriptOpen(true)
        }
    }, [searchParams])

    // ── Progress sync ────────────────────────────────────────────
    useEffect(() => {
        if (!id) return
        const t = setInterval(() => {
            const el = audioElRef.current
            if (!el) return
            api
                .put(`/api/listening/materials/${id}/progress`, {
                    lastPositionSeconds: Math.floor(el.currentTime),
                    playbackSpeed: el.playbackRate,
                    loopStartSeconds: loopA,
                    loopEndSeconds: loopB,
                    transcriptViewed: transcriptOpen,
                    completed:
                        el.duration > 0 && el.currentTime >= el.duration - 2,
                })
                .catch(() => {
                })
        }, 5000)
        return () => clearInterval(t)
    }, [id, loopA, loopB, transcriptOpen])

    // ── Loop actions ────────────────────────────────────────────
    const markLoopA = () => setLoopA(currentTime)
    const markLoopB = () => setLoopB(currentTime)
    const clearLoop = () => {
        setLoopA(null)
        setLoopB(null)
        setLoopEnabled(false)
    }

    // ── Transcript reveal ───────────────────────────────────────
    const toggleTranscript = useCallback(async () => {
        // Already have it — just toggle
        if (transcript != null) {
            setTranscriptOpen((v) => !v)
            return
        }
        if (!id) return
        setTranscriptLoading(true)
        setTranscriptError(null)
        try {
            // Backend returns PLAIN STRING (not JSON object).
            // api.get with T=string parses text response as string.
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
            if (!text) {
                setTranscriptError('Transcript bo\'sh yoki mavjud emas.')
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setTranscriptError('Bu material uchun transcript qo\'shilmagan.')
            } else {
                setTranscriptError(
                    err instanceof Error ? err.message : 'Transcript ochilmadi.'
                )
            }
            setTranscriptOpen(true) // panelni ochib xatoni ko'rsatamiz
        } finally {
            setTranscriptLoading(false)
        }
    }, [id, transcript])

    if (loading) {
        return (
            <main className="grid min-h-screen place-items-center bg-cream">
                <p className="text-sm text-ink-muted">Loading audio…</p>
            </main>
        )
    }
    if (error || !material) {
        return (
            <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
                <div>
                    <p className="mb-4 text-sm text-coral-700">
                        {error ?? 'Material topilmadi.'}
                    </p>
                    <Link to="/learn/listening" className="btn-primary">
                        Back
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-cream">
            <header className="flex items-center justify-between border-b border-ink/8 bg-white px-5 py-3">
                <Link
                    to={`/learn/listening/material/${material.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Back
                </Link>
                <span className="truncate max-w-[380px] text-sm font-medium text-ink">
          {material.title}
        </span>
                <Logo size={26}/>
            </header>

            <div className="mx-auto max-w-6xl px-5 py-6">
                {/* Meta chips */}
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[material.cefrLevel]}`}
          >
            {material.cefrLevel}
          </span>
                    {material.certificateType && (
                        <span
                            className="rounded-full border border-ink/12 bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              {material.certificateType.replace(/_/g, ' ')}
            </span>
                    )}
                    <span
                        className="rounded-full border border-mint-500/25 bg-mint-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mint-700">
            Practice
          </span>
                </div>

                {/* Player + transcript side-by-side */}
                <div
                    className={`grid gap-6 transition-[grid-template-columns] duration-500 ease-out ${
                        transcriptOpen
                            ? 'lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'
                            : 'lg:grid-cols-[minmax(0,1fr)]'
                    }`}
                >
                    {/* LEFT — audio player */}
                    <div
                        className={`transition-all duration-500 ${
                            transcriptOpen ? 'lg:mx-0' : 'lg:mx-auto'
                        }`}
                    >
                        <AudioPlayer
                            src={material.audioUrl}
                            title={material.title}
                            subtitle={
                                material.topic ? `${material.topic}` : undefined
                            }
                            onAudioRef={handleAudioRef}
                            onTimeUpdate={handleTimeUpdate}
                            onDurationChange={handleDuration}
                        />

                        {/* A-B loop panel */}
                        <section className="mt-4 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm">
                            <p className="mb-2 text-xs font-medium text-ink-soft">A–B loop</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={markLoopA}
                                    className="rounded-full border border-mint-500/30 bg-mint-50 px-3 py-1 text-xs font-medium text-mint-700 hover:bg-mint-100"
                                >
                                    Set A {loopA != null && `· ${formatTime(loopA)}`}
                                </button>
                                <button
                                    onClick={markLoopB}
                                    className="rounded-full border border-coral-500/30 bg-coral-50 px-3 py-1 text-xs font-medium text-coral-700 hover:bg-coral-100"
                                >
                                    Set B {loopB != null && `· ${formatTime(loopB)}`}
                                </button>
                                <label className="ml-auto inline-flex items-center gap-2 text-xs text-ink-soft">
                                    <input
                                        type="checkbox"
                                        checked={loopEnabled}
                                        onChange={(e) => setLoopEnabled(e.target.checked)}
                                        disabled={loopA == null || loopB == null || loopB <= loopA}
                                        className="h-4 w-4"
                                    />
                                    Loop A → B
                                </label>
                                {(loopA != null || loopB != null) && (
                                    <button
                                        onClick={clearLoop}
                                        className="text-xs text-ink-muted hover:text-ink"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </section>

                        {/* Transcript toggle button */}
                        <button
                            onClick={toggleTranscript}
                            disabled={transcriptLoading}
                            className="mt-4 w-full rounded-2xl border border-ink/8 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-indigo-500/30 hover:bg-indigo-50 disabled:cursor-wait"
                        >
              <span className="inline-flex items-center gap-2 font-display font-semibold text-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                  {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
                  {transcriptLoading && (
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                    loading…
                  </span>
                  )}
              </span>
                        </button>
                    </div>

                    {/* RIGHT — transcript panel (animated in) */}
                    {transcriptOpen && (
                        <aside
                            className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm animate-slideInRight"
                            style={{
                                animation: 'slideInRight 400ms ease-out both',
                            }}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="font-display text-sm font-semibold text-ink">
                                    Transcript
                                </h2>
                                <button
                                    onClick={() => setTranscriptOpen(false)}
                                    className="rounded-full p-1 text-ink-muted transition hover:bg-cream hover:text-ink"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                            {transcriptError ? (
                                <p className="text-sm text-coral-700">{transcriptError}</p>
                            ) : transcript != null && transcript.length > 0 ? (
                                <div className="max-h-[60vh] overflow-y-auto">
                                    <p className="whitespace-pre-line font-serif text-base leading-relaxed text-ink">
                                        {transcript}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-ink-muted">Transcript bo'sh.</p>
                            )}
                        </aside>
                    )}
                </div>

                {/* Questions + notes stack below */}
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    {/* Notes */}
                    <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
                        <p className="mb-2 inline-flex items-center gap-2 font-display text-sm font-semibold text-ink">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round">
                                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                            My notes
                        </p>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Jot down what you hear, tricky words, or timestamps to revisit…"
                            rows={6}
                            className="w-full resize-none rounded-2xl border border-ink/8 bg-cream p-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                        />
                        <p className="mt-1.5 text-xs text-ink-muted">
                            Notes stay in your browser.
                        </p>
                    </section>

                    {/* Questions panel */}
                    <QuestionsPanel materialId={material.id} jumpToRef={jumpToRef} audioElRef={audioElRef}/>
                </div>
            </div>

            {/* Local styles for the transcript animation */}
            <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </main>
    )
}

// ═════════════════════════════════════════════════════════════════
// Questions panel — Practice-mode reveal-answer version
// ═════════════════════════════════════════════════════════════════
//
// Practice mode is NOT a graded exam.  We show the questions so
// learners can self-check as they listen.  For each question there's
// a "Show answer" toggle that reveals the correct answer inline.
// Teachers/Admins already have correctAnswer from the /questions
// endpoint; users get the public version (no correctAnswer) and
// simply see the correct one after clicking Show.
//
// To keep it simple we always fetch the exam-questions endpoint,
// which is available to all authenticated users.  For teachers who
// want to edit them, we send them to the Manage Questions page (TBD).

function QuestionsPanel({
                            materialId,
                            jumpToRef,
                            audioElRef,
                        }: {
    materialId: string
    jumpToRef: React.MutableRefObject<number | null>
    audioElRef: React.MutableRefObject<HTMLAudioElement | null>
}) {
    const [questions, setQuestions] = useState<
        ListeningQuestionPublic[] | ListeningQuestionFull[]
    >([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hasCorrectAnswers, setHasCorrectAnswers] = useState(false)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        // Try the teacher endpoint first — if the user is Teacher+ they
        // get full DTOs (with correctAnswer).  Fallback to the exam
        // endpoint for regular users.
        const load = async () => {
            try {
                const full = await api.get<ListeningQuestionFull[]>(
                    `/api/listening/materials/${materialId}/questions`
                )
                if (!cancelled) {
                    setQuestions(full)
                    setHasCorrectAnswers(true)
                }
            } catch (err) {
                if (err instanceof ApiError && err.status === 403) {
                    try {
                        const pub = await api.get<ListeningQuestionPublic[]>(
                            `/api/listening/materials/${materialId}/exam-questions`
                        )
                        if (!cancelled) {
                            setQuestions(pub)
                            setHasCorrectAnswers(false)
                        }
                    } catch (e2) {
                        if (!cancelled) {
                            setError(
                                e2 instanceof Error ? e2.message : 'Could not load questions.'
                            )
                        }
                    }
                } else {
                    if (!cancelled) {
                        // Public fallback in case forbidden was reported differently
                        try {
                            const pub = await api.get<ListeningQuestionPublic[]>(
                                `/api/listening/materials/${materialId}/exam-questions`
                            )
                            if (!cancelled) {
                                setQuestions(pub)
                                setHasCorrectAnswers(false)
                            }
                        } catch (e2) {
                            if (!cancelled) {
                                setError(
                                    e2 instanceof Error ? e2.message : 'Could not load questions.'
                                )
                            }
                        }
                    }
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [materialId])

    const grouped = useMemo(() => {
        const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex)
        return groupBySection(sorted)
    }, [questions])

    const jumpTo = useCallback(
        (t: number) => {
            const el = audioElRef.current
            if (el) {
                el.currentTime = t
                el.play().catch(() => {
                })
                jumpToRef.current = t
            }
        },
        [audioElRef, jumpToRef]
    )

    return (
        <section className="rounded-3xl border border-ink/8 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
                <p className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
                    </svg>
                    Questions
                </p>
                <span className="text-xs text-ink-muted">
          {questions.length > 0
              ? `${questions.length} total`
              : loading
                  ? 'loading…'
                  : ''}
        </span>
            </div>

            {loading && (
                <p className="text-sm text-ink-muted">Loading questions…</p>
            )}
            {error && !loading && (
                <p className="text-sm text-coral-700">{error}</p>
            )}
            {!loading && !error && questions.length === 0 && (
                <p className="text-sm text-ink-muted">
                    Bu material'ga savollar hali qo'shilmagan. Practice mode uchun
                    audio va transcript kifoya.
                </p>
            )}

            {!loading && questions.length > 0 && (
                <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
                    {grouped.map((g, gi) => (
                        <div key={gi}>
                            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                                {g.section}
                            </p>
                            <ul className="space-y-2">
                                {g.items.map((q) => (
                                    <PracticeQuestionRow
                                        key={q.id}
                                        question={q}
                                        hasCorrectAnswers={hasCorrectAnswers}
                                        onJump={jumpTo}
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

// One question, with "Show answer" toggle
function PracticeQuestionRow({
                                 question: q,
                                 hasCorrectAnswers,
                                 onJump,
                             }: {
    question: ListeningQuestionPublic | ListeningQuestionFull
    hasCorrectAnswers: boolean
    onJump: (t: number) => void
}) {
    const options = useMemo(() => parseOptions(q.options), [q.options])
    const [selected, setSelected] = useState<string>('')
    const [revealed, setRevealed] = useState(false)

    // If we DON'T have correct answers (regular user), the "Show answer"
    // button silently does nothing — we simply hide the reveal UI.
    const correct = hasCorrectAnswers
        ? (q as ListeningQuestionFull).correctAnswer
        : null

    return (
        <li className="rounded-2xl border border-ink/8 bg-cream/40 p-3">
            <div className="mb-2 flex items-start gap-2">
        <span
            className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-white font-mono text-[10px] font-semibold text-ink-soft tabular-nums">
          {q.orderIndex}
        </span>
                <p className="flex-1 text-sm text-ink">{q.question}</p>
            </div>

            <div className="pl-7">
                {q.questionType === 'MCQ' && (
                    <div className="space-y-1">
                        {options.map((opt) => (
                            <label
                                key={opt}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition ${
                                    selected === opt
                                        ? revealed
                                            ? correct != null
                                                ? matches(opt, correct)
                                                    ? 'border-mint-500/30 bg-mint-50'
                                                    : 'border-coral-500/30 bg-coral-50'
                                                : 'border-indigo-500/30 bg-indigo-50'
                                            : 'border-indigo-500/30 bg-indigo-50'
                                        : revealed && correct != null && matches(opt, correct)
                                            ? 'border-mint-500/30 bg-mint-50'
                                            : 'border-ink/8 bg-white hover:border-indigo-500/20'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name={q.id}
                                    value={opt}
                                    checked={selected === opt}
                                    onChange={() => setSelected(opt)}
                                    className="h-3.5 w-3.5 accent-indigo-500"
                                />
                                <span className="text-ink">{opt}</span>
                            </label>
                        ))}
                    </div>
                )}

                {q.questionType === 'TRUE_FALSE' && (
                    <div className="flex flex-wrap gap-1.5">
                        {(options.length ? options : ['True', 'False']).map((opt) => {
                            const isSelected = selected === opt
                            const isCorrectOne =
                                revealed && correct != null && matches(opt, correct)
                            return (
                                <button
                                    key={opt}
                                    onClick={() => setSelected(opt)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                        isSelected
                                            ? revealed && correct != null
                                                ? matches(opt, correct)
                                                    ? 'border-mint-500 bg-mint-500 text-white'
                                                    : 'border-coral-500 bg-coral-500 text-white'
                                                : 'border-indigo-500 bg-indigo-500 text-white'
                                            : isCorrectOne
                                                ? 'border-mint-500/30 bg-mint-50 text-mint-700'
                                                : 'border-ink/12 bg-white text-ink-soft hover:border-indigo-500/30'
                                    }`}
                                >
                                    {opt}
                                </button>
                            )
                        })}
                    </div>
                )}

                {q.questionType === 'SHORT_ANSWER' && (
                    <input
                        type="text"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        placeholder="Type your answer…"
                        className="w-full max-w-xs rounded-lg border border-ink/12 bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                    />
                )}
            </div>

            <div className="mt-2 flex items-center justify-between pl-7 text-xs">
                <div className="flex items-center gap-2">
                    {hasCorrectAnswers ? (
                        <button
                            onClick={() => setRevealed((v) => !v)}
                            className="rounded-full border border-ink/12 bg-white px-2.5 py-0.5 text-[10px] font-medium text-ink-soft hover:border-indigo-500/30 hover:text-ink"
                        >
                            {revealed ? 'Hide answer' : 'Show answer'}
                        </button>
                    ) : (
                        <span className="text-[10px] text-ink-muted">
              Take the exam to check your answers
            </span>
                    )}
                    {q.timestampSeconds != null && (
                        <button
                            onClick={() => onJump(q.timestampSeconds!)}
                            className="rounded-full border border-indigo-500/20 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                            ▶ {formatTime(q.timestampSeconds)}
                        </button>
                    )}
                </div>
            </div>

            {revealed && correct != null && (
                <p className="mt-2 pl-7 text-xs text-ink-soft">
          <span className="mr-1 font-mono text-[10px] uppercase text-ink-muted">
            Answer:
          </span>
                    <span className="rounded bg-mint-100 px-1.5 py-0.5 text-mint-800">
            {correct.split('|')[0]}
          </span>
                    {correct.includes('|') && (
                        <span className="ml-2 text-ink-muted">
              (also: {correct.split('|').slice(1).join(', ')})
            </span>
                    )}
                </p>
            )}
        </li>
    )
}

function matches(a: string, correct: string): boolean {
    const norm = (s: string) =>
        s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '')
    const na = norm(a)
    return correct.split('|').some((c) => norm(c) === na)
}
