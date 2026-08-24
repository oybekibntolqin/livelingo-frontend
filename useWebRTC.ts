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
//   • RACE FIX: OFFER/ANSWER/ICE pc yaratilishidan OLDIN kelib qolsa ham
//     (mobil qurilmalarda getUserMedia sekinroq bo'lishi mumkin), signal
//     yo'qolib ketmaydi — earlySignalQueueRef orqali navbatga qo'yiladi va
//     pc tayyor bo'lgach qayta ishlanadi.
//
// CallOverlay bu hook'ni chaqiradi va FAQAT UI render qiladi — o'zi
// PeerConnection yaratmaydi, socket'ga obuna bo'lmaydi (Problem 12).

import {useCallback, useEffect, useRef, useState} from 'react'
import {chatSocket} from '../lib/chatSocket'
import type {SignalMessage} from '../lib/chatTypes'
import type {SerializedIceCandidate} from '../lib/callTypes'

const ICE_SERVERS: RTCIceServer[] = [
    {urls: 'stun:turn.livelingo.uz:3478'},
    {
        urls: 'turn:turn.livelingo.uz:3478',
        username: 'livelingo',
        credential: 'qGzHnirK9xLKiyYn75SbfuK1d/c3Fxq/',
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
    // ── Speaker chiqishi (Problem: Speaker tugmasi) ──
    speakerOn: boolean
    speakerSupported: boolean
    toggleSpeaker: () => void
    // ── Old/orqa kamera almashtirish (Problem: Front/Rear tugmasi) ──
    facingMode: 'user' | 'environment'
    canSwitchCamera: boolean
    switchCamera: () => void
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
    // Speaker chiqishi (setSinkId qo'llab-quvvatlansa ishlaydi — asosan
    // Chrome/Edge desktop va Android Chrome'da; iOS Safari'da API yo'q,
    // shu sabab tugma faqat qo'llab-quvvatlansa ko'rsatiladi).
    const [speakerOn, setSpeakerOn] = useState(true)
    const [speakerSupported, setSpeakerSupported] = useState(false)
    // Old (user) / orqa (environment) kamera
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
    const [canSwitchCamera, setCanSwitchCamera] = useState(false)

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const facingModeRef = useRef<'user' | 'environment'>('user')
    const statsIntervalRef = useRef<number | null>(null)

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

    // ── "Erta kelgan" signal navbati (RACE FIX) ──
    // pc hali yaratilmagan bo'lsa ham (getUserMedia/RTCPeerConnection
    // asinxron tayyorlanmoqda), OFFER/ANSWER/ICE signallari yo'qolib
    // ketmasin uchun shu yerga navbatga qo'yiladi, pc tayyor bo'lgach
    // qayta ishlanadi.
    const earlySignalQueueRef = useRef<SignalMessage[]>([])
    const pcReadyRef = useRef(false)

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

        // ── Diagnostika: qo'ng'iroq davomida audio yuborilgan/qabul
        // qilinganini konsolga yozib qo'yamiz — bu, ayniqsa "bir tomonlama
        // ovoz kelmayapti" holatlarini aniqlashda foydali: agar
        // "bytesSent" o'sgan bo'lsa, laptop tomondan yuborish ishlagan;
        // agar peer tarafda "bytesReceived" 0 bo'lsa — muammo tarmoq/
        // negotiation'da, mikrofonning o'zida emas.
        if (pc && pc.connectionState !== 'closed') {
            pc.getStats().then((stats) => {
                stats.forEach((report) => {
                    if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                        console.log('[WebRTC diagnostika] audio yuborildi (bytesSent):', report.bytesSent)
                    }
                    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                        console.log('[WebRTC diagnostika] audio qabul qilindi (bytesReceived):', report.bytesReceived, 'packetsLost:', report.packetsLost)
                    }
                })
            }).catch(() => {})
        }

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

        if (statsIntervalRef.current) {
            window.clearInterval(statsIntervalRef.current)
            statsIntervalRef.current = null
        }

        pendingCandidatesRef.current = []
        earlySignalQueueRef.current = []
        pcReadyRef.current = false
        makingOfferRef.current = false
        ignoreOfferRef.current = false
        isSettingRemoteAnswerPendingRef.current = false

        setConnectionState('idle')
        setElapsed(0)

        // MUHIM FIX (Problem: mute holati keyingi qo'ng'iroqqa "saqlanib
        // qolishi"): CallOverlay/useWebRTC komponent instance'i qo'ng'iroqlar
        // orasida unmount BO'LMAYDI (CallLayer butun ilova bo'ylab doimiy
        // mount qilingan — qarang CallLayer.tsx), shuning uchun useState bilan
        // saqlangan `muted`/`cameraOff`/`speakerOn`/`facingMode` avvalgi
        // qo'ng'iroqdan keyin ham eskicha qolib ketardi. Har bir qo'ng'iroq
        // tugaganda (yoki hali boshlanmasdan) bu holatlar boshlang'ich
        // qiymatiga qaytariladi — yangi qo'ng'iroq HAR DOIM ochiq mikrofon/
        // kamera va standart speaker bilan boshlanadi.
        setMuted(false)
        setCameraOff(false)
        setSpeakerOn(true)
        setFacingMode('user')
        facingModeRef.current = 'user'
        setMediaError(null)
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
                // Aniq audio constraint'lar: ba'zi noutbuklarda (ayniqsa
                // tashqi/USB mikrofon yoki drayver darajasidagi AGC muammosi
                // bo'lganlarda) constraint berilmasa brauzer standart
                // qurilmani noto'g'ri sozlashlar bilan ochishi mumkin va
                // audio deyarli eshitilmay qoladi. Bu yerda aniq yoqamiz.
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    // `{ideal: ...}` — laptop veb-kamerasi facingMode haqida
                    // umuman ma'lumot bermasa ham (odatiy holat), xato
                    // qaytarmasdan mavjud kamerani beradi.
                    video: {facingMode: {ideal: facingModeRef.current}},
                })
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop())
                    return
                }

                // ── Mikrofon diagnostikasi (Problem: "laptop mikrofoni
                // ishlamayapti") ──
                // Agar audio track umuman kelmasa (masalan OS darajasida
                // mikrofonga ruxsat berilgan-u, lekin boshqa dastur uni band
                // qilib turgan bo'lsa) — buni ANIQ xabar qilib beramiz,
                // aks holda foydalanuvchi bu "ilova xatosi" deb o'ylaydi.
                const audioTrack = stream.getAudioTracks()[0]
                if (!audioTrack) {
                    setMediaError(
                        "Mikrofon topilmadi yoki ruxsat berilmadi. Brauzer sozlamalaridan mikrofonga ruxsat berilganini tekshiring."
                    )
                } else {
                    // `track.muted` — brauzer/OS darajasida real vaqtda audio
                    // signal kelmayotganini bildiradi (masalan mikrofon
                    // boshqa ilova tomonidan band qilingan). Bu holatni
                    // kuzatib, foydalanuvchiga bildiramiz.
                    const reportHardwareMute = () => {
                        if (audioTrack.muted) {
                            setMediaError(
                                "Mikrofon signali kelmayapti — u boshqa dastur tomonidan band qilingan yoki OS darajasida o'chirilgan bo'lishi mumkin."
                            )
                        }
                    }
                    audioTrack.onmute = reportHardwareMute
                    audioTrack.onunmute = () => setMediaError(null)
                    audioTrack.onended = () => {
                        setMediaError('Mikrofon uzildi. Qurilmani tekshirib, qayta urinib ko\'ring.')
                    }
                    // Ba'zi noutbuklarda ruxsat berilgandan keyin ham track
                    // "muted: true" holatida boshlanadi — darhol tekshiramiz.
                    reportHardwareMute()
                }

                localStreamRef.current = stream
                if (localVideoRef.current) localVideoRef.current.srcObject = stream

                // Nechta kamera mavjudligini aniqlaymiz — faqat bittadan
                // ko'p bo'lsa "old/orqa" almashtirish tugmasi ko'rsatiladi.
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices()
                    const videoInputs = devices.filter((d) => d.kind === 'videoinput')
                    setCanSwitchCamera(videoInputs.length > 1)
                } catch {
                    setCanSwitchCamera(false)
                }
                // Instance darajasida tekshiramiz (prototype darajasidagi
                // tekshiruvdan ko'ra ishonchliroq — ba'zi brauzer/polyfill
                // kombinatsiyalarida metod faqat instance'da mavjud bo'ladi).
                // MUHIM: bu — brauzer platformasi cheklovi, deyarli barcha
                // mobil brauzerlar (Android Chrome, iOS Safari) setSinkId'ni
                // hali qo'llab-quvvatlamaydi, shu sabab tugma odatda faqat
                // desktop brauzerlarda ko'rinadi.
                setSpeakerSupported(
                    typeof (remoteVideoRef.current as unknown as {setSinkId?: unknown} | null)?.setSinkId ===
                        'function'
                )

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
                    if (s === 'connected') {
                        onConnectedRef.current?.()
                        // Diagnostika: har 4 soniyada audio bayt hisoblagichlarini
                        // konsolga yozamiz. Agar "audio yuborildi" o'sib borsa-yu,
                        // ikkinchi tomonda "audio qabul qilindi" o'smasa — bu aniq
                        // tarmoq/relay muammosi (mikrofon emas). Agar ikkalasi ham
                        // 0'da qolsa — track umuman qo'shilmagan/negotiate
                        // qilinmagan degani.
                        if (!statsIntervalRef.current) {
                            statsIntervalRef.current = window.setInterval(() => {
                                pc.getStats().then((stats) => {
                                    stats.forEach((report) => {
                                        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                                            console.log('[WebRTC audio] yuborilmoqda, bytesSent:', report.bytesSent)
                                        }
                                        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                                            console.log('[WebRTC audio] qabul qilinmoqda, bytesReceived:', report.bytesReceived, 'jitter:', report.jitter, 'packetsLost:', report.packetsLost)
                                        }
                                    })
                                }).catch(() => {})
                            }, 4000)
                        }
                    }
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

                // ── pc endi tayyor — shu vaqt oralig'ida "erta kelgan"
                // signallar bo'lsa, ularni endi qayta ishlaymiz (RACE FIX) ──
                pcReadyRef.current = true
                const queued = earlySignalQueueRef.current.splice(0)
                for (const sig of queued) {
                    await processSignalRef.current?.(sig)
                }
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
    // processSignal — pc ustida ishlaydigan asosiy mantiq. Bu ref orqali
    // saqlanadi, shunda setup() ichidan (pc tayyor bo'lgan zahoti, navbatni
    // bo'shatishda) ham, quyidagi jonli subscribe handler ichidan ham bir
    // xil funksiya chaqiriladi (RACE FIX — signal yo'qolib ketmaydi).
    const processSignalRef = useRef<((sig: SignalMessage) => Promise<void>) | null>(null)

    useEffect(() => {
        processSignalRef.current = async (sig: SignalMessage) => {
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
        }
    }, [flushPendingCandidates])

    useEffect(() => {
        if (!enabled) return

        const unsub = chatSocket.subscribe(async (sig: SignalMessage) => {
            // Har doim callIdRef'dan o'qiymiz — closure eskirgan bo'lsa ham
            // muammo yo'q (Problem 4).
            if (!sig.callId || sig.callId !== callIdRef.current) return

            // RACE FIX: pc hali tayyor bo'lmasa (getUserMedia/RTCPeerConnection
            // hali asinxron tayyorlanmoqda), signalni YO'QOTMASDAN navbatga
            // qo'yamiz — pc tayyor bo'lgach setup() ichida qayta ishlanadi.
            if (!pcReadyRef.current) {
                earlySignalQueueRef.current.push(sig)
                return
            }

            await processSignalRef.current?.(sig)
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

    // ── Speaker (chiqish qurilmasi) almashtirish ──
    // setSinkId — audio remoteVideoRef orqali chiqadi (video elementi audio
    // trekni ham o'z ichiga oladi), shuning uchun output shu elementga
    // qo'llaniladi. Qo'llab-quvvatlanmasa (masalan iOS Safari) tugma UI'da
    // umuman ko'rsatilmaydi (speakerSupported=false).
    const toggleSpeaker = useCallback(() => {
        const videoEl = remoteVideoRef.current as (HTMLVideoElement & {
            setSinkId?: (id: string) => Promise<void>
        }) | null
        if (!videoEl || typeof videoEl.setSinkId !== 'function') return

        setSpeakerOn((on) => {
            const next = !on
            ;(async () => {
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices()
                    const outputs = devices.filter((d) => d.kind === 'audiooutput')
                    if (next) {
                        // Standart (odatda bosh — telefon dinamigi/notebook
                        // dinamiklari) chiqishga qaytamiz.
                        await videoEl.setSinkId!('default')
                    } else {
                        // "Speaker" o'chirilganda — default bo'lmagan boshqa
                        // chiqish qurilmasi bo'lsa (masalan quloqchin/earpiece)
                        // shunga o'tamiz; topilmasa 'default' qoladi.
                        const alt = outputs.find((d) => d.deviceId && d.deviceId !== 'default')
                        if (alt) await videoEl.setSinkId!(alt.deviceId)
                    }
                } catch {
                    /* setSinkId muvaffaqiyatsiz — tugma holati baribir UI'da yangilanadi */
                }
            })()
            return next
        })
    }, [])

    // ── Old/orqa kamera almashtirish ──
    // Joriy video trekni to'xtatib, yangi facingMode bilan qayta
    // getUserMedia chaqiramiz va RTCRtpSender'dagi trekni almashtiramiz
    // (qayta negotiation shart emas — replaceTrack shu uchun bor).
    //
    // MUHIM FIX ("Could not start video source" xatosi): avvalgi versiyada
    // yangi kamera ochilishidan OLDIN eski trek to'xtatilmagan edi. Ko'p
    // qurilmalarda (asosan Android) kamera apparati bir vaqtning o'zida
    // faqat bitta "ochiq" oqimni qo'llab-quvvatlaydi — eski trek hali band
    // qilib turgan holda yangisini ochishga urinish
    // NotReadableError("Could not start video source") bilan tugaydi. Endi
    // avval eski trekni to'xtatib, kamerani "bo'shatamiz", so'ng yangisini
    // so'raymiz. Muvaffaqiyatsiz bo'lsa, eski kameraga qaytishga urinamiz.
    const switchCamera = useCallback(async () => {
        const pc = pcRef.current
        const stream = localStreamRef.current
        if (!pc || !stream) return

        const prevFacing = facingModeRef.current
        const nextFacing = prevFacing === 'user' ? 'environment' : 'user'

        const oldTrack = stream.getVideoTracks()[0]
        if (oldTrack) {
            stream.removeTrack(oldTrack)
            oldTrack.stop()
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null

        const acquire = async (facing: 'user' | 'environment') =>
            navigator.mediaDevices.getUserMedia({
                // `{ideal: ...}` — qattiq (`exact`) emas, moslashuvchan talab:
                // agar qurilmada aynan shu tomon kamera bo'lmasa ham, xato
                // qaytarmasdan mavjud kamerani beradi.
                video: {facingMode: {ideal: facing}},
                audio: false,
            })

        try {
            let newStream: MediaStream
            try {
                newStream = await acquire(nextFacing)
            } catch {
                // Ba'zi kamera drayverlari resursni darhol bo'shatmaydi —
                // qisqa kutib, bir marta qayta urinamiz.
                await new Promise((r) => setTimeout(r, 300))
                newStream = await acquire(nextFacing)
            }

            const newTrack = newStream.getVideoTracks()[0]
            if (!newTrack) throw new Error('Kamera trek topilmadi')

            const sender = pc.getSenders().find((s) => s.track === null || s.track?.kind === 'video')
            if (sender) await sender.replaceTrack(newTrack)

            newTrack.enabled = !cameraOff
            stream.addTrack(newTrack)
            if (localVideoRef.current) localVideoRef.current.srcObject = stream

            facingModeRef.current = nextFacing
            setFacingMode(nextFacing)
            setMediaError(null)
        } catch (err) {
            // Yangi kamerani ochib bo'lmadi — eski kameraga qaytishga
            // urinamiz, aks holda foydalanuvchi video'siz qolib ketadi.
            try {
                const fallbackStream = await acquire(prevFacing)
                const fallbackTrack = fallbackStream.getVideoTracks()[0]
                if (fallbackTrack) {
                    const sender = pc.getSenders().find((s) => s.track === null || s.track?.kind === 'video')
                    if (sender) await sender.replaceTrack(fallbackTrack)
                    fallbackTrack.enabled = !cameraOff
                    stream.addTrack(fallbackTrack)
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream
                }
            } catch {
                /* eski kameraga ham qaytib bo'lmadi — mediaError orqali xabar beramiz */
            }
            setMediaError(
                err instanceof Error
                    ? `Kamerani almashtirib bo'lmadi: ${err.message}`
                    : "Kamerani almashtirib bo'lmadi"
            )
        }
    }, [cameraOff])

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
        speakerOn,
        speakerSupported,
        toggleSpeaker,
        facingMode,
        canSwitchCamera,
        switchCamera,
    }
}
