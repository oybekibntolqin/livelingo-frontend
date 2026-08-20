// Flashcards — browse sahifasi.
//
// Ikki tab: "My decks" (o'zim yaratganlar, progress bilan) va
// "Public decks" (boshqalar yaratgan, til bo'yicha filtrланadi).
// Yangi deck yaratish modal orqali.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import { isAuthenticated } from '../lib/auth'
import { flashcardApi, type CreateDeckInput, type FlashcardDeck } from '../lib/flashcard'
import { LANG_OPTIONS, LEVELS, LEVEL_TINT } from '../lib/listening'
import type { CefrLevel } from '../lib/listening'

type Tab = 'my' | 'public'

export default function Flashcards() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [tab, setTab] = useState<Tab>('my')
  const [myDecks, setMyDecks] = useState<FlashcardDeck[]>([])
  const [publicDecks, setPublicDecks] = useState<FlashcardDeck[]>([])
  const [publicLang, setPublicLang] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const loadMy = useCallback(async () => {
    try {
      const decks = await flashcardApi.myDecks()
      setMyDecks(decks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load decks.')
    }
  }, [])

  const loadPublic = useCallback(async (lang: string) => {
    try {
      const decks = await flashcardApi.publicDecks(lang || undefined)
      setPublicDecks(decks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load public decks.')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([loadMy(), loadPublic(publicLang)]).finally(() => setLoading(false))
  }, [loadMy, loadPublic, publicLang])

  const decks = tab === 'my' ? myDecks : publicDecks

  return (
    <main className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <span className="text-sm font-medium text-ink">Flashcards</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Flashcards
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              O'z deck'laringizni yarating yoki jamoat deck'laridan o'rganing
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New deck
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-5 inline-flex rounded-2xl border border-ink/8 bg-white p-1">
          <TabButton active={tab === 'my'} onClick={() => setTab('my')}>
            My decks
            {myDecks.length > 0 && (
              <span className="ml-1.5 text-ink-muted">({myDecks.length})</span>
            )}
          </TabButton>
          <TabButton active={tab === 'public'} onClick={() => setTab('public')}>
            Public decks
          </TabButton>
        </div>

        {/* Public til filtr */}
        {tab === 'public' && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            <Chip active={publicLang === ''} onClick={() => setPublicLang('')}>
              All languages
            </Chip>
            {LANG_OPTIONS.map((l) => (
              <Chip
                key={l.code}
                active={publicLang === l.code}
                onClick={() => setPublicLang(l.code)}
              >
                {l.flag} {l.name}
              </Chip>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-coral-500/20 bg-coral-50 px-4 py-3 text-sm text-coral-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-ink-muted">Loading…</p>
        ) : decks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink/12 bg-white/50 p-10 text-center">
            <p className="text-sm text-ink-soft">
              {tab === 'my'
                ? "Hali deck yaratmagansiz. Birinchisini yarating!"
                : "Bu tilda jamoat deck'i topilmadi."}
            </p>
            {tab === 'my' && (
              <button onClick={() => setCreateOpen(true)} className="mt-4 btn-primary">
                Create your first deck
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <DeckCard key={d.id} deck={d} showProgress={tab === 'my'} />
            ))}
          </div>
        )}
      </div>

      <CreateDeckModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(deck) => {
          setMyDecks((prev) => [deck, ...prev])
          setCreateOpen(false)
          setTab('my')
        }}
      />
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-indigo-500 text-white shadow-sm' : 'text-ink-soft hover:bg-cream'
      }`}
    >
      {children}
    </button>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-indigo-500 bg-indigo-500 text-white'
          : 'border-ink/12 bg-white text-ink-soft hover:border-indigo-500/30 hover:bg-indigo-50'
      }`}
    >
      {children}
    </button>
  )
}

function DeckCard({
  deck,
  showProgress,
}: {
  deck: FlashcardDeck
  showProgress: boolean
}) {
  const langInfo = LANG_OPTIONS.find((l) => l.code === deck.languageCode)
  const progressPct =
    deck.cardCount > 0 ? Math.round((deck.knownCount / deck.cardCount) * 100) : 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link
        to={`/flashcards/${deck.id}`}
        className="group flex h-full flex-col rounded-3xl border border-ink/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md"
      >
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-lg leading-none">{langInfo?.flag ?? '🌐'}</span>
          {deck.cefrLevel && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[deck.cefrLevel]}`}
            >
              {deck.cefrLevel}
            </span>
          )}
          {deck.isPublic && (
            <span className="rounded-full border border-mint-500/25 bg-mint-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mint-700">
              Public
            </span>
          )}
        </div>

        <h3 className="mb-1 line-clamp-2 font-display text-base font-semibold text-ink">
          {deck.title}
        </h3>
        {deck.description && (
          <p className="mb-3 line-clamp-2 text-xs text-ink-muted">
            {deck.description}
          </p>
        )}

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>{deck.cardCount} cards</span>
            {!showProgress && <span>by {deck.ownerName.trim() || 'Anonymous'}</span>}
          </div>

          {showProgress && deck.cardCount > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] text-ink-muted">
                <span>{deck.knownCount} known</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream">
                <div
                  className="h-full bg-mint-500 transition-[width]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Create deck modal
// ═════════════════════════════════════════════════════════════════
function CreateDeckModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (deck: FlashcardDeck) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [languageCode, setLanguageCode] = useState('en')
  const [cefrLevel, setCefrLevel] = useState<CefrLevel | ''>('')
  const [isPublic, setIsPublic] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setLanguageCode('en')
    setCefrLevel('')
    setIsPublic(false)
    setError(null)
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const submit = async () => {
    if (!title.trim()) {
      setError('Deck nomi majburiy.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const input: CreateDeckInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        languageCode,
        cefrLevel: cefrLevel || null,
        isPublic,
      }
      const deck = await flashcardApi.createDeck(input)
      onCreated(deck)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deck yaratilmadi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/6 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">New deck</h2>
          <button onClick={onClose} disabled={submitting} className="rounded-full p-2 text-ink-muted transition hover:bg-cream hover:text-ink disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Everyday Korean verbs"
              disabled={submitting}
              className="w-full rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={submitting}
              className="w-full resize-none rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Language *</span>
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm font-medium text-ink outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Level</span>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value as CefrLevel | '')}
                disabled={submitting}
                className="w-full rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm font-medium text-ink outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">— Any —</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink/12 bg-cream/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 accent-indigo-500"
            />
            <span className="text-sm text-ink">Make this deck public</span>
          </label>

          {error && <p className="text-sm text-coral-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream/40 px-6 py-4">
          <button onClick={onClose} disabled={submitting} className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create deck'}
          </button>
        </div>
      </div>
    </div>
  )
}
