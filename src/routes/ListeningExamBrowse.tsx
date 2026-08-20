// Listening Practice — browse (v3).
//
// O'zgarishlar v2 dan:
//   • Sidebar'dan Topic maydoni olib tashlandi
//   • Materiallar tepasida SEARCH bar — title va topic bo'yicha filter
//   • 2 ta upload tugma:
//       "Upload with questions" — user o'z savollari + transcript + audio
//       "Generate with AI"      — audio + transcript, AI savol yaratadi
//
// Layout:
//   ┌─────────┬───────────────────────────────────────┐
//   │ Filters │  🔍 Search + [Upload] [Generate AI]   │
//   │ (lang,  │                                       │
//   │ level,  │  ┌──┐ ┌──┐ ┌──┐                      │
//   │ cert)   │  │  │ │  │ │  │                      │
//   │         │  └──┘ └──┘ └──┘                      │
//   └─────────┴───────────────────────────────────────┘

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'
import {
  CERTS_BY_LANG,
  formatTime,
  LANG_OPTIONS,
  LEVELS,
  LEVEL_TINT,
  type CefrLevel,
  type ListeningMaterial,
  type Page,
} from '../lib/listening'

export default function ListeningExamBrowse() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  // Filters (Topic olib tashlandi)
  const [lang, setLang] = useState('en')
  const [level, setLevel] = useState<CefrLevel | ''>('')
  const [cert, setCert] = useState('')

  // Search — client-side filter
  const [search, setSearch] = useState('')

  const [materials, setMaterials] = useState<ListeningMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Learner tili
  useEffect(() => {
    let cancelled = false
    api
      .get<{ languageCode: string; languageRole: 'NATIVE' | 'LEARNING' }[]>(
        '/api/languages'
      )
      .then((langs) => {
        if (cancelled) return
        const learning = langs.filter((l) => l.languageRole === 'LEARNING')
        if (learning.length > 0) setLang(learning[0].languageCode)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setCert('')
  }, [lang])

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ lang, page: '0', size: '60' })
      if (level) qs.set('level', level)
      if (cert) qs.set('cert', cert)
      const page = await api.get<Page<ListeningMaterial>>(
        `/api/listening/materials?${qs}`
      )
      setMaterials(page.content ?? [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load materials.')
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [lang, level, cert, navigate])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  // Client-side search — title va topic bo'yicha
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return materials
    return materials.filter((m) => {
      const inTitle = m.title.toLowerCase().includes(q)
      const inTopic = (m.topic ?? '').toLowerCase().includes(q)
      return inTitle || inTopic
    })
  }, [materials, search])

  const availableCerts = CERTS_BY_LANG[lang] ?? ['GENERAL']

  return (
    <main className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link
          to="/learn/listening"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Listening
        </Link>
        <span className="text-sm font-medium text-ink">Exam</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <div className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm">
            <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
              Filters
            </p>

            <div className="space-y-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  Language
                </span>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  {LANG_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag}  {l.name}
                    </option>
                  ))}
                </select>
              </label>

              <ChipGroup
                label="Level"
                options={LEVELS as unknown as string[]}
                value={level}
                onChange={(v) => setLevel(v as CefrLevel | '')}
                tintFor={(v) => (v ? LEVEL_TINT[v as CefrLevel] : '')}
              />

              <ChipGroup
                label="Certificate"
                options={availableCerts}
                value={cert}
                onChange={setCert}
                normalize={(v) => v.replace(/_/g, ' ')}
              />

              {(level || cert) && (
                <button
                  onClick={() => {
                    setLevel('')
                    setCert('')
                  }}
                  className="text-xs font-medium text-coral-600 hover:text-coral-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── MAIN AREA ───────────────────────────────────── */}
        <section>
          {/* Sarlavha */}
          <div className="mb-5">
            <h1 className="font-display text-2xl font-semibold text-ink">
              Exam materials
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Choose a material to take a timed exam
            </p>
          </div>

          {/* Search — Upload tugmalari yo'q (materiallar Practice'da
          qo'shiladi, bu yerda faqat tanlab, Exam boshlanadi) */}
          <div className="relative mb-6">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by title or topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-ink/12 bg-white py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Counter */}
          <p className="mb-4 text-xs text-ink-muted">
            {loading
              ? 'Loading…'
              : `${filtered.length} material${filtered.length === 1 ? '' : 's'}`}
            {search && ` (of ${materials.length})`}
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-coral-500/20 bg-coral-50 px-4 py-3 text-sm text-coral-700">
              {error}
            </div>
          )}
          {!error && !loading && filtered.length === 0 && (
            <div className="rounded-3xl border border-dashed border-ink/12 bg-white/50 p-10 text-center">
              <p className="text-sm text-ink-soft">
                {search
                  ? `No material matching your search was found..`
                  : `No materials found. Upload your own audio using the button above..`}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Chip group
// ═════════════════════════════════════════════════════════════════
function ChipGroup({
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
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition'
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

function MaterialCard({ material: m }: { material: ListeningMaterial }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        to={`/learn/listening/exam/${m.id}`}
        className="group flex h-full flex-col rounded-3xl border border-ink/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-mint-500/30 hover:shadow-md"
      >
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[m.cefrLevel]}`}
          >
            {m.cefrLevel}
          </span>
          {m.certificateType && (
            <span className="rounded-full border border-ink/12 bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              {m.certificateType.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        <h3 className="mb-1 line-clamp-2 font-display text-base font-semibold text-ink">
          {m.title}
        </h3>
        {m.topic && (
          <p className="mb-3 text-xs text-ink-muted">{m.topic}</p>
        )}

        <div className="mt-auto flex items-center justify-between text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            {formatTime(m.durationSeconds)}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
