// Umumiy Admin Guard — barcha /admin/** sahifalarida bir xil
// himoya zanjirini ta'minlaydi:
//   1. ADMIN/OWNER roli tekshiriladi (bo'lmasa — chiroyli soxta-404)
//   2. Admin Panel paroli tekshiriladi/so'raladi (session token)
//   3. Ikkalasi ham o'tsa — children render qilinadi
//
// MUHIM: avval bu logika FAQAT AdminPanel.tsx'да edi —
// AdminCefrGeneration.tsx kabi boshqa admin sahifalarida yo'q edi.
// Natijada: sessiya tugagan/hali tasdiqlanmagan holatda boshqa
// admin sahifasiga o'tilsa — backend'дan xom "Admin panel session
// required" xato xabari ko'rinardi, parol so'rash ekrani
// chiqmasdi. Endi BARCHA admin sahifalari shu bitta komponentga
// o'ralib, bir xil, izchil himoyaga ega.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getCurrentUser, canGenerateWithAi, type CurrentUser } from '../../lib/user'
import {
  adminAuthApi,
  getAdminSessionToken,
  setAdminSessionToken,
} from '../../lib/adminAuth'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/sign-in', { replace: true }))
      .finally(() => setChecking(false))
  }, [navigate])

  const [pwPhase, setPwPhase] = useState<'checking' | 'set' | 'verify' | 'unlocked'>('checking')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  useEffect(() => {
    if (checking || !canGenerateWithAi(user)) return

    if (getAdminSessionToken()) {
      setPwPhase('unlocked')
      return
    }

    adminAuthApi
      .status()
      .then((s) => setPwPhase(s.hasPassword ? 'verify' : 'set'))
      .catch(() => setPwPhase('verify'))
  }, [checking, user])

  // Boshqa admin sahifasidan (masalan Content Generation'даgi
  // 403 tutqichi) "qayta tasdiqlash kerak" signali kelsa — shu
  // sahifada ham parol darvozasi qayta ko'rsatiladi.
  useEffect(() => {
    const handler = () => setPwPhase((p) => (p === 'unlocked' ? 'verify' : p))
    window.addEventListener('admin-session-expired', handler)
    return () => window.removeEventListener('admin-session-expired', handler)
  }, [])

  const handleSetPassword = async (password: string, confirm: string) => {
    setPwError(null)
    if (password.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setPwError('Passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      const { sessionToken } = await adminAuthApi.setPassword(password)
      setAdminSessionToken(sessionToken)
      setPwPhase('unlocked')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Could not set password.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleVerifyPassword = async (password: string) => {
    setPwError(null)
    setPwLoading(true)
    try {
      const { sessionToken } = await adminAuthApi.verifyPassword(password)
      setAdminSessionToken(sessionToken)
      setPwPhase('unlocked')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Incorrect password.')
    } finally {
      setPwLoading(false)
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Checking access…</p>
      </main>
    )
  }

  // Ataylab oddiy "ruxsat yo'q" emas — chiroyli, animatsiyali
  // "404 — sahifa topilmadi". Admin Panel mavjudligi oshkor
  // bo'lmasligi uchun.
  if (!canGenerateWithAi(user)) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-indigo-500/8 blur-[130px]" />
          <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-coral-500/8 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <motion.p
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="font-display text-8xl font-bold text-indigo-500/15 sm:text-9xl"
          >
            404
          </motion.p>
          <h1 className="-mt-6 font-display text-2xl font-bold text-ink sm:text-3xl">
            This page doesn't exist
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">
            The link you followed may be broken, or the page may have
            been moved.
          </p>
        </motion.div>
      </main>
    )
  }

  if (pwPhase === 'checking') {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  if (pwPhase === 'set' || pwPhase === 'verify') {
    return (
      <AdminPasswordGate
        mode={pwPhase}
        loading={pwLoading}
        error={pwError}
        onSet={handleSetPassword}
        onVerify={handleVerifyPassword}
      />
    )
  }

  return <>{children}</>
}

function AdminPasswordGate({
  mode,
  loading,
  error,
  onSet,
  onVerify,
}: {
  mode: 'set' | 'verify'
  loading: boolean
  error: string | null
  onSet: (password: string, confirm: string) => void
  onVerify: (password: string) => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'set') onSet(password, confirm)
    else onVerify(password)
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-indigo-500/8 blur-[130px]" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-coral-500/8 blur-[120px]" />
      </div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-3xl border border-ink/8 bg-white p-7 shadow-lg"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </div>

        <h1 className="mb-1 text-center font-display text-lg font-bold text-ink">
          {mode === 'set' ? 'Set your Admin Panel password' : 'Enter your Admin Panel password'}
        </h1>
        <p className="mb-5 text-center text-xs text-ink-muted">
          {mode === 'set'
            ? 'This is separate from your login — it protects the Admin Panel specifically.'
            : 'This session lasts 4 hours.'}
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-ink/10 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
          />
        </label>

        {mode === 'set' && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-ink/10 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>
        )}

        {error && <p className="mb-3 text-xs text-coral-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Please wait…' : mode === 'set' ? 'Set password' : 'Unlock'}
        </button>
      </motion.form>
    </main>
  )
}
