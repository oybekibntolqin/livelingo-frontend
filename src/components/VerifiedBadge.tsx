// VerifiedBadge — Instagram uslubidagi "tasdiqlangan" tik belgisi.
//
// Hozircha barcha foydalanuvchilarga (backend'da alohida "verified" maydon
// SHART EMAS) statik ravishda ko'rsatiladi. Faqat bitta istisno: rasmiy
// "Livelingo" akkaunt (username === OFFICIAL_USERNAME) — unga tik o'rniga
// yulduzcha (Telegram Premium uslubida) ko'rsatiladi.
//
// MUHIM: OFFICIAL_USERNAME shu yerda backend'dagi DataInitializer.java
// ichidagi OFFICIAL_USERNAME konstantasi bilan AYNAN bir xil bo'lishi kerak
// ("livelingo"), aks holda rasmiy akkaunt oddiy tik bilan ko'rinadi.
import React from 'react'

const OFFICIAL_USERNAME = 'livelingo'

interface VerifiedBadgeProps {
  username?: string | null
  className?: string
  size?: number
}

export default function VerifiedBadge({ username, className = '', size = 16 }: VerifiedBadgeProps) {
  if (!username) return null

  const isOfficial = username.toLowerCase() === OFFICIAL_USERNAME

  if (isOfficial) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={`inline-block shrink-0 align-middle ${className}`}
        aria-label="Rasmiy akkaunt"
        role="img"
      >
        <defs>
          <linearGradient id="livelingo-star-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5FC1F1" />
            <stop offset="100%" stopColor="#2B8FE0" />
          </linearGradient>
        </defs>
        <path
          fill="url(#livelingo-star-grad)"
          d="M12 1.5l2.85 6.32 6.9.72-5.2 4.68 1.5 6.78L12 16.9l-6.05 3.1 1.5-6.78-5.2-4.68 6.9-.72L12 1.5z"
        />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-label="Tasdiqlangan"
      role="img"
    >
      <path
        fill="#3B9EFF"
        d="M12 1.3l2.34 1.5 2.76-.28 1.06 2.56 2.56 1.06-.28 2.76 1.5 2.34-1.5 2.34.28 2.76-2.56 1.06-1.06 2.56-2.76-.28L12 22.7l-2.34-1.5-2.76.28-1.06-2.56-2.56-1.06.28-2.76-1.5-2.34 1.5-2.34-.28-2.76 2.56-1.06 1.06-2.56 2.76.28L12 1.3z"
      />
      <path
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12.5l2.5 2.5L16 9.5"
      />
    </svg>
  )
}
