// Exercises — Skill Path
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'
import { Sidebar, MobileNav } from '../components/AppShell'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import { fetchPrimaryLearningLanguageCode } from '../lib/nativeLanguages'
import { LANGUAGES } from '../lib/languages'
import {
  CHECKPOINT_PATH,
  checkpointState,
  type Checkpoint,
  type CheckpointState,
  type UserProgress,
} from '../lib/exercises'

// Onboarding'dagi bilan bir xil 15 tillik ro'yxatdan foydalanamiz
// (avval bu yerda faqat 7 ta til bilan alohida, eskirgan ro'yxat bor edi).
const LANG_OPTIONS = LANGUAGES.map(({ code, name, flag }) => ({ code, flag, name }))

const OFFSETS = [0, 42, -36, 40, -42, 0]
const NODE_HEIGHT = 110

export default function Exercises() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [lang, setLang] = useState('en')
  const [langReady, setLangReady] = useState(false)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lockedHint, setLockedHint] = useState<string | null>(null)

  // Sahifa birinchi ochilganda 'en' bilan emas, user haqiqatan
  // o'rganayotgan til bilan boshlaymiz (onboarding'da tanlagan yoki
  // keyin /api/languages orqali qo'shgan). Faqat shundan keyin
  // progressni yuklaymiz — aks holda bir lahzaga noto'g'ri (inglizcha)
  // progress ko'rsatib, keyin almashtirib qo'yardi.
  useEffect(() => {
    let cancelled = false
    fetchPrimaryLearningLanguageCode().then((code) => {
      if (cancelled) return
      setLang(code)
      setLangReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!langReady) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
        .get<UserProgress>(`/api/exercises/progress?lang=${lang}`)
        .then((p) => {
          if (!cancelled) setProgress(p)
        })
        .catch((err) => {
          if (cancelled) return
          if (err instanceof ApiError && err.status === 401) {
            navigate('/sign-in', { replace: true })
            return
          }
          setError(err instanceof Error ? err.message : 'Could not load your progress.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    return () => {
      cancelled = true
    }
  }, [lang, langReady, navigate])

  const totalXp = progress?.totalXp ?? 0

  const openCompose = () => {
    navigate('/dashboard', { state: { openCompose: true } })
  }

  const states = useMemo<CheckpointState[]>(
      () => CHECKPOINT_PATH.map((cp, i) => checkpointState(cp, i, totalXp)),
      [totalXp]
  )

  const handleTap = (cp: Checkpoint, state: CheckpointState) => {
    if (state === 'locked') {
      setLockedHint(`Reach ${cp.xpToUnlock} XP to unlock "${cp.title}"`)
      setTimeout(() => setLockedHint(null), 2500)
      return
    }
    navigate(`/learn/exercises/session/${cp.id}?lang=${lang}`)
  }

  const svgPathD = useMemo(() => {
    const center = 160
    let d = ''
    CHECKPOINT_PATH.forEach((_, i) => {
      const x = center + OFFSETS[i % OFFSETS.length]
      const y = i * NODE_HEIGHT + 36
      if (i === 0) {
        d += `M ${x} ${y}`
      } else {
        const prevX = center + OFFSETS[(i - 1) % OFFSETS.length]
        const prevY = (i - 1) * NODE_HEIGHT + 36
        const controlY = (prevY + y) / 2
        d += ` C ${prevX} ${controlY}, ${x} ${controlY}, ${x} ${y}`
      }
    })
    return d
  }, [])

  return (
      <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-10 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-400/10 blur-[140px]" />
          <div className="absolute top-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-[130px]" />
          <div className="absolute bottom-10 left-1/3 h-[450px] w-[450px] rounded-full bg-amber-400/10 blur-[140px]" />
        </div>

        <div className="mx-auto flex max-w-7xl gap-6 px-4 pt-6 sm:px-6">
          <Sidebar onCreatePost={openCompose} />

          <MobileNav onCreatePost={openCompose} />

          {/* Main */}
          <main className="relative min-w-0 flex-1 pb-32">
            {/* Header HUD — Arrow tugmasi olib tashlandi, Logo va Statikalar chiroyli taqsimlandi */}
            <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200/80 bg-white/75 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-b-2xl lg:border-x">
              <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
                <Logo size={26} />

                <div className="flex items-center gap-2 sm:gap-3">
                  <StatPill icon="flame" value={progress?.streakDays ?? 0} color="coral" label="Streak" />
                  <StatPill icon="star" value={progress?.totalXp ?? 0} color="sun" label="XP" />
                  <HeartsPill hearts={5} />
                </div>
              </div>
            </header>

            {/* Til paneli */}
            <div className="mx-auto max-w-2xl px-2 pt-6">
              <LanguageScroller lang={lang} onSelect={setLang} />
            </div>

            {/* Path Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-28 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
                  <p className="text-xs font-medium text-slate-400">Loading your skill path…</p>
                </div>
            ) : error ? (
                <div className="mx-auto mt-12 max-w-sm rounded-2xl bg-rose-50 p-6 text-center border border-rose-100">
                  <p className="text-sm font-semibold text-rose-700">{error}</p>
                </div>
            ) : (
                <div className="relative mx-auto max-w-xl px-4 pt-8">
                  <div className="mb-12 text-center">
                <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-600 ring-1 ring-indigo-500/15">
                  {progress?.currentLevel ?? 'A1'} · Level Path
                </span>
                    <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                      Keep the streak alive!
                    </h1>
                  </div>

                  <div className="relative mx-auto flex flex-col items-center" style={{ width: 320 }}>
                    <svg
                        className="absolute top-0 left-0 w-full h-full pointer-events-none -z-0"
                        style={{ height: CHECKPOINT_PATH.length * NODE_HEIGHT }}
                    >
                      <path
                          d={svgPathD}
                          fill="none"
                          stroke="#CBD5E1"
                          strokeWidth="4"
                          strokeDasharray="8 8"
                          strokeLinecap="round"
                      />
                    </svg>

                    <div className="relative z-10 w-full flex flex-col items-center">
                      {CHECKPOINT_PATH.map((cp, i) => (
                          <div
                              key={cp.id}
                              className="flex justify-center items-center w-full"
                              style={{
                                height: NODE_HEIGHT,
                                transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)`,
                              }}
                          >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
                            >
                              <CheckpointNode
                                  checkpoint={cp}
                                  state={states[i]}
                                  onTap={() => handleTap(cp, states[i])}
                              />
                            </motion.div>
                          </div>
                      ))}

                      <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: CHECKPOINT_PATH.length * 0.07 }}
                          className="mt-6 flex flex-col items-center gap-2"
                      >
                        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/80 shadow-inner">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        </div>
                        <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[11px] font-semibold text-slate-500">
                      B1 Path — Coming Soon
                    </span>
                      </motion.div>
                    </div>
                  </div>
                </div>
            )}

            <AnimatePresence>
              {lockedHint && (
                  <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed inset-x-0 bottom-8 z-50 mx-auto w-fit max-w-sm rounded-2xl bg-slate-900/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md ring-1 ring-white/20 text-center"
                  >
                    {lockedHint}
                  </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
  )
}

// Til qatori: ko'p til bo'lganda foydalanuvchi buni sezishi uchun
// chetlarda xira gradient (fade) va bosiladigan strelkalar ko'rsatadi.
// Skrollash mumkin bo'lmasa (hammasi ekranga sig'sa) hech narsa ko'rinmaydi.
function LanguageScroller({
                            lang,
                            onSelect,
                          }: {
  lang: string
  onSelect: (code: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateScrollState()
    const el = scrollerRef.current
    if (!el) return
    const onResize = () => updateScrollState()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * (el.clientWidth * 0.7), behavior: 'smooth' })
  }

  return (
      <div className="relative">
        <div
            ref={scrollerRef}
            onScroll={updateScrollState}
            className="flex gap-2.5 overflow-x-auto scroll-smooth pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {LANG_OPTIONS.map((l) => {
            const isActive = lang === l.code
            return (
                <button
                    key={l.code}
                    onClick={() => onSelect(l.code)}
                    className={`flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                        isActive
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15 scale-105 ring-2 ring-slate-900/10'
                            : 'bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200/80 hover:bg-white hover:text-slate-900 hover:shadow'
                    }`}
                >
                  <span className="text-base">{l.flag}</span>
                  <span>{l.name}</span>
                </button>
            )
          })}
        </div>

        {/* Chap tomon: fade + strelka */}
        <div
            className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-slate-50/60 to-transparent transition-opacity duration-200 ${
                canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
        />
        <button
            aria-label="Chapga surish"
            onClick={() => scrollBy(-1)}
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/3 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-600 shadow-md ring-1 ring-slate-200 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 ${
                canScrollLeft ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-90'
            }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* O'ng tomon: fade + strelka */}
        <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-50/60 to-transparent transition-opacity duration-200 ${
                canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
        />
        <button
            aria-label="O'ngga surish"
            onClick={() => scrollBy(1)}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-600 shadow-md ring-1 ring-slate-200 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 ${
                canScrollRight ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-90'
            }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
  )
}

function StatPill({
                    icon,
                    value,
                    color,
                    label,
                  }: {
  icon: 'flame' | 'star'
  value: number
  color: 'coral' | 'sun'
  label: string
}) {
  const isCoral = color === 'coral'
  return (
      <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-transform hover:scale-105 ${
              isCoral
                  ? 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20'
                  : 'bg-yellow-500/10 text-yellow-600 ring-1 ring-yellow-500/20'
          }`}
          title={label}
      >
        {icon === 'flame' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500">
              <path d="M12 2c-1 3-4 4-4 8a4 4 0 108 0c1.5 1 2 2.5 2 4a6 6 0 11-12 0c0-5 3-7 6-12z" />
            </svg>
        ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
        )}
        <span>{value}</span>
      </div>
  )
}

function HeartsPill({ hearts }: { hearts: number }) {
  return (
      <div className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 ring-1 ring-rose-500/20 transition-transform hover:scale-105">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-rose-500">
          <path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.2 1.6 6.7 4.6 5.4c2-.86 4-.2 5.4 1.5C11.4 5.2 13.4 4.54 15.4 5.4c3 1.3 3.8 4.8 1.9 7.5C19.7 16.65 12 21 12 21z" />
        </svg>
        <span>{hearts}</span>
      </div>
  )
}

const ICONS: Record<Checkpoint['icon'], JSX.Element> = {
  translate: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h10M9 3v2M12 4c-1.5 5-4 8-8 10M8 8c1 3.5 4 6 8 8M14 21l4-9 4 9M15.5 18h5" />
      </svg>
  ),
  image: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
  ),
  build: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="6" height="6" rx="1.5" />
        <rect x="9" y="10" width="6" height="6" rx="1.5" />
        <rect x="16" y="10" width="6" height="6" rx="1.5" />
      </svg>
  ),
  blank: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h4M20 12h-4M12 4v4M12 20v-4" />
        <rect x="8" y="8" width="8" height="8" rx="2" strokeDasharray="2 2" />
      </svg>
  ),
  choice: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12l2 2 4-4" />
      </svg>
  ),
  truefalse: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4M2 12l4 4L15.5 5.5" />
      </svg>
  ),
}

function CheckpointNode({
                          checkpoint,
                          state,
                          onTap,
                        }: {
  checkpoint: Checkpoint
  state: CheckpointState
  onTap: () => void
}) {
  const isLocked = state === 'locked'
  const isCurrent = state === 'current'
  const isDone = state === 'completed'

  return (
      <div className="relative flex flex-col items-center">
        {isCurrent && (
            <motion.div
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: [0, -4, 0], opacity: 1 }}
                transition={{
                  y: { repeat: Infinity, duration: 1.6, ease: 'easeInOut' },
                  opacity: { duration: 0.3 },
                }}
                className="absolute -top-7 z-20 rounded-md bg-indigo-600 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-white shadow-md shadow-indigo-500/30 uppercase"
            >
              START
            </motion.div>
        )}

        {isCurrent && (
            <motion.span
                className="absolute inset-0 rounded-full bg-indigo-500/40 blur-md pointer-events-none"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
        )}

        <motion.button
            onClick={onTap}
            whileTap={!isLocked ? { y: 3, scale: 0.96 } : undefined}
            whileHover={!isLocked ? { scale: 1.06 } : undefined}
            className={`relative grid h-16 w-16 place-items-center rounded-2xl transition-all duration-200 select-none ${
                isDone
                    ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/25 border-b-4 border-emerald-700'
                    : isCurrent
                        ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-xl shadow-indigo-500/35 border-b-4 border-indigo-800 ring-4 ring-indigo-500/20'
                        : 'cursor-not-allowed bg-slate-100/90 text-slate-400 shadow-sm border-b-4 border-slate-300/80 ring-1 ring-slate-200/80'
            }`}
        >
          {isDone ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
          ) : isLocked ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 018 0v3" />
              </svg>
          ) : (
              ICONS[checkpoint.icon]
          )}
        </motion.button>

        <p
            className={`mt-2 max-w-[90px] text-center text-[11px] font-bold leading-tight transition-colors ${
                isCurrent
                    ? 'text-indigo-600 font-extrabold'
                    : isDone
                        ? 'text-slate-800'
                        : 'text-slate-400'
            }`}
        >
          {checkpoint.title}
        </p>
      </div>
  )
}