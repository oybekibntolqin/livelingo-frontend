import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'
import { useGeolocation } from '../hooks/useGeolocation'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'

// 30 supported languages, ISO 639-1 codes
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'uz', name: 'Oʻzbekcha', flag: '🇺🇿' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
]

// Months in English so the picker UI is consistent regardless of
// the user's browser locale (native <input type="date"> follows the
// OS language, which we can't override).
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Common countries with ISO 3166-1 alpha-2 codes — matches what the
// backend expects in countryCode. Uzbekistan + Central Asia first so
// the typical user finds themselves at the top.
const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'OTHER', name: 'Other / Not listed', flag: '🌍' },
]

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

type Step = 1 | 2 | 3

export default function Onboarding() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // ?resumeStep3=en,de — set when returning from CEFR test mid-onboarding.
  // The user has already finished steps 1+2 in the backend; we just need
  // to walk them through level-setting for the remaining learning languages.
  const resumeRaw = params.get('resumeStep3')
  const resumeLangs = resumeRaw ? resumeRaw.split(',').filter(Boolean) : []
  const isResuming = resumeLangs.length > 0

  const [step, setStep] = useState<Step>(isResuming ? 3 : 1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameTaken, setUsernameTaken] = useState(false)

  // If the user isn't signed in, kick them back to sign-in. The backend
  // would reject the onboarding endpoints with 401 anyway, this just
  // avoids showing the form to people who can't submit it.
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/sign-in', { replace: true })
    }
  }, [navigate])

  // Step 1
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // Username — unique handle, shown as @username across the app.
  // Backend should check uniqueness on submit; we only enforce format here.
  const [username, setUsername] = useState('')
  // Birth date split into three so the labels are in English regardless
  // of the user's browser language.
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  // Derive ISO date string only when all three pieces are present.
  const birthDate =
    birthDay && birthMonth && birthYear
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : ''
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('')

  // Auto-detected geolocation
  const geo = useGeolocation()

  // Location is editable so the user can override or fill in if auto-detect
  // failed. We seed these from the geo hook once it returns successfully,
  // but only if the user hasn't already typed something AND the backend
  // profile fetch (below) hasn't already supplied a real saved value.
  const [countryCode, setCountryCode] = useState('')
  const [city, setCity] = useState('')

  // Whether we've finished trying to load the user's already-saved
  // onboarding data from the backend. Geo auto-detect waits for this so
  // it never clobbers a real saved value with a guess, and so the "Back"
  // button (or reopening this page) never presents an empty form for
  // data that's already been submitted.
  const [profileLoaded, setProfileLoaded] = useState(isResuming)

  useEffect(() => {
    if (isResuming) return // steps 1+2 already done server-side, nothing to prefill
    let cancelled = false

    api
      .get<{
        firstName?: string
        lastName?: string
        username?: string
        birthDate?: string
        gender?: 'MALE' | 'FEMALE'
        countryCode?: string
        city?: string
        nativeLanguages?: string[]
        learningLanguages?: string[]
        nextStep?: 1 | 2 | 3 | null
        completed?: boolean
      }>('/api/onboarding/status')
      .then((status) => {
        if (cancelled) return

        if (status.firstName) setFirstName(status.firstName)
        if (status.lastName) setLastName(status.lastName)
        if (status.username) setUsername(status.username)
        if (status.birthDate) {
          const [y, m, d] = status.birthDate.split('-')
          setBirthYear(y)
          setBirthMonth(String(Number(m)))
          setBirthDay(String(Number(d)))
        }
        if (status.gender) setGender(status.gender)
        if (status.countryCode) setCountryCode(status.countryCode)
        if (status.city) setCity(status.city)
        if (status.nativeLanguages?.length) setNativeLangs(status.nativeLanguages)
        if (status.learningLanguages?.length) setLearningLangs(status.learningLanguages)

        // Resume wherever the backend says we left off, so returning to
        // this page (back button, refresh, closed tab) doesn't force the
        // user to redo steps they already finished.
        if (status.completed) {
          navigate('/dashboard', { replace: true })
        } else if (status.nextStep === 2 || status.nextStep === 3) {
          setStep(status.nextStep)
        }
      })
      .catch(() => {
        // Brand-new user with nothing saved yet — start fresh, no error needed.
      })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (profileLoaded && geo.countryCode && !countryCode) setCountryCode(geo.countryCode)
  }, [geo.countryCode, profileLoaded]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (profileLoaded && geo.city && !city) setCity(geo.city)
  }, [geo.city, profileLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Username format: 3–20 chars, lowercase letters / digits / underscore,
  // must start with a letter. Backend re-validates and checks uniqueness.
  const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/
  const usernameValid = USERNAME_RE.test(username)
  const usernameError =
    username.length > 0 && !usernameValid
      ? '3–20 chars, lowercase letters, digits, or underscore. Must start with a letter.'
      : null

  // Step 2 — multi-language: user can speak >1 native and learn >1 language
  const [nativeLangs, setNativeLangs] = useState<string[]>([])
  const [learningLangs, setLearningLangs] = useState<string[]>(
    isResuming ? resumeLangs : []
  )

  // Step 3
  const [levelChoice, setLevelChoice] = useState<'beginner' | 'know' | 'test' | ''>('')
  const [selectedLevel, setSelectedLevel] = useState<typeof CEFR_LEVELS[number]>('A1')
  // When user picked multiple learning languages, step 3 cycles through
  // them one at a time. levelStepIdx tracks which one we're on.
  const [levelStepIdx, setLevelStepIdx] = useState(0)

  const canProceed1 = firstName && lastName && usernameValid && birthDate && gender && countryCode && city
  // Need at least one native, one learning, and zero overlap.
  const canProceed2 =
    nativeLangs.length > 0 &&
    learningLangs.length > 0 &&
    !nativeLangs.some((n) => learningLangs.includes(n))
  const canSubmit = levelChoice !== ''

  // ── Backend submission for each step ────────────────────────────
  // The Spring controllers expect a separate POST per step. Each one
  // requires the JWT (added automatically by apiFetch). On 401 we send
  // them back to sign-in.
  const submitStep1 = async () => {
    if (!canProceed1 || submitting) return
    setError(null)
    setUsernameTaken(false)
    setSubmitting(true)
    try {
      await api.post('/api/onboarding/step1', {
        firstName,
        lastName,
        username,
        birthDate, // YYYY-MM-DD string — Spring parses to LocalDate
        gender,
        countryCode,
        timeZone: geo.timezone,
        city,
      })
      setStep(2)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          navigate('/sign-in', { replace: true })
          return
        }
        // 409 Conflict OR 400 with a "username" message — the backend
        // either dedicates a status code or includes a hint in the body.
        const looksLikeUsernameClash =
          err.status === 409 ||
          (err.status === 400 && /username/i.test(err.message))
        if (looksLikeUsernameClash) {
          setUsernameTaken(true)
        } else {
          setError(err.message)
        }
      } else {
        setError('Could not reach the server. Is the backend running?')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitStep2 = async () => {
    if (!canProceed2 || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/api/onboarding/step2', {
        nativeLanguageCodes: nativeLangs,
        learningLanguageCodes: learningLangs,
      })
      setStep(3)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to save languages.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitStep3 = async () => {
    if (!canSubmit || submitting) return
    setError(null)

    // Current language we're setting level for, and whether it's the last one.
    const currentLang = learningLangs[levelStepIdx] ?? ''
    const isLast = levelStepIdx >= learningLangs.length - 1
    // Remaining languages AFTER this one (used for test redirect queue)
    const remaining = learningLangs.slice(levelStepIdx + 1)

    // "Take the placement test" → hand off to the CEFR test page.
    // After the test the user is sent back here for the next language
    // (or to the dashboard if this was the last one).
    if (levelChoice === 'test') {
      const qs = new URLSearchParams({ onboarding: '1', lang: currentLang })
      if (remaining.length > 0) qs.set('remaining', remaining.join(','))
      navigate(`/cefr-test?${qs}`)
      return
    }

    setSubmitting(true)
    try {
      // beginner=true means start at A1; otherwise use whatever level was picked.
      await api.post('/api/onboarding/step3', {
        beginner: levelChoice === 'beginner',
        cefrLevel: levelChoice === 'know' ? selectedLevel : 'A1',
        languageCode: currentLang,
      })

      if (isLast) {
        navigate('/dashboard', { replace: true })
      } else {
        // Advance to the next language. Reset the picker so the user
        // makes a fresh choice for it.
        setLevelStepIdx(levelStepIdx + 1)
        setLevelChoice('')
        setSelectedLevel('A1')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to save your level.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen bg-cream px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-mint-500/10 blur-[120px]" />
        <div className="absolute -right-20 top-40 h-96 w-96 rounded-full bg-coral-500/10 blur-[120px]" />
      </div>

      <Link to="/" className="absolute left-6 top-6">
        <Logo size={32} />
      </Link>

      <div className="mx-auto max-w-2xl pt-16">
        {/* Backend error banner — separate from per-field errors. */}
        {error && (
          <div className="mb-6 rounded-2xl border border-coral-500/30 bg-coral-50 p-4 text-sm text-coral-600">
            {error}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-10">
          <div className="mb-3 flex items-center justify-between text-xs font-mono uppercase tracking-widest text-ink-muted">
            <span>Step {step} of 3</span>
            <span>
              {step === 1 ? 'About you' : step === 2 ? 'Languages' : 'Your level'}
            </span>
          </div>
          <div className="grid h-1.5 grid-cols-3 gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`rounded-full transition-colors duration-500 ${
                  n <= step ? 'bg-indigo-500' : 'bg-ink/8'
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-display-md font-semibold text-ink">
                Tell us about yourself.
              </h1>
              <p className="mt-3 text-ink-soft">
                We'll use this to personalize your learning journey.
              </p>

              <div className="mt-8 grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="First name">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jasur"
                      className="input"
                    />
                  </Field>
                  <Field label="Last name">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Karimov"
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="Username">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-base text-ink-muted">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        // Lowercase and strip disallowed chars as the user types,
                        // so it always looks like a valid handle.
                        setUsername(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '')
                            .slice(0, 20)
                        )
                        // Reset the "taken" flag — they're trying a new one.
                        if (usernameTaken) setUsernameTaken(false)
                      }}
                      placeholder="jasur_k"
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      className="input"
                      style={{ paddingLeft: '2rem' }}
                    />
                    {/* Subtle availability hint when format is valid */}
                    {usernameValid && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-mint-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
                        Looks good
                      </span>
                    )}
                  </div>
                  <p className={`mt-1.5 text-xs ${usernameError || usernameTaken ? 'text-coral-600' : 'text-ink-muted'}`}>
                    {usernameTaken
                      ? `@${username} is already taken. Try a different one.`
                      : usernameError ??
                        'This is how others will find you. You can change it later.'}
                  </p>
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Birth date">
                    <DatePicker
                      day={birthDay}
                      month={birthMonth}
                      year={birthYear}
                      onChange={(d, m, y) => {
                        setBirthDay(d)
                        setBirthMonth(m)
                        setBirthYear(y)
                      }}
                    />
                  </Field>
                  <Field label="Gender">
                    <div className="grid grid-cols-2 gap-2">
                      {(['MALE', 'FEMALE'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                            gender === g
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                              : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
                          }`}
                        >
                          {g === 'MALE' ? 'Male' : 'Female'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                {/* Location — editable. Pre-filled from auto-detect when
                    possible. Timezone is always reliable (Intl API),
                    so we just show it as a footnote. */}
                <div className="rounded-3xl border border-ink/8 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                      Location
                    </p>
                    {geo.loading ? (
                      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-500" />
                        Detecting…
                      </span>
                    ) : geo.error ? (
                      <span className="text-xs text-coral-600">Enter manually</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-mint-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
                        Auto-detected
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs text-ink-muted">Country</p>
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="select-soft"
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs text-ink-muted">City</p>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Tashkent"
                        className="input"
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-ink-muted">
                    Timezone:{' '}
                    <span className="font-mono text-ink-soft">{geo.timezone}</span>{' '}
                    <span className="text-ink-muted">(auto-detected)</span>
                  </p>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  onClick={submitStep1}
                  disabled={!canProceed1 || submitting}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? 'Saving…' : 'Continue'}
                  {!submitting && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-display-md font-semibold text-ink">
                Pick your languages.
              </h1>
              <p className="mt-3 text-ink-soft">
                Most people speak one native language and learn one — but if you speak more or want to study several, pick all that apply.
              </p>

              <div className="mt-8 grid gap-7">
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <p className="text-sm font-medium text-ink">I speak (native)</p>
                    {nativeLangs.length > 0 && (
                      <span className="font-mono text-[11px] text-mint-600">
                        {nativeLangs.length} selected
                      </span>
                    )}
                  </div>
                  <MultiLanguagePicker
                    values={nativeLangs}
                    onToggle={(code) => toggleInList(code, nativeLangs, setNativeLangs)}
                    disabled={learningLangs}
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <p className="text-sm font-medium text-ink">I want to learn</p>
                    {learningLangs.length > 0 && (
                      <span className="font-mono text-[11px] text-indigo-600">
                        {learningLangs.length} selected
                      </span>
                    )}
                  </div>
                  <MultiLanguagePicker
                    values={learningLangs}
                    onToggle={(code) => toggleInList(code, learningLangs, setLearningLangs)}
                    disabled={nativeLangs}
                    accent="indigo"
                  />
                </div>

                {learningLangs.length > 1 && (
                  <p className="rounded-2xl bg-sun-500/10 px-4 py-3 text-sm text-ink-soft">
                    <span className="font-medium text-ink">Heads up:</span> next
                    we'll ask your level in each of these{' '}
                    <span className="font-medium text-ink">{learningLangs.length} languages</span>,
                    one at a time. Takes about a minute total.
                  </p>
                )}
              </div>

              <div className="mt-10 flex justify-between">
                <button onClick={() => setStep(1)} disabled={submitting} className="btn-ghost">
                  Back
                </button>
                <button
                  onClick={submitStep2}
                  disabled={!canProceed2 || submitting}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {learningLangs.length > 1 && (
                <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                  Language {levelStepIdx + 1} of {learningLangs.length}
                </p>
              )}
              <h1 className="font-display text-display-md font-semibold text-ink">
                {learningLangs.length > 1 ? (
                  <>
                    Your level in{' '}
                    <span className="text-indigo-600">
                      {LANGUAGES.find((l) => l.code === learningLangs[levelStepIdx])?.name}?
                    </span>
                  </>
                ) : (
                  'Where are you at?'
                )}
              </h1>
              <p className="mt-3 text-ink-soft">
                {learningLangs.length > 1 && levelStepIdx < learningLangs.length - 1
                  ? "Be honest. We'll adjust as you go — next we'll ask about your other languages."
                  : "Be honest. We'll adjust as you go."}
              </p>

              <div className="mt-8 grid gap-3">
                <LevelOption
                  selected={levelChoice === 'beginner'}
                  onSelect={() => setLevelChoice('beginner')}
                  title="Total beginner"
                  body="I'm starting from zero. Begin at A1."
                  accent="mint"
                />
                <LevelOption
                  selected={levelChoice === 'know'}
                  onSelect={() => setLevelChoice('know')}
                  title="I know my level"
                  body="I'll pick a CEFR level myself."
                  accent="indigo"
                >
                  {levelChoice === 'know' && (
                    <div className="mt-4 grid grid-cols-6 gap-2">
                      {CEFR_LEVELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLevel(l)
                          }}
                          className={`rounded-xl border py-2 font-mono text-sm font-medium transition-all ${
                            selectedLevel === l
                              ? 'border-indigo-500 bg-indigo-500 text-cream'
                              : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </LevelOption>
                <LevelOption
                  selected={levelChoice === 'test'}
                  onSelect={() => setLevelChoice('test')}
                  title="Take the placement test"
                  body="25 questions, ~10 minutes. We'll place you precisely."
                  accent="coral"
                />
              </div>

              <div className="mt-10 flex items-center justify-between">
                {levelStepIdx === 0 && !isResuming ? (
                  <button
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="btn-ghost"
                  >
                    Back
                  </button>
                ) : (
                  // Once we've started iterating through languages,
                  // there's no clean "back" — they've already submitted
                  // the previous one to the backend.
                  <span />
                )}
                <button
                  onClick={submitStep3}
                  disabled={!canSubmit || submitting}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {(() => {
                    if (submitting) return 'Saving…'
                    if (levelChoice === 'test') return 'Take the test'
                    const isLast = levelStepIdx >= learningLangs.length - 1
                    if (!isLast) {
                      const nextLang = LANGUAGES.find(
                        (l) => l.code === learningLangs[levelStepIdx + 1]
                      )
                      return `Continue to ${nextLang?.name ?? 'next'}`
                    }
                    return 'Start learning'
                  })()}
                  {!submitting && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(20,20,43,0.10);
          background-color: white;
          padding: 0.875rem 1rem;
          font-family: inherit;
          font-size: 0.95rem;
          color: #14142B;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: #5B5FE9;
          box-shadow: 0 0 0 4px rgba(91, 95, 233, 0.12);
        }
        .input::placeholder {
          color: #8B879A;
        }
        .select-soft {
          width: 100%;
          appearance: none;
          -webkit-appearance: none;
          border-radius: 1rem;
          border: 1px solid rgba(20,20,43,0.10);
          background-color: white;
          /* Custom chevron via inline SVG, indigo-tinted */
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238B879A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.9rem center;
          padding: 0.875rem 2.25rem 0.875rem 1rem;
          font-family: inherit;
          font-size: 0.95rem;
          color: #14142B;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .select-soft:focus {
          outline: none;
          border-color: #5B5FE9;
          box-shadow: 0 0 0 4px rgba(91, 95, 233, 0.12);
        }
      `}</style>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

// Custom day/month/year picker so the labels stay in English regardless
// of the user's OS/browser locale. Native <input type="date"> picks up
// the system language for its UI strings, which we can't override.
function DatePicker({
  day,
  month,
  year,
  onChange,
}: {
  day: string
  month: string
  year: string
  onChange: (day: string, month: string, year: string) => void
}) {
  const currentYear = new Date().getFullYear()
  // Reasonable range: 100 years back to 5 years ago (no babies as users).
  const years = Array.from({ length: 95 }, (_, i) => String(currentYear - 5 - i))
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1))

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={month}
        onChange={(e) => onChange(day, e.target.value, year)}
        className="select-soft"
      >
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1)}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => onChange(e.target.value, month, year)}
        className="select-soft"
      >
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(day, month, e.target.value)}
        className="select-soft"
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

function DetectedItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-0.5 truncate font-medium text-ink ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function MultiLanguagePicker({
  values,
  onToggle,
  disabled = [],
  accent = 'mint',
}: {
  values: string[]
  onToggle: (code: string) => void
  /** Languages already chosen in the other role — rendered greyed out. */
  disabled?: string[]
  accent?: 'mint' | 'indigo'
}) {
  const accentClasses =
    accent === 'indigo'
      ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
      : 'border-mint-500 bg-mint-50 text-mint-600'

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {LANGUAGES.map((lang) => {
        const isSelected = values.includes(lang.code)
        const isDisabled = disabled.includes(lang.code)
        return (
          <button
            key={lang.code}
            type="button"
            disabled={isDisabled}
            onClick={() => onToggle(lang.code)}
            title={isDisabled ? 'Picked in the other category' : undefined}
            className={`relative flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
              isDisabled
                ? 'cursor-not-allowed border-ink/8 bg-cream-warm/60 text-ink-muted opacity-50'
                : isSelected
                ? accentClasses
                : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
            }`}
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="truncate">{lang.name}</span>
            {isSelected && (
              <span className="absolute right-2 top-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Toggle a code's presence in a list — used by both pickers.
function toggleInList(
  code: string,
  list: string[],
  setList: (next: string[]) => void
) {
  setList(list.includes(code) ? list.filter((c) => c !== code) : [...list, code])
}

function LanguagePicker({
  value,
  onChange,
  exclude,
}: {
  value: string
  onChange: (v: string) => void
  exclude?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {LANGUAGES.filter((l) => l.code !== exclude).map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => onChange(lang.code)}
          className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
            value === lang.code
              ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
              : 'border-ink/10 bg-white text-ink-soft hover:border-ink/30'
          }`}
        >
          <span className="text-lg">{lang.flag}</span>
          {lang.name}
        </button>
      ))}
    </div>
  )
}

function LevelOption({
  selected,
  onSelect,
  title,
  body,
  accent,
  children,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  body: string
  accent: 'indigo' | 'coral' | 'mint'
  children?: React.ReactNode
}) {
  const dotColor = {
    indigo: 'bg-indigo-500',
    coral: 'bg-coral-500',
    mint: 'bg-mint-500',
  }[accent]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-5 text-left transition-all ${
        selected
          ? 'border-ink/30 bg-white shadow-soft'
          : 'border-ink/10 bg-white hover:border-ink/20'
      }`}
    >
      <div className="flex items-start gap-4">
        <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${selected ? dotColor : 'bg-ink/10'}`} />
        <div className="flex-1">
          <p className="font-display text-lg font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm text-ink-soft">{body}</p>
          {children}
        </div>
      </div>
    </button>
  )
}
