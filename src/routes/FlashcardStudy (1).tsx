// Flashcard study session — 3D flip, know/don't know, progress.
//
// Mavjud Flashcard3D komponentini AYNAN shu holida ishlatamiz —
// professional flip animatsiya allaqachon tayyor edi.
//
// Flow:
//   1. Kartochkalar shuffle qilib yuklanadi (backend /shuffle)
//   2. Har kartani flip qilib javobni ko'rish mumkin
//   3. "Know" / "Don't know" — backend'ga POST /mark, keyingi kartaga o'tadi
//   4. Oxirida natija: nechta known, qayta boshlash yoki deck'ka qaytish

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import Flashcard3D from '../components/Flashcard3D'
import { isAuthenticated } from '../lib/auth'
import { flashcardApi, NATIVE_LANG_NAME, type FlashcardCard } from '../lib/flashcard'
import { fetchNativeLanguageCodes } from '../lib/nativeLanguages'
import {
  fetchPronunciation,
  fetchPronunciationGuessLanguage,
  speakText,
  stopSpeech,
  type PronunciationResult,
} from '../lib/pronunciation'

export default function FlashcardStudy() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Deck ichidagi kartochkalar ro'yxatidan bitta kartani bosib
  // kirilganda shu ID keladi (`/flashcards/:id/study?card=CARD_ID`).
  // Shunda butun shuffle qilingan sessiya o'rniga faqat o'sha bitta
  // kartochka ochiladi — "Study" tugmasi esa bu parametrsiz, hozirgidek
  // to'liq (shuffle qilingan) sessiyani boshlayveradi.
  const singleCardId = searchParams.get('card')

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [languageCode, setLanguageCode] = useState<string>('')
  const [nativeLangs, setNativeLangs] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [marking, setMarking] = useState(false)
  // Har karta uchun flip holatini reset qilish uchun key
  const [flipKey, setFlipKey] = useState(0)
  // Har bir karta uchun random: front/back teskari ko'rsatilsinmi?
  // (ba'zida so'z oldin, ba'zida tarjima oldin — yaxshiroq yodlash uchun)
  const [reversedMap, setReversedMap] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [mine, pub, natives] = await Promise.all([
        flashcardApi.myDecks().catch(() => []),
        flashcardApi.publicDecks().catch(() => []),
        fetchNativeLanguageCodes(),
      ])
      const deck = [...mine, ...pub].find((d) => d.id === id)
      setLanguageCode(deck?.languageCode ?? '')
      setNativeLangs(natives)

      let sessionCards: FlashcardCard[]
      if (singleCardId) {
        // Bitta kartochka rejimi — ro'yxatdagi tartibni (shuffle
        // qilinmagan) olib, aynan bosilgan kartochkani ajratib
        // olamiz. Shu bilan 50-100 ta kartadan birini tekshirish
        // uchun butun sessiyani aylanib chiqishga hojat qolmaydi.
        const all = await flashcardApi.getCards(id)
        const found = all.find((c) => c.id === singleCardId)
        sessionCards = found ? [found] : []
      } else {
        sessionCards = await flashcardApi.getCardsShuffled(id)
      }

      setCards(sessionCards)
      // Har safar (shu jumladan "Study again"da ham) qaytadan random
      // qilib belgilaymiz — shu bilan bir xil karta har seansda
      // turli tomondan boshlanishi mumkin. Bitta kartochka rejimida
      // esa doim old tomondan (front) boshlanadi — ro'yxatdan aynan
      // shu so'zni ko'rish uchun bosilgan, tasodifiy teskari
      // ko'rsatish kutilmagan bo'ladi.
      const reversed: Record<string, boolean> = {}
      sessionCards.forEach((c) => {
        reversed[c.id] = singleCardId ? false : Math.random() < 0.5
      })
      setReversedMap(reversed)
      setIndex(0)
      setResults({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cards.')
    } finally {
      setLoading(false)
    }
  }, [id, singleCardId])

  useEffect(() => {
    load()
  }, [load])

  const current = cards[index]
  const isReversed = current ? !!reversedMap[current.id] : false
  const done = cards.length > 0 && index >= cards.length
  const knownCount = Object.values(results).filter(Boolean).length
  const answeredCount = Object.keys(results).length

  // ── Joriy karta uchun live IPA + description ──
  // Hech qayerga saqlanmaydi — har safar karta ko'rsatilganda
  // (yoki sessiya davomida keshdan) olib kelinadi.
  const [frontPron, setFrontPron] = useState<PronunciationResult | null>(null)
  const [backPron, setBackPron] = useState<PronunciationResult | null>(null)

  useEffect(() => {
    if (!current) {
      setFrontPron(null)
      setBackPron(null)
      return
    }
    let cancelled = false
    setFrontPron(null)
    setBackPron(null)

    // Front — til aniq (deck tili)
    fetchPronunciation(current.front, languageCode).then((res) => {
      if (!cancelled) setFrontPron(res)
    })
    // Back — til noaniq, ona tillar orasidan qidiramiz
    fetchPronunciationGuessLanguage(current.back, nativeLangs).then((res) => {
      if (!cancelled) setBackPron(res)
    })

    return () => {
      cancelled = true
    }
  }, [current, languageCode, nativeLangs])

  // ── Karta almashganda yoki sahifadan chiqilganda — hozir ijro
  //    etilayotgan ovozni to'xtatamiz.  Aks holda eski so'z yangi
  //    kartaga o'tilgandan keyin ham davom etib eshitilaveradi. ──
  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [current?.id])

  const mark = async (know: boolean) => {
    if (!current || marking) return
    // Karta almashishidan oldin talaffuzni DARHOL, shu klikning o'zi
    // ichida to'xtatamiz (keyingi render'dagi effect cleanup'ini
    // kutmaymiz) — aks holda Chrome'da "muzlab qolgan" utterance
    // aynan shu klik tufayli uyg'onib, keyingi kartaga o'tib
    // bo'lgandan keyin eshitilib qolishi mumkin.
    stopSpeech()
    setMarking(true)
    setResults((prev) => ({ ...prev, [current.id]: know }))
    try {
      await flashcardApi.markCard(current.id, know)
    } catch {
      // Xato bo'lsa ham davom etamiz — user tajribasi buzilmasin
    } finally {
      setMarking(false)
      setIndex((i) => i + 1)
      setFlipKey((k) => k + 1)
    }
  }

  const restart = () => {
    load()
    setFlipKey((k) => k + 1)
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  if (error || cards.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <p className="mb-4 text-sm text-coral-700">
            {error ?? "Bu deck'да kartochka yo'q."}
          </p>
          <Link to={`/flashcards/${id}`} className="btn-primary">
            Back to deck
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#F5EFEA]">
      {/* ── Fon — aniq ko'rinadigan, yaltiroq shisha sferalar ──
          Muhim: sferalarga tashqi blur filtri qo'yilmagan — yumshoqlik
          gradientning o'zidan (stop'lar orqali) keladi, shuning uchun
          shakllari aniq va "iflos"/xira ko'rinmaydi. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Katta yuqori-chap — binafsha */}
        <motion.div
          className="absolute -left-20 -top-24 h-[30rem] w-[30rem] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 74% 18%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 6%), ' +
              'radial-gradient(circle at 26% 24%, rgba(255,255,255,0.9) 0%, rgba(196,132,252,0.98) 22%, rgba(147,51,234,1) 55%, rgba(107,33,168,1) 100%)',
            boxShadow: '0 40px 80px -20px rgba(126,34,206,0.55)',
          }}
          animate={{ x: [0, 22, 0], y: [0, 16, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Katta yuqori-o'ng — shaftoli/orange */}
        <motion.div
          className="absolute -right-16 -top-16 h-[26rem] w-[26rem] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 72% 20%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 6%), ' +
              'radial-gradient(circle at 28% 26%, rgba(255,255,255,0.9) 0%, rgba(253,186,140,0.98) 22%, rgba(251,146,60,1) 55%, rgba(217,119,6,1) 100%)',
            boxShadow: '0 40px 80px -20px rgba(217,119,6,0.5)',
          }}
          animate={{ x: [0, -18, 0], y: [0, 20, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Katta pastki-chap — pushti/magenta */}
        <motion.div
          className="absolute -bottom-24 left-10 h-[28rem] w-[28rem] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 75% 22%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 6%), ' +
              'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.9) 0%, rgba(249,168,212,0.98) 22%, rgba(236,72,153,1) 55%, rgba(190,24,93,1) 100%)',
            boxShadow: '0 40px 80px -20px rgba(219,39,119,0.5)',
          }}
          animate={{ x: [0, 18, 0], y: [0, -14, 0] }}
          transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Katta pastki-o'ng — indigo/moviy */}
        <motion.div
          className="absolute -bottom-16 right-6 h-80 w-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 72% 20%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 6%), ' +
              'radial-gradient(circle at 28% 26%, rgba(255,255,255,0.9) 0%, rgba(165,180,252,0.98) 22%, rgba(99,102,241,1) 55%, rgba(67,56,202,1) 100%)',
            boxShadow: '0 40px 80px -20px rgba(79,70,229,0.5)',
          }}
          animate={{ x: [0, -14, 0], y: [0, -18, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Kartaning pastki-o'ng burchagiga "yopishgan" kichik shar — referensdagi kabi */}
        <motion.div
          className="absolute bottom-[18%] right-[30%] h-16 w-16 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0%, rgba(196,132,252,0.98) 25%, rgba(147,51,234,1) 60%, rgba(107,33,168,1) 100%)',
            boxShadow: '0 12px 24px -6px rgba(126,34,206,0.5)',
          }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Kichik aksent — o'ng yuqori, kartaning yonida */}
        <motion.div
          className="absolute right-[12%] top-[16%] h-12 w-12 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0%, rgba(249,168,212,0.98) 25%, rgba(236,72,153,1) 60%, rgba(190,24,93,1) 100%)',
            boxShadow: '0 10px 20px -6px rgba(219,39,119,0.45)',
          }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <header className="relative z-10 flex flex-shrink-0 items-center justify-between border-b border-ink/8 bg-white/70 px-5 py-3 backdrop-blur-md">
        <Link
          to={`/flashcards/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Exit
        </Link>
        <span className="font-mono text-xs font-medium text-ink-muted tabular-nums">
          {Math.min(index + 1, cards.length)} / {cards.length}
        </span>
        <Logo size={26} />
      </header>

      <div className="relative z-10 h-1 flex-shrink-0 bg-white/60">
        <div
          className="h-full bg-indigo-500 transition-[width] duration-300"
          style={{ width: `${(answeredCount / cards.length) * 100}%` }}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-8">
        {done ? (
          <ResultsView
            total={cards.length}
            known={knownCount}
            onRestart={restart}
            deckId={id!}
          />
        ) : (
          current && (
            <StudyCard
              key={`${current.id}-${flipKey}`}
              card={current}
              languageCode={languageCode}
              backLanguageCode={nativeLangs[0] ?? ''}
              reversed={isReversed}
              frontPron={frontPron}
              backPron={backPron}
              marking={marking}
              onKnow={() => mark(true)}
              onDontKnow={() => mark(false)}
            />
          )
        )}
      </div>
    </main>
  )
}

function StudyCard({
  card,
  languageCode,
  backLanguageCode,
  reversed,
  frontPron,
  backPron,
  marking,
  onKnow,
  onDontKnow,
}: {
  card: FlashcardCard
  languageCode: string
  backLanguageCode: string
  reversed: boolean
  frontPron: PronunciationResult | null
  backPron: PronunciationResult | null
  marking: boolean
  onKnow: () => void
  onDontKnow: () => void
}) {
  const targetLangName = NATIVE_LANG_NAME[languageCode] ?? languageCode

  // reversed=false (odatiy): oldida so'z (target til), orqasida tarjima.
  // reversed=true: oldida tarjima, orqasida so'z (target til) — shu bilan
  // user ba'zan so'zdan tarjimani, ba'zan tarjimadan so'zni topishga
  // majbur bo'ladi va yodlash mustahkamroq bo'ladi.
  const frontProps = reversed
    ? {
        word: card.back,
        language: 'Translation',
        pronunciation: backPron?.ipa ?? undefined,
        onSpeak: (h: { onStart: () => void; onEnd: () => void }) =>
          speakText(card.back, backLanguageCode, backPron?.audioUrl, h),
      }
    : {
        word: card.front,
        language: targetLangName,
        pronunciation: frontPron?.ipa ?? undefined,
        onSpeak: (h: { onStart: () => void; onEnd: () => void }) =>
          speakText(card.front, languageCode, frontPron?.audioUrl, h),
      }

  const backProps = reversed
    ? {
        translation: card.front,
        example: card.exampleSentence ?? undefined,
        description: frontPron?.description ?? undefined,
        onSpeak: (h: { onStart: () => void; onEnd: () => void }) =>
          speakText(card.front, languageCode, frontPron?.audioUrl, h),
      }
    : {
        translation: card.back,
        example: card.exampleSentence ?? undefined,
        description: backPron?.description ?? undefined,
        onSpeak: (h: { onStart: () => void; onEnd: () => void }) =>
          speakText(card.back, backLanguageCode, backPron?.audioUrl, h),
      }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="h-80 w-full sm:h-96">
        <Flashcard3D
          front={frontProps}
          back={backProps}
          backLabel={reversed ? targetLangName : 'Translation'}
          accent="indigo"
          glass
        />
      </div>

      <div className="flex w-full gap-3">
        <button
          onClick={onDontKnow}
          disabled={marking}
          className="flex-1 rounded-2xl border-2 border-coral-500/30 bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-700 transition hover:bg-coral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Don't know
        </button>
        <button
          onClick={onKnow}
          disabled={marking}
          className="flex-1 rounded-2xl border-2 border-mint-500/30 bg-mint-50 px-4 py-3 text-sm font-semibold text-mint-700 transition hover:bg-mint-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Know
        </button>
      </div>
      <p className="text-center text-xs text-ink-muted">
        Kartani bosib javobni ko'ring, keyin baholang
      </p>
    </div>
  )
}

function ResultsView({
  total,
  known,
  onRestart,
  deckId,
}: {
  total: number
  known: number
  onRestart: () => void
  deckId: string
}) {
  const pct = total > 0 ? Math.round((known / total) * 100) : 0

  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-mint-50 text-mint-600">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h2 className="mb-2 font-display text-2xl font-semibold text-ink">
        Session complete!
      </h2>
      <p className="mb-6 text-sm text-ink-soft">
        {known} of {total} cards known ({pct}%)
      </p>

      <div className="mb-8 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full bg-mint-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-center gap-3">
        <Link
          to={`/flashcards/${deckId}`}
          className="rounded-2xl border border-ink/12 bg-white px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-cream"
        >
          Back to deck
        </Link>
        <button onClick={onRestart} className="btn-primary">
          Study again
        </button>
      </div>
    </div>
  )
}
