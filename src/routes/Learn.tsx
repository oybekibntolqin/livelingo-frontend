import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import { isAuthenticated } from '../lib/auth'

interface Skill {
  slug: string
  title: string
  body: string
  accent: 'indigo' | 'coral' | 'mint'
  available: boolean
  icon: 'reading' | 'writing' | 'listening'
}

const SKILLS: Skill[] = [
  {
    slug: 'reading',
    title: 'Reading',
    body: 'IELTS / TOEFL / TOPIK passages plus anything you upload. Highlight what matters and add notes — they stay saved.',
    accent: 'indigo',
    available: true,
    icon: 'reading',
  },
  {
    slug: 'writing',
    title: 'Writing',
    body: 'Task 1 and Task 2 style prompts. Submit your answer and get an honest CEFR-aligned breakdown from AI.',
    accent: 'coral',
    available: true,
    icon: 'writing',
  },
  {
    slug: 'listening',
    title: 'Listening',
    body: 'Audio + transcript. A-B repeat, slow playback, skip silences. Upload your own audio too.',
    accent: 'mint',
    available: true,
    icon: 'listening',
  },
]

const ACCENT_BG = { indigo: 'bg-indigo-50', coral: 'bg-coral-50', mint: 'bg-mint-50' }
const ACCENT_TEXT = { indigo: 'text-indigo-600', coral: 'text-coral-600', mint: 'text-mint-600' }
const ACCENT_DOT = { indigo: 'bg-indigo-500', coral: 'bg-coral-500', mint: 'bg-mint-500' }

export default function Learn() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -right-20 top-60 h-96 w-96 rounded-full bg-coral-500/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to dashboard
        </Link>
        <Logo size={28} />
      </header>

      <div className="mx-auto max-w-5xl pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
            Learn
          </p>
          <h1 className="font-display text-display-lg font-semibold text-ink">
            What do you want to work on?
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            Pick a skill. Each one has CEFR-graded materials and AI feedback.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((skill, i) => (
            <SkillCard key={skill.slug} skill={skill} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </main>
  )
}

function SkillCard({ skill, delay }: { skill: Skill; delay: number }) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={skill.available ? { y: -4 } : {}}
      className={`group relative h-full overflow-hidden rounded-4xl border border-ink/8 bg-white p-7 transition-shadow ${
        skill.available ? 'hover:shadow-card' : 'opacity-70'
      }`}
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${ACCENT_BG[skill.accent]}`} />

      <div className="relative">
        <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${ACCENT_BG[skill.accent]} ${ACCENT_TEXT[skill.accent]}`}>
          <SkillIcon kind={skill.icon} />
        </div>

        <h3 className="mb-2 font-display text-2xl font-semibold tracking-tight text-ink">
          {skill.title}
        </h3>
        <p className="text-ink-soft">{skill.body}</p>

        <div className="mt-6 flex items-center justify-between">
          {skill.available ? (
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${ACCENT_TEXT[skill.accent]}`}>
              Open
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[skill.accent]} animate-pulse-dot`} />
              Coming soon
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )

  if (skill.available) {
    return <Link to={`/learn/${skill.slug}`}>{inner}</Link>
  }
  return <div className="cursor-not-allowed">{inner}</div>
}

function SkillIcon({ kind }: { kind: Skill['icon'] }) {
  const c = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'reading':
      return <svg {...c}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg>
    case 'writing':
      return <svg {...c}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z" /></svg>
    case 'listening':
      return <svg {...c}><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg>
  }
}
