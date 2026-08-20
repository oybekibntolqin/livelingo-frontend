// Analytics — foydalanuvchining o'sishini bitta joyda ko'rsatadi:
//   1) Exercises — XP/streak/aniqlik (progress + so'nggi 30 kunlik faollik)
//   2) Learning — 3 skill (Reading / Listening / Writing) bo'yicha kunlik
//      mashq vaqti va imtihon natijalari trendi
//   3) Flashcards — yodlangan (known) so'zlar soni, deck bo'yicha taqsimot
//
// MUHIM: bu sahifa uchun backend'da YANGI endpoint kerak emas — barchasi
// allaqachon mavjud bo'lgan quyidagi API'lardan foydalanadi:
//   GET /api/exercises/progress?lang=X
//   GET /api/exercises/activity?lang=X   (so'nggi 30 kun)
//   GET /api/flashcards/decks/my
//   GET /api/reading/my-submissions
//   GET /api/writing/my-submissions
//   GET /api/listening/my-submissions

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

import Logo from '../components/Logo'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import { fetchLearningLanguages, type LearningLanguage } from '../lib/nativeLanguages'
import type { UserProgress } from '../lib/exercises'
import { flashcardApi, type FlashcardDeck } from '../lib/flashcard'
import type { ReadingSubmission } from '../lib/reading'
import type { WritingSubmission, Page as WritingPage } from '../lib/writing'
import type { ListeningSubmission } from '../lib/listening'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
)

// ─────────────────────────────────────────────────────────────────
// Design tokens (bir xil QuestionVisual.tsx palette bilan)
// ─────────────────────────────────────────────────────────────────
const C = {
  indigo: '#5B5FE9',
  coral: '#FF8A65',
  mint: '#4ECDC4',
  sun: '#E8BF1F',
  ink: '#14142B',
  inkSoft: '#4A4759',
  inkMuted: '#8B879A',
  grid: '#EEEEF3',
}

const LANG_OPTIONS = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'uz', flag: '🇺🇿', name: "O'zbekcha" },
]

function langMeta(code: string) {
  return LANG_OPTIONS.find((l) => l.code === code) ?? { code, flag: '🌐', name: code.toUpperCase() }
}

// Backend `DailyActivity` entity to'g'ridan-to'g'ri qaytariladi — bizga
// kerakli maydonlarnigina oladigan yengil interfeys.
interface DailyActivityDTO {
  activityDate: string
  exerciseCount: number
  correctCount: number
  readingMinutes: number
  listeningMinutes: number
  writingMinutes: number
  chatMinutes: number
  videoCallMinutes: number
  xpEarned: number
}

const DAYS_WINDOW = 30

/** So'nggi N kunni (bugungisi bilan) ISO (yyyy-MM-dd) formatda, ortib boruvchi tartibda qaytaradi. */
function lastNDates(n: number): string[] {
  const out: string[] = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function shortLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })
}

/** 30 kunlik oynani nol qiymatlar bilan to'ldirib, backend qaytargan faollikni shu ustiga qo'yadi. */
function fillActivity(data: DailyActivityDTO[]): DailyActivityDTO[] {
  const byDate = new Map(data.map((d) => [d.activityDate?.slice(0, 10), d]))
  return lastNDates(DAYS_WINDOW).map((date) => {
    const found = byDate.get(date)
    return (
      found ?? {
        activityDate: date,
        exerciseCount: 0,
        correctCount: 0,
        readingMinutes: 0,
        listeningMinutes: 0,
        writingMinutes: 0,
        chatMinutes: 0,
        videoCallMinutes: 0,
        xpEarned: 0,
      }
    )
  })
}

export default function Analytics() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [languages, setLanguages] = useState<LearningLanguage[]>([])
  const [lang, setLang] = useState<string | null>(null)
  const [langReady, setLangReady] = useState(false)

  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [activity, setActivity] = useState<DailyActivityDTO[]>([])
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [readingSubs, setReadingSubs] = useState<ReadingSubmission[]>([])
  const [writingSubs, setWritingSubs] = useState<WritingSubmission[]>([])
  const [listeningSubs, setListeningSubs] = useState<ListeningSubmission[]>([])

  const [loading, setLoading] = useState(true)
  const [notLearning, setNotLearning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1) Foydalanuvchi haqiqatan o'rganayotgan tillarni yuklaymiz.
  useEffect(() => {
    let cancelled = false
    fetchLearningLanguages().then((list) => {
      if (cancelled) return
      setLanguages(list)
      setLang((prev) => prev ?? list[0]?.languageCode ?? null)
      setLangReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 2) Til bo'yicha (Exercises + Flashcards) statistikani yuklaymiz.
  useEffect(() => {
    if (!langReady) return
    if (!lang) {
      setLoading(false)
      setNotLearning(true)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setNotLearning(false)

    Promise.all([
      api.get<UserProgress>(`/api/exercises/progress?lang=${lang}`),
      api.get<DailyActivityDTO[]>(`/api/exercises/activity?lang=${lang}`),
      flashcardApi.myDecks(0, 100),
    ])
      .then(([progressRes, activityRes, deckRes]) => {
        if (cancelled) return
        setProgress(progressRes)
        setActivity(Array.isArray(activityRes) ? activityRes : [])
        setDecks(deckRes)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        if (err instanceof ApiError && err.status === 403) {
          // Bu til hali "o'rganilayotgan tillar" ro'yxatida yo'q.
          setNotLearning(true)
          setProgress(null)
          setActivity([])
          return
        }
        setError(err instanceof Error ? err.message : 'Statistikani yuklab bo\'lmadi.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [lang, langReady, navigate])

  // 3) Reading/Writing/Listening natijalari — til bo'yicha bo'linmagan,
  //    shuning uchun faqat bir marta yuklanadi.
  useEffect(() => {
    let cancelled = false
    api
      .get<ReadingSubmission[]>('/api/reading/my-submissions')
      .then((res) => !cancelled && setReadingSubs(Array.isArray(res) ? res : []))
      .catch(() => {})
    api
      .get<WritingPage<WritingSubmission>>('/api/writing/my-submissions?page=0&size=50')
      .then((res) => !cancelled && setWritingSubs(res?.content ?? []))
      .catch(() => {})
    api
      .get<ListeningSubmission[]>('/api/listening/my-submissions')
      .then((res) => !cancelled && setListeningSubs(Array.isArray(res) ? res : []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const filledActivity = useMemo(() => fillActivity(activity), [activity])

  const openCompose = () => navigate('/dashboard', { state: { openCompose: true } })

  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:gap-8 lg:pb-16">
        <Sidebar onCreatePost={openCompose} />
        <MobileNav onCreatePost={openCompose} />

        <main className="min-w-0">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 lg:hidden">
                <Logo size={24} />
              </div>
              <p className="font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                Analytics
              </p>
              <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                O'sishingiz bir joyda
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                Mashqlar, Reading/Writing/Listening va yodlagan so'zlaringiz — barchasi shu yerda.
              </p>
            </div>

            {languages.length > 0 && (
              <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {languages.map((l) => {
                  const meta = langMeta(l.languageCode)
                  const active = lang === l.languageCode
                  return (
                    <button
                      key={l.languageCode}
                      onClick={() => setLang(l.languageCode)}
                      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-ink text-white shadow-md'
                          : 'bg-white text-ink-soft ring-1 ring-ink/10 hover:bg-cream'
                      }`}
                    >
                      <span className="text-sm">{meta.flag}</span>
                      {meta.name}
                    </button>
                  )
                })}
              </div>
            )}
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-28">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent" />
              <p className="text-xs font-medium text-ink-muted">Statistika yuklanmoqda…</p>
            </div>
          ) : notLearning ? (
            <div className="rounded-4xl border border-ink/8 bg-white p-10 text-center">
              <p className="font-display text-lg font-semibold text-ink">
                Hali birorta ham til o'rganishni boshlamagansiz
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                Analytics ko'rish uchun avval bir tilni o'rganishni boshlang.
              </p>
              <button
                onClick={() => navigate('/onboarding')}
                className="mt-5 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
              >
                Boshlash
              </button>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-coral-500/20 bg-coral-50 p-6 text-center">
              <p className="text-sm font-semibold text-coral-600">{error}</p>
            </div>
          ) : (
            <AnalyticsBody
              progress={progress}
              activity={filledActivity}
              decks={decks}
              readingSubs={readingSubs}
              writingSubs={writingSubs}
              listeningSubs={listeningSubs}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Body — statistika tayyor bo'lgach ko'rsatiladi
// ═════════════════════════════════════════════════════════════════
function AnalyticsBody({
  progress,
  activity,
  decks,
  readingSubs,
  writingSubs,
  listeningSubs,
}: {
  progress: UserProgress | null
  activity: DailyActivityDTO[]
  decks: FlashcardDeck[]
  readingSubs: ReadingSubmission[]
  writingSubs: WritingSubmission[]
  listeningSubs: ListeningSubmission[]
}) {
  // ── Flashcards aggregates ──
  const totalCards = decks.reduce((s, d) => s + (d.cardCount ?? 0), 0)
  const totalKnown = decks.reduce((s, d) => s + (d.knownCount ?? 0), 0)
  const knownPercent = totalCards > 0 ? Math.round((totalKnown / totalCards) * 100) : 0

  // ── 30 kunlik faollik minutlari yig'indisi (skill bo'yicha) ──
  const totalReadingMin = activity.reduce((s, a) => s + a.readingMinutes, 0)
  const totalListeningMin = activity.reduce((s, a) => s + a.listeningMinutes, 0)
  const totalWritingMin = activity.reduce((s, a) => s + a.writingMinutes, 0)
  const totalPracticeMin = totalReadingMin + totalListeningMin + totalWritingMin

  // ── Reading/Listening/Writing o'rtacha ballari ──
  const avgReading =
    readingSubs.length > 0
      ? Math.round(readingSubs.reduce((s, r) => s + (r.scorePercent ?? 0), 0) / readingSubs.length)
      : null
  const avgListening =
    listeningSubs.length > 0
      ? Math.round(listeningSubs.reduce((s, r) => s + (r.scorePercent ?? 0), 0) / listeningSubs.length)
      : null
  const gradedWriting = writingSubs.filter((w) => w.checked && w.overallScore != null)
  const avgWritingBand =
    gradedWriting.length > 0
      ? Math.round(
          (gradedWriting.reduce((s, w) => s + (w.overallScore ?? 0), 0) / gradedWriting.length) * 10
        ) / 10
      : null

  return (
    <div className="space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Daraja" value={progress?.currentLevel ?? '—'} accent="indigo" icon="level" />
        <StatCard label="Jami XP" value={(progress?.totalXp ?? 0).toLocaleString()} accent="sun" icon="xp" />
        <StatCard label="Streak" value={`${progress?.streakDays ?? 0} kun`} accent="coral" icon="flame" />
        <StatCard label="Aniqlik" value={`${progress?.accuracyPercent ?? 0}%`} accent="mint" icon="target" />
        <StatCard label="Yodlangan so'z" value={`${totalKnown}/${totalCards}`} accent="indigo" icon="cards" />
        <StatCard label="30 kunlik amaliyot" value={`${totalPracticeMin} daq`} accent="mint" icon="clock" />
      </div>

      {/* ── Exercises: XP va faollik trendi ── */}
      <SectionCard
        title="Mashqlar — XP va faollik"
        subtitle="So'nggi 30 kun — har kuni to'plangan XP va yechilgan mashqlar soni"
      >
        {activity.every((a) => a.xpEarned === 0 && a.exerciseCount === 0) ? (
          <EmptyChart text="Hali mashq tarixi yo'q — birinchi mashqni bajaring, shu yerda trend paydo bo'ladi." />
        ) : (
          <div className="h-72 sm:h-80">
            <Line
              data={{
                labels: activity.map((a) => shortLabel(a.activityDate)),
                datasets: [
                  {
                    label: 'XP',
                    data: activity.map((a) => a.xpEarned),
                    borderColor: C.sun,
                    backgroundColor: `${C.sun}33`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 2,
                    yAxisID: 'y',
                  },
                  {
                    label: 'Mashqlar soni',
                    data: activity.map((a) => a.exerciseCount),
                    borderColor: C.indigo,
                    backgroundColor: 'transparent',
                    tension: 0.35,
                    pointRadius: 2,
                    yAxisID: 'y1',
                  },
                ],
              }}
              options={dualAxisLineOptions('XP', 'Mashqlar')}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Learning: 3 skill — kunlik amaliyot vaqti ── */}
      <SectionCard
        title="Learning — 3 skill bo'yicha kunlik amaliyot"
        subtitle="Reading / Listening / Writing — kuniga necha daqiqa mashq qilingani (so'nggi 30 kun)"
      >
        {totalPracticeMin === 0 ? (
          <EmptyChart text="Hali Reading, Listening yoki Writing bo'yicha vaqt qayd etilmagan." />
        ) : (
          <div className="h-72 sm:h-80">
            <Line
              data={{
                labels: activity.map((a) => shortLabel(a.activityDate)),
                datasets: [
                  {
                    label: 'Reading (daq)',
                    data: activity.map((a) => a.readingMinutes),
                    borderColor: C.indigo,
                    backgroundColor: `${C.indigo}22`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 1.5,
                  },
                  {
                    label: 'Listening (daq)',
                    data: activity.map((a) => a.listeningMinutes),
                    borderColor: C.mint,
                    backgroundColor: `${C.mint}22`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 1.5,
                  },
                  {
                    label: 'Writing (daq)',
                    data: activity.map((a) => a.writingMinutes),
                    borderColor: C.coral,
                    backgroundColor: `${C.coral}22`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 1.5,
                  },
                ],
              }}
              options={simpleLineOptions()}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Learning: imtihon natijalari trendi ── */}
      <SectionCard
        title="Learning — natijalar trendi"
        subtitle="Har bir urinishda olingan ball — o'sish tendensiyasini ko'rish uchun (Writing 0–9 ball × 10 sifatida ko'rsatilgan)"
      >
        {readingSubs.length === 0 && listeningSubs.length === 0 && writingSubs.length === 0 ? (
          <EmptyChart text="Hali Reading, Listening yoki Writing bo'yicha topshirilgan urinish yo'q." />
        ) : (
          <div className="h-72 sm:h-80">
            <Line data={skillScoreTrendData(readingSubs, listeningSubs, writingSubs)} options={percentLineOptions()} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-ink/8 pt-4 text-sm">
          <ScoreBadge label="Reading o'rtacha" value={avgReading != null ? `${avgReading}%` : '—'} color={C.indigo} />
          <ScoreBadge label="Listening o'rtacha" value={avgListening != null ? `${avgListening}%` : '—'} color={C.mint} />
          <ScoreBadge label="Writing o'rtacha" value={avgWritingBand != null ? `${avgWritingBand} / 9` : '—'} color={C.coral} />
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Exercises: to'g'ri / noto'g'ri javoblar ── */}
        <SectionCard title="Mashqlar — javoblar taqsimoti" subtitle="Barcha vaqt bo'yicha">
          {(progress?.totalExercises ?? 0) === 0 ? (
            <EmptyChart text="Hali mashq yechilmagan." small />
          ) : (
            <div className="mx-auto h-64 w-64">
              <Doughnut
                data={{
                  labels: ['To\'g\'ri', 'Noto\'g\'ri'],
                  datasets: [
                    {
                      data: [
                        progress?.totalCorrect ?? 0,
                        Math.max((progress?.totalExercises ?? 0) - (progress?.totalCorrect ?? 0), 0),
                      ],
                      backgroundColor: [C.mint, `${C.coral}CC`],
                      borderColor: '#ffffff',
                      borderWidth: 3,
                    },
                  ],
                }}
                options={doughnutOptions()}
              />
            </div>
          )}
        </SectionCard>

        {/* ── Flashcards: yodlangan so'zlar ── */}
        <SectionCard title="Flashcards — yodlangan so'zlar" subtitle={`${totalKnown} / ${totalCards} so'z (${knownPercent}%)`}>
          {totalCards === 0 ? (
            <EmptyChart text="Hali flashcard deck yaratilmagan." small />
          ) : (
            <div className="mx-auto h-64 w-64">
              <Doughnut
                data={{
                  labels: ['Yodlangan', 'Hali yodlanmagan'],
                  datasets: [
                    {
                      data: [totalKnown, Math.max(totalCards - totalKnown, 0)],
                      backgroundColor: [C.indigo, `${C.grid}`],
                      borderColor: '#ffffff',
                      borderWidth: 3,
                    },
                  ],
                }}
                options={doughnutOptions()}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Flashcards: deck bo'yicha taqsimot ── */}
      {decks.length > 0 && (
        <SectionCard title="Flashcards — deck bo'yicha" subtitle="Har bir deckda yodlangan so'zlar soni">
          <div style={{ height: Math.max(decks.length * 42, 140) }}>
            <Bar
              data={{
                labels: decks
                  .slice()
                  .sort((a, b) => b.cardCount - a.cardCount)
                  .slice(0, 10)
                  .map((d) => d.title),
                datasets: [
                  {
                    label: 'Yodlangan',
                    data: decks
                      .slice()
                      .sort((a, b) => b.cardCount - a.cardCount)
                      .slice(0, 10)
                      .map((d) => d.knownCount),
                    backgroundColor: C.indigo,
                    borderRadius: 6,
                  },
                  {
                    label: 'Jami so\'z',
                    data: decks
                      .slice()
                      .sort((a, b) => b.cardCount - a.cardCount)
                      .slice(0, 10)
                      .map((d) => Math.max(d.cardCount - d.knownCount, 0)),
                    backgroundColor: C.grid,
                    borderRadius: 6,
                  },
                ],
              }}
              options={horizontalStackedBarOptions()}
            />
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Chart data / options helpers
// ═════════════════════════════════════════════════════════════════

function skillScoreTrendData(
  readingSubs: ReadingSubmission[],
  listeningSubs: ListeningSubmission[],
  writingSubs: WritingSubmission[]
) {
  const reading = readingSubs
    .slice()
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .map((r) => r.scorePercent ?? 0)

  const listening = listeningSubs
    .slice()
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .map((r) => r.scorePercent ?? 0)

  const writing = writingSubs
    .filter((w) => w.checked && w.overallScore != null)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((w) => Math.round(((w.overallScore ?? 0) / 9) * 100))

  const maxLen = Math.max(reading.length, listening.length, writing.length, 1)
  const labels = Array.from({ length: maxLen }, (_, i) => `#${i + 1}`)

  const pad = (arr: number[]) => labels.map((_, i) => (i < arr.length ? arr[i] : null))

  return {
    labels,
    datasets: [
      { label: 'Reading %', data: pad(reading), borderColor: C.indigo, backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, spanGaps: true },
      { label: 'Listening %', data: pad(listening), borderColor: C.mint, backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, spanGaps: true },
      { label: 'Writing % (band×10/9)', data: pad(writing), borderColor: C.coral, backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, spanGaps: true },
    ],
  }
}

function simpleLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 14, font: { size: 12 }, color: C.inkSoft },
      },
      tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: C.inkMuted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: C.grid }, ticks: { color: C.inkMuted } },
    },
  }
}

function percentLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 14, font: { size: 12 }, color: C.inkSoft },
      },
      tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: C.inkMuted } },
      y: { beginAtZero: true, max: 100, grid: { color: C.grid }, ticks: { color: C.inkMuted, callback: (v: string | number) => `${v}%` } },
    },
  }
}

function dualAxisLineOptions(leftLabel: string, rightLabel: string) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 14, font: { size: 12 }, color: C.inkSoft },
      },
      tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: C.inkMuted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        beginAtZero: true,
        grid: { color: C.grid },
        ticks: { color: C.inkMuted },
        title: { display: true, text: leftLabel, color: C.inkMuted, font: { size: 11 } },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        beginAtZero: true,
        grid: { display: false },
        ticks: { color: C.inkMuted },
        title: { display: true, text: rightLabel, color: C.inkMuted, font: { size: 11 } },
      },
    },
  }
}

function doughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 14, font: { size: 12 }, color: C.inkSoft },
      },
      tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8 },
    },
  }
}

function horizontalStackedBarOptions() {
  return {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 14, font: { size: 12 }, color: C.inkSoft },
      },
      tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { stacked: true, grid: { color: C.grid }, ticks: { color: C.inkMuted } },
      y: { stacked: true, grid: { display: false }, ticks: { color: C.inkSoft, font: { size: 11 } } },
    },
  }
}

// ═════════════════════════════════════════════════════════════════
// Small UI pieces
// ═════════════════════════════════════════════════════════════════

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-4xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  )
}

function EmptyChart({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className={`flex ${small ? 'h-40' : 'h-56'} flex-col items-center justify-center gap-2 rounded-2xl bg-cream text-center`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="max-w-xs px-4 text-xs text-ink-muted">{text}</p>
    </div>
  )
}

function ScoreBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-ink-muted">{label}:</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  )
}

const ICONS: Record<string, JSX.Element> = {
  level: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
    </svg>
  ),
  xp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />
    </svg>
  ),
  flame: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2s6 5.5 6 11a6 6 0 11-12 0c0-1.5.5-2.5 1.5-4 .3 1 1 1.5 1.5 1.5C9 8 9 4 12 2z" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" />
    </svg>
  ),
  cards: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="14" height="14" rx="3" />
      <path d="M21 14V5a2 2 0 0 0-2-2H10" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
}

const ACCENT_BG: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  coral: 'bg-coral-50 text-coral-600',
  mint: 'bg-mint-50 text-mint-600',
  sun: 'bg-sun-50 text-sun-600',
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: string
  accent: 'indigo' | 'coral' | 'mint' | 'sun'
  icon: keyof typeof ICONS
}) {
  return (
    <div className="rounded-3xl border border-ink/8 bg-white p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl ${ACCENT_BG[accent]}`}>
        {ICONS[icon]}
      </div>
      <p className="font-display text-lg font-semibold leading-tight text-ink">{value}</p>
      <p className="text-[11px] font-medium text-ink-muted">{label}</p>
    </div>
  )
}
