// ReportedUsers — men shikoyat qilgan foydalanuvchilar ro'yxati.
// Profil > Settings > Reported orqali ochiladi. MUHIM: bu yerdan
// shikoyatni qaytarib olib bo'lmaydi — faqat ko'rish uchun.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import { isAuthenticated } from '../lib/auth'
import { reportApi, REPORT_REASONS, type Report } from '../lib/reportApi'

function reasonLabel(reason: Report['reason']) {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function ReportedUsers() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const openCompose = () => navigate('/dashboard', { state: { openCompose: true } })

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    reportApi
      .getMyReports()
      .then(setReports)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklanmadi."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
        <Sidebar onCreatePost={openCompose} />
        <MobileNav onCreatePost={openCompose} />

        <main className="min-w-0">
          <div className="rounded-4xl border border-ink/8 bg-white p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-full p-1.5 text-ink-muted transition hover:bg-cream hover:text-ink"
                aria-label="Back"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h1 className="font-display text-lg font-semibold text-ink">Reported accounts</h1>
            </div>

            <p className="mb-5 text-sm text-ink-muted">
              People you've reported. Reports can't be withdrawn once submitted.
            </p>

            {loading ? (
              <p className="py-12 text-center text-sm text-ink-muted">Loading…</p>
            ) : error ? (
              <p className="py-12 text-center text-sm text-coral-700">{error}</p>
            ) : reports.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">
                Siz hech kimni report qilmagansiz.
              </p>
            ) : (
              <div className="space-y-1">
                {reports.map((r) => {
                  const fullName =
                    `${r.reportedUserFirstName ?? ''} ${r.reportedUserLastName ?? ''}`.trim() || 'User'
                  return (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-ink/6 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{fullName}</p>
                        <p className="mt-0.5 text-xs font-medium text-coral-600">{reasonLabel(r.reason)}</p>
                        {r.description && (
                          <p className="mt-1 text-xs text-ink-muted">{r.description}</p>
                        )}
                      </div>
                      <span className="flex-shrink-0 whitespace-nowrap text-[11px] text-ink-muted">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
