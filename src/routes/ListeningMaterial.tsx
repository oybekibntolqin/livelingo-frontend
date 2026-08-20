// Listening material landing.
//
// After tapping a material card, the learner sees this page: a big
// title, meta, and two mode buttons — Practice (free-form) and Exam
// (real test).  Past attempts show under the buttons so returning
// learners can see their progress at a glance.
//
// Teachers/Admins/Owners see an extra "Manage Questions" button
// here (added later — currently placeholder alert).

import {useEffect, useState} from 'react'
import {Link, useNavigate, useParams} from 'react-router-dom'
import Logo from '../components/Logo'
import {api, ApiError} from '../lib/api'
import {isAuthenticated} from '../lib/auth'
import {canAddQuestion, type CurrentUser, getCurrentUser} from '../lib/user'
import {
    formatTime,
    LEVEL_TINT,
    type ListeningExamResponse,
    type ListeningMaterial,
    type ListeningSubmission,
} from '../lib/listening'

export default function ListeningMaterialLanding() {
    const {id} = useParams<{ id: string }>()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated()) navigate('/sign-in', {replace: true})
    }, [navigate])

    const [material, setMaterial] = useState<ListeningMaterial | null>(null)
    const [attempts, setAttempts] = useState<ListeningSubmission[]>([])
    const [questionCount, setQuestionCount] = useState<number | null>(null)
    // Mode B (AI 10 ta variant tayyorlagan) materiallarda — exam-questions
    // difficulty'siz so'ralsa 400 xato beradi (bu "savol yo'q" emas,
    // aksincha "variantlar mavjud, tanlov kerak" degani).
    const [hasVariants, setHasVariants] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        getCurrentUser().then(setUser).catch(() => {
        })
    }, [])

    useEffect(() => {
        if (!id) return
        let cancelled = false
        setLoading(true)
        setError(null)

        Promise.all([
            api.get<ListeningMaterial>(`/api/listening/materials/${id}`),
            api
                .get<ListeningSubmission[]>(
                    `/api/listening/materials/${id}/my-submissions`
                )
                .catch(() => [] as ListeningSubmission[]),
            // Exam mode ochiqmi — MUHIM: 400 xato "savol yo'q" DEGANI EMAS,
            // aksincha bu material 10 ta variant (Easy/Hard) bilan
            // tayyorlangan, difficulty tanlash kerakligini bildiradi.
            api
                .get<ListeningExamResponse>(`/api/listening/materials/${id}/exam-questions`)
                .then((resp) => ({kind: 'single' as const, count: resp.questions?.length ?? 0}))
                .catch((err) => {
                    if (err instanceof ApiError && err.status === 400) {
                        return {kind: 'variants' as const, count: 0}
                    }
                    return {kind: 'none' as const, count: 0}
                }),
        ])
            .then(([m, subs, examInfo]) => {
                if (cancelled) return
                setMaterial(m)
                setAttempts(subs ?? [])
                setHasVariants(examInfo.kind === 'variants')
                setQuestionCount(examInfo.kind === 'single' ? examInfo.count : null)
            })
            .catch((err) => {
                if (cancelled) return
                if (err instanceof ApiError && err.status === 401) {
                    navigate('/sign-in', {replace: true})
                    return
                }
                setError(err instanceof Error ? err.message : 'Could not load material.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [id, navigate])

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
                    <Link to="/learn/listening" className="btn-primary">
                        Back to Listening
                    </Link>
                </div>
            </main>
        )
    }

    const hasExam = hasVariants || (questionCount ?? 0) > 0
    const canManage = canAddQuestion(user)

    return (
        <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]"/>
            </div>

            <header className="mx-auto flex max-w-4xl items-center justify-between">
                <Link
                    to="/learn/listening"
                    className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Listening
                </Link>
                <Logo size={28}/>
            </header>

            <div className="mx-auto max-w-4xl pt-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
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
                    </div>
                    <h1 className="font-display text-display-md font-semibold text-ink">
                        {material.title}
                    </h1>
                    <p className="mt-2 text-sm text-ink-soft">
                        {formatTime(material.durationSeconds)} audio
                        {questionCount != null && questionCount > 0
                            ? ` · ${questionCount} exam questions`
                            : ' · no exam questions yet'}
                        {material.topic && ` · ${material.topic}`}
                    </p>
                </div>

                {/* Mode chooser */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <ModeCard
                        to={`/learn/listening/practice/${material.id}`}
                        iconColor="mint"
                        icon={
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round">
                                <path d="M3 18v-6a9 9 0 0118 0v6"/>
                                <path d="M21 19a2 2 0 01-2 2h-1v-6h3v4zM3 19a2 2 0 002 2h1v-6H3v4z"/>
                            </svg>
                        }
                        title="Practice"
                        subtitle="Free-form learning"
                        bullets={[
                            'Play, pause, seek anytime',
                            'A – B loop for tricky bits',
                            'Speed 0.5× → 2×',
                            'Reveal transcript when stuck',
                        ]}
                        cta="Start practice"
                    />
                    <ModeCard
                        to={hasExam ? `/learn/listening/exam/${material.id}` : undefined}
                        iconColor="coral"
                        icon={
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round">
                                <path d="M9 11l3 3 8-8"/>
                                <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/>
                            </svg>
                        }
                        title="Exam"
                        subtitle="Test yourself"
                        bullets={[
                            'Audio plays ONCE',
                            'Timer counts down',
                            'Auto-grade on submit',
                            'Detailed feedback per task',
                        ]}
                        cta={hasExam ? 'Start exam' : 'No questions yet'}
                        disabled={!hasExam}
                    />
                </div>

                {/* Manage button (teachers/admins only) */}
                {canManage && (
                    <div className="mt-4">
                        <button
                            onClick={() =>
                                alert(
                                    'Question builder is coming soon — it will be added in a future update.'
                                )
                            }
                            className="w-full rounded-2xl border border-ink/12 bg-white px-5 py-3 text-sm font-medium text-ink-soft transition hover:border-indigo-500/30 hover:bg-indigo-50 hover:text-ink"
                        >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Manage questions
              </span>
                        </button>
                    </div>
                )}

                {/* Past attempts */}
                {attempts.length > 0 && (
                    <section className="mt-10">
                        <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                            Recent attempts
                        </h2>
                        <div className="rounded-3xl border border-ink/8 bg-white shadow-sm">
                            {attempts.slice(0, 5).map((a, i) => (
                                <Link
                                    key={a.id}
                                    to={`/learn/listening/results/${a.id}`}
                                    className={`flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-cream/60 ${i > 0 ? 'border-t border-ink/6' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <ScoreBadge percent={a.scorePercent}/>
                                        <div>
                                            <p className="text-sm font-medium text-ink">
                                                {a.correctCount} / {a.totalCount} correct
                                            </p>
                                            <p className="text-xs text-ink-muted">
                                                {timeAgo(a.submittedAt)}
                                                {a.timeTakenSeconds != null &&
                                                    ` · ${formatTime(a.timeTakenSeconds)} spent`}
                                            </p>
                                        </div>
                                    </div>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round" className="text-ink-muted">
                                        <path d="M9 6l6 6-6 6"/>
                                    </svg>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}

// ═════════════════════════════════════════════════════════════════
// Mode card — one of Practice / Exam
// ═════════════════════════════════════════════════════════════════
function ModeCard({
                      to,
                      iconColor,
                      icon,
                      title,
                      subtitle,
                      bullets,
                      cta,
                      disabled,
                  }: {
    to?: string
    iconColor: 'mint' | 'coral'
    icon: React.ReactNode
    title: string
    subtitle: string
    bullets: string[]
    cta: string
    disabled?: boolean
}) {
    const iconWrap =
        iconColor === 'mint'
            ? 'bg-mint-50 text-mint-600'
            : 'bg-coral-50 text-coral-600'
    const cardBase =
        'group block rounded-3xl border p-6 shadow-sm transition'
    const cardStyle = disabled
        ? 'cursor-not-allowed border-ink/8 bg-cream/50 opacity-60'
        : 'border-ink/8 bg-white hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md'

    const content = (
        <>
            <div className="mb-4 flex items-center gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-2xl ${iconWrap}`}>
                    {icon}
                </div>
                <div>
                    <p className="font-display text-lg font-semibold text-ink">{title}</p>
                    <p className="text-xs text-ink-muted">{subtitle}</p>
                </div>
            </div>
            <ul className="mb-5 space-y-1.5 text-sm text-ink-soft">
                {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                        <span className="mt-2 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-ink-muted"/>
                        <span>{b}</span>
                    </li>
                ))}
            </ul>
            <span
                className={`inline-flex items-center gap-1.5 font-medium ${disabled ? 'text-ink-muted' : 'text-indigo-600'}`}
            >
        {cta}
                {!disabled && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round">
                        <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                )}
      </span>
        </>
    )

    if (disabled || !to) {
        return <div className={`${cardBase} ${cardStyle}`}>{content}</div>
    }
    return (
        <Link to={to} className={`${cardBase} ${cardStyle}`}>
            {content}
        </Link>
    )
}

function ScoreBadge({percent}: { percent: number }) {
    const color =
        percent >= 80
            ? 'bg-mint-50 text-mint-700 border-mint-500/25'
            : percent >= 60
                ? 'bg-indigo-50 text-indigo-700 border-indigo-500/25'
                : 'bg-coral-50 text-coral-700 border-coral-500/25'
    return (
        <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border font-display font-semibold tabular-nums ${color}`}
        >
      {percent}%
    </span>
    )
}

function timeAgo(iso: string): string {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
}
