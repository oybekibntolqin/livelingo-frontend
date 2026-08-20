// CallContext — Chat.tsx va CallOverlay o'rtasida call state'ni ulashish.
//
// Chat.tsx bu context'ga faqat CALL/ACCEPT/REJECT/END/MISSED darajasida
// ishlaydi (Problem 13). SDP/ICE haqida hech narsa bilmaydi.

import { createContext, useContext } from 'react'
import type { ActiveCall } from '../lib/callTypes'

export interface CallContextValue {
  call: ActiveCall | null
  startCall: (peerId: string, peerName: string) => void
  acceptCall: () => void
  rejectCall: () => void
  endCall: () => void
  // useWebRTC connectionState 'connected' bo'lganda CallOverlay shu orqali
  // CallProvider'ga xabar beradi — call.state 'connected'ga o'tadi va
  // startedAt belgilanadi (Problem 1: state machine markazlashgan bo'lishi kerak).
  notifyPeerConnected: () => void
  notifyPeerDisconnected: () => void
}

export const CallContext = createContext<CallContextValue | null>(null)

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext)
  if (!ctx) {
    throw new Error('useCall() faqat <CallProvider> ichida ishlatilishi kerak')
  }
  return ctx
}
