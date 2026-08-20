// Ball 70% dan past bo'lganda ko'rsatiladigan motivatsion karta —
// Reading, Writing, Listening natija sahifalarining hammasida
// ishlatiladi.  70% yoki undan yuqori bo'lsa — hech narsa
// render qilmaydi (null).

import { useMemo } from 'react'
import { randomQuote } from '../../lib/motivation'

export default function MotivationalCard({ scorePercent }: { scorePercent: number }) {
  // Har render'da bir xil iqtibos qolishi uchun — useMemo (aks holda
  // re-render'да iqtibos "sakrab" turardi)
  const quote = useMemo(() => randomQuote(), [])

  if (scorePercent >= 70) return null

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-indigo-500/15 bg-gradient-to-br from-indigo-50 via-white to-mint-50 p-6 sm:p-7">
      {/* Fon bezaklari */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-500/8 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-mint-500/10 blur-2xl" />

      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
            </svg>
          </div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-indigo-600">
            Davom eting — bu faqat boshlanish
          </p>
        </div>

        <svg
          width="26"
          height="20"
          viewBox="0 0 32 24"
          fill="none"
          className="mb-2 text-indigo-500/25"
        >
          <path
            d="M0 24V14.4C0 6.4 5.2 1.2 12.8 0L14 3.2C9.6 4.4 7.2 7.2 6.8 11.2H12.8V24H0ZM19.2 24V14.4C19.2 6.4 24.4 1.2 32 0L33.2 3.2C28.8 4.4 26.4 7.2 26 11.2H32V24H19.2Z"
            fill="currentColor"
          />
        </svg>

        <p className="mb-3 font-display text-lg font-semibold leading-snug text-ink sm:text-xl">
          {quote.textUz}
        </p>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 max-w-[24px] bg-ink/15" />
          <p className="text-xs text-ink-muted">
            <span className="font-medium text-ink-soft">{quote.author}</span>
            <span className="mx-1">·</span>
            {quote.role}
          </p>
        </div>

        <p className="mt-3 text-xs italic text-ink-muted/70">"{quote.textOriginal}"</p>
      </div>
    </div>
  )
}
