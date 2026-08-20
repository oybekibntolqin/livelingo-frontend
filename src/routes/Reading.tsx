import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'
import UploadWithQuestionsDialog from '../components/reading/UploadWithQuestionsDialog'
import { api, ApiError, API_BASE } from '../lib/api'
import { getToken, isAuthenticated } from '../lib/auth'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

interface ReadingMaterial {
  id: string
  title: string
  content: string
  languageCode: string
  cefrLevel: CefrLevel
  certificateType: string | null
  topic: string | null
  source: string | null
  originalFileUrl: string | null
  year: number | null
  createdAt: string
  uploadedByUserId?: string | null
}

interface UserProfileDTO {
  id: string
  firstName: string
  lastName: string
  username: string
  profilePhotoUrl: string | null
  bio: string | null
  countryCode: string | null
  city: string | null
  languages: any[]
  roles: string[]
  online: boolean
  profileCompleted: boolean
  followersCount: number
  followingCount: number
}

// Spring's Page<T> shape
interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const LEVEL_TINT: Record<CefrLevel, string> = {
  A1: 'bg-mint-50 text-mint-600 border-mint-500/30',
  A2: 'bg-mint-50 text-mint-600 border-mint-500/30',
  B1: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  B2: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  C1: 'bg-coral-50 text-coral-600 border-coral-500/30',
  C2: 'bg-coral-50 text-coral-600 border-coral-500/30',
}

// Single source of truth for the language list matching the provided image
const LANG_OPTIONS: { code: string; countryCode: string; flag: string; name: string }[] = [
  { code: 'en', countryCode: 'GB', flag: '🇬🇧', name: 'English' },
  { code: 'es', countryCode: 'ES', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', countryCode: 'FR', flag: '🇫🇷', name: 'Français' },
  { code: 'de', countryCode: 'DE', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'it', countryCode: 'IT', flag: '🇮🇹', name: 'Italiano' },
  { code: 'pt', countryCode: 'PT', flag: '🇵🇹', name: 'Português' },
  { code: 'ru', countryCode: 'RU', flag: '🇷🇺', name: 'Русский' },
  { code: 'uz', countryCode: 'UZ', flag: '🇺🇿', name: "O'zbekcha" },
  { code: 'tr', countryCode: 'TR', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'ar', countryCode: 'SA', flag: '🇸🇦', name: 'العربية' },
  { code: 'ko', countryCode: 'KR', flag: '🇰🇷', name: '한국어' },
  { code: 'ja', countryCode: 'JP', flag: '🇯🇵', name: '日本語' },
  { code: 'zh', countryCode: 'CN', flag: '🇨🇳', name: '中文' },
  { code: 'hi', countryCode: 'IN', flag: '🇮🇳', name: 'हिन्दी' },
  { code: 'vi', countryCode: 'VN', flag: '🇻🇳', name: 'Tiếng Việt' },
]

const CERTS_BY_LANG: Record<string, string[]> = {
  en: ['IELTS', 'TOEFL', 'CAMBRIDGE', 'GENERAL'],
  de: ['GOETHE', 'TESTDAF', 'GENERAL'],
  ko: ['TOPIK', 'GENERAL'],
  ja: ['JLPT', 'GENERAL'],
  fr: ['DELF', 'GENERAL'],
  es: ['DELE', 'GENERAL'],
  zh: ['HSK', 'GENERAL'],
  ru: ['TORFL', 'GENERAL'],
  it: ['CELI', 'GENERAL'],
  pt: ['CAPLE', 'GENERAL'],
  tr: ['TYS', 'GENERAL'],
  ar: ['ALPT', 'GENERAL'],
  hi: ['GENERAL'],
  vi: ['GENERAL'],
}

export default function Reading() {
  const navigate = useNavigate()

  // Foydalanuvchi tekshiruvdan o'tganligini aniqlash statelari
  const [isVerified, setIsVerified] = useState(false)

  // Filters
  const [lang, setLang] = useState('en')
  const [level, setLevel] = useState<CefrLevel | ''>('')
  const [cert, setCert] = useState('')
  const [view, setView] = useState<'all' | 'mine'>('all')
  // Foydalanuvchining o'z LEARNING tillari — upload oynasida til
  // tanlashni shu ro'yxatga cheklash uchun (bug tuzatish: avval
  // butun 15 tildan istalganini tanlash mumkin edi, hatto o'zi
  // o'rganmayotgan tilni ham).
  const [learningLangs, setLearningLangs] = useState<string[]>([])

  // Data
  const [materials, setMaterials] = useState<ReadingMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showUploadWithQuestions, setShowUploadWithQuestions] = useState(false)

  // So'rovlar poygasini nazorat qilish uchun tartib raqami (seq)
  const requestSeq = useRef(0)

  const certs = CERTS_BY_LANG[lang] ?? ['GENERAL']

  // ── 1. Auth va Profile Completed Tekshiruvi ───────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/sign-in', { replace: true })
      return
    }

    let cancelled = false
    api
        .get<UserProfileDTO>('/api/users/me')
        .then((user) => {
          if (cancelled) return

          // Response strukturasini xavfsiz tekshiramiz (Direct yoki Wrapped holatlari uchun)
          const profileCompleted = user?.profileCompleted ?? (user as any)?.data?.profileCompleted

          if (profileCompleted === false) {
            // Profil to'liq emas bo'lsa landing sahifaga yo'naltiriladi
            navigate('/', { replace: true })
          } else if (profileCompleted === true) {
            setIsVerified(true)
          } else {
            console.warn('profileCompleted maydoni kutilganidek aniqlanmadi:', user)
            setIsVerified(true) // Maydon kelmaganda ham sahifa bloklanib qolmasligi uchun true qilamiz
          }
        })
        .catch((err) => {
          if (cancelled) return
          console.error('User verification error:', err)

          // Faqatgina status 401 yoki 403 bo'lsa sign-inga qaytaramiz
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            navigate('/sign-in', { replace: true })
          } else {
            // Boshqa har qanday xatolikda foydalanuvchini tizimdan haydamaymiz, balki ekranda xabarni ko'rsatamiz
            setError("Profil ma'lumotlarini tekshirishda xatolik yuz berdi. Iltimos, sahifani yangilang.")
          }
        })

    return () => {
      cancelled = true
    }
  }, [navigate])

  // ── 2. Foydalanuvchi o'rganayotgan tillarini yuklash ───────────
  useEffect(() => {
    if (!isVerified) return

    let cancelled = false
    api
        .get<{
          languageCode: string
          languageRole: 'NATIVE' | 'LEARNING'
          cefrLevel: string | null
        }[]>('/api/languages')
        .then((langs) => {
          if (cancelled) return
          const learning = langs
              .filter((l) => l.languageRole === 'LEARNING')
              .map((l) => l.languageCode)
          setLearningLangs(learning)
          if (learning.length > 0) setLang(learning[0])
        })
        .catch(() => {
          /* keep default lang='en' */
        })
    return () => {
      cancelled = true
    }
  }, [isVerified])

  // ── 3. Materiallarni yuklash (Poyga holati bartaraf etilgan) ───
  const loadMaterials = useCallback(async () => {
    if (!isVerified) return

    const currentSeq = ++requestSeq.current // Har safar yangi yuklash boshlanganda seq bittaga oshadi
    setLoading(true)
    setError(null)

    try {
      const path = view === 'mine'
          ? '/api/reading/materials/user'
          : '/api/reading/materials'
      const qs = new URLSearchParams({ lang, page: '0', size: '50' })
      if (level) qs.set('level', level)
      if (cert) qs.set('cert', cert)

      const page = await api.get<Page<ReadingMaterial>>(`${path}?${qs}`)

      // Faqatgina ushbu so'rov eng oxirgisi bo'lsa state yangilanadi
      if (currentSeq === requestSeq.current) {
        setMaterials(page.content ?? [])
      }
    } catch (err) {
      if (currentSeq === requestSeq.current) {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load materials.')
        setMaterials([])
      }
    } finally {
      if (currentSeq === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [isVerified, view, lang, level, cert, navigate])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  // ── Delete user's own material ─────────────────────────────────
  const deleteMyMaterial = async (id: string) => {
    if (!confirm('Delete this material? Highlights you saved on it will go with it.')) return
    try {
      await api.del(`/api/reading/materials/${id}/my`)
      setMaterials((m) => m.filter((x) => x.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  // Tizim to'liq tekshirilguncha yuklanish (spinner) ekrani
  if (!isVerified) {
    return (
        <div className="grid min-h-screen place-items-center bg-cream p-6 text-center">
          {error ? (
              <div className="max-w-md rounded-3xl border border-coral-500/30 bg-coral-50 p-6 shadow-sm">
                <p className="text-sm text-coral-600 font-semibold mb-4">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="btn-primary py-2 px-5 text-xs rounded-xl"
                >
                  Sahifani yangilash
                </button>
              </div>
          ) : (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
          )}
        </div>
    )
  }

  return (
      <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        </div>

        {/* Header */}
        <header className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
              to="/learn"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Learn
          </Link>
          <div className="flex items-center gap-4">
            <Link
                to="/learn/reading/my-results"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Mening natijalarim
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
                Reading
              </p>
              <h1 className="font-display text-display-md font-semibold text-ink">
                Passages, articles, and your own files.
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                  onClick={() => setShowUploadWithQuestions(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-ink/12 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-indigo-500/40 hover:bg-indigo-50"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                O'z savollarim bilan
              </button>
              <button
                  onClick={() => setShowUpload(true)}
                  className="btn-primary"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Upload your file
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-5 inline-flex rounded-full border border-ink/10 bg-white p-1">
            <button
                onClick={() => setView('all')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    view === 'all' ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink'
                }`}
            >
              All materials
            </button>
            <button
                onClick={() => setView('mine')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    view === 'mine' ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink'
                }`}
            >
              My uploads
            </button>
          </div>

          {/* Filters */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <FilterChip label="Language">
              <select value={lang} onChange={(e) => { setLang(e.target.value); setCert('') }} className="chip-select">
                {LANG_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                ))}
              </select>
            </FilterChip>

            <FilterChip label="Level">
              <select value={level} onChange={(e) => setLevel(e.target.value as CefrLevel | '')} className="chip-select">
                <option value="">Any</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </FilterChip>

            <FilterChip label="Style">
              <select value={cert} onChange={(e) => setCert(e.target.value)} className="chip-select">
                <option value="">Any</option>
                {certs.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FilterChip>

            {(level || cert) && (
                <button
                    onClick={() => { setLevel(''); setCert('') }}
                    className="ml-1 text-xs font-medium text-ink-muted hover:text-ink"
                >
                  Clear filters
                </button>
            )}
          </div>

          {error && (
              <div className="mb-6 rounded-2xl border border-coral-500/30 bg-coral-50 p-4 text-sm text-coral-600">
                {error}
              </div>
          )}

          {loading ? (
              <div className="grid min-h-[40vh] place-items-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
              </div>
          ) : materials.length === 0 ? (
              <EmptyState view={view} onUpload={() => setShowUpload(true)} />
          ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {materials.map((m) => (
                    <MaterialCard
                        key={m.id}
                        material={m}
                        onDelete={view === 'mine' ? () => deleteMyMaterial(m.id) : undefined}
                    />
                ))}
              </div>
          )}
        </div>

        <AnimatePresence>
          {showUpload && (
              <UploadDialog
                  onClose={() => setShowUpload(false)}
                  onUploaded={() => {
                    setShowUpload(false)
                    loadMaterials()
                  }}
                  currentLang={lang}
                  learningLangs={learningLangs}
              />
          )}
          {showUploadWithQuestions && (
              <UploadWithQuestionsDialog
                  onClose={() => setShowUploadWithQuestions(false)}
                  onUploaded={() => {
                    setShowUploadWithQuestions(false)
                    loadMaterials()
                  }}
                  currentLang={lang}
                  LANG_OPTIONS={LANG_OPTIONS.filter((l) => learningLangs.length === 0 || learningLangs.includes(l.code))}
                  CERT_OPTIONS={CERT_OPTIONS}
                  LEVELS={LEVELS}
              />
          )}
        </AnimatePresence>

        <style>{`
        .chip-select {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          padding: 0 1.25rem 0 0;
          font: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          color: #14142B;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238B879A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0 center;
        }
        .chip-select:focus { outline: none; }
      `}</style>
      </main>
  )
}

function FilterChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
      <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 transition-colors hover:border-ink/20">
      <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-ink-muted">
        {label}
      </span>
        {children}
      </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Material Card
// ─────────────────────────────────────────────────────────────────
function MaterialCard({
                        material,
                        onDelete,
                      }: {
  material: ReadingMaterial
  onDelete?: () => void
}) {
  const wordCount = material.content?.split(/\s+/).filter(Boolean).length ?? 0
  const minutes = Math.max(1, Math.round(wordCount / 200))
  const isMine = !!onDelete
  const langMeta = LANG_OPTIONS.find((l) => l.code === material.languageCode)

  return (
      <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="group relative flex h-full flex-col rounded-[24px] border border-ink/6 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/20 hover:shadow-[0_20px_40px_rgba(79,70,229,0.06)]"
      >
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-warm px-2.5 py-1 text-[11px] font-semibold text-ink">
          <span className="text-sm leading-none">{langMeta?.flag ?? '🌐'}</span>
          <span>{langMeta?.name ?? material.languageCode.toUpperCase()}</span>
        </span>
          <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${LEVEL_TINT[material.cefrLevel]}`}
          >
          {material.cefrLevel}
        </span>
          {material.certificateType && material.certificateType !== 'GENERAL' && (
              <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cream">
            {material.certificateType}
          </span>
          )}

          {material.originalFileUrl ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50/50 border border-red-200/40 px-2 py-0.5 font-mono text-[9px] font-bold text-red-600">
            PDF
          </span>
          ) : (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50/50 border border-amber-200/40 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-600">
            TEXT
          </span>
          )}
        </div>

        <h3 className="mb-2.5 font-display text-[17px] font-bold leading-snug text-ink transition-colors group-hover:text-indigo-950 line-clamp-2">
          {material.title}
        </h3>

        <p className="mb-5 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
          {material.content?.slice(0, 180).replace(/\s+/g, ' ').trim()}
          {material.content && material.content.length > 180 && '…'}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/4 pt-4 text-[11px] font-medium text-ink-muted">
          <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            {wordCount.toLocaleString()} words
          </span>
            <span className="text-ink-muted/30">·</span>
            <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
              {minutes} min
          </span>
          </div>
          {material.topic && (
              <span className="max-w-[120px] truncate text-right font-semibold text-indigo-600/70">{material.topic}</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Link
                to={`/learn/reading/${material.id}${isMine ? '?mine=1' : ''}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-2 text-xs font-bold text-indigo-600 transition-all duration-300 hover:border-indigo-200 hover:bg-indigo-600 hover:text-white hover:shadow-md hover:shadow-indigo-500/10 active:scale-95"
            >
              <span>Read</span>
              <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
                to={`/learn/reading/practice/${material.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-mint-500/20 bg-mint-500/10 px-4 py-2 text-xs font-bold text-mint-700 transition-all duration-300 hover:border-mint-500/40 hover:bg-mint-500 hover:text-white active:scale-95"
                title="Savollar bilan mashq qilish"
            >
              <span>Practice</span>
            </Link>
            <Link
                to={`/learn/reading/exam/${material.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-coral-500/20 bg-coral-500/10 px-4 py-2 text-xs font-bold text-coral-700 transition-all duration-300 hover:border-coral-500/40 hover:bg-coral-500 hover:text-white active:scale-95"
                title="Vaqt cheklangan imtihon"
            >
              <span>Exam</span>
            </Link>
          </div>
          {onDelete && (
              <button
                  onClick={onDelete}
                  aria-label="Delete this upload"
                  title="Delete"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50/50 text-red-500 transition-all duration-300 hover:border-red-200 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/15 active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6M10 11v6M14 11v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
          )}
        </div>
      </motion.article>
  )
}

function EmptyState({ view, onUpload }: { view: 'all' | 'mine'; onUpload: () => void }) {
  const isMine = view === 'mine'
  return (
      <div className="grid min-h-[40vh] place-items-center rounded-4xl border border-dashed border-ink/15 bg-white/40 p-12 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          </div>
          <h3 className="font-display text-xl font-semibold text-ink">
            {isMine ? "You haven't uploaded anything yet." : 'Nothing here yet.'}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            {isMine
                ? 'Upload a PDF, TXT, or DOCX and it will show up here. Highlights you add stay tied to the file.'
                : "Either no materials match your filters, or your admin hasn't generated content for this combination yet. Try uploading your own."}
          </p>
          <button onClick={onUpload} className="btn-primary mt-6">
            Upload a file
          </button>
        </div>
      </div>
  )
}

const CERT_OPTIONS: Record<string, { code: string; name: string }[]> = {
  en: [
    { code: 'IELTS', name: 'IELTS' },
    { code: 'TOEFL', name: 'TOEFL' },
    { code: 'CAMBRIDGE', name: 'Cambridge' },
    { code: 'GENERAL', name: 'General' },
  ],
  de: [
    { code: 'GOETHE', name: 'Goethe' },
    { code: 'TESTDAF', name: 'TestDaF' },
    { code: 'GENERAL', name: 'General' },
  ],
  ko: [{ code: 'TOPIK', name: 'TOPIK' }, { code: 'GENERAL', name: 'General' }],
  ja: [{ code: 'JLPT', name: 'JLPT' }, { code: 'GENERAL', name: 'General' }],
  fr: [{ code: 'DELF', name: 'DELF' }, { code: 'GENERAL', name: 'General' }],
  es: [{ code: 'DELE', name: 'DELE' }, { code: 'GENERAL', name: 'General' }],
  zh: [{ code: 'HSK', name: 'HSK' }, { code: 'GENERAL', name: 'General' }],
  ru: [{ code: 'TORFL', name: 'TORFL' }, { code: 'GENERAL', name: 'General' }],
  it: [{ code: 'CELI', name: 'CELI' }, { code: 'GENERAL', name: 'General' }],
  pt: [{ code: 'CAPLE', name: 'CAPLE' }, { code: 'GENERAL', name: 'General' }],
  tr: [{ code: 'TYS', name: 'TYS' }, { code: 'GENERAL', name: 'General' }],
  ar: [{ code: 'ALPT', name: 'ALPT' }, { code: 'GENERAL', name: 'General' }],
  hi: [{ code: 'GENERAL', name: 'General' }],
  vi: [{ code: 'GENERAL', name: 'General' }],
}

// ─────────────────────────────────────────────────────────────────
// Upload dialog — Fixed height overflow + Grid Language selector
// ─────────────────────────────────────────────────────────────────
function UploadDialog({
                        onClose,
                        onUploaded,
                        currentLang,
                        learningLangs,
                      }: {
  onClose: () => void
  onUploaded: () => void
  currentLang: string
  // Foydalanuvchining o'z LEARNING tillari — bo'sh bo'lsa (hali
  // yuklanmagan bo'lsa) to'liq ro'yxatga tushib qolamiz, aks holda
  // faqat shu tillarga cheklaymiz (bug tuzatish — pastga qarang).
  learningLangs: string[]
}) {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<CefrLevel>('B1')
  const [uploadLang, setUploadLang] = useState<string>(currentLang)
  const [certType, setCertType] = useState<string>('GENERAL')
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [authExpired, setAuthExpired] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // MUHIM TUZATISH: avval bu yerda to'liq (15+ til) LANG_OPTIONS
  // ishlatilardi — user o'zi umuman o'rganmayotgan tilni ham tanlab,
  // material yuklashi mumkin edi. Endi faqat foydalanuvchining
  // profilida "learning" deb belgilangan tillar ko'rsatiladi.
  const uploadLangOptions =
      learningLangs.length > 0
          ? LANG_OPTIONS.filter((l) => learningLangs.includes(l.code))
          : LANG_OPTIONS

  // Agar joriy tanlangan til endi ro'yxatda bo'lmasa (masalan
  // learningLangs kech yuklangan bo'lsa) — birinchi mos tilga
  // avtomatik almashtiramiz.
  useEffect(() => {
    if (!uploadLangOptions.some((l) => l.code === uploadLang) && uploadLangOptions.length > 0) {
      setUploadLang(uploadLangOptions[0].code)
    }
  }, [uploadLangOptions, uploadLang])

  const certOptions = CERT_OPTIONS[uploadLang] ?? [{ code: 'GENERAL', name: 'General' }]

  useEffect(() => {
    if (!certOptions.some((c) => c.code === certType)) {
      setCertType('GENERAL')
    }
  }, [uploadLang])

  const onPick = (f: File | null) => {
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
    setErr(null)
    setAuthExpired(false)
  }

  const submit = async () => {
    if (!file) return
    const token = getToken()
    if (!token) {
      setAuthExpired(true)
      setErr('You need to sign in before uploading.')
      return
    }

    setUploading(true)
    setErr(null)
    setAuthExpired(false)
    try {
      const form = new FormData()
      form.append('file', file)
      if (title) form.append('title', title)
      form.append('level', level)
      form.append('type', certType)
      form.append('languageCode', uploadLang)

      const res = await fetch(`${API_BASE}/api/reading/materials/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })

      if (!res.ok) {
        const raw = await res.text().catch(() => '')

        if (res.status === 401 || res.status === 403) {
          setAuthExpired(true)
          throw new Error(
              res.status === 401
                  ? 'Your session expired. Sign in again to upload.'
                  : 'Permission denied. Your sign-in may have expired — try signing in again.'
          )
        }

        // Backend xato javobi JSON ({"message": "..."}) formatida
        // keladi (GlobalExceptionHandler) — masalan matn/PDF
        // uzunligi chegaradan oshganda aniq va foydali xabar shu
        // yerdan chiqadi. Avval xom JSON matn ko'rsatilardi.
        let message = `Upload failed (${res.status})`
        try {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
            message = parsed.message
          } else if (raw) {
            message = raw
          }
        } catch {
          if (raw) message = raw
        }
        throw new Error(message)
      }
      onUploaded()
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const reSignIn = () => {
    localStorage.removeItem('jwt')
    navigate('/sign-in')
  }

  return (
      <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6 backdrop-blur-sm"
          onClick={onClose}
      >
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          {/* Header - Fixed */}
          <div className="flex items-center justify-between border-b border-ink/6 px-6 py-4">
            <h2 className="font-display text-xl font-bold text-ink">Upload a file</h2>
            <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-cream-warm hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Dropzone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) onPick(f)
                }}
                onClick={() => fileRef.current?.click()}
                className={`grid min-h-[110px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-4 text-center transition-colors ${
                    dragOver
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-ink/15 bg-cream-warm hover:border-ink/30'
                }`}
            >
              <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
              {file ? (
                  <div>
                    <p className="font-medium text-ink text-sm">{file.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {(file.size / 1024).toFixed(1)} KB · click to change
                    </p>
                  </div>
              ) : (
                  <div>
                    <div className="mx-auto mb-1.5 grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-ink">Drop a file or click to pick</p>
                    {/* MUHIM TUZATISH: haqiqiy backend chegarasi 10MB
                        edi, bu yerda noto'g'ri "50 MB" ko'rsatilardi.
                        Bundan tashqari haqiqiy muammo — matn uzunligi
                        (butun kitob emas, bitta parcha) — endi shu
                        yerda ham aytiladi. */}
                    <p className="mt-0.5 text-[11px] text-ink-muted">PDF, TXT, or DOCX · up to 10 MB</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      One passage or article — not a whole book (PDF max 30 pages)
                    </p>
                  </div>
              )}
            </div>

            {/* Title */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">Title</span>
              <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cambridge IELTS 17 — Passage 2"
                  className="w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/12"
              />
            </label>

            {/* Language Selector Grid */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">Language</span>
              {learningLangs.length > 0 && (
                  <p className="mb-1.5 text-[11px] text-ink-muted">
                    Only languages you're currently learning are shown. Add more from your profile if you don't see one.
                  </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1.5 rounded-2xl border border-ink/10 bg-cream-warm/40">
                {uploadLangOptions.map((l) => (
                    <button
                        key={l.code}
                        type="button"
                        onClick={() => setUploadLang(l.code)}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                            uploadLang === l.code
                                ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                                : 'border-ink/10 bg-white text-ink hover:border-ink/20'
                        }`}
                    >
                    <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            uploadLang === l.code ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink-soft'
                        }`}
                    >
                      {l.countryCode}
                    </span>
                      <span className="truncate">{l.name}</span>
                    </button>
                ))}
              </div>
            </label>

            {/* CEFR level */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">CEFR level</span>
              <div className="grid grid-cols-6 gap-1.5">
                {LEVELS.map((l) => (
                    <button
                        key={l}
                        type="button"
                        onClick={() => setLevel(l)}
                        className={`rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all ${
                            level === l
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
                        }`}
                    >
                      {l}
                    </button>
                ))}
              </div>
            </label>

            {/* Certificate style */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Certificate style
              </span>
              <div className="flex flex-wrap gap-1.5">
                {certOptions.map((c) => (
                    <button
                        key={c.code}
                        type="button"
                        onClick={() => setCertType(c.code)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                            certType === c.code
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
                        }`}
                    >
                      {c.name}
                    </button>
                ))}
              </div>
            </label>

            {err && (
                <div className="rounded-xl border border-coral-500/30 bg-coral-50 p-3 text-sm">
                  <p className="text-coral-600 text-xs">{err}</p>
                  {authExpired && (
                      <button
                          onClick={reSignIn}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-coral-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-coral-600"
                      >
                        Sign in again
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                  )}
                </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="flex items-center justify-between border-t border-ink/6 bg-cream-warm/30 px-6 py-3.5">
            <p className="hidden text-[11px] text-ink-muted sm:block">
              PDF, TXT, DOCX · max 10 MB · one passage, not a whole book
            </p>
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <button onClick={onClose} disabled={uploading} className="btn-ghost text-xs px-4 py-2">
                Cancel
              </button>
              <button
                  onClick={submit}
                  disabled={!file || uploading}
                  className="btn-primary text-xs px-5 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
  )
}