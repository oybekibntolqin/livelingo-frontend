import { motion, useReducedMotion } from 'framer-motion'
import logoMark from '../assets/logo-mark.png'

interface LogoProps {
  size?: number
  mark?: 'wordmark' | 'mark'
  className?: string
  inverted?: boolean
}

/**
 * LiveLingo logo — the parrot/speech-bubble mark, used everywhere the brand
 * appears (sidebar, topbars, auth screens, empty states, loaders, etc).
 *
 * Kept as a single shared component so the mark + its animation stay
 * perfectly consistent across every page — change it once here and it
 * updates everywhere.
 */
export default function Logo({
  size = 40,
  mark = 'wordmark',
  className = '',
  inverted = false,
}: LogoProps) {
  const ink = inverted ? '#FAFAFA' : '#14142B'
  const prefersReducedMotion = useReducedMotion()

  const Mark = (
    <motion.img
      src={logoMark}
      alt="LiveLingo"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain' }}
      className="select-none drop-shadow-sm"
      draggable={false}
      initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
      animate={
        prefersReducedMotion
          ? { opacity: 1, scale: 1, rotate: 0 }
          : { opacity: 1, scale: 1, rotate: [0, -4, 3, 0], y: [0, -2, 0] }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0.3 }
          : {
              opacity: { duration: 0.35 },
              scale: { duration: 0.35 },
              rotate: { duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
              y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
            }
      }
      whileHover={
        prefersReducedMotion
          ? undefined
          : { rotate: [0, -10, 8, -4, 0], scale: 1.08, transition: { duration: 0.55, ease: 'easeInOut' } }
      }
    />
  )

  if (mark === 'mark') {
    return <span className={className}>{Mark}</span>
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {Mark}
      <span
        className="font-display text-[1.35rem] font-semibold tracking-tight"
        style={{ color: ink }}
      >
        Live<span style={{ color: '#5C8A2E' }}>Lingo</span>
      </span>
    </span>
  )
}
