import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { setToken } from '../lib/auth'

// Backend's AuthResponse shape — see uz.livelingo.livelingo.response.AuthResponse
interface AuthResponse {
  jwt: string
  profileCompleted: boolean
}

// Google Identity Services types — minimal shape we need
interface GoogleCredentialResponse {
  credential: string
  select_by?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (resp: GoogleCredentialResponse) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void
        }
      }
    }
  }
}

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const btnRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  useEffect(() => {
    if (!clientId) return
    let cancelled = false

    // The GSI script is loaded async in index.html. Poll until it's ready,
    // then initialize and render the button into our container.
    const tryInit = () => {
      if (cancelled) return
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 100)
        return
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
        })
      }
    }

    tryInit()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const handleCredential = async (resp: GoogleCredentialResponse) => {
    setError(null)
    setSubmitting(true)
    try {
      // Backend expects the raw idToken as the body. apiFetch JSON-encodes
      // it (turning "abc" into `"abc"`), and the backend handles both.
      const data = await api.post<AuthResponse>('/api/auth/google', resp.credential, {
        skipAuth: true,
      })
      setToken(data.jwt)
      // Agar user ulashilgan post link'ni bosib kelgan bo'lsa
      // (PostDetail.tsx navigate('/sign-in', {state:{redirectTo}})
      // orqali yuborgan) — onboarding tugagan bo'lsa, avval o'sha
      // sahifaga qaytaramiz.  Aks holda odatdagidek dashboard/onboarding.
      const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo
      if (data.profileCompleted && redirectTo) {
        navigate(redirectTo, { replace: true })
      } else {
        navigate(data.profileCompleted ? '/dashboard' : '/onboarding', { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 400
            ? "Google said your email isn't verified yet."
            : `Sign in failed: ${err.message}`
        )
      } else {
        setError('Could not reach the server. Is the backend running?')
      }
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-cream px-5 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-coral-500/15 blur-[120px]" />
        <div className="absolute -right-20 bottom-20 h-96 w-96 rounded-full bg-indigo-500/15 blur-[120px]" />
      </div>

      <Link to="/" className="absolute left-6 top-6">
        <Logo size={32} />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-4xl border border-ink/8 bg-white p-10 shadow-card"
      >
        <h1 className="font-display text-display-md font-semibold text-ink">
          Welcome.
        </h1>
        <p className="mt-3 text-ink-soft">
          Sign in with Google to start learning. No password to remember.
        </p>

        {/* Google button container — GSI renders the official styled button
            into this div. If the client ID isn't configured we show a
            developer-facing hint so it's obvious why nothing rendered. */}
        <div className="mt-8 flex min-h-[48px] items-center justify-center">
          {clientId ? (
            <div ref={btnRef} />
          ) : (
            <div className="w-full rounded-2xl border border-coral-500/30 bg-coral-50 p-4 text-sm text-coral-600">
              <strong className="font-semibold">Setup needed:</strong> add{' '}
              <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> to your{' '}
              <code className="font-mono">.env.local</code> and restart{' '}
              <code className="font-mono">npm run dev</code>.
            </div>
          )}
        </div>

        {submitting && (
          <p className="mt-4 text-center text-sm text-ink-muted">Signing you in…</p>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-coral-500/30 bg-coral-50 p-3 text-sm text-coral-600">
            {error}
          </div>
        )}

        <div className="my-7 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-ink/8" />
          <span className="font-mono uppercase tracking-widest">No account yet?</span>
          <span className="h-px flex-1 bg-ink/8" />
        </div>

        <p className="text-center text-sm text-ink-soft">
          Your account will be created automatically the first time you sign in. We'll ask a few setup questions next.
        </p>

        <p className="mt-8 text-center text-xs text-ink-muted">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </motion.div>
    </main>
  )
}
