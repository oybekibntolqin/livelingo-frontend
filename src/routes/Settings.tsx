// Settings — foydalanuvchining shaxsiy sozlamalari sahifasi.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardNav, Sidebar, MobileNav, performLogout } from '../components/AppShell'
import { isAuthenticated } from '../lib/auth'
import { revokeAllSessions } from '../lib/api'
import { profileApi, type UserProfile } from '../lib/profileApi'

export default function Settings() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) navigate('/sign-in', { replace: true })
  }, [navigate])

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    profileApi
        .getMyProfile()
        .then((p) => {
          if (!cancelled) setProfile(p)
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Profil yuklanmadi.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    return () => {
      cancelled = true
    }
  }, [])

  const [togglingPrivacy, setTogglingPrivacy] = useState(false)
  const [privacyError, setPrivacyError] = useState<string | null>(null)

  const togglePrivacy = async () => {
    if (!profile) return
    const next = !profile.showOnlineStatus
    setTogglingPrivacy(true)
    setPrivacyError(null)
    setProfile({ ...profile, showOnlineStatus: next })
    try {
      const updated = await profileApi.updatePrivacy(next)
      setProfile(updated)
    } catch (err) {
      setProfile((prev) => (prev ? { ...prev, showOnlineStatus: !next } : prev))
      setPrivacyError(err instanceof Error ? err.message : "Saqlanmadi. Qayta urinib ko'ring.")
    } finally {
      setTogglingPrivacy(false)
    }
  }

  const [confirmingLogout, setConfirmingLogout] = useState(false)

  // "Barcha qurilmalardan chiqish" — token o'g'irlanganidan
  // shubhalansangiz shu tugmani bosing: bu serverdagi BARCHA
  // refresh-token yozuvlarini bekor qiladi, shuning uchun boshqa
  // brauzer/qurilmalarda (hattoki hozir ochiq bo'lsa ham) keyingi
  // access token muddati tugashi bilan avtomatik chiqib ketiladi.
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false)
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null)

  const handleLogoutAll = async () => {
    setLoggingOutAll(true)
    setLogoutAllError(null)
    try {
      await revokeAllSessions()
      performLogout(navigate)
    } catch (err) {
      setLogoutAllError(err instanceof Error ? err.message : "Bajarilmadi. Qayta urinib ko'ring.")
      setLoggingOutAll(false)
    }
  }

  // Escape bosilganda modalni yopish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmingLogout(false)
    }
    if (confirmingLogout) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmingLogout])

  return (
      <div className="min-h-screen bg-cream">
        <DashboardNav />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
          <Sidebar onCreatePost={() => navigate('/dashboard', { state: { openCompose: true } })} />
          <MobileNav onCreatePost={() => navigate('/dashboard', { state: { openCompose: true } })} />

          <main className="min-w-0">
            <div className="mx-auto max-w-xl rounded-3xl border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
              {/* Sarlavha */}
              <div className="mb-6 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 text-ink-muted transition-all duration-200 hover:bg-ink/10 hover:text-ink active:scale-95"
                    aria-label="Back"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">Settings</h1>
              </div>

              {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-3 text-sm text-ink-muted">Yuklanmoqda…</p>
                  </div>
              ) : loadError || !profile ? (
                  <div className="rounded-2xl border border-coral-200 bg-coral-50/50 p-4 text-center">
                    <p className="text-sm font-medium text-coral-700">{loadError ?? 'Profil topilmadi.'}</p>
                  </div>
              ) : (
                  <div className="space-y-6">
                    {/* ── Privacy ── */}
                    <section>
                      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Privacy
                      </h2>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink/8 bg-cream/40 p-4.5 transition-colors hover:bg-cream/70">
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-semibold text-ink">Show when I'm online</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                            {profile.showOnlineStatus
                                ? "Boshqalar sizning aniq online/offline holatingizni ko'radi."
                                : 'Boshqalar aniq holatni ko\'rmaydi — o\'rniga "last seen recently" ko\'rsatiladi.'}
                          </p>
                        </div>

                        <button
                            type="button"
                            role="switch"
                            aria-checked={profile.showOnlineStatus}
                            onClick={togglePrivacy}
                            disabled={togglingPrivacy}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                profile.showOnlineStatus ? 'bg-indigo-600' : 'bg-ink/15'
                            }`}
                        >
                      <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              profile.showOnlineStatus ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                        </button>
                      </div>

                      {privacyError && <p className="mt-2 text-xs font-medium text-coral-600">{privacyError}</p>}
                    </section>

                    {/* ── Account ── */}
                    <section>
                      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Account
                      </h2>

                      <button
                          type="button"
                          onClick={() => navigate('/profile/edit')}
                          className="group flex w-full items-center justify-between rounded-2xl border border-ink/8 bg-cream/40 p-4.5 text-left transition-all duration-200 hover:bg-cream/80 hover:shadow-xs active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 text-ink transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-ink">Edit profile</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </section>

                    {/* ── Log out ── */}
                    <section className="border-t border-ink/8 pt-5">
                      <button
                          type="button"
                          onClick={() => setConfirmingLogout(true)}
                          className="group flex w-full items-center justify-between rounded-2xl border border-coral-200/70 bg-coral-50/40 p-4 text-left transition-all duration-200 hover:border-coral-300 hover:bg-coral-50 hover:shadow-xs active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-100/80 text-coral-600 transition-colors group-hover:bg-coral-600 group-hover:text-white">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                              <path d="M16 17l5-5-5-5" />
                              <path d="M21 12H9" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-coral-700">Log out</p>
                            <p className="text-xs text-coral-600/70">Hisobingizdan xavfsiz chiqish</p>
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-coral-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-coral-600">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>

                      {/* ── Log out of ALL devices ── */}
                      <button
                          type="button"
                          onClick={() => setConfirmingLogoutAll(true)}
                          className="group mt-2.5 flex w-full items-center justify-between rounded-2xl border border-ink/8 bg-cream/40 p-4 text-left transition-all duration-200 hover:bg-cream/80 hover:shadow-xs active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 text-ink transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 1v6m0 6v6" />
                              <path d="M4.22 4.22l4.24 4.24m6.36 6.36l4.24 4.24" />
                              <path d="M1 12h6m6 0h6" />
                              <path d="M4.22 19.78l4.24-4.24m6.36-6.36l4.24-4.24" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">Log out of all devices</p>
                            <p className="text-xs text-ink-muted">Boshqa qurilmalardagi barcha sessiyalarni tugatadi</p>
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                      {logoutAllError && <p className="mt-2 text-xs font-medium text-coral-600">{logoutAllError}</p>}
                    </section>
                  </div>
              )}
            </div>
          </main>
        </div>

        {/* ── Modern Logout Confirmation Modal ── */}
        {confirmingLogout && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
            >
              {/* Backdrop (xiralashtirilgan fon) */}
              <div
                  className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                  onClick={() => setConfirmingLogout(false)}
              />

              {/* Modal Container */}
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-ink/8 bg-white p-6 shadow-2xl shadow-ink/15 transition-all animate-in zoom-in-95 duration-200">
                {/* Modal Icon */}
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-50 ring-8 ring-coral-50/50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-coral-600">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </div>

                {/* Matnlar */}
                <div className="mt-4 text-center">
                  <h3 className="font-display text-lg font-bold text-ink">
                    Hisobdan chiqmoqchimisiz?
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    Qayta kirish uchun hisob ma'lumotlaringizni qaytadan kiritishingiz talab etiladi.
                  </p>
                </div>

                {/* Tugmalar */}
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <button
                      type="button"
                      onClick={() => setConfirmingLogout(false)}
                      className="w-full rounded-xl border border-ink/10 bg-cream/40 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream/80 active:scale-[0.98]"
                  >
                    Bekor qilish
                  </button>
                  <button
                      type="button"
                      onClick={() => performLogout(navigate)}
                      className="w-full rounded-xl bg-coral-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-coral-600/30 transition-all hover:bg-coral-700 active:scale-[0.98]"
                  >
                    Ha, chiqish
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* ── "Log out of all devices" Confirmation Modal ── */}
        {confirmingLogoutAll && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
            >
              <div
                  className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                  onClick={() => (loggingOutAll ? undefined : setConfirmingLogoutAll(false))}
              />

              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-ink/8 bg-white p-6 shadow-2xl shadow-ink/15 transition-all animate-in zoom-in-95 duration-200">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 ring-8 ring-indigo-50/50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <path d="M12 1v6m0 6v6" />
                    <path d="M4.22 4.22l4.24 4.24m6.36 6.36l4.24 4.24" />
                    <path d="M1 12h6m6 0h6" />
                    <path d="M4.22 19.78l4.24-4.24m6.36-6.36l4.24-4.24" />
                  </svg>
                </div>

                <div className="mt-4 text-center">
                  <h3 className="font-display text-lg font-bold text-ink">
                    Barcha qurilmalardan chiqmoqchimisiz?
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    Boshqa telefon/brauzerlardagi barcha faol sessiyalar tugatiladi va bu qurilmadan ham chiqasiz. Har birida qayta login qilishingiz kerak bo'ladi.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <button
                      type="button"
                      onClick={() => setConfirmingLogoutAll(false)}
                      disabled={loggingOutAll}
                      className="w-full rounded-xl border border-ink/10 bg-cream/40 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream/80 active:scale-[0.98] disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                  <button
                      type="button"
                      onClick={handleLogoutAll}
                      disabled={loggingOutAll}
                      className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loggingOutAll ? 'Bajarilmoqda…' : 'Ha, hammasidan chiqish'}
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  )
}