// useWebRTC — RTCPeerConnection va SDP/ICE negotiation'ning YAGONA joyi.
//
// Bu hook quyidagilarga javobgar:
//   • PeerConnection'ni FAQAT bir marta yaratish, `enabled` true bo'lganda
//     (Problem 6 — render'lar bilan bog'lamaslik)
//   • getUserMedia orqali local stream olish
//   • Perfect Negotiation Pattern (Problem 10) — glare'ni oldini olish
//   • ICE candidate queue — remoteDescription o'rnatilgunga qadar
//     candidate'lar to'planadi, keyin flush qilinadi (Problem 9)
//   • Signal handler'da har doim eng oxirgi callId/peerId'ni ishlatish —
//     stale closure YO'Q, hammasi ref orqali (Problem 4)
//   • Offer FAQAT connected/callId/pc/localStream mavjud bo'lganda
//     yaratiladi — bu onnegotiationneeded orqali tabiiy ravishda ta'minlanadi,
//     chunki track faqat pc yaratilgandan keyin qo'shiladi (Problem 8)
//
// CallOverlay bu hook'ni chaqiradi va FAQAT UI render qiladi — o'zi
// PeerConnection yaratmaydi, socket'ga obuna bo'lmaydi (Problem 12).

import {useCallback, useEffect, useRef, useState} from 'react'
import {chatSocket} from '../lib/chatSocket'
import type {SignalMessage} from '../lib/chatTypes'
import type {SerializedIceCandidate} from '../lib/callTypes'

// STUN — barcha holatlarda ishlaydi.
// TURN — bepul OpenRelay (Metered.ca). Public/shared credential, shuning
// uchun faqat zaxira sifatida (NAT/firewall orqasidagi foydalanuvchilar
// uchun). Productionda o'z TURN serveringiz yoki pullik provayder tavsiya
// etiladi.
const ICE_SERVERS: RTCIceServer[] = [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'stun:openrelay.metered.ca:80'},
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
]

export type WebRTCConnectionState =
    | 'idle'
    | 'new'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'failed'
    | 'closed'

interface UseWebRTCParams {
    // Faqat call.state 'connecting' yoki 'connected' bo'lganda true bo'lishi
    // kerak — Problem 2/8: overlay/negotiation callId va accept'dan oldin
    // ishga tushmaydi.
    enabled: boolean
    callId: string
    peerId: string
    isCaller: boolean
    onConnected?: () => void
    onDisconnected?: () => void
}

interface UseWebRTCResult {
    localVideoRef: React.RefObject<HTMLVideoElement>
    remoteVideoRef: React.RefObject<HTMLVideoElement>
    localStreamRef: React.RefObject<MediaStream | null>
    connectionState: WebRTCConnectionState
    elapsed: number
    muted: boolean
    cameraOff: boolean
    mediaError: string | null
    toggleMic: () => void
    toggleCamera: () => void
    stop: () => void
}

function parseCandidate(raw: SerializedIceCandidate): RTCIceCandidateInit {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export function useWebRTC({
                              enabled,
                              callId,
                              peerId,
                              isCaller,
                              onConnected,
                              onDisconnected,
                          }: UseWebRTCParams): UseWebRTCResult {
    const [connectionState, setConnectionState] = useState<WebRTCConnectionState>('idle')
    const [elapsed, setElapsed] = useState(0)
    const [muted, setMuted] = useState(false)
    const [cameraOff, setCameraOff] = useState(false)
    const [mediaError, setMediaError] = useState<string | null>(null)

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)

    // ── Har doim eng so'nggi qiymatlarni ushlab turuvchi ref'lar ──
    // Signal handler closure ichida yaratilsa ham, bular orqali har doim
    // joriy callId/peerId'ga murojaat qilinadi (Problem 4).
    const callIdRef = useRef(callId)
    const peerIdRef = useRef(peerId)
    const politeRef = useRef(!isCaller)
    const onConnectedRef = useRef(onConnected)
    const onDisconnectedRef = useRef(onDisconnected)

    useEffect(() => {
        callIdRef.current = callId
    }, [callId])
    useEffect(() => {
        peerIdRef.current = peerId
    }, [peerId])
    useEffect(() => {
        politeRef.current = !isCaller
    }, [isCaller])
    useEffect(() => {
        onConnectedRef.current = onConnected
    }, [onConnected])
    useEffect(() => {
        onDisconnectedRef.current = onDisconnected
    }, [onDisconnected])

    // ── Perfect Negotiation holati (Problem 10) ──
    const makingOfferRef = useRef(false)
    const ignoreOfferRef = useRef(false)
    const isSettingRemoteAnswerPendingRef = useRef(false)

    // ── ICE candidate queue (Problem 9) ──
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

    const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
        const queued = pendingCandidatesRef.current.splice(0)
        for (const cand of queued) {
            try {
                await pc.addIceCandidate(cand)
            } catch {
                /* eskirgan candidate — e'tiborsiz qoldiramiz */
            }
        }
    }, [])

    const stopInternal = useCallback(() => {
        const pc = pcRef.current
        if (pc) {
            pc.ontrack = null
            pc.onicecandidate = null
            pc.onnegotiationneeded = null
            pc.onconnectionstatechange = null
            pc.close()
        }
        pcRef.current = null

        localStreamRef.current?.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null

        if (localVideoRef.current) localVideoRef.current.srcObject = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

        pendingCandidatesRef.current = []
        makingOfferRef.current = false
        ignoreOfferRef.current = false
        isSettingRemoteAnswerPendingRef.current = false

        setConnectionState('idle')
        setElapsed(0)
    }, [])

    // ── PeerConnection lifecycle — FAQAT `enabled` o'zgarganda (Problem 6) ──
    useEffect(() => {
        if (!enabled) {
            stopInternal()
            return
        }

        let cancelled = false

        const setup = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true,
                })
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop())
                    return
                }
                localStreamRef.current = stream
                if (localVideoRef.current) localVideoRef.current.srcObject = stream

                const pc = new RTCPeerConnection({iceServers: ICE_SERVERS})
                pcRef.current = pc

                stream.getTracks().forEach((track) => pc.addTrack(track, stream))

                pc.ontrack = (e) => {
                    if (remoteVideoRef.current && e.streams[0]) {
                        remoteVideoRef.current.srcObject = e.streams[0]
                    }
                }

                pc.onicecandidate = (e) => {
                    if (e.candidate) {
                        chatSocket.send({
                            type: 'ICE',
                            to: peerIdRef.current,
                            callId: callIdRef.current,
                            candidate: JSON.stringify(e.candidate),
                        })
                    }
                }

                pc.onconnectionstatechange = () => {
                    const s = pc.connectionState as WebRTCConnectionState
                    setConnectionState(s)
                    if (s === 'connected') onConnectedRef.current?.()
                    if (s === 'failed') {
                        // Haqiqiy ICE/ulanish muvaffaqiyatsizligi (STUN/TURN
                        // ishlamadi va h.k.) — bu faqat diagnostika uchun,
                        // backend loglaydi. 'disconnected'/'closed' bunga
                        // kirmaydi, chunki ular normal holatlar (masalan
                        // qo'ng'iroqni tugatish) bo'lishi mumkin.
                        chatSocket.send({
                            type: 'ICE_FAILED',
                            to: peerIdRef.current,
                            callId: callIdRef.current,
                            reason: 'RTCPeerConnection connectionState=failed',
                        })
                    }
                    if (s === 'disconnected' || s === 'failed' || s === 'closed') {
                        onDisconnectedRef.current?.()
                    }
                }

                // ── Perfect Negotiation: offer yaratish (Problem 8, 10) ──
                // Bu faqat pc yaratilib, track qo'shilgandan KEYIN, brauzer
                // tomonidan avtomatik chaqiriladi — ya'ni "connected + callId +
                // pc + localStream" barchasi allaqachon mavjud bo'lganda.
                pc.onnegotiationneeded = async () => {
                    try {
                        makingOfferRef.current = true
                        await pc.setLocalDescription()
                        chatSocket.send({
                            type: 'OFFER',
                            to: peerIdRef.current,
                            callId: callIdRef.current,
                            sdp: pc.localDescription?.sdp,
                        })
                    } catch {
                        /* setLocalDescription xatosi — keyingi negotiationneeded'da qayta urinadi */
                    } finally {
                        makingOfferRef.current = false
                    }
                }

                setConnectionState('new')
            } catch (err) {
                if (!cancelled) {
                    setMediaError(
                        err instanceof Error ? err.message : 'Kamera/mikrofonga ruxsat berilmadi'
                    )
                }
            }
        }

        setup()

        return () => {
            cancelled = true
            stopInternal()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled])

    // ── Signalizatsiya qabul qilish: OFFER / ANSWER / ICE (Problem 4, 9, 10) ──
    useEffect(() => {
        if (!enabled) return

        const unsub = chatSocket.subscribe(async (sig: SignalMessage) => {
            // Har doim callIdRef'dan o'qiymiz — closure eskirgan bo'lsa ham
            // muammo yo'q (Problem 4).
            if (!sig.callId || sig.callId !== callIdRef.current) return
            const pc = pcRef.current
            if (!pc) return

            try {
                if (sig.type === 'OFFER' && sig.sdp) {
                    const offerCollision =
                        makingOfferRef.current || pc.signalingState !== 'stable'
                    ignoreOfferRef.current = !politeRef.current && offerCollision
                    if (ignoreOfferRef.current) return

                    await pc.setRemoteDescription({type: 'offer', sdp: sig.sdp})
                    await flushPendingCandidates(pc)

                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    chatSocket.send({
                        type: 'ANSWER',
                        to: peerIdRef.current,
                        callId: callIdRef.current,
                        sdp: pc.localDescription?.sdp,
                    })
                } else if (sig.type === 'ANSWER' && sig.sdp) {
                    isSettingRemoteAnswerPendingRef.current = true
                    await pc.setRemoteDescription({type: 'answer', sdp: sig.sdp})
                    isSettingRemoteAnswerPendingRef.current = false
                    await flushPendingCandidates(pc)
                } else if (sig.type === 'ICE' && sig.candidate) {
                    const candidate = parseCandidate(sig.candidate)
                    if (pc.remoteDescription) {
                        try {
                            await pc.addIceCandidate(candidate)
                        } catch (err) {
                            if (!ignoreOfferRef.current) {
                                // e'tiborsiz qoldirilmagan offer bo'yicha xato — jim log
                                console.warn('ICE candidate qo\'shilmadi', err)
                            }
                        }
                    } else {
                        // remoteDescription hali yo'q — navbatga qo'yamiz (Problem 9)
                        pendingCandidatesRef.current.push(candidate)
                    }
                }
            } catch (err) {
                console.warn('WebRTC signal xatosi', err)
            }
        })

        return unsub
    }, [enabled, flushPendingCandidates])

    // ── Davomiylik taymeri ──
    useEffect(() => {
        if (connectionState !== 'connected') return
        const start = Date.now()
        const t = window.setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000))
        }, 1000)
        return () => window.clearInterval(t)
    }, [connectionState])

    const toggleMic = useCallback(() => {
        const stream = localStreamRef.current
        if (!stream) return
        setMuted((m) => {
            const next = !m
            stream.getAudioTracks().forEach((t) => (t.enabled = !next))
            return next
        })
    }, [])

    const toggleCamera = useCallback(() => {
        const stream = localStreamRef.current
        if (!stream) return
        setCameraOff((c) => {
            const next = !c
            stream.getVideoTracks().forEach((t) => (t.enabled = !next))
            return next
        })
    }, [])

    const stop = useCallback(() => {
        stopInternal()
    }, [stopInternal])

    return {
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
        stop,
    }
}
