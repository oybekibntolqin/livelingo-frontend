import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import {motion, AnimatePresence} from 'framer-motion'
import Logo from '../components/Logo'
import Flashcard3D from '../components/Flashcard3D'

// ─────────────────────────────────────────────────────────────────
// Multilingual greeting rotator — sits above the headline.
// The whole point of LiveLingo is languages, so make the brand
// promise itself speak in multiple languages on load.
// ─────────────────────────────────────────────────────────────────
const GREETINGS = [
    {word: 'Hello', lang: 'English'},
    {word: 'Salom', lang: "O'zbekcha"},
    {word: '안녕', lang: '한국어'},
    {word: 'Hola', lang: 'Español'},
    {word: 'Hallo', lang: 'Deutsch'},
    {word: 'Bonjour', lang: 'Français'},
    {word: 'こんにちは', lang: '日本語'},
    {word: 'مرحبا', lang: 'العربية'},
]

function GreetingRotator() {
    const [i, setI] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setI((x) => (x + 1) % GREETINGS.length), 1800)
        return () => clearInterval(t)
    }, [])
    return (
        <div className="relative inline-flex h-10 items-center overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.span
                    key={GREETINGS[i].word}
                    initial={{y: 20, opacity: 0}}
                    animate={{y: 0, opacity: 1}}
                    exit={{y: -20, opacity: 0}}
                    transition={{duration: 0.4, ease: 'easeOut'}}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/80 px-3 py-1.5 text-sm font-medium backdrop-blur-sm"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-coral-500 animate-pulse-dot"/>
                    <span className="text-ink">{GREETINGS[i].word}</span>
                    <span className="text-ink-muted">— {GREETINGS[i].lang}</span>
                </motion.span>
            </AnimatePresence>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// Scroll-to-section link. Plain <a href="#id"> doesn't work here
// because HashRouter intercepts the hash change and tries to route,
// so we cancel the default and scroll programmatically.
// ─────────────────────────────────────────────────────────────────
function ScrollLink({
                        id,
                        children,
                        className,
                    }: {
    id: string
    children: React.ReactNode
    className?: string
}) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'})
    }
    return (
        <a href={`#${id}`} onClick={handleClick} className={className}>
            {children}
        </a>
    )
}

// ─────────────────────────────────────────────────────────────────
// Copyable email link — mailto: alone is unreliable because it
// depends on the visitor's OS/browser having a default mail client
// configured. Clicking now ALSO copies the address to the clipboard
// and shows a brief "Copied!" confirmation, so the address is
// always usable even when no mail handler is set up. mailto: is
// still attempted underneath (via href) for visitors who do have
// one configured — this is additive, not a replacement.
// ─────────────────────────────────────────────────────────────────
function CopyableEmail({
                            email,
                            className,
                            children,
                        }: {
    email: string
    className?: string
    children: React.ReactNode
}) {
    const [copied, setCopied] = useState(false)

    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        try {
            await navigator.clipboard.writeText(email)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard API blocked/unavailable — fall back to letting
            // the browser attempt the mailto: handler directly.
            window.location.href = `mailto:${email}`
        }
    }

    return (
        <a href={`mailto:${email}`} onClick={handleClick} className={className}>
            {children}
            <AnimatePresence>
                {copied && (
                    <motion.span
                        initial={{opacity: 0, y: 4}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: 4}}
                        transition={{duration: 0.2}}
                        className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-mint-600"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Nusxalandi!
                    </motion.span>
                )}
            </AnimatePresence>
        </a>
    )
}

// ─────────────────────────────────────────────────────────────────
// Navbar — sticky, glass effect on scroll
// ─────────────────────────────────────────────────────────────────
function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12)
        window.addEventListener('scroll', onScroll, {passive: true})
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const navLinks = [
        {id: 'features', label: 'Features'},
        {id: 'how', label: 'How it works'},
        {id: 'about', label: 'About'},
        {id: 'support', label: 'Support'},
    ]

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled ? 'py-2' : 'py-4'
            }`}
        >
            <div className="container-x">
                <nav
                    className={`flex items-center justify-between rounded-full px-4 py-2.5 transition-all duration-300 ${
                        scrolled
                            ? 'border border-ink/8 bg-white/85 shadow-soft backdrop-blur-xl'
                            : 'border border-transparent bg-transparent'
                    }`}
                >

                    <Link
                        to="/" aria-label="LiveLingo home"
                        onClick={() => {
                            if (window.location.pathname === "/") {
                                window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                });
                            }
                        }}
                    >
                        <Logo size={32}/>
                    </Link>

                    <div className="hidden items-center gap-7 md:flex">
                        <ScrollLink id="features"
                                    className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
                            Features
                        </ScrollLink>
                        <ScrollLink id="how"
                                    className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
                            How it works
                        </ScrollLink>
                        <ScrollLink id="about"
                                    className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
                            About
                        </ScrollLink>
                        <ScrollLink id="support"
                                    className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
                            Support
                        </ScrollLink>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link to="/sign-in"
                              className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:block">
                            Sign in
                        </Link>
                        <Link
                            to="/sign-in"
                            className="btn-primary !py-2 !px-4 text-sm"
                        >
                            Get started
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2"
                                      strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </Link>

                        {/* Hamburger — faqat md dan pastda, chunki bo'lim
                            havolalari (Features/How/About/Support) shu
                            breakpoint'da yashiriladi. */}
                        <button
                            type="button"
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-label="Toggle menu"
                            aria-expanded={menuOpen}
                            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-warm hover:text-ink md:hidden"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {menuOpen ? (
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                ) : (
                                    <path d="M3 6h18M3 12h18M3 18h18"/>
                                )}
                            </svg>
                        </button>
                    </div>
                </nav>

                {/* Mobil bo'lim havolalari — md dan pastda hamburger bosilganda ochiladi */}
                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{opacity: 0, y: -8}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -8}}
                            transition={{duration: 0.15}}
                            className="mt-2 flex flex-col gap-1 rounded-3xl border border-ink/8 bg-white/95 p-3 shadow-soft backdrop-blur-xl md:hidden"
                        >
                            {navLinks.map((link) => (
                                <a
                                    key={link.id}
                                    href={`#${link.id}`}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setMenuOpen(false)
                                        document.getElementById(link.id)?.scrollIntoView({behavior: 'smooth', block: 'start'})
                                    }}
                                    className="rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-cream-warm hover:text-ink"
                                >
                                    {link.label}
                                </a>
                            ))}
                            <Link
                                to="/sign-in"
                                onClick={() => setMenuOpen(false)}
                                className="rounded-2xl px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-cream-warm hover:text-ink sm:hidden"
                            >
                                Sign in
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </header>
    )
}

// ─────────────────────────────────────────────────────────────────
// Hero — multilingual headline + animated product card stack
// ─────────────────────────────────────────────────────────────────
function Hero() {
    return (
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
            {/* Soft background blobs */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-coral-500/15 blur-[120px]"/>
                <div className="absolute -right-24 top-40 h-96 w-96 rounded-full bg-indigo-500/15 blur-[120px]"/>
                <div className="absolute left-1/3 bottom-0 h-80 w-80 rounded-full bg-mint-500/10 blur-[100px]"/>
            </div>

            <div className="container-x">
                <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
                    {/* Left: Copy */}
                    <div>
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.6}}
                            className="mb-6"
                        >
                            <GreetingRotator/>
                        </motion.div>

                        <motion.h1
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.6, delay: 0.1}}
                            className="font-display text-display-xl font-semibold text-ink"
                        >
                            Learn languages
                            <br/>
                            with{' '}
                            <span className="relative inline-block">
                real people
                <svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 300 12"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                  <path
                      d="M3 9 Q 75 1, 150 6 T 297 4"
                      stroke="#FF8A65"
                      strokeWidth="4"
                      strokeLinecap="round"
                      fill="none"
                  />
                </svg>
              </span>
                            .
                        </motion.h1>

                        <motion.p
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.6, delay: 0.2}}
                            className="mt-7 max-w-lg text-lg text-ink-soft sm:text-xl"
                        >
                            CEFR-graded lessons, live chat with native speakers, video calls,
                            and AI feedback that's honest about your mistakes. 15+ languages.
                        </motion.p>

                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.6, delay: 0.3}}
                            className="mt-9 flex flex-wrap items-center gap-3"
                        >
                            <Link to="/sign-in" className="btn-primary">
                                Start learning — it's free
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2"
                                          strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </Link>
                            <ScrollLink id="how" className="btn-ghost">
                                See how it works
                            </ScrollLink>
                        </motion.div>

                        {/* Trust strip */}
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            transition={{duration: 0.6, delay: 0.5}}
                            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-muted"
                        >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-500"/>
                CEFR A1 → C2
              </span>
                            <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-coral-500"/>
                Verified teachers
              </span>
                            <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sun-500"/>
                AI feedback that won't lie to you
              </span>
                        </motion.div>
                    </div>

                    {/* Right: Card stack — product showcase */}
                    <HeroCardStack/>
                </div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────────
// Hero card stack — the "deck of features", fans out in 3D space.
// Each card represents one product surface (flashcard, chat,
// exercise, video call). The flashcard one flips for real.
// ─────────────────────────────────────────────────────────────────
function HeroCardStack() {
    return (
        <motion.div
            initial={{opacity: 0, scale: 0.92}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.8, delay: 0.3, ease: 'easeOut'}}
            className="relative mx-auto h-[480px] w-full max-w-[440px] sm:h-[560px]"
        >
            {/* Exercise card — back left */}
            <motion.div
                animate={{y: [0, -8, 0]}}
                transition={{duration: 6, repeat: Infinity, ease: 'easeInOut'}}
                className="absolute left-0 top-8 w-[220px] -rotate-[8deg] rounded-3xl border border-ink/8 bg-white p-5 shadow-card sm:w-[240px]"
            >
                <div className="mb-4 flex items-center justify-between">
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-sun-500"/>
            Exercise
          </span>
                    <span className="pill">+10 XP</span>
                </div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-muted">
                    Fill in the blank
                </p>
                <p className="font-display text-lg leading-snug text-ink">
                    She <span className="rounded bg-mint-500/20 px-1.5 py-0.5 text-mint-600">___</span> to the market
                    every Sunday.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <span
                        className="rounded-lg border border-ink/10 bg-cream-warm px-2 py-1.5 text-center text-ink-soft">go</span>
                    <span
                        className="rounded-lg border-2 border-mint-500 bg-mint-50 px-2 py-1.5 text-center font-medium text-mint-600">goes</span>
                </div>
            </motion.div>

            {/* Chat card — back right */}
            <motion.div
                animate={{y: [0, -10, 0]}}
                transition={{duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8}}
                className="absolute right-0 top-4 w-[210px] rotate-[7deg] rounded-3xl border border-ink/8 bg-white p-5 shadow-card sm:w-[230px]"
            >
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="grid h-8 w-8 place-items-center rounded-full bg-coral-500 text-xs font-semibold text-white">
                            MK
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-ink">Min-jun</p>
                            <p className="text-[10px] text-ink-muted">🇰🇷 → English C1</p>
                        </div>
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-mint-500 animate-pulse-dot"/>
                </div>
                <div className="space-y-2">
                    <div className="rounded-2xl rounded-tl-sm bg-cream-warm px-3 py-2 text-xs text-ink">
                        Hey! Want to practice today?
                    </div>
                    <div className="ml-6 rounded-2xl rounded-tr-sm bg-indigo-500 px-3 py-2 text-xs text-cream">
                        Yes! Same topic as Tuesday? ✓✓
                    </div>
                    <div className="flex items-center gap-1 px-2 text-[10px] text-ink-muted">
                        <span className="h-1 w-1 rounded-full bg-ink-muted animate-pulse"/>
                        typing…
                    </div>
                </div>
            </motion.div>

            {/* Video call card — middle bottom */}
            <motion.div
                animate={{y: [0, -6, 0]}}
                transition={{duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.2}}
                className="absolute bottom-0 left-1/2 w-[230px] -translate-x-1/2 rotate-[3deg] rounded-3xl border border-ink/8 bg-ink p-4 shadow-card sm:w-[260px]"
            >
                <div
                    className="relative mb-3 aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-coral-500">
                    <div
                        className="absolute bottom-2 right-2 h-12 w-16 rounded-lg border-2 border-cream/20 bg-mint-500/80"/>
                    <div
                        className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-ink/40 px-2 py-1 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-coral-400 animate-pulse-dot"/>
                        <span className="font-mono text-[10px] font-medium text-cream">LIVE · 04:21</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-cream">Practice session</p>
                        <p className="text-[10px] text-cream/60">English · Native partner</p>
                    </div>
                    <div className="flex gap-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-cream/10 text-cream">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path
                  d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z"/></svg>
            </span>
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-coral-500 text-cream">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path
                  d="M3 21l18-18M3 3l18 18"/></svg>
            </span>
                    </div>
                </div>
            </motion.div>

            {/* Flashcard — front center, flips for real */}
            <div className="absolute left-1/2 top-1/2 z-10 w-[260px] -translate-x-1/2 -translate-y-1/2 sm:w-[300px]">
                <div className="h-[300px]">
                    <Flashcard3D
                        front={{
                            word: 'Saodat',
                            language: "O'zbekcha",
                            pronunciation: '/saʔɒdat/',
                        }}
                        back={{
                            translation: 'Happiness',
                            example: 'Saodat — bu eng kichik narsalardan zavqlanish.',
                            exampleTranslation: 'Happiness is enjoying the smallest things.',
                        }}
                        level="B1"
                        accent="indigo"
                    />
                </div>
            </div>
        </motion.div>
    )
}

// ─────────────────────────────────────────────────────────────────
// Features grid — six cards, each anchored to one product surface.
// Asymmetric grid (some span 2 cols) gives the page rhythm.
// ─────────────────────────────────────────────────────────────────
const FEATURES = [
    {
        title: 'AI-generated CEFR content',
        body: 'Reading, writing, and listening materials tuned to your exact level — A1 through C2, refreshed every year.',
        accent: 'indigo',
        span: 2,
        visual: 'ai',
    },
    {
        title: 'Real-time chat',
        body: 'WebSocket-backed. See typing, delivery, and seen ticks.',
        accent: 'coral',
        span: 1,
        visual: 'chat',
    },
    {
        title: 'Video calls',
        body: 'Peer-to-peer via WebRTC. Speak today, not someday.',
        accent: 'mint',
        span: 1,
        visual: 'call',
    },
    {
        title: '3D flashcards',
        body: 'Spaced repetition that actually feels like cards.',
        accent: 'sun',
        span: 1,
        visual: 'card',
    },
    {
        title: 'Social feed',
        body: 'Posts, likes, comments, follows. Learning is more fun with people.',
        accent: 'coral',
        span: 1,
        visual: 'social',
    },
    {
        title: 'Honest analytics',
        body: 'XP, streaks, time-on-task, accuracy — no vanity metrics, just signal.',
        accent: 'indigo',
        span: 2,
        visual: 'analytics',
    },
] as const

const accentMap: Record<string, { bg: string; text: string; dot: string }> = {
    indigo: {bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500'},
    coral: {bg: 'bg-coral-50', text: 'text-coral-600', dot: 'bg-coral-500'},
    mint: {bg: 'bg-mint-50', text: 'text-mint-600', dot: 'bg-mint-500'},
    sun: {bg: 'bg-sun-50', text: 'text-sun-600', dot: 'bg-sun-500'},
}

function Features() {
    return (
        <section id="features" className="relative py-24 sm:py-32">
            <div className="container-x">
                <div className="mb-14 max-w-2xl">
                    <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                        What's inside
                    </p>
                    <h2 className="font-display text-display-lg font-semibold text-ink">
                        Every tool you need,
                        <br/>
                        in one place.
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {FEATURES.map((f, i) => {
                        const colors = accentMap[f.accent]
                        return (
                            <motion.div
                                key={f.title}
                                initial={{opacity: 0, y: 30}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true, margin: '-80px'}}
                                transition={{duration: 0.5, delay: i * 0.05}}
                                className={`group relative overflow-hidden rounded-4xl border border-ink/8 bg-white p-7 transition-shadow hover:shadow-card ${
                                    f.span === 2 ? 'md:col-span-2' : ''
                                }`}
                            >
                                <div
                                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${colors.bg} ${colors.text}`}>
                                    <FeatureIcon kind={f.visual}/>
                                </div>
                                <h3 className="mb-2 font-display text-2xl font-semibold tracking-tight text-ink">
                                    {f.title}
                                </h3>
                                <p className="max-w-md text-ink-soft">{f.body}</p>

                                {/* Subtle accent line that grows on hover */}
                                <span
                                    className={`absolute bottom-0 left-7 right-7 h-px ${colors.dot} origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100`}
                                />
                            </motion.div>
                        )
                    })}
                </div>

                {/* Languages strip */}
                <div className="mt-12 overflow-hidden rounded-4xl border border-ink/8 bg-ink p-8 sm:p-10">
                    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                        <div>
                            <p className="font-mono text-xs font-medium uppercase tracking-widest text-cream/50">
                                Languages
                            </p>
                            <p className="mt-1 font-display text-3xl font-semibold text-cream sm:text-4xl">
                                15+ &amp; growing
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                '🇬🇧 English', '🇰🇷 한국어', '🇪🇸 Español', '🇩🇪 Deutsch',
                                '🇫🇷 Français', '🇯🇵 日本語', '🇨🇳 中文', '🇮🇹 Italiano',
                                '🇺🇿 Oʻzbekcha', '🇷🇺 Русский', '🇸🇦 العربية', '🇹🇷 Türkçe',
                                '🇵🇹 Português', '🇮🇳 हिन्दी', '🇻🇳 Tiếng Việt',
                            ].map((lang) => (
                                <span
                                    key={lang}
                                    className="rounded-full border border-cream/12 bg-cream/5 px-3 py-1.5 text-sm font-medium text-cream/90"
                                >
                  {lang}
                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

function FeatureIcon({kind}: { kind: string }) {
    const common = {
        width: 20,
        height: 20,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const
    }
    switch (kind) {
        case 'ai':
            return <svg {...common}>
                <path
                    d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
        case 'chat':
            return <svg {...common}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
        case 'call':
            return <svg {...common}>
                <rect x="2" y="6" width="14" height="12" rx="2"/>
                <path d="M22 8l-6 4 6 4V8z"/>
            </svg>
        case 'card':
            return <svg {...common}>
                <rect x="3" y="5" width="14" height="14" rx="2"/>
                <path d="M7 9h6M7 13h4"/>
                <rect x="7" y="9" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.1"/>
            </svg>
        case 'social':
            return <svg {...common}>
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg>
        case 'analytics':
            return <svg {...common}>
                <path d="M3 3v18h18"/>
                <path d="M7 14l4-4 4 4 5-5"/>
            </svg>
        default:
            return null
    }
}

// ─────────────────────────────────────────────────────────────────
// How it works — 4 numbered steps. The numbers ARE the structure
// here because the steps are a real sequence.
// ─────────────────────────────────────────────────────────────────
const STEPS = [
    {
        step: '01',
        title: 'Pick your languages',
        body: 'Choose your native language and the one you want to learn. Switch any time.',
        accent: 'indigo',
    },
    {
        step: '02',
        title: 'Take a placement test',
        body: 'A 25-question CEFR test puts you at the right level so you don\'t waste time.',
        accent: 'coral',
    },
    {
        step: '03',
        title: 'Learn a little every day',
        body: 'Exercises, flashcards, reading, listening. The streak takes care of motivation.',
        accent: 'mint',
    },
    {
        step: '04',
        title: 'AI checks your progress',
        body: 'Honest feedback on your writing. Real conversations with real people.',
        accent: 'sun',
    },
] as const

function HowItWorks() {
    return (
        <section id="how" className="relative bg-cream-warm py-24 sm:py-32">
            <div className="container-x">
                <div className="mb-14 grid items-end gap-6 sm:grid-cols-2">
                    <div>
                        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                            How it works
                        </p>
                        <h2 className="font-display text-display-lg font-semibold text-ink">
                            Four steps to fluent.
                        </h2>
                    </div>
                    <p className="max-w-md text-lg text-ink-soft sm:justify-self-end">
                        No textbook nonsense. Pick a level, do a little every day, and talk to real people while you
                        learn.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((step, i) => {
                        const colors = accentMap[step.accent]
                        return (
                            <motion.div
                                key={step.step}
                                initial={{opacity: 0, y: 30}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true, margin: '-60px'}}
                                transition={{duration: 0.5, delay: i * 0.1}}
                                className="relative rounded-4xl border border-ink/8 bg-white p-7"
                            >
                                <div className="mb-6 flex items-center justify-between">
                  <span className={`font-mono text-3xl font-medium ${colors.text}`}>
                    {step.step}
                  </span>
                                    <span className={`h-2 w-2 rounded-full ${colors.dot}`}/>
                                </div>
                                <h3 className="mb-2 font-display text-xl font-semibold tracking-tight text-ink">
                                    {step.title}
                                </h3>
                                <p className="text-sm text-ink-soft">{step.body}</p>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────────
// About + Support — sit together since both are textual sections
// ─────────────────────────────────────────────────────────────────
function AboutAndSupport() {
    return (
        <section className="relative py-24 sm:py-32">
            <div className="container-x grid gap-8 lg:grid-cols-2">
                <motion.div
                    id="about"
                    initial={{opacity: 0, y: 30}}
                    whileInView={{opacity: 1, y: 0}}
                    viewport={{once: true, margin: '-80px'}}
                    transition={{duration: 0.6}}
                    className="rounded-5xl bg-ink p-10 text-cream sm:p-12"
                >
                    <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-cream/50">
                        About
                    </p>
                    <h2 className="font-display text-display-md font-semibold">
                        Built for modern learners.
                    </h2>
                    <p className="mt-6 text-lg leading-relaxed text-cream/85">
                        LiveLingo is an AI-powered language learning platform built for modern learners. We combine
                        CEFR-based learning, intelligent content generation, interactive exercises, pronunciation
                        analysis, and live communication to create a complete language learning experience.
                    </p>
                    <p className="mt-4 text-cream/70">
                        Whether you're preparing for exams, improving your speaking skills, or learning a new language
                        from scratch, LiveLingo helps you learn smarter and progress with confidence.
                    </p>
                </motion.div>

                <motion.div
                    id="support"
                    initial={{opacity: 0, y: 30}}
                    whileInView={{opacity: 1, y: 0}}
                    viewport={{once: true, margin: '-80px'}}
                    transition={{duration: 0.6, delay: 0.1}}
                    className="rounded-5xl border border-ink/8 bg-white p-10 sm:p-12"
                >
                    <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                        Support
                    </p>
                    <h2 className="font-display text-display-md font-semibold text-ink">
                        Help, when you need it.
                    </h2>
                    <p className="mt-6 text-lg leading-relaxed text-ink-soft">
                        Need assistance? Contact our support team anytime, and we'll get back to you as soon as
                        possible.
                    </p>
                    <CopyableEmail
                        email="support.livelingo@gmail.com"
                        className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-ink/10 bg-cream-warm px-5 py-4 transition-colors hover:border-ink/30"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-coral-500">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <path d="M22 6l-10 7L2 6"/>
                        </svg>
                        <span className="font-medium text-ink">support.livelingo@gmail.com</span>
                    </CopyableEmail>
                </motion.div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────────
// Final CTA banner before footer
// ─────────────────────────────────────────────────────────────────
function FinalCta() {
    return (
        <section className="relative pb-24 sm:pb-32">
            <div className="container-x">
                <div
                    className="relative overflow-hidden rounded-5xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-coral-500 p-12 text-center sm:p-16">
                    <div className="pointer-events-none absolute inset-0 opacity-30 grain"/>
                    <h2 className="relative font-display text-display-lg font-semibold text-cream">
                        Ready to learn?
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-md text-lg text-cream/85">
                        Sign up free in under a minute. Your streak starts today.
                    </p>
                    <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                        <Link
                            to="/sign-in"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-6 py-3.5 font-medium text-ink transition-transform hover:scale-[1.02] active:scale-100"
                        >
                            <svg width="18" height="18" viewBox="0 0 48 48">
                                <path fill="#FFC107"
                                      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                                <path fill="#FF3D00"
                                      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                                <path fill="#4CAF50"
                                      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                                <path fill="#1976D2"
                                      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                            </svg>
                            Continue with Google
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}

// ─────────────────────────────────────────────────────────────────
// Policy Notice — dinbiy/intim +18 kontentni qo'llab-quvvatlamasligimiz
// ─────────────────────────────────────────────────────────────────
function PolicyNotice() {
    return (
        <div className="relative overflow-hidden border-y border-coral-500/15 bg-coral-50/60 py-6">
            <div className="pointer-events-none absolute inset-0 opacity-[0.03] grain"/>
            <div className="container-x">
                <p className="relative flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-3">
                    <svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 text-coral-600"
                    >
                        <path d="M12 9v4M12 17h.01"/>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-coral-700 sm:text-sm">
                        We do not support or respond to religious or adult (+18) content
                    </span>
                </p>
            </div>
        </div>
    )
}

function Footer() {
    return (
        <footer className="border-t border-ink/8 bg-cream py-14">
            <div className="container-x">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                    <div>
                        <Logo size={32}/>
                        <p className="mt-4 max-w-xs text-sm text-ink-soft">
                            Learn languages with real people. CEFR-graded, AI-checked, never boring.
                        </p>
                    </div>

                    <div>
                        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                            Product
                        </p>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#features"
                                   className="text-ink-soft transition-colors hover:text-ink">Features</a></li>
                            <li><a href="#how" className="text-ink-soft transition-colors hover:text-ink">How it
                                works</a></li>
                            <li><Link to="/sign-in" className="text-ink-soft transition-colors hover:text-ink">Sign
                                in</Link></li>
                        </ul>
                    </div>

                    <div>
                        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                            Company
                        </p>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#about" className="text-ink-soft transition-colors hover:text-ink">About</a>
                            </li>
                            <li><a href="#support"
                                   className="text-ink-soft transition-colors hover:text-ink">Support</a></li>
                        </ul>
                    </div>

                    <div>
                        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                            Contact
                        </p>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <CopyableEmail
                                    email="livelingo.official@gmail.com"
                                    className="inline-flex items-center gap-2 text-ink-soft transition-colors hover:text-ink"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path
                                            d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                        <path d="M22 6l-10 7L2 6"/>
                                    </svg>
                                    livelingo.official@gmail.com
                                </CopyableEmail>
                            </li>
                            <li>
                                <a href="https://t.me/livelingobot" target="_blank" rel="noopener noreferrer"
                                   className="inline-flex items-center gap-2 text-ink-soft transition-colors hover:text-ink">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                    Telegram: @livelingobot
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-ink/8 pt-6">
                    <p className="text-sm text-ink-muted">© {new Date().getFullYear()} LiveLingo. Made with care.</p>
                    <p className="font-mono text-xs text-ink-muted">v0.1 — beta</p>
                </div>
            </div>
        </footer>
    )
}

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────
export default function Landing() {
    return (
        <main className="min-h-screen bg-cream">
            <Navbar/>
            <Hero/>
            <Features/>
            <HowItWorks/>
            <AboutAndSupport/>
            <FinalCta/>
            <PolicyNotice/>
            <Footer/>
        </main>
    )
}
