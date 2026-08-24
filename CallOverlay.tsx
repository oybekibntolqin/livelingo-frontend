import {useCallback, useEffect, useRef, useState} from 'react'
import {API_BASE} from '../../lib/api'
import {formatDuration} from '../../lib/chatApi'
import {callAudio} from '../../lib/callAudio'
import {useCall} from '../../context/CallContext'
import {useWebRTC} from '../../hooks/useWebRTC'

export default function CallOverlay() {
    const {call, acceptCall, rejectCall, endCall, notifyPeerConnected, notifyPeerDisconnected} =
        useCall()

    const [minimized, setMinimized] = useState(false)
    const [isMaximized, setIsMaximized] = useState(false) // Fullscreen o'rniga chegaralangan teatral rejim

    // Drag-and-drop uchun koordinatalar
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const dragStartRef = useRef({ x: 0, y: 0 })
    const initialPosRef = useRef({ x: 0, y: 0 })
    const overlayRef = useRef<HTMLDivElement>(null)

    const [nativePct, setNativePct] = useState<number | null>(null)
    const [targetPct, setTargetPct] = useState<number | null>(null)
    const [warning, setWarning] = useState<string | null>(null)

    const chunkTimerRef = useRef<number | null>(null)
    const recorderRef = useRef<MediaRecorder | null>(null)

    const enabled = call?.state === 'connecting' || call?.state === 'connected'

    const {
        localVideoRef,
        remoteVideoRef,
        localStreamRef,
        connectionState,
        elapsed,
        muted,
        cameraOff,
        mediaError,
        toggleMic,
        toggleCamera,
        speakerOn,
        speakerSupported,
        toggleSpeaker,
        canSwitchCamera,
        switchCamera,
    } = useWebRTC({
        enabled,
        callId: call?.callId ?? '',
        peerId: call?.peerId ?? '',
        isCaller: call?.isCaller ?? false,
        onConnected: notifyPeerConnected,
        onDisconnected: notifyPeerDisconnected,
    })

    // ── Drag & Drop Event Handlers ──
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isMaximized) return // Kattalashgan rejimda surish o'chadi

        const target = e.target as HTMLElement
        if (target.closest('button')) return

        setIsDragging(true)
        dragStartRef.current = { x: e.clientX, y: e.clientY }
        initialPosRef.current = { x: position.x, y: position.y }

        overlayRef.current?.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return
        const dx = e.clientX - dragStartRef.current.x
        const dy = e.clientY - dragStartRef.current.y

        setPosition({
            x: initialPosRef.current.x + dx,
            y: initialPosRef.current.y + dy,
        })
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
            setIsDragging(false)
            overlayRef.current?.releasePointerCapture(e.pointerId)
        }
    }

    // ── Audio chunking ──
    const startAudioChunking = useCallback(
        (stream: MediaStream, callId: string) => {
            const audioOnly = new MediaStream(stream.getAudioTracks());

            let stopped = false;
            let recorder: MediaRecorder | null = null;

            const recordSegment = () => {
                if (stopped) return;

                const chunks: Blob[] = [];

                try {
                    recorder = new MediaRecorder(audioOnly, {
                        mimeType: "audio/webm",
                    });
                } catch (e) {
                    console.error("MediaRecorder yaratilmadi:", e);
                    return;
                }

                recorderRef.current = recorder;

                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                recorder.onstop = async () => {
                    if (chunks.length > 0) {
                        const blob = new Blob(chunks, {
                            type: recorder?.mimeType || "audio/webm",
                        });

                        const fd = new FormData();
                        fd.append("audio", blob, "chunk.webm");

                        try {
                            const token = localStorage.getItem("jwt");

                            const res = await fetch(
                                `${API_BASE}/api/calls/${callId}/audio-chunk`,
                                {
                                    method: "POST",
                                    headers: token
                                        ? {
                                            Authorization: `Bearer ${token}`,
                                        }
                                        : {},
                                    body: fd,
                                }
                            );

                            if (res.ok) {
                                const data = await res.json();
                                setNativePct(data.nativePercent);
                                setTargetPct(data.targetPercent);
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }

                    if (!stopped) {
                        recordSegment();
                    }
                };

                recorder.start();

                window.setTimeout(() => {
                    if (recorder && recorder.state === "recording") {
                        recorder.stop();
                    }
                }, 12000);
            };

            recordSegment();

            recorderRef.current = recorder;

            return () => {
                stopped = true;

                if (recorder && recorder.state === "recording") {
                    recorder.stop();
                }
            };
        },
        []
    );

    const stopAudioChunking = useCallback((callId: string) => {
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }

        if (
            recorderRef.current &&
            recorderRef.current.state === "recording"
        ) {
            recorderRef.current.stop();
        }

        recorderRef.current = null;

        const token = localStorage.getItem("jwt");

        fetch(`${API_BASE}/api/calls/${callId}/audio-chunk/end`, {
            method: "POST",
            headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                }
                : {},
        }).catch(() => {
        });
    }, []);

    useEffect(() => {
        if (connectionState !== 'connected' || !localStreamRef.current || !call) return
        const stream = localStreamRef.current
        const callId = call.callId
        startAudioChunking(stream, callId)
        return () => stopAudioChunking(callId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionState, call?.callId])

    // ── Qo'ng'iroq ovozlari: caller uchun "gudok", callee uchun ringtone ──
    useEffect(() => {
        if (call?.state === 'incoming') {
            callAudio.play('ringtone')
        } else if (call?.state === 'calling') {
            callAudio.play('ringback')
        } else {
            callAudio.stop()
        }
        return () => callAudio.stop()
    }, [call?.state])

    if (!call) return null

    // ── INCOMING ──
    if (call.state === 'incoming') {
        return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/70 backdrop-blur-md">
                <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-8 text-center shadow-2xl animate-fade-in">
                    <div className="relative mx-auto mb-5 h-24 w-24">
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                        <div className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 font-display text-3xl font-semibold text-white shadow-lg">
                            {call.peerName[0]?.toUpperCase()}
                        </div>
                    </div>
                    <h3 className="font-display text-xl font-bold text-white mb-1">{call.peerName}</h3>
                    <p className="mb-8 text-sm text-zinc-400">Guruh videosuhbati yoki shaxsiy qo'ng'iroq…</p>
                    <div className="flex justify-center gap-6">
                        <button
                            onClick={rejectCall}
                            className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white shadow-lg transition duration-200 hover:bg-red-600 hover:scale-105 active:scale-95"
                            title="Rad etish"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <button
                            onClick={acceptCall}
                            className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition duration-200 hover:bg-emerald-600 hover:scale-105 active:scale-95"
                            title="Qabul qilish"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 7l-7 5 7 5V7z" />
                                <rect x="1" y="5" width="15" height="14" rx="3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── ENDED ──
    if (call.state === 'ended') {
        const label =
            call.endedReason === 'rejected'
                ? 'Rad etildi'
                : call.endedReason === 'missed'
                    ? "O'tkazib yuborildi"
                    : call.endedReason === 'busy'
                        ? 'Foydalanuvchi band'
                        : call.endedReason === 'error'
                            ? 'Ulanish uzildi'
                            : 'Qo\'ng\'iroq tugadi'
        return (
            <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-3 text-sm font-medium text-white shadow-2xl animate-fade-in-up">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    {label}
                </div>
            </div>
        )
    }

    const statusLabel =
        call.state === 'calling'
            ? 'Qo\'ng\'iroq qilinmoqda…'
            : call.state === 'connecting'
                ? 'Ulanmoqda…'
                : formatDuration(elapsed)

    // Oyna joylashuvi va o'lcham klasslari
    const containerClasses = isMaximized
        ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-3xl h-[75vh] max-h-[580px] rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl z-50'
        : minimized
            ? 'fixed bottom-4 right-4 h-16 w-72 sm:w-80 rounded-2xl bg-zinc-900/95 border border-white/10 backdrop-blur-xl shadow-2xl cursor-grab active:cursor-grabbing z-40'
            : 'fixed bottom-4 right-4 h-[340px] w-[280px] sm:h-[460px] sm:w-[360px] rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl cursor-grab active:cursor-grabbing z-40'

    // Kattalashtirilgan rejimda orqa fonni xiralashtiruvchi qatlam
    const backdropElement = isMaximized ? (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in" />
    ) : null

    // Kattalashganda markazda turishi yoki drag koordinatalariga amal qilishi uchun inline style
    const cardStyle = isMaximized
        ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        : { transform: `translate3d(${position.x}px, ${position.y}px, 0)` }

    return (
        <>
            {backdropElement}

            <div
                ref={overlayRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={cardStyle}
                className={`overflow-hidden flex flex-col justify-between transition-all duration-300 select-none ${containerClasses}`}
            >
                {/* 1. Remote Video (Suhbatdosh) — DOIMIY ravishda DOM-da qoladi va sifat saqlanadi */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 h-full w-full bg-zinc-950 transition-all duration-300 ${
                        minimized
                            ? 'opacity-0 pointer-events-none'
                            : isMaximized
                                ? 'object-contain' // Kattalashtirilganda asliga nisbatan cho'zilmaydi va sifat buzilmaydi
                                : 'object-cover'
                    }`}
                />

                {/* Orqa fon qoraytirish gradienti */}
                <div className={`absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none transition-opacity duration-300 ${
                    minimized ? 'opacity-0' : 'opacity-100'
                }`} />

                {/* 2. Local Video (O'z kameramiz) — DOIMIY ravishda DOM-da qoladi */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute rounded-2xl border border-white/20 object-cover shadow-lg transition-all duration-300 pointer-events-none ${
                        minimized
                            ? 'opacity-0 scale-50 pointer-events-none'
                            : isMaximized
                                ? 'right-6 top-16 h-36 w-28 opacity-100 shadow-2xl'
                                : 'right-3 top-16 h-28 w-20 opacity-100'
                    }`}
                />

                {/* ── A. MINIMIZED KO'RINISHI ── */}
                {minimized && (
                    <div className="absolute inset-0 flex items-center justify-between px-3 h-full w-full animate-fade-in">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden grid place-items-center font-display font-semibold text-white bg-indigo-600 text-sm shadow-md">
                                {call.peerName[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{call.peerName}</p>
                                <p className="text-[10px] text-zinc-400 font-mono">{statusLabel}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Mikrofon */}
                            <button
                                onClick={toggleMic}
                                className={`p-2 rounded-xl transition-colors ${
                                    muted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    {muted ? (
                                        <>
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                                        </>
                                    ) : (
                                        <>
                                            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                                            <path d="M19 10v2a7 7 0 01-14 0v-2" />
                                        </>
                                    )}
                                </svg>
                            </button>

                            {/* Oynani tiklash */}
                            <button
                                onClick={() => setMinimized(false)}
                                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                                title="Kattalashtirish"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                </svg>
                            </button>

                            {/* Yakunlash */}
                            <button
                                onClick={endCall}
                                className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M21 15.46l-5.27-.61-2.52 2.52a15.05 15.05 0 01-6.59-6.59l2.53-2.53L8.54 3H3.03C2.45 13.18 10.82 21.55 21 20.97v-5.51z" transform="rotate(135 12 12)" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── B. NORMAL / MAXIMIZED KO'RINISHI ── */}
                {!minimized && (
                    <div className="relative h-full w-full flex flex-col justify-between pointer-events-none">

                        {/* Yuqori Panel (Header) */}
                        <div className="relative z-10 flex items-center justify-between p-4 pointer-events-auto">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white drop-shadow-md">{call.peerName}</span>
                                <span className="text-[11px] text-white/80 font-mono drop-shadow-sm flex items-center gap-1.5">
                                    <span className={`h-1.5 w-1.5 rounded-full ${call.state === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                                    {statusLabel}
                                </span>
                            </div>

                            {/* Ekran va O'lcham tugmalari */}
                            <div className="flex items-center gap-2">
                                {/* Teatr rejimi / Kattalashtirish */}
                                <button
                                    onClick={() => setIsMaximized((prev) => !prev)}
                                    className="p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 transition backdrop-blur-md"
                                    title={isMaximized ? 'Kichik oyna' : 'Kattalashtirish (Teatr)'}
                                >
                                    {isMaximized ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                                        </svg>
                                    )}
                                </button>

                                {/* Kichraytirish (Minimize) */}
                                <button
                                    onClick={() => setMinimized(true)}
                                    className="p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 transition backdrop-blur-md"
                                    title="Kichraytirish"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* O'rta qism: Warning va tahlillar */}
                        <div className="relative z-10 px-4 flex flex-col gap-2 pointer-events-auto">
                            {/* Media xatoliklari */}
                            {mediaError && (
                                <div className="mx-auto max-w-xs rounded-xl bg-red-500/80 px-3 py-2 text-center text-xs font-semibold text-white backdrop-blur-md shadow-md">
                                    ⚠ {mediaError}
                                </div>
                            )}

                            {/* Sariq rangdagi ogohlantirish (Warning box) */}
                            {warning && (
                                <div className="mx-auto w-full max-w-xs flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/85 px-3 py-2.5 text-xs text-amber-200 backdrop-blur-md shadow-lg animate-bounce-subtle">
                                    <svg className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <span className="font-semibold block mb-0.5">Tizim ogohlantirishi</span>
                                        <span>{warning}</span>
                                    </div>
                                </div>
                            )}

                            {/* Whisper tahlillari */}
                            {(nativePct != null || targetPct != null) && (
                                <div className="self-start rounded-xl bg-black/50 border border-white/5 px-3 py-1.5 backdrop-blur-md">
                                    <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wide font-mono">
                                        <span className="text-emerald-400">Target {targetPct?.toFixed(0) ?? 0}%</span>
                                        <span className="text-white/30">|</span>
                                        <span className={nativePct != null && nativePct > 50 ? 'text-rose-400' : 'text-zinc-300'}>
                                            Native {nativePct?.toFixed(0) ?? 0}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pastki boshqaruv paneli */}
                        <div className="relative z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pointer-events-auto">
                            <div className="flex items-center justify-center gap-4">
                                {/* Mikrofon */}
                                <button
                                    onClick={toggleMic}
                                    className={`grid h-12 w-12 place-items-center rounded-2xl transition duration-200 border shadow-md hover:scale-105 active:scale-95 ${
                                        muted
                                            ? 'bg-red-500 border-red-400 text-white'
                                            : 'bg-zinc-800/80 border-white/10 text-white hover:bg-zinc-700'
                                    }`}
                                    title={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        {muted ? (
                                            <>
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                                                <path d="M17 16.95A7 7 0 015 12v-2" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                                                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                                                <line x1="12" y1="19" x2="12" y2="23" />
                                                <line x1="8" y1="23" x2="16" y2="23" />
                                            </>
                                        )}
                                    </svg>
                                </button>

                                {/* Kamera */}
                                <button
                                    onClick={toggleCamera}
                                    className={`grid h-12 w-12 place-items-center rounded-2xl transition duration-200 border shadow-md hover:scale-105 active:scale-95 ${
                                        cameraOff
                                            ? 'bg-red-500 border-red-400 text-white'
                                            : 'bg-zinc-800/80 border-white/10 text-white hover:bg-zinc-700'
                                    }`}
                                    title={cameraOff ? "Kamerani yoqish" : "Kamerani o'chirish"}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        {cameraOff ? (
                                            <>
                                                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
                                                <path d="M23 7l-7 5 7 5V7z" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M23 7l-7 5 7 5V7z" />
                                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                            </>
                                        )}
                                    </svg>
                                </button>

                                {/* Speaker (chiqish qurilmasi) — faqat brauzer setSinkId'ni qo'llab-quvvatlasa ko'rsatiladi */}
                                {speakerSupported && (
                                    <button
                                        onClick={toggleSpeaker}
                                        className={`grid h-12 w-12 place-items-center rounded-2xl transition duration-200 border shadow-md hover:scale-105 active:scale-95 ${
                                            speakerOn
                                                ? 'bg-zinc-800/80 border-white/10 text-white hover:bg-zinc-700'
                                                : 'bg-amber-500 border-amber-400 text-white'
                                        }`}
                                        title={speakerOn ? "Karnayni o'chirish" : 'Karnayni yoqish'}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                                            {speakerOn ? (
                                                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                                            ) : (
                                                <line x1="23" y1="9" x2="17" y2="15" />
                                            )}
                                            {speakerOn ? null : <line x1="17" y1="9" x2="23" y2="15" />}
                                        </svg>
                                    </button>
                                )}

                                {/* Old/orqa kamera almashtirish — faqat bir nechta kamera bo'lsa ko'rsatiladi */}
                                {canSwitchCamera && (
                                    <button
                                        onClick={switchCamera}
                                        className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-800/80 border border-white/10 text-white shadow-md transition duration-200 hover:bg-zinc-700 hover:scale-105 active:scale-95"
                                        title="Kamerani almashtirish (old/orqa)"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <path d="M17 1l4 4-4 4" />
                                            <path d="M3 11V9a4 4 0 014-4h14" />
                                            <path d="M7 23l-4-4 4-4" />
                                            <path d="M21 13v2a4 4 0 01-4 4H3" />
                                        </svg>
                                    </button>
                                )}

                                {/* Yakunlash */}
                                <button
                                    onClick={endCall}
                                    className="grid h-12 w-14 place-items-center rounded-2xl bg-red-600 border border-red-500 text-white shadow-lg transition duration-200 hover:bg-red-700 hover:scale-105 active:scale-95"
                                    title="Qo'ng'iroqni tugatish"
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                        <path
                                            d="M21 15.46l-5.27-.61-2.52 2.52a15.05 15.05 0 01-6.59-6.59l2.53-2.53L8.54 3H3.03C2.45 13.18 10.82 21.55 21 20.97v-5.51z"
                                            transform="rotate(135 12 12)"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}