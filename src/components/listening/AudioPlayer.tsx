import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatTime, PLAYBACK_SPEEDS } from '../../lib/listening'

interface Props {
    src: string
    title?: string
    subtitle?: string
    onAudioRef?: (el: HTMLAudioElement | null) => void
    onTimeUpdate?: (currentTime: number) => void
    onDurationChange?: (duration: number) => void
}

export default function AudioPlayer({
                                        src,
                                        title,
                                        subtitle,
                                        onAudioRef,
                                        onTimeUpdate,
                                        onDurationChange,
                                    }: Props) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [muted, setMuted] = useState(false)
    const [repeat, setRepeat] = useState(false)
    const [speedIdx, setSpeedIdx] = useState(2) // 1.0×

    // A-B Loop holatlari
    const [loopStart, setLoopStart] = useState<number | null>(null)
    const [loopEnd, setLoopEnd] = useState<number | null>(null)

    // Hover va Drag holatlari
    const [hoverTime, setHoverTime] = useState<number | null>(null)
    const [hoverX, setHoverX] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const speed = PLAYBACK_SPEEDS[speedIdx] ?? 1.0

    useEffect(() => {
        onAudioRef?.(audioRef.current)
        return () => onAudioRef?.(null)
    }, [onAudioRef])

    useEffect(() => {
        const el = audioRef.current
        if (!el) return

        const onLoad = () => {
            const d = el.duration || 0
            setDuration(d)
            onDurationChange?.(d)
        }
        const onTime = () => {
            const cur = el.currentTime
            setCurrentTime(cur)
            onTimeUpdate?.(cur)

            // A-B Loop mantiqi: Agar A va B nuqtalar o'rnatilgan bo'lsa va vaqt B dan oshsa (yoki A dan orqada bo'lsa) A ga qaytadi
            if (loopStart !== null && loopEnd !== null) {
                if (cur >= loopEnd || cur < loopStart) {
                    el.currentTime = loopStart
                }
            }
        }
        const onPlay = () => setPlaying(true)
        const onPause = () => setPlaying(false)
        const onEnd = () => {
            if (repeat) {
                el.currentTime = 0
                el.play().catch(() => {})
            } else {
                setPlaying(false)
            }
        }

        el.addEventListener('loadedmetadata', onLoad)
        el.addEventListener('timeupdate', onTime)
        el.addEventListener('play', onPlay)
        el.addEventListener('pause', onPause)
        el.addEventListener('ended', onEnd)

        return () => {
            el.removeEventListener('loadedmetadata', onLoad)
            el.removeEventListener('timeupdate', onTime)
            el.removeEventListener('play', onPlay)
            el.removeEventListener('pause', onPause)
            el.removeEventListener('ended', onEnd)
        }
    }, [repeat, onTimeUpdate, onDurationChange, loopStart, loopEnd])

    const togglePlay = useCallback(() => {
        const el = audioRef.current
        if (!el) return
        if (el.paused) el.play().catch(() => {})
        else el.pause()
    }, [])

    const seekBy = useCallback((delta: number) => {
        const el = audioRef.current
        if (!el) return
        el.currentTime = Math.max(0, Math.min(duration, el.currentTime + delta))
    }, [duration])

    const seekTo = useCallback((t: number) => {
        const el = audioRef.current
        if (!el) return
        el.currentTime = Math.max(0, Math.min(duration, t))
    }, [duration])

    const cycleSpeed = () => {
        const el = audioRef.current
        if (!el) return
        const next = (speedIdx + 1) % PLAYBACK_SPEEDS.length
        setSpeedIdx(next)
        el.playbackRate = PLAYBACK_SPEEDS[next]
    }

    const toggleMute = () => {
        const el = audioRef.current
        if (!el) return
        const next = !muted
        setMuted(next)
        el.muted = next
    }

    const changeVolume = (v: number) => {
        const el = audioRef.current
        if (!el) return
        setVolume(v)
        el.volume = v
        if (v === 0) {
            setMuted(true)
            el.muted = true
        } else if (muted) {
            setMuted(false)
            el.muted = false
        }
    }

    // A-B Loop nuqtalarini boshqarish funksiyalari
    const handleSetA = () => {
        const el = audioRef.current
        if (!el) return
        const cur = el.currentTime
        if (loopEnd !== null && cur >= loopEnd) {
            setLoopEnd(null)
        }
        setLoopStart(cur)
    }

    const handleSetB = () => {
        const el = audioRef.current
        if (!el) return
        const cur = el.currentTime
        if (loopStart === null) {
            setLoopStart(cur)
        } else if (cur > loopStart) {
            setLoopEnd(cur)
        } else {
            // Agar B nuqta A dan oldinroq bo'lsa, ularni almashtiramiz
            setLoopEnd(loopStart)
            setLoopStart(cur)
        }
    }

    const handleClearLoop = () => {
        setLoopStart(null)
        setLoopEnd(null)
    }

    // Klaviatura boshqaruvi
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === ' ') {
            e.preventDefault()
            togglePlay()
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            seekBy(-3)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            seekBy(3)
        }
    }

    // ── Waveform Analizi ────────────────────────────────────────
    const [peaks, setPeaks] = useState<number[]>(() => generateFakePeaks(96))
    const [analyzing, setAnalyzing] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        let ac: AudioContext | null = null
        setAnalyzing(true)

        const loadAndAnalyze = async () => {
            try {
                const resp = await fetch(src, {
                    credentials: 'include',
                    signal: controller.signal,
                })
                if (!resp.ok) throw new Error('Fetch failed')
                const buf = await resp.arrayBuffer()

                const Ctx = window.AudioContext || (window as any).webkitAudioContext
                ac = new Ctx()
                const audioBuffer = await ac.decodeAudioData(buf)

                if (!controller.signal.aborted) {
                    setPeaks(downsample(audioBuffer, 96))
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return
                if (!controller.signal.aborted) setPeaks(generateFakePeaks(96))
            } finally {
                if (!controller.signal.aborted) setAnalyzing(false)
                if (ac) {
                    ac.close().catch(() => {})
                }
            }
        }

        loadAndAnalyze()
        return () => {
            controller.abort()
        }
    }, [src])

    // Waveform va A-B belgilari chizish
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr
            canvas.height = h * dpr
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, w, h)

        const progress = duration > 0 ? currentTime / duration : 0
        const hoverProgress = (hoverTime !== null && duration > 0) ? hoverTime / duration : null

        const barCount = peaks.length
        const barWidth = w / barCount
        const barGap = Math.max(1.5, barWidth * 0.35)
        const barDrawWidth = Math.max(1, barWidth - barGap)

        // 1. Waveform to'lqinlarini chizish
        for (let i = 0; i < barCount; i++) {
            const peak = peaks[i]
            const barHeight = Math.max(4, peak * (h * 0.72))
            const x = i * barWidth
            const y = (h - barHeight) / 2

            const barPosRatio = i / barCount
            const isPlayed = barPosRatio < progress
            const isHovered = hoverProgress !== null && barPosRatio < hoverProgress

            if (isPlayed) {
                ctx.fillStyle = '#f59e0b' // Amber
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.45)' // Hover qismi
            } else {
                ctx.fillStyle = '#27272a' // Zinc-800
            }

            const r = Math.min(2, barDrawWidth / 2)
            roundRect(ctx, x, y, barDrawWidth, barHeight, r)
            ctx.fill()
        }

        // 2. A-B Loop vizual chiziq va fonlarini chizish
        if (duration > 0) {
            const xA = loopStart !== null ? (loopStart / duration) * w : null
            const xB = loopEnd !== null ? (loopEnd / duration) * w : null

            // A va B oralig'idagi hududni bo'yash
            if (xA !== null && xB !== null) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.08)'
                ctx.fillRect(xA, 0, xB - xA, h)
            }

            // A chizig'i
            if (xA !== null) {
                ctx.strokeStyle = '#f59e0b'
                ctx.lineWidth = 1.5
                ctx.setLineDash([4, 3])
                ctx.beginPath()
                ctx.moveTo(xA, 0)
                ctx.lineTo(xA, h)
                ctx.stroke()
                ctx.setLineDash([])

                // "A" harfi yozuvi
                ctx.fillStyle = '#f59e0b'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('A', xA + 5, 14)
            }

            // B chizig'i
            if (xB !== null) {
                ctx.strokeStyle = '#f59e0b'
                ctx.lineWidth = 1.5
                ctx.setLineDash([4, 3])
                ctx.beginPath()
                ctx.moveTo(xB, 0)
                ctx.lineTo(xB, h)
                ctx.stroke()
                ctx.setLineDash([])

                // "B" harfi yozuvi
                ctx.fillStyle = '#f59e0b'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('B', xB - 12, 14)
            }
        }
    }, [peaks, currentTime, duration, hoverTime, loopStart, loopEnd])

    // Drag / Seek amallari
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas || duration <= 0) return

        canvas.setPointerCapture(e.pointerId)
        setIsDragging(true)

        const handleSeek = (evt: PointerEvent) => {
            const rect = canvas.getBoundingClientRect()
            const ratio = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width))
            seekTo(ratio * duration)
        }

        handleSeek(e.nativeEvent)

        const handlePointerMove = (evt: PointerEvent) => {
            handleSeek(evt)
        }

        const handlePointerUp = () => {
            setIsDragging(false)
            canvas.removeEventListener('pointermove', handlePointerMove)
            canvas.removeEventListener('pointerup', handlePointerUp)
        }

        canvas.addEventListener('pointermove', handlePointerMove)
        canvas.addEventListener('pointerup', handlePointerUp)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas || duration <= 0) return
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const ratio = Math.max(0, Math.min(1, x / rect.width))
        setHoverX(x)
        setHoverTime(ratio * duration)
    }

    const handlePointerLeave = () => {
        setHoverX(null)
        setHoverTime(null)
    }

    const VolumeIcon = useMemo(
        () => getVolumeIcon(muted ? 0 : volume),
        [muted, volume]
    )

    return (
        <div
            ref={containerRef}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            className="w-full max-w-2xl mx-auto rounded-3xl bg-zinc-950 border border-zinc-800/80 p-6 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 transition-all select-none"
        >
            {/* Sarlavha qismi */}
            {(title || subtitle) && (
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-900">
                    <div className="min-w-0">
                        {title && (
                            <h3 className="text-sm font-semibold text-zinc-100 truncate tracking-wide">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Waveform hududi */}
            <div className="relative w-full h-24 my-5 rounded-2xl bg-zinc-900/40 border border-zinc-900 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                    className="w-full h-full cursor-ew-resize touch-none"
                />

                {/* Vaqt tooltipi (sichqoncha olib borilganda) */}
                {hoverTime !== null && hoverX !== null && (
                    <div
                        className="absolute top-2 pointer-events-none -translate-x-1/2 bg-zinc-800 text-zinc-100 text-[10px] px-2 py-0.5 rounded-md font-mono shadow-md border border-zinc-700 transition-all"
                        style={{ left: `${hoverX}px` }}
                    >
                        {formatTime(hoverTime)}
                    </div>
                )}

                {analyzing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-[11px] font-medium text-zinc-400 tracking-wider">
                        <span className="animate-pulse">Toʻlqin tahlil qilinmoqda…</span>
                    </div>
                )}
            </div>

            {/* A-B Loop interfeysi */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border border-zinc-900 rounded-xl bg-zinc-900/20 mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">A-B Loop:</span>
                    {loopStart !== null && (
                        <span className="text-[11px] bg-amber-500/10 text-amber-500 font-mono px-2 py-0.5 rounded border border-amber-500/20">
                            A: {formatTime(loopStart)}
                        </span>
                    )}
                    {loopEnd !== null && (
                        <span className="text-[11px] bg-amber-500/10 text-amber-500 font-mono px-2 py-0.5 rounded border border-amber-500/20">
                            B: {formatTime(loopEnd)}
                        </span>
                    )}
                    {loopStart === null && loopEnd === null && (
                        <span className="text-[11px] text-zinc-500 font-medium">Faol emas</span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleSetA}
                        className="px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all duration-200"
                        title="Hozirgi vaqtni A nuqta qilib belgilash"
                    >
                        [A] qo'yish
                    </button>
                    <button
                        onClick={handleSetB}
                        className="px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all duration-200"
                        title="Hozirgi vaqtni B nuqta qilib belgilash"
                    >
                        [B] qo'yish
                    </button>
                    {(loopStart !== null || loopEnd !== null) && (
                        <button
                            onClick={handleClearLoop}
                            className="px-2 py-1 text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/30 rounded-lg transition-all duration-200"
                            title="Loopni tozalash"
                        >
                            O'chirish
                        </button>
                    )}
                </div>
            </div>

            {/* Vaqt hisoblagichi */}
            <div className="flex items-center justify-between mb-4 font-mono text-xs text-zinc-400 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Boshqaruv paneli */}
            <div className="flex items-center justify-between gap-4">

                {/* Chap qism: Takrorlash va Tezlik */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setRepeat((r) => !r)}
                        className={`p-2 rounded-xl transition-all duration-200 ${
                            repeat
                                ? 'text-amber-400 bg-amber-400/10'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                        title={repeat ? "Takrorlash yoniq" : "Takrorlash o'chiq"}
                    >
                        <RepeatIcon />
                    </button>
                    <button
                        onClick={cycleSpeed}
                        className="px-2.5 py-1 text-[11px] font-bold text-zinc-300 border border-zinc-800 rounded-lg bg-zinc-900/60 hover:text-white hover:bg-zinc-800 transition duration-200 tabular-nums"
                        title="Tezlik"
                    >
                        {speed.toFixed(1)}×
                    </button>
                </div>

                {/* Markaziy qism: O'ynatish tugmalari */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => seekBy(-3)}
                        className="p-2 text-zinc-400 hover:text-white active:scale-90 transition duration-150"
                        title="3 soniya orqaga"
                    >
                        <RewindIcon />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-14 h-14 bg-amber-500 hover:bg-amber-400 active:scale-95 rounded-full grid place-items-center text-zinc-950 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all duration-200"
                        title={playing ? 'Pauza' : "O'ynatish"}
                    >
                        {playing ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="5" y="4" width="4" height="16" rx="1.5"/>
                                <rect x="15" y="4" width="4" height="16" rx="1.5"/>
                            </svg>
                        ) : (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="ml-1"
                            >
                                <path d="M7 4v16l12-8z"/>
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={() => seekBy(3)}
                        className="p-2 text-zinc-400 hover:text-white active:scale-90 transition duration-150"
                        title="3 soniya oldinga"
                    >
                        <ForwardIcon />
                    </button>
                </div>

                {/* O'ng qism: Ovozni boshqarish */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMute}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition duration-200"
                        title={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
                    >
                        <VolumeIcon />
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={muted ? 0 : volume}
                        onChange={(e) => changeVolume(Number(e.target.value))}
                        className="w-16 sm:w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 focus:outline-none"
                        aria-label="Ovoz balandligi"
                    />
                </div>
            </div>

            <audio ref={audioRef} src={src} preload="metadata" />
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════
// SVG Ikonkalari
// ═════════════════════════════════════════════════════════════════
function RepeatIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 01-4 4H3"/>
        </svg>
    )
}

function RewindIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
        </svg>
    )
}

function ForwardIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
        </svg>
    )
}

function getVolumeIcon(v: number) {
    if (v === 0) return VolumeMuteIcon
    if (v < 0.4) return VolumeLowIcon
    if (v < 0.7) return VolumeMedIcon
    return VolumeHighIcon
}

function VolumeMuteIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
    )
}

function VolumeLowIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <path d="M15.54 8.46a5 5 0 010 7.07"/>
        </svg>
    )
}

function VolumeMedIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/>
        </svg>
    )
}

function VolumeHighIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/>
        </svg>
    )
}

// ═════════════════════════════════════════════════════════════════
// Yordamchi Funksiyalar (Waveform helpers)
// ═════════════════════════════════════════════════════════════════
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

function downsample(buffer: AudioBuffer, samples: number): number[] {
    const channelCount = buffer.numberOfChannels
    const channels: Float32Array[] = []
    for (let c = 0; c < channelCount; c++) channels.push(buffer.getChannelData(c))
    const blockSize = Math.floor(buffer.length / samples)
    const peaks: number[] = []

    for (let i = 0; i < samples; i++) {
        let max = 0
        const start = i * blockSize
        const end = start + blockSize
        for (let j = start; j < end; j++) {
            let sum = 0
            for (let c = 0; c < channelCount; c++) sum += Math.abs(channels[c][j] || 0)
            const avg = sum / channelCount
            if (avg > max) max = avg
        }
        peaks.push(max)
    }
    const maxPeak = Math.max(...peaks) || 1
    return peaks.map((p) => p / maxPeak)
}

function generateFakePeaks(n: number): number[] {
    const out: number[] = []
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 4
        const base =
            0.4 +
            0.3 * Math.sin(t) +
            0.15 * Math.sin(t * 2.3 + 1.1) +
            0.15 * Math.sin(t * 4.7 + 2.2)
        out.push(Math.max(0.1, Math.min(1, base)))
    }
    return out
}