// Admin — AI Content Generation hub.
//
// MUHIM: avval bu sahifa FAQAT CEFR placement test uchun edi.
// Backend'да ALLAQACHON Reading/Writing/Exercises uchun ham
// generatsiya endpoint'lari bor edi (ContentGenerationService) —
// faqat ularga frontend UI yo'q edi. Endi 4 ta tab — bitta umumiy,
// qayta ishlatiladigan <GenerationPanel> komponenti orqali.
//
// Har biri — bir xil naqsh: 6 ta CEFR daraja (A1..C2) uchun
// ALOHIDA-ALOHIDA so'rov (backend bir martada faqat BITTA daraja
// qabul qiladi).

import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { getAdminSessionToken } from '../lib/adminAuth'
import AdminGuard from '../components/admin/AdminGuard'
import { LANGUAGES } from '../lib/languages'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Level = (typeof LEVELS)[number]

// Onboarding'dagi bilan bir xil 15 tillik ro'yxatdan foydalanamiz
// (avval bu yerda faqat 8 ta til bilan alohida, eskirgan ro'yxat bor edi).
const LANG_OPTIONS = LANGUAGES.map(({ code, name }) => ({ code, name }))

type LevelStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
type Tab = 'cefr' | 'reading' | 'writing' | 'exercises'

// Backend'dagi ContentGenerationService.GenerationJobSummary'ga mos.
// Faqat 'exercises' tab shu formatni ishlatadi — u backend'da fon
// jarayoniga (background job) o'tkazilgan, boshqalar hali sinxron.
interface GenerationJobSummary {
  id: string
  languageCode: string
  cefrLevel: string
  targetCount: number
  savedCount: number
  failedCount: number
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

const TAB_CONFIG: Record<
  Tab,
  {
    label: string
    title: string
    description: string
    endpoint: string
    countPerLevel: number
    includeCertificateType: boolean
    // MUHIM: yangi — CEFR o'z holicha (fixed count, barcha 6 daraja
    // avtomatik) qoladi, lekin Reading/Writing/Exercises endi admin
    // HAR BIR daraja uchun ALOHIDA son kiritadi (0/bo'sh — o'sha
    // daraja o'tkazib yuboriladi).
    customizable: boolean
    // YANGI: faqat 'exercises' true. Backend endi bu endpoint uchun
    // DARHOL {started, rejected} qaytaradi (generatsiya fonda davom
    // etadi) — frontend job'ni pollab, progress'ni jonli ko'rsatishi
    // va xohlasa BEKOR QILISHI kerak. cefr/reading/writing hali
    // eski sinxron ({generated, failed} yoki savedCount) formatda.
    async?: boolean
  }
> = {
  cefr: {
    label: 'CEFR Placement Test',
    title: 'CEFR Placement Test Questions',
    description:
      "Generates ~102 questions (17 per level, A1→C2) for the onboarding placement test. Learners then get 25 random, progressively harder questions drawn from this pool — nothing here is deleted unless the database itself is cleared, so you'll only need to re-run this if that happens.",
    endpoint: '/api/admin/content/cefr',
    countPerLevel: 17,
    includeCertificateType: false,
    customizable: false,
  },
  reading: {
    label: 'Reading',
    title: 'Reading Materials',
    description:
      'Generates reading passages for the levels and counts you choose below. Note: this creates the TEXTS only — questions for each passage are generated separately, per-material, from inside the Reading section itself.',
    endpoint: '/api/admin/content/reading',
    countPerLevel: 5,
    includeCertificateType: true,
    customizable: true,
  },
  writing: {
    label: 'Writing',
    title: 'Writing Prompts',
    description:
      'Generates writing task prompts (essay/letter/report style, depending on level) for the levels and counts you choose below. You don\u2019t need to pick a task type — whichever tasks apply for that level/certificate are included automatically.',
    endpoint: '/api/admin/content/writing',
    countPerLevel: 5,
    includeCertificateType: true,
    customizable: true,
  },
  exercises: {
    label: 'Exercises',
    title: 'Duolingo-style Exercises',
    description:
      'Generates the exercise pool (word translation, image match, sentence building, fill-in-the-blank, multiple choice, true/false) for the levels and counts you choose below. The count is the TOTAL across all 6 exercise types combined (roughly split evenly), and each checkpoint in the app now needs 70-100 exercises of its own type — so enter ~600 to get about 100 per type. More is always better (users never run out of fresh material). Generation happens in small batches automatically, so larger numbers are safe.',
    endpoint: '/api/admin/content/exercises',
    countPerLevel: 600,
    includeCertificateType: false,
    customizable: true,
    async: true,
  },
}

export default function AdminCefrGeneration() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('cefr')

  return (
    <AdminGuard>
    <main className="min-h-screen bg-cream px-5 py-8">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin Panel
        </Link>
        <Logo size={26} />
      </header>

      <div className="mx-auto mt-10 max-w-2xl">
        <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Admin · Content Generation
        </p>

        {/* Tab switcher */}
        <div className="mb-8 flex flex-wrap gap-1.5">
          {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t ? 'text-white' : 'text-ink-soft hover:bg-white'
              }`}
            >
              {tab === t && (
                <motion.div
                  layoutId="content-gen-tab-bg"
                  className="absolute inset-0 rounded-full bg-indigo-500"
                  transition={{ duration: 0.2 }}
                />
              )}
              <span className="relative">{TAB_CONFIG[t].label}</span>
            </button>
          ))}
        </div>

        <GenerationPanel key={tab} config={TAB_CONFIG[tab]} navigate={navigate} />
      </div>
    </main>
    </AdminGuard>
  )
}

// ═════════════════════════════════════════════════════════════════
// Umumiy generatsiya paneli — 4 ta tab bir xil komponentdan
// foydalanadi, faqat konfiguratsiyasi farq qiladi.
// ═════════════════════════════════════════════════════════════════

function GenerationPanel({
  config,
  navigate,
}: {
  config: (typeof TAB_CONFIG)[Tab]
  navigate: (path: string, opts?: { replace: boolean }) => void
}) {
  const [lang, setLang] = useState('en')
  const [running, setRunning] = useState(false)
  const [statuses, setStatuses] = useState<Record<Level, LevelStatus>>({
    A1: 'pending', A2: 'pending', B1: 'pending',
    B2: 'pending', C1: 'pending', C2: 'pending',
  })
  const [savedCounts, setSavedCounts] = useState<Record<Level, number>>({
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Joriy ishlayotgan job ID'i (faqat 'exercises' tab uchun) va
  // "foydalanuvchi bekor qildi" bayrog'i — useState EMAS, useRef,
  // chunki bular async for-loop ichida DARHOL (keyingi render'ni
  // kutmasdan) tekshirilishi kerak (stale closure muammosidan qochish
  // uchun).
  const currentJobIdRef = useRef<string | null>(null)
  const cancelRequestedRef = useRef(false)

  // MUHIM: yangi — customizable bo'lgan tab'larда (Reading/Writing/
  // Exercises) admin har bir daraja uchun ALOHIDA son kiritadi.
  // Boshlang'ich qiymat sifatida config.countPerLevel taklif
  // qilinadi (qulaylik uchun) — admin xohlasa o'zgartiradi, 0/bo'sh
  // qilib o'sha darajani o'tkazib yuborishi mumkin.
  const [levelCounts, setLevelCounts] = useState<Record<Level, number>>({
    A1: config.countPerLevel, A2: config.countPerLevel, B1: config.countPerLevel,
    B2: config.countPerLevel, C1: config.countPerLevel, C2: config.countPerLevel,
  })

  // Faqat 'exercises' (async) tab uchun: job holatini har 2 soniyada
  // so'raydi, savedCounts'ни JONLI yangilab turadi, va job
  // COMPLETED/CANCELLED/FAILED bo'lguncha kutadi.
  const pollJob = async (jobId: string, level: Level, token: string | null): Promise<GenerationJobSummary> => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Foydalanuvchi "Bekor qilish"ni bosgan bo'lsa — pollashni
      // to'xtatamiz (backend job'ni o'zi CANCELLED holatiga o'tkazadi,
      // biz uni bir marta so'nggi tekshirib olamiz).
      const job = await api.get<GenerationJobSummary>(
        `/api/admin/content/generation-jobs/${jobId}`,
        { headers: token ? { 'X-Admin-Session': token } : {} }
      )
      setSavedCounts((c) => ({ ...c, [level]: job.savedCount }))

      if (job.status !== 'RUNNING') return job
      if (cancelRequestedRef.current) return job

      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  const cancelGeneration = async () => {
    cancelRequestedRef.current = true
    setCancelling(true)
    const jobId = currentJobIdRef.current
    if (jobId) {
      try {
        const token = getAdminSessionToken()
        await api.post(
          `/api/admin/content/generation-jobs/${jobId}/cancel`,
          undefined,
          { headers: token ? { 'X-Admin-Session': token } : {} }
        )
      } catch {
        // Bekor qilish so'rovi o'zi muvaffaqiyatsiz bo'lsa ham,
        // cancelRequestedRef true bo'lgani uchun keyingi darajalar
        // baribir boshlanmaydi — jarayon shu bilan to'xtaydi.
      }
    }
  }

  const generate = async () => {
    setRunning(true)
    setError(null)
    setCancelling(false)
    cancelRequestedRef.current = false
    currentJobIdRef.current = null
    setStatuses({ A1: 'pending', A2: 'pending', B1: 'pending', B2: 'pending', C1: 'pending', C2: 'pending' })
    setSavedCounts({ A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 })

    for (const level of LEVELS) {
      if (cancelRequestedRef.current) break

      const count = config.customizable ? levelCounts[level] : config.countPerLevel

      // Customizable rejimda — 0/bo'sh bo'lsa, bu daraja butunlay
      // o'tkazib yuboriladi (so'rov ham ketmaydi).
      if (config.customizable && (!count || count <= 0)) {
        continue
      }

      setStatuses((s) => ({ ...s, [level]: 'running' }))
      try {
        const body: Record<string, unknown> = {
          languageCodes: [lang],
          cefrLevel: level,
          countPerLanguage: count,
        }
        if (config.includeCertificateType) body.certificateType = 'GENERAL'

        // MUHIM TUZATISH: bu so'rov avval X-Admin-Session
        // sarlavhasini UMUMAN yubormasdi — AdminSessionFilter
        // buni har doim 403 ("Admin panel session required") deb
        // rad etardi, garchi foydalanuvchi to'g'ri parolni
        // kiritgan bo'lsa ham.
        const token = getAdminSessionToken()

        if (config.async) {
          // YANGI OQIM: backend DARHOL {started, rejected} qaytaradi
          // (generatsiya fonda davom etadi) — job ID'ni olib, uni
          // pollaymiz.
          const res = await api.post<{ started: GenerationJobSummary[]; rejected: string[] }>(
            config.endpoint,
            body,
            { headers: token ? { 'X-Admin-Session': token } : {} }
          )

          if (!res.started.length) {
            setStatuses((s) => ({ ...s, [level]: 'failed' }))
            setError(res.rejected[0] ?? `Failed to start ${level}.`)
            continue
          }

          const jobId = res.started[0].id
          currentJobIdRef.current = jobId

          const finalJob = await pollJob(jobId, level, token)
          currentJobIdRef.current = null

          if (finalJob.status === 'COMPLETED') {
            setStatuses((s) => ({ ...s, [level]: 'done' }))
            setSavedCounts((c) => ({ ...c, [level]: finalJob.savedCount }))
          } else if (finalJob.status === 'CANCELLED') {
            setStatuses((s) => ({ ...s, [level]: 'cancelled' }))
            break // bekor qilingandan keyin keyingi darajalarga o'tmaymiz
          } else {
            setStatuses((s) => ({ ...s, [level]: 'failed' }))
            if (finalJob.errorMessage) setError(finalJob.errorMessage)
          }
          continue
        }

        // ESKI OQIM (cefr/reading/writing) — sinxron.
        //
        // MUHIM BUG TUZATISH: bu so'rov har doim HTTP 200 qaytaradi
        // (backend generatsiya butunlay muvaffaqiyatsiz bo'lsa ham —
        // masalan OpenAI billing tugasa), shuning uchun avval bu yerda
        // "done" deb belgilanardi va savedCount har doim so'ralgan
        // sonni (haqiqiy natijani emas) ko'rsatardi (backend javobida
        // "savedCount" maydoni umuman yo'q edi). Endi ikkalasi ham
        // tuzatilgan: backend real savedCount qaytaradi, va bu yerda
        // "failed" ro'yxati bo'sh emasligini ANIQ tekshiramiz.
        const res = await api.post<{ generated?: string[]; failed?: string[]; savedCount?: number }>(
          config.endpoint,
          body,
          { headers: token ? { 'X-Admin-Session': token } : {} }
        )

        if (res?.failed && res.failed.length > 0) {
          setStatuses((s) => ({ ...s, [level]: 'failed' }))
          setSavedCounts((c) => ({ ...c, [level]: res?.savedCount ?? 0 }))
          setError(res.failed[0])
        } else {
          setStatuses((s) => ({ ...s, [level]: 'done' }))
          setSavedCounts((c) => ({ ...c, [level]: res?.savedCount ?? 0 }))
        }
      } catch (err) {
        setStatuses((s) => ({ ...s, [level]: 'failed' }))
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        // Sessiya tugagan (403) — AdminGuard'ga xabar berамиз, u
        // parol darvozasini qayta ko'rsatadi.
        if (err instanceof ApiError && err.status === 403) {
          window.dispatchEvent(new Event('admin-session-expired'))
          setError('Your admin session expired. Please re-enter your password.')
          return
        }
        setError(err instanceof Error ? err.message : `Failed at ${level}.`)
      }
    }
    setRunning(false)
    setCancelling(false)
  }

  const totalSaved = LEVELS.reduce((sum, l) => sum + savedCounts[l], 0)
  const anySelected = !config.customizable || LEVELS.some((l) => levelCounts[l] > 0)

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">
        {config.title}
      </h1>
      <p className="mb-8 text-sm text-ink-soft">{config.description}</p>

      <div className="rounded-3xl border border-ink/8 bg-white p-6">
        <label className="mb-5 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Language
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LANG_OPTIONS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                disabled={running}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  lang === l.code
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-ink/10 bg-white text-ink-soft hover:border-ink/25'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </label>

        {config.customizable && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Count per level (0 = skip)
          </p>
        )}

        <div className="mb-5 space-y-2">
          {LEVELS.map((level) => (
            <div
              key={level}
              className="flex items-center justify-between rounded-xl border border-ink/8 px-3.5 py-2.5"
            >
              <span className="font-mono text-sm font-semibold text-ink">{level}</span>

              {config.customizable && !running && statuses[level] === 'pending' ? (
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={levelCounts[level]}
                  onChange={(e) =>
                    setLevelCounts((c) => ({
                      ...c,
                      [level]: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="w-16 rounded-lg border border-ink/10 px-2 py-1 text-right text-sm outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                />
              ) : (
                <StatusBadge status={statuses[level]} count={savedCounts[level]} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-xs text-coral-600">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={running || !anySelected}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'Generating…' : `Generate for ${LANG_OPTIONS.find((l) => l.code === lang)?.name}`}
          </button>

          {/* Faqat 'exercises' (async) tab uchun — token/xarajat behuda
              sarflanmasligi uchun, generatsiya ketayotganda to'xtatish
              imkoniyati. */}
          {config.async && running && (
            <button
              onClick={cancelGeneration}
              disabled={cancelling}
              className="shrink-0 rounded-2xl border border-coral-300 bg-coral-50 px-5 py-2.5 text-sm font-semibold text-coral-700 transition hover:bg-coral-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>

        {!running && totalSaved > 0 && (
          <p className="mt-3 text-center text-xs text-mint-600">
            {totalSaved} items saved.
          </p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, count }: { status: LevelStatus; count: number }) {
  if (status === 'pending') {
    return <span className="text-xs text-ink-muted">Waiting…</span>
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
        Generating… ({count} so far)
      </span>
    )
  }
  if (status === 'cancelled') {
    return <span className="text-xs font-medium text-ink-muted">Cancelled ({count} saved)</span>
  }
  if (status === 'failed') {
    return (
      <span className="text-xs font-medium text-coral-600">
        Failed{count > 0 ? ` (${count} saved)` : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-mint-600">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {count} saved
    </span>
  )
}
