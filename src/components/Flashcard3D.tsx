import { useState } from 'react'
import { motion } from 'framer-motion'

interface Flashcard3DProps {
  front: {
    word: string
    language: string
    pronunciation?: string
    // Bosilganda so'zni ovozli o'qiydi (Dictionary audio yoki Web
    // Speech API) — berilmasa 🔊 tugma ko'rsatilmaydi.  Tugma haqiqiy
    // "boshlandi/tugadi" holatini bilishi uchun handlers beriladi.
    onSpeak?: (handlers: { onStart: () => void; onEnd: () => void }) => void
  }
  back: {
    translation: string
    example?: string
    exampleTranslation?: string
    description?: string
    onSpeak?: (handlers: { onStart: () => void; onEnd: () => void }) => void
  }
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  accent?: 'indigo' | 'coral' | 'mint' | 'sun'
  className?: string
  autoFlip?: boolean
  glass?: boolean
  // Orqa tomondagi "Translation" yorlig'i — front/back random almashtirilganda
  // (masalan tarjima oldinga chiqsa) shu yerga haqiqiy tilni ko'rsatish uchun.
  backLabel?: string
}

const accentRing = {
  indigo: 'from-indigo-500/30 to-indigo-500/0',
  coral: 'from-coral-500/30 to-coral-500/0',
  mint: 'from-mint-500/30 to-mint-500/0',
  sun: 'from-sun-500/30 to-sun-500/0',
}

const accentDot = {
  indigo: 'bg-indigo-500',
  coral: 'bg-coral-500',
  mint: 'bg-mint-500',
  sun: 'bg-sun-500',
}

// Uzun so'zlar/iboralar kartadan tashqariga chiqib ketmasligi uchun
// matn uzunligiga qarab shrift o'lchamini avtomatik kichraytiramiz.
function fitTextSizeClass(text: string, variant: 'front' | 'back'): string {
  const len = text?.length ?? 0
  if (variant === 'front') {
    if (len <= 12) return 'text-4xl sm:text-5xl'
    if (len <= 20) return 'text-3xl sm:text-4xl'
    if (len <= 30) return 'text-2xl sm:text-3xl'
    if (len <= 45) return 'text-xl sm:text-2xl'
    return 'text-lg sm:text-xl'
  }
  if (len <= 12) return 'text-3xl sm:text-4xl'
  if (len <= 20) return 'text-2xl sm:text-3xl'
  if (len <= 30) return 'text-xl sm:text-2xl'
  if (len <= 45) return 'text-lg sm:text-xl'
  return 'text-base sm:text-lg'
}

// Karta o'zi bitta katta <button>, shuning uchun ichiga yana <button>
// solib bo'lmaydi (HTML'da button ichida button noto'g'ri) — shu sabab
// bu <span role="button"> sifatida yasalgan va klik kartani flip
// qilmasligi uchun stopPropagation qilinadi.
function SpeakerButton({
  onSpeak,
  dark = false,
}: {
  onSpeak: (handlers: { onStart: () => void; onEnd: () => void }) => void
  dark?: boolean
}) {
  const [speaking, setSpeaking] = useState(false)

  const trigger = () => {
    setSpeaking(true)
    onSpeak({
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    })
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Talaffuzni eshitish"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        trigger()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
          e.preventDefault()
          trigger()
        }
      }}
      className={`inline-flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition ${
        dark
          ? 'text-white/70 hover:bg-white/15 hover:text-white'
          : 'text-ink-muted hover:bg-ink/8 hover:text-ink'
      } ${speaking ? 'scale-110 text-indigo-500' : ''}`}
    >
      {speaking ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
        </svg>
      )}
    </span>
  )
}

export default function Flashcard3D({
                                      front,
                                      back,
                                      level = 'A2',
                                      accent = 'indigo',
                                      className = '',
                                      autoFlip = false,
                                      glass = false,
                                      backLabel = 'Translation',
                                    }: Flashcard3DProps) {
  const [flipped, setFlipped] = useState(false)

  return (
      <div className={`perspective h-full w-full ${className}`}>
        <motion.button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            onMouseEnter={() => autoFlip && setFlipped(true)}
            onMouseLeave={() => autoFlip && setFlipped(false)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="preserve-3d group relative block h-full w-full text-left"
            aria-label={`Flashcard: ${front.word}. Click to flip.`}
        >
          <div
              className="preserve-3d relative h-full w-full transition-transform duration-700 ease-out"
              style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            {/* FRONT */}
            <div
                className={`backface-hidden absolute inset-0 flex flex-col justify-between overflow-hidden rounded-4xl p-7 shadow-card ${
                    glass
                        ? 'border border-white/60 bg-white/45 backdrop-blur-3xl'
                        : 'bg-white'
                }`}
            >
              {/* Soft accent glow */}
              <div
                  className={`pointer-events-none absolute inset-0 rounded-4xl bg-gradient-to-br ${accentRing[accent]} opacity-50 blur-2xl`}
                  style={{ zIndex: -1 }}
              />

              <div className="flex items-start justify-between">
                <div className="pill">
                  <span className={`h-1.5 w-1.5 rounded-full ${accentDot[accent]}`} />
                  {front.language}
                </div>
                <span className="pill">{level}</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-4">
                <div className="flex items-start gap-2">
                  <p
                      className={`font-display font-semibold leading-tight tracking-tight text-ink break-words [overflow-wrap:anywhere] ${fitTextSizeClass(front.word, 'front')}`}
                  >
                    {front.word}
                  </p>
                  {front.onSpeak && (
                      <SpeakerButton onSpeak={front.onSpeak} />
                  )}
                </div>
                {front.pronunciation && (
                    <p className="mt-2 font-mono text-sm text-ink-muted break-words">
                      {front.pronunciation}
                    </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                      d="M3 12h18M3 12l6-6M3 12l6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                  />
                </svg>
                Tap to flip
              </span>
                <span className="font-medium">FRONT</span>
              </div>
            </div>

            {/* BACK — TO'LIQ QORA VA OPPOQ YOZUV */}
            <div
                className={`backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between overflow-hidden rounded-4xl p-7 text-white shadow-card ${
                    glass
                        ? 'border border-white/20 bg-black/90 backdrop-blur-3xl'
                        : 'bg-black'
                }`}
            >
              <div className="flex items-start justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-xs font-medium text-white">
                <span className={`h-1.5 w-1.5 rounded-full ${accentDot[accent]}`} />
                {backLabel}
              </span>
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-xs font-medium text-white">
                {level}
              </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-4">
                <div className="flex items-start gap-2">
                  <p
                      className={`font-display font-semibold leading-tight tracking-tight text-white break-words [overflow-wrap:anywhere] ${fitTextSizeClass(back.translation, 'back')}`}
                  >
                    {back.translation}
                  </p>
                  {back.onSpeak && (
                      <SpeakerButton onSpeak={back.onSpeak} dark />
                  )}
                </div>
                {back.example && (
                    <div className="mt-4 border-l-2 border-white/30 pl-3">
                      <p className="break-words text-sm font-medium text-white">"{back.example}"</p>
                      {back.exampleTranslation && (
                          <p className="mt-1 break-words text-xs text-white/70">{back.exampleTranslation}</p>
                      )}
                    </div>
                )}
                {back.description && (
                    <p className="mt-3 line-clamp-2 break-words text-xs italic text-white/60">
                      {back.description}
                    </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Tap to flip back</span>
                <span className="font-medium">BACK</span>
              </div>
            </div>
          </div>
        </motion.button>
      </div>
  )
}