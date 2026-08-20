// CallProvider — markazlashgan CallManager.
//
// Faqat quyidagilarga javobgar (Problem 13/14):
//   • CALL / ACCEPT / REJECT / END / MISSED / USER_BUSY signallarini qabul qilish
//   • Call state machine: idle → calling/incoming → connecting → connected → ended
//   • callId'ni state'dan MUSTAQIL ravishda sinxronlash (Problem 3)
//
// SDP/ICE haqida hech narsa bilmaydi — bu useWebRTC'ning ishi.
//
// MUHIM (Problem: "call faqat Chat sahifasida ishlaydi"): bu Provider endi
// App darajasida, BARCHA sahifalarni o'rab turgan holda mount qilinadi
// (qarang: App.tsx / CallLayer.tsx), shuning uchun u endi Chat.tsx'ning
// lokal `chats` ro'yxatiga bog'liq bo'lolmaydi — kiruvchi qo'ng'iroqda
// peer ismini o'zi, mustaqil ravishda profileApi orqali so'raydi.

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { chatSocket } from '../lib/chatSocket'
import type { SignalMessage } from '../lib/chatTypes'
import type { ActiveCall, CallState, EndedReason } from '../lib/callTypes'
import { profileApi } from '../lib/profileApi'
import { CallContext, type CallContextValue } from './CallContext'

interface ProviderState {
  call: ActiveCall | null
  // Caller uchun: ACCEPT callId hali sinxronlanmasdan kelib qolishi mumkin
  // (backend CALL'ni receiver'ga va caller'ga alohida yuboradi — Problem 3).
  // Bu holatda "connecting"ga o'tishni callId kelgunga qadar kechiktiramiz.
  pendingAccept: boolean
}

type Action =
  | { type: 'START_CALL'; peerId: string; peerName: string }
  | { type: 'INCOMING_CALL'; callId: string; peerId: string; peerName: string }
  | { type: 'CALL_ID_SYNC'; callId: string }
  | { type: 'REMOTE_ACCEPTED' }
  | { type: 'LOCAL_ACCEPT' }
  | { type: 'PEER_CONNECTED' }
  | { type: 'END'; reason: EndedReason }
  | { type: 'CLEAR' }
  // Kiruvchi qo'ng'iroqda ism darhol ma'lum bo'lmasligi mumkin — u
  // profileApi orqali asinxron olingach shu action bilan yangilanadi.
  | { type: 'PEER_NAME_RESOLVED'; peerId: string; peerName: string }

const initialState: ProviderState = { call: null, pendingAccept: false }

function reducer(state: ProviderState, action: Action): ProviderState {
  switch (action.type) {
    case 'START_CALL':
      if (state.call) return state // allaqachon faol qo'ng'iroq bor
      return {
        call: {
          callId: '',
          peerId: action.peerId,
          peerName: action.peerName,
          state: 'calling',
          isCaller: true,
        },
        pendingAccept: false,
      }

    case 'INCOMING_CALL':
      if (state.call) return state // band — backend USER_BUSY yuboradi
      return {
        call: {
          callId: action.callId,
          peerId: action.peerId,
          peerName: action.peerName,
          state: 'incoming',
          isCaller: false,
        },
        pendingAccept: false,
      }

    // Backend CALL'ni caller'ga callId bilan qaytarganda keladi.
    // callId state'dan mustaqil yangilanadi (Problem 3).
    case 'CALL_ID_SYNC': {
      if (!state.call || !state.call.isCaller || state.call.callId) return state
      const nextCallState: CallState = state.pendingAccept
        ? 'connecting'
        : state.call.state
      return {
        call: { ...state.call, callId: action.callId, state: nextCallState },
        pendingAccept: false,
      }
    }

    // Callee ACCEPT bosdi, biz (caller) signalni oldik.
    case 'REMOTE_ACCEPTED': {
      if (!state.call || !state.call.isCaller) return state
      if (!state.call.callId) {
        // callId hali kelmagan — CALL_ID_SYNC kelganda connecting'ga o'tamiz
        return { ...state, pendingAccept: true }
      }
      return {
        call: { ...state.call, state: 'connecting' },
        pendingAccept: false,
      }
    }

    // Biz (callee) ACCEPT bosdik.
    case 'LOCAL_ACCEPT': {
      if (!state.call || state.call.isCaller) return state
      return {
        call: { ...state.call, state: 'connecting' },
        pendingAccept: false,
      }
    }

    // useWebRTC PeerConnection 'connected' holatiga o'tganini xabar qildi.
    case 'PEER_CONNECTED': {
      if (!state.call) return state
      return {
        call: { ...state.call, state: 'connected', startedAt: Date.now() },
        pendingAccept: false,
      }
    }

    case 'END': {
      if (!state.call) return state
      return {
        call: { ...state.call, state: 'ended', endedReason: action.reason },
        pendingAccept: false,
      }
    }

    case 'PEER_NAME_RESOLVED': {
      if (!state.call || state.call.peerId !== action.peerId) return state
      return { ...state, call: { ...state.call, peerName: action.peerName } }
    }

    case 'CLEAR':
      return { call: null, pendingAccept: false }

    default:
      return state
  }
}

interface Props {
  children: ReactNode
}

export default function CallProvider({ children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Signal subscriber'ning stale closure ko'rmasligi uchun ref
  // (Problem 4 printsipi Provider darajasida ham qo'llanadi).
  const stateRef = useRef(state)

  useEffect(() => { stateRef.current = state }, [state])

  // ── Signalizatsiya: CALL / ACCEPT / REJECT / END / MISSED / USER_BUSY ──
  useEffect(() => {
    const unsub = chatSocket.subscribe((sig: SignalMessage) => {
      // DEBUG — muammoni topgach o'chirib tashlang
      if (['CALL', 'ACCEPT', 'REJECT', 'END', 'MISSED', 'USER_BUSY'].includes(sig.type)) {
        console.log('[CallProvider] signal:', JSON.stringify(sig), 'currentCall:', JSON.stringify(stateRef.current.call))
      }
      switch (sig.type) {
        case 'CALL': {
          if (!sig.from || !sig.callId) break
          const current = stateRef.current.call
          if (current?.isCaller && !current.callId) {
            // Backend'ning caller'ga o'zi yaratgan callId'ni qaytarishi.
            // MUHIM: bu signalda "from" maydoni CALLER'NING O'Z ID'SI
            // bo'ladi (backend uni caller'ga "sizning qo'ng'irog'ingiz
            // shu callId bilan yaratildi" sifatida yuboradi) — shuning
            // uchun sig.from'ni current.peerId (callee) bilan solishtirib
            // bo'lmaydi. Bu tarmoqdagi holat: biz caller ekanmiz va
            // callId hali kelmagan bo'lsa, keladigan CALL signali
            // faqat shu sinxronizatsiya bo'lishi mumkin.
            dispatch({ type: 'CALL_ID_SYNC', callId: sig.callId })
          } else if (!current) {
            // Bizga yangi qo'ng'iroq — peer ismi hozircha noma'lum,
            // profileApi orqali asinxron aniqlanadi (pastda).
            const peerId = sig.from
            dispatch({
              type: 'INCOMING_CALL',
              callId: sig.callId,
              peerId,
              peerName: '…',
            })
            profileApi
              .getProfile(peerId)
              .then((p) => {
                dispatch({
                  type: 'PEER_NAME_RESOLVED',
                  peerId,
                  peerName: `${p.firstName} ${p.lastName}`.trim() || 'Foydalanuvchi',
                })
              })
              .catch(() => {
                dispatch({ type: 'PEER_NAME_RESOLVED', peerId, peerName: 'Foydalanuvchi' })
              })
          }
          break
        }
        case 'ACCEPT': {
          const current = stateRef.current.call
          if (current?.isCaller && current.peerId === sig.from) {
            dispatch({ type: 'REMOTE_ACCEPTED' })
          }
          break
        }
        case 'REJECT':
          dispatch({ type: 'END', reason: 'rejected' })
          break
        case 'MISSED':
          dispatch({ type: 'END', reason: 'missed' })
          break
        case 'USER_BUSY':
          dispatch({ type: 'END', reason: 'busy' })
          break
        case 'END':
          dispatch({ type: 'END', reason: 'hangup' })
          break
      }
    })
    return unsub
  }, [])

  // 'ended' holati qisqa vaqt UI'da ko'rinadi (masalan "Rad etildi"), so'ng
  // avtomatik tozalanadi.
  useEffect(() => {
    if (state.call?.state !== 'ended') return
    const t = window.setTimeout(() => dispatch({ type: 'CLEAR' }), 1500)
    return () => window.clearTimeout(t)
  }, [state.call?.state])

  const startCall = useCallback((peerId: string, peerName: string) => {
    if (stateRef.current.call) return
    const ok = chatSocket.send({ type: 'CALL', to: peerId })
    console.log('[CallProvider] send CALL ->', peerId, 'ok:', ok, 'wsConnected:', chatSocket.isConnected())
    dispatch({ type: 'START_CALL', peerId, peerName })
  }, [])

  const acceptCall = useCallback(() => {
    const call = stateRef.current.call
    if (!call || call.state !== 'incoming') {
      console.log('[CallProvider] acceptCall aborted — call:', JSON.stringify(call))
      return
    }
    const ok = chatSocket.send({ type: 'ACCEPT', to: call.peerId, callId: call.callId })
    console.log('[CallProvider] send ACCEPT -> peer:', call.peerId, 'callId:', call.callId, 'ok:', ok, 'wsConnected:', chatSocket.isConnected())
    dispatch({ type: 'LOCAL_ACCEPT' })
  }, [])

  const rejectCall = useCallback(() => {
    const call = stateRef.current.call
    if (!call) return
    chatSocket.send({ type: 'REJECT', to: call.peerId, callId: call.callId })
    dispatch({ type: 'CLEAR' })
  }, [])

  const endCall = useCallback(() => {
    const call = stateRef.current.call
    if (!call) return
    chatSocket.send({ type: 'END', to: call.peerId, callId: call.callId })
    dispatch({ type: 'END', reason: 'hangup' })
  }, [])

  const notifyPeerConnected = useCallback(() => {
    dispatch({ type: 'PEER_CONNECTED' })
  }, [])

  const notifyPeerDisconnected = useCallback(() => {
    // Faqat allaqachon connected bo'lgan qo'ng'iroq kutilmaganda uzilsa
    // yakunlaymiz — 'connecting' bosqichidagi vaqtinchalik uzilishlarni
    // (masalan glare paytida) call tugatish sifatida talqin qilmaymiz.
    if (stateRef.current.call?.state === 'connected') {
      const call = stateRef.current.call
      chatSocket.send({ type: 'END', to: call.peerId, callId: call.callId })
      dispatch({ type: 'END', reason: 'error' })
    }
  }, [])

  const value: CallContextValue = {
    call: state.call,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    notifyPeerConnected,
    notifyPeerDisconnected,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
