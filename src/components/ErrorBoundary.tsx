// Error boundary — render paytida xato bo'lса butun ilova oq ekranга
// aylanmasин, aniq xato ko'rsatilsин.
//
// Chat.tsx (yoki xohlagan sahifа) shu bilan o'raladi.

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackLabel?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // Konsolga to'liq chiqaramiz — debugging uchun
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-cream px-5">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral-50 text-coral-600">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 className="mb-2 font-display text-lg font-semibold text-ink">
              {this.props.fallbackLabel ?? 'Nimadir xato ketdi'}
            </h1>
            <p className="mb-1 text-sm text-ink-soft">
              Sahifani ko'rsatishда xatolik yuz berdi.
            </p>
            {this.state.error && (
              <pre className="mb-4 mt-3 max-h-40 overflow-auto rounded-xl bg-white p-3 text-left text-xs text-coral-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-2">
              <button
                onClick={this.reset}
                className="rounded-2xl border border-ink/12 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream"
              >
                Qayta urinish
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600"
              >
                Sahifani yangilash
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
