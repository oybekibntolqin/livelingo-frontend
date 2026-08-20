// Flashcard deck detail — kartochkalar ro'yxati + boshqaruv.
//
// Egasi bo'lsa: qo'shish/tahrirlash/o'chirish mumkin.
// Har kim: "Study" tugmasi bilan 3D flip sessiyasini boshlaydi.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { isAuthenticated } from '../lib/auth'
import { getUserIdFromToken } from '../lib/chatAuth'
import { fetchNativeLanguageCodes } from '../lib/nativeLanguages'
import { fetchPronunciation, speakText, type PronunciationResult } from '../lib/pronunciation'
import {
  flashcardApi,
  NATIVE_LANG_NAME,
  type CreateCardInput,
  type FlashcardCard,
  type FlashcardDeck as DeckType,
} from '../lib/flashcard'
import { LANG_OPTIONS, LEVEL_TINT } from '../lib/listening'

export default function FlashcardDeckPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const myId = getUserIdFromToken()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [deck, setDeck] = useState<DeckType | null>(null)
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<FlashcardCard | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      // Deck ma'lumoti alohida endpoint bilan kelmaydi — my/public
      // ro'yxatlaridan birida bo'lishi kerak.  Ikkalasini urinamiz.
      const [mine, pub, cardList] = await Promise.all([
        flashcardApi.myDecks().catch(() => []),
        flashcardApi.publicDecks().catch(() => []),
        flashcardApi.getCards(id),
      ])
      const found = [...mine, ...pub].find((d) => d.id === id) ?? null
      setDeck(found)
      setCards(cardList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deck.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isOwner = deck && myId && deck.ownerId === myId

  const deleteCard = async (card: FlashcardCard) => {
    if (!confirm(`"${card.front}" kartochkasini o'chirishni xohlaysizmi?`)) return
    try {
      await flashcardApi.deleteCard(card.id)
      setCards((prev) => prev.filter((c) => c.id !== card.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : "O'chirishda xato.")
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  if (error || !deck) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">{error ?? 'Deck topilmadi.'}</p>
          <Link to="/flashcards" className="btn-primary">Back to Flashcards</Link>
        </div>
      </main>
    )
  }

  const langInfo = LANG_OPTIONS.find((l) => l.code === deck.languageCode)

  return (
    <main className="min-h-screen bg-cream pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/8 bg-white/85 px-5 py-3 backdrop-blur">
        <Link to="/flashcards" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Flashcards
        </Link>
        <span className="text-sm font-medium text-ink">Deck</span>
        <Logo size={26} />
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {/* Meta */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-lg leading-none">{langInfo?.flag ?? '🌐'}</span>
          {deck.cefrLevel && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TINT[deck.cefrLevel]}`}>
              {deck.cefrLevel}
            </span>
          )}
          {deck.isPublic && (
            <span className="rounded-full border border-mint-500/25 bg-mint-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mint-700">
              Public
            </span>
          )}
        </div>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{deck.title}</h1>
        {deck.description && <p className="mb-4 text-sm text-ink-soft">{deck.description}</p>}
        <p className="mb-6 text-xs text-ink-muted">
          {cards.length} cards · {deck.knownCount} known · by {deck.ownerName.trim() || 'Anonymous'}
        </p>

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            to={`/flashcards/${deck.id}/study`}
            className={`btn-primary ${cards.length === 0 ? 'pointer-events-none opacity-40' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
            Study
          </Link>
          {isOwner && (
            <button
              onClick={() => { setEditingCard(null); setCardModalOpen(true) }}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-ink/12 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-indigo-500/40 hover:bg-indigo-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add card
            </button>
          )}
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink/12 bg-white/50 p-10 text-center">
            <p className="text-sm text-ink-soft">
              {isOwner ? "Hali kartochka yo'q. Birinchisini qo'shing." : "Bu deck bo'sh."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              // Butun qator bosiladigan — aynan shu kartochkani
              // ochib, uni Study ko'rinishida (flip/audio/know
              // tugmalari bilan) ko'rish uchun. Edit/Delete
              // tugmalari o'ziga xos harakat, shuning uchun ular
              // klikni yuqoriga (qator navigatsiyasiga) o'tkazmaydi.
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/flashcards/${deck.id}/study?card=${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/flashcards/${deck.id}/study?card=${c.id}`)
                  }
                }}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/8 bg-white px-4 py-3 transition hover:border-indigo-500/30 hover:bg-indigo-50/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink">{c.front}</p>
                    <span className="text-ink-muted">→</span>
                    <p className="text-ink-soft">{c.back}</p>
                  </div>
                  {c.exampleSentence && (
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      "{c.exampleSentence}"
                    </p>
                  )}
                </div>
                {c.viewCount > 0 && (
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.known ? 'bg-mint-50 text-mint-700' : 'bg-coral-50 text-coral-700'
                    }`}
                  >
                    {c.known ? 'Known' : 'Learning'}
                  </span>
                )}
                {isOwner && (
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingCard(c)
                        setCardModalOpen(true)
                      }}
                      className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCard(c)
                      }}
                      className="rounded-full p-1.5 text-ink-muted transition hover:bg-coral-50 hover:text-coral-600"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CardModal
        open={cardModalOpen}
        deckId={deck.id}
        deckLanguageCode={deck.languageCode}
        editingCard={editingCard}
        onClose={() => setCardModalOpen(false)}
        onSaved={(card, isNew) => {
          if (isNew) {
            setCards((prev) => [...prev, card])
          } else {
            setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)))
          }
          setCardModalOpen(false)
        }}
      />
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Add / Edit card modal
// ═════════════════════════════════════════════════════════════════
function CardModal({
  open,
  deckId,
  deckLanguageCode,
  editingCard,
  onClose,
  onSaved,
}: {
  open: boolean
  deckId: string
  deckLanguageCode: string
  editingCard: FlashcardCard | null
  onClose: () => void
  onSaved: (card: FlashcardCard, isNew: boolean) => void
}) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Live talaffuz preview — hech narsa saqlanmaydi, faqat
  //    ko'rsatish uchun.  Front tili aniq (deck tili), back tili
  //    esa foydalanuvchining ona tillaridan tanlanadi. ──
  const [nativeLangs, setNativeLangs] = useState<string[]>([])
  const [backLang, setBackLang] = useState('')
  const [frontPreview, setFrontPreview] = useState<PronunciationResult | null>(null)
  const [backPreview, setBackPreview] = useState<PronunciationResult | null>(null)
  const [frontLoading, setFrontLoading] = useState(false)
  const [backLoading, setBackLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setFront(editingCard?.front ?? '')
    setBack(editingCard?.back ?? '')
    setExample(editingCard?.exampleSentence ?? '')
    setError(null)
    setSubmitting(false)
    setFrontPreview(null)
    setBackPreview(null)

    // Ona tillarni bir marta yuklaymiz — 1 tа bo'lsa avtomatik,
    // ko'p bo'lsa kichik dropdown ko'rsatiladi.
    fetchNativeLanguageCodes().then((langs) => {
      setNativeLangs(langs)
      setBackLang(langs[0] ?? '')
    })
  }, [open, editingCard])

  if (!open) return null

  // ── Blur bo'lganda avtomatik talaffuz olib kelish ──
  const handleFrontBlur = async () => {
    if (!front.trim()) return
    setFrontLoading(true)
    try {
      const res = await fetchPronunciation(front, deckLanguageCode)
      setFrontPreview(res)
    } finally {
      setFrontLoading(false)
    }
  }

  const handleBackBlur = async () => {
    if (!back.trim() || !backLang) return
    setBackLoading(true)
    try {
      const res = await fetchPronunciation(back, backLang)
      setBackPreview(res)
    } finally {
      setBackLoading(false)
    }
  }

  const submit = async () => {
    if (!front.trim() || !back.trim()) {
      setError('Front va Back majburiy.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const input: CreateCardInput = {
        front: front.trim(),
        back: back.trim(),
        exampleSentence: example.trim() || undefined,
      }
      if (editingCard) {
        const updated = await flashcardApi.updateCard(editingCard.id, input)
        onSaved(updated, false)
      } else {
        const created = await flashcardApi.addCard(deckId, input)
        onSaved(created, true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlanmadi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/6 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            {editingCard ? 'Edit card' : 'Add card'}
          </h2>
          <button onClick={onClose} disabled={submitting} className="rounded-full p-2 text-ink-muted transition hover:bg-cream hover:text-ink disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Front (word/phrase) *</span>
            <input
              type="text"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onBlur={handleFrontBlur}
              placeholder="안녕하세요"
              disabled={submitting}
              className="w-full rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
            <PronunciationPreview
                loading={frontLoading}
                result={frontPreview}
                text={front}
                languageCode={deckLanguageCode}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-soft">Back (translation) *</span>
              {/* 2+ ona til bo'lsa — qaysi tilda yozayotganini so'raymiz */}
              {nativeLangs.length > 1 && (
                <select
                  value={backLang}
                  onChange={(e) => setBackLang(e.target.value)}
                  disabled={submitting}
                  className="rounded-lg border border-ink/12 bg-white px-2 py-0.5 text-[11px] font-medium text-ink-soft outline-none focus:border-indigo-500/40"
                >
                  {nativeLangs.map((code) => (
                    <option key={code} value={code}>
                      {NATIVE_LANG_NAME[code] ?? code}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              type="text"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onBlur={handleBackBlur}
              placeholder="Hello"
              disabled={submitting}
              className="w-full rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
            <PronunciationPreview
                loading={backLoading}
                result={backPreview}
                text={back}
                languageCode={backLang}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Example sentence</span>
            <textarea
              value={example}
              onChange={(e) => setExample(e.target.value)}
              rows={2}
              placeholder="안녕하세요, 만나서 반갑습니다."
              disabled={submitting}
              className="w-full resize-none rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>
          {error && <p className="text-sm text-coral-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink/6 bg-cream/40 px-6 py-4">
          <button onClick={onClose} disabled={submitting} className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-white disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Saving…' : editingCard ? 'Save changes' : 'Add card'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Live talaffuz preview — modal ichida, saqlanmaydi, faqat ko'rsatiladi
// ═════════════════════════════════════════════════════════════════
function PronunciationPreview({
  loading,
  result,
  text,
  languageCode,
}: {
  loading: boolean
  result: PronunciationResult | null
  text: string
  languageCode: string
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
          <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Talaffuz qidirilmoqda…
      </p>
    )
  }
  if (!result || (!result.ipa && !result.description)) return null
  return <SpeakerRow text={text} languageCode={languageCode} result={result} />
}

function SpeakerRow({
  text,
  languageCode,
  result,
}: {
  text: string
  languageCode: string
  result: PronunciationResult
}) {
  const [speaking, setSpeaking] = useState(false)

  return (
    <div className="flex items-start gap-2 rounded-lg bg-indigo-50/60 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        {result.ipa && (
          <p className="font-mono text-xs text-indigo-700">{result.ipa}</p>
        )}
        {result.description && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">
            {result.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setSpeaking(true)
          speakText(text, languageCode, result.audioUrl, {
            onStart: () => setSpeaking(true),
            onEnd: () => setSpeaking(false),
          })
        }}
        aria-label="Talaffuzni eshitish"
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-indigo-600 transition hover:bg-indigo-100 ${speaking ? 'scale-110' : ''}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={speaking ? 'animate-pulse' : ''}>
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
        </svg>
      </button>
    </div>
  )
}
