// EditProfile — o'z profilingizni tahrirlash, ALOHIDA SAHIFA sifatida
// (avvalgi popup/modal o'rniga). Profil > Settings > Edit profile
// orqali ochiladi.
//
// Maydonlar: First name, Last name, Username, Bio, Gender,
// Birth date (kun/oy/yil — alohida select'lar).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardNav, Sidebar, MobileNav } from '../components/AppShell'
import Avatar from '../components/Avatar'
import LanguagesEditor from './LanguagesEditor'
import { isAuthenticated } from '../lib/auth'
import { profileApi, type Gender, type UserProfile } from '../lib/profileApi'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(month: number, year: number) {
  // month: 1-12. year=0 (tanlanmagan) bo'lsa 31 kunlik oy sifatida hisoblaymiz.
  if (!year) return new Date(2001, month, 0).getDate()
  return new Date(year, month, 0).getDate()
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => CURRENT_YEAR - i)

export default function EditProfile() {
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
        if (cancelled) return
        setProfile(p)
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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [day, setDay] = useState(0)
  const [month, setMonth] = useState(0) // 1-12, 0 = tanlanmagan
  const [year, setYear] = useState(0)

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.firstName ?? '')
    setLastName(profile.lastName ?? '')
    setUsername(profile.username ?? '')
    setBio(profile.bio ?? '')
    setGender(profile.gender ?? '')
    if (profile.birthDate) {
      const [y, m, d] = profile.birthDate.split('-').map(Number)
      setYear(y || 0)
      setMonth(m || 0)
      setDay(d || 0)
    }
  }, [profile])

  const maxDay = useMemo(() => daysInMonth(month || 1, year), [month, year])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      const birthDate =
        day && month && year
          ? `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
              .toString()
              .padStart(2, '0')}`
          : undefined

      const updated = await profileApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim() || undefined,
        bio: bio.trim(),
        gender: gender || undefined,
        birthDate,
      })
      setProfile(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlanmadi. Qayta urinib ko'ring.")
    } finally {
      setSubmitting(false)
    }
  }

  const openCompose = () => navigate('/dashboard', { state: { openCompose: true } })

  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[240px_1fr] lg:pb-16">
        <Sidebar onCreatePost={openCompose} />
        <MobileNav onCreatePost={openCompose} />

        <main className="min-w-0">
          <div className="mx-auto max-w-xl rounded-4xl border border-ink/8 bg-white p-6 sm:p-8">
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
              <h1 className="font-display text-lg font-semibold text-ink">Edit profile</h1>
            </div>

            {loading ? (
              <p className="py-16 text-center text-sm text-ink-muted">Loading…</p>
            ) : loadError || !profile ? (
              <p className="py-16 text-center text-sm text-coral-700">{loadError ?? 'Profil topilmadi.'}</p>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-1.5">
                  <Avatar url={profile.profilePhotoUrl} size={80} />
                  <p className="text-[11px] text-ink-muted">
                    Rasmni o'zgartirish uchun profildagi avatarni bosing
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-soft">First name</span>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={submitting}
                      className="rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-soft">Last name</span>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={submitting}
                      className="rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Username</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    disabled={submitting}
                    className="rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    disabled={submitting}
                    placeholder="Ixtiyoriy — link ham qo'shishingiz mumkin (https://...)"
                    className="resize-none rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Gender</span>
                  <div className="flex gap-2">
                    {(['MALE', 'FEMALE'] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        disabled={submitting}
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                          gender === g
                            ? 'border-indigo-500/40 bg-indigo-50 text-indigo-700'
                            : 'border-ink/12 bg-cream text-ink-soft hover:border-indigo-500/30'
                        }`}
                      >
                        {g === 'MALE' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Birth date</span>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={day}
                      onChange={(e) => setDay(Number(e.target.value))}
                      disabled={submitting}
                      className="rounded-xl border border-ink/12 bg-cream px-2 py-2 text-sm text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                    >
                      <option value={0}>Day</option>
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      disabled={submitting}
                      className="rounded-xl border border-ink/12 bg-cream px-2 py-2 text-sm text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                    >
                      <option value={0}>Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      disabled={submitting}
                      className="rounded-xl border border-ink/12 bg-cream px-2 py-2 text-sm text-ink outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                    >
                      <option value={0}>Year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Languages</span>
                  <LanguagesEditor />
                </div>

                {error && <p className="text-sm text-coral-700">{error}</p>}
                {saved && !error && <p className="text-sm text-mint-600">Saqlandi.</p>}

                <div className="flex items-center justify-end gap-2 border-t border-ink/6 pt-5">
                  <button
                    onClick={() => navigate(-1)}
                    disabled={submitting}
                    className="rounded-2xl px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-cream disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
