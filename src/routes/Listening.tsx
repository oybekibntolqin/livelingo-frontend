// Listening — top-level rejim tanlash sahifasi.
//
// /learn/listening'ga kirsa foydalanuvchi 2 ta katta karta ko'radi:
//   • Practice — o'z materiallari, AI baholash, do'stona feedback
//   • Exam     — real imtihon simulyatsiyasi, qat'iy vaqt
//
// Har kartaga bosish tegishli browse sahifasiga eltadi.

import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { isAuthenticated } from '../lib/auth'

export default function Listening() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-0 top-60 h-72 w-72 rounded-full bg-coral-500/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Learn
        </Link>
        <Logo size={28} />
      </header>

      <div className="mx-auto max-w-5xl pt-16">
        <div className="mb-10 text-center">
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
            Listening
          </p>
          <h1 className="mx-auto max-w-2xl font-display text-display-md font-semibold text-ink">
            How would you like to work today?
          </h1>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* PRACTICE */}
          <Link
            to="/learn/listening/practice"
            className="group relative overflow-hidden rounded-4xl border border-ink/8 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-mint-500/40 hover:shadow-lg"
          >
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-3xl bg-mint-50 text-mint-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0118 0v6" />
                <path d="M21 19a2 2 0 01-2 2h-1v-6h3v4zM3 19a2 2 0 002 2h1v-6H3v4z" />
              </svg>
            </div>

            <h2 className="mb-2 font-display text-2xl font-semibold text-ink">
              Practice
            </h2>
            <p className="mb-5 text-sm text-ink-soft">
              Work with your own audio materials. AI generates questions from the transcript and evaluates you.
            </p>

            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-mint-500" />
                <span>Upload your own materials</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-mint-500" />
                <span>AI automatically generates questions from the transcript.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-mint-500" />
                <span>Detailed feedback, error analysis</span>
              </li>
            </ul>

            <span className="mt-6 inline-flex items-center gap-1.5 font-medium text-indigo-600">
              Start practice
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          {/* EXAM */}
          <Link
            to="/learn/listening/exam-browse"
            className="group relative overflow-hidden rounded-4xl border border-ink/8 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-coral-500/40 hover:shadow-lg"
          >
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-3xl bg-coral-50 text-coral-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3 8-8" />
                <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" />
              </svg>
            </div>

            <h2 className="mb-2 font-display text-2xl font-semibold text-ink">
              Exam
            </h2>
            <p className="mb-5 text-sm text-ink-soft">
              Real imtihon simulyatsiyasi.  Vaqt cheklangan, aralash
              Easy/Hard savollar, avtomatik baholash.
            </p>

            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-coral-500" />
                <span>Vaqt cheklangan, avtomatik topshiriladi</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-coral-500" />
                <span>Standart imtihonlar (IELTS, TOEFL...)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-coral-500" />
                <span>Random Easy/Hard aralash savollar</span>
              </li>
            </ul>

            <span className="mt-6 inline-flex items-center gap-1.5 font-medium text-indigo-600">
              Take exam
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </main>
  )
}
