// SeoPageLayout — shared shell for the public, crawlable marketing/SEO
// pages (Section 6 of the SEO spec): /language-learning,
// /language-exchange, /video-chat, /language-exercises,
// /speaking-practice, /reading-practice, /listening-practice,
// /writing-practice.
//
// These are DIFFERENT from the authenticated app pages at similar
// paths (e.g. /learn/reading). They're public, unauthenticated,
// content pages meant to be crawlable and rank for their topic, with
// a clear CTA into the real (gated) product.

import { Link } from 'react-router-dom'
import Logo from '../../components/Logo'

const RELATED_PAGES = [
  { to: '/language-learning', label: 'Language learning' },
  { to: '/language-exchange', label: 'Language exchange' },
  { to: '/video-chat', label: 'Video chat' },
  { to: '/language-exercises', label: 'Exercises' },
  { to: '/speaking-practice', label: 'Speaking practice' },
  { to: '/reading-practice', label: 'Reading practice' },
  { to: '/listening-practice', label: 'Listening practice' },
  { to: '/writing-practice', label: 'Writing practice' },
]

export function RelatedLinks({ exclude }: { exclude: string }) {
  const others = RELATED_PAGES.filter((p) => p.to !== exclude)
  return (
    <nav aria-label="Related features" className="mt-14 border-t border-ink/8 pt-8">
      <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
        Explore LiveLingo
      </p>
      <ul className="flex flex-wrap gap-2">
        {others.map((p) => (
          <li key={p.to}>
            <Link
              to={p.to}
              className="inline-block rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-indigo-500/30 hover:text-ink"
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SeoHeader() {
  return (
    <header className="border-b border-ink/8 bg-white/85 backdrop-blur">
      <div className="container-x flex items-center justify-between py-4">
        <Link to="/" aria-label="LiveLingo home">
          <Logo size={30} />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link to="/" className="hidden text-ink-soft transition-colors hover:text-ink sm:inline">
            Home
          </Link>
          <Link
            to="/sign-in"
            className="rounded-full bg-indigo-500 px-4 py-2 text-white transition-colors hover:bg-indigo-600"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SeoFooter() {
  return (
    <footer className="border-t border-ink/8 bg-cream py-10">
      <div className="container-x flex flex-wrap items-center justify-between gap-4">
        <Link to="/" aria-label="LiveLingo home">
          <Logo size={24} />
        </Link>
        <p className="text-sm text-ink-muted">© {new Date().getFullYear()} LiveLingo. Made with care.</p>
      </div>
    </footer>
  )
}

export default function SeoPageLayout({
  eyebrow,
  h1,
  intro,
  children,
  ctaLabel = 'Get started free',
}: {
  /** Small label above the H1, e.g. "Language exchange" */
  eyebrow: string
  h1: string
  /** One-paragraph intro under the H1 */
  intro: string
  children: React.ReactNode
  ctaLabel?: string
}) {
  return (
    <main className="min-h-screen bg-cream">
      <SeoHeader />

      <section className="container-x py-14 sm:py-20">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-indigo-600">
          {eyebrow}
        </p>
        <h1 className="max-w-3xl font-display text-3xl font-semibold leading-tight text-ink sm:text-5xl">
          {h1}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          {intro}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/sign-in"
            className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
          >
            {ctaLabel}
          </Link>
          <Link
            to="/"
            className="rounded-full border border-ink/12 px-6 py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-ink/25"
          >
            Learn more about LiveLingo
          </Link>
        </div>
      </section>

      <section className="container-x pb-16 sm:pb-24">
        <div className="max-w-3xl space-y-10">{children}</div>
      </section>

      <div className="container-x">
        <RelatedLinks exclude={typeof window !== 'undefined' ? window.location.pathname : ''} />
      </div>

      <div className="mt-14">
        <SeoFooter />
      </div>
    </main>
  )
}

export function SeoSection({ h2, children }: { h2: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink sm:text-2xl">{h2}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-soft sm:text-base">{children}</div>
    </div>
  )
}
