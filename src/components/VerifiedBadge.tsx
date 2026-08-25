import React, { useId } from 'react'
import './VerifiedBadge.css'

const OFFICIAL_USERNAME = 'livelingo'

interface VerifiedBadgeProps {
  username?: string | null
  className?: string
  size?: number
}

export default function VerifiedBadge({
  username,
  className = '',
  size = 16,
}: VerifiedBadgeProps) {
  const gradientId = useId().replace(/:/g, '')

  if (!username) return null

  const isOfficial =
    username.toLowerCase() === OFFICIAL_USERNAME

  // ============================================================
  // LIVELINGO OFFICIAL — Telegram Premium style animated star
  // ============================================================
  if (isOfficial) {
    return (
      <span
        className={`official-badge ${className}`}
        style={{
          width: size,
          height: size,
        }}
        aria-label="Rasmiy akkaunt"
        role="img"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className="official-star"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`star-gradient-${gradientId}`}
              x1="3"
              y1="2"
              x2="21"
              y2="22"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#7B61FF" />
              <stop offset="45%" stopColor="#8F6CFF" />
              <stop offset="75%" stopColor="#B35CFF" />
              <stop offset="100%" stopColor="#E85DFF" />
            </linearGradient>

            <filter
              id={`star-glow-${gradientId}`}
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur
                stdDeviation="1.2"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Main Premium Star */}
          <path
            className="star-main"
            fill={`url(#star-gradient-${gradientId})`}
            filter={`url(#star-glow-${gradientId})`}
            d="
              M12 1.8
              L14.9 7.7
              L21.4 8.6
              L16.7 13.2
              L17.8 19.7
              L12 16.65
              L6.2 19.7
              L7.3 13.2
              L2.6 8.6
              L9.1 7.7
              Z
            "
          />

          {/* Small sparkles */}
          <g className="star-sparkles">
            <path
              className="sparkle sparkle-1"
              d="M4 3.2 L4.45 4.35 L5.6 4.8 L4.45 5.25 L4 6.4 L3.55 5.25 L2.4 4.8 L3.55 4.35 Z"
            />

            <path
              className="sparkle sparkle-2"
              d="M19.5 3.8 L19.9 4.8 L20.9 5.2 L19.9 5.6 L19.5 6.6 L19.1 5.6 L18.1 5.2 L19.1 4.8 Z"
            />

            <path
              className="sparkle sparkle-3"
              d="M21 10.5 L21.35 11.35 L22.2 11.7 L21.35 12.05 L21 12.9 L20.65 12.05 L19.8 11.7 L20.65 11.35 Z"
            />

            <circle
              className="sparkle-dot sparkle-4"
              cx="5.2"
              cy="14.5"
              r="0.65"
            />

            <circle
              className="sparkle-dot sparkle-5"
              cx="18.2"
              cy="17"
              r="0.55"
            />
          </g>
        </svg>
      </span>
    )
  }

  // ============================================================
  // NORMAL VERIFIED — Instagram style
  // ============================================================
  return (
    <span
      className={`verified-badge ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-label="Tasdiqlangan"
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {/* Instagram-style verified badge */}
        <path
          fill="#0095F6"
          d="
            M12 1.3
            L14.35 2.65
            L17.05 2.45
            L18.25 4.9
            L20.7 6.1
            L20.5 8.8
            L21.85 11.15
            L20.5 13.5
            L20.7 16.2
            L18.25 17.4
            L17.05 19.85
            L14.35 19.65
            L12 21
            L9.65 19.65
            L6.95 19.85
            L5.75 17.4
            L3.3 16.2
            L3.5 13.5
            L2.15 11.15
            L3.5 8.8
            L3.3 6.1
            L5.75 4.9
            L6.95 2.45
            L9.65 2.65
            Z
          "
        />

        {/* White check */}
        <path
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.7 11.9 L10.4 14.5 L16.3 8.7"
        />
      </svg>
    </span>
  )
}
