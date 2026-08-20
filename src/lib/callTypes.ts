// Call state machine uchun tiplar.
//
// State diagram (Problem 1 / Problem 7):
//
//   idle ──CALL(out)──► calling ──ACCEPT(in)──► connecting ──PC connected──► connected
//    │                     │                                                    │
//    │                  REJECT/                                                END/
//    │                  BUSY/END                                             hangup
//    │                     │                                                    │
//    ▼                     ▼                                                    ▼
//   idle ◄──────────────ended ◄──────────────────────────────────────────────ended
//
//   idle ──CALL(in)──► incoming ──ACCEPT(local)──► connecting ──PC connected──► connected
//                          │
//                       REJECT
//                          │
//                          ▼
//                        idle

export type CallState =
  | 'idle'
  | 'calling'      // biz qo'ng'iroq qildik, ACCEPT/callId kutyapmiz
  | 'incoming'     // bizga qo'ng'iroq kelyapti, popup ko'rsatilyapti
  | 'connecting'   // ACCEPT bo'ldi va callId mavjud — WebRTC negotiation boshlanadi
  | 'connected'    // RTCPeerConnection connectionState === 'connected'
  | 'ended'        // qo'ng'iroq tugadi, qisqa vaqt UI'da ko'rinadi, so'ng CLEAR

export type EndedReason = 'hangup' | 'rejected' | 'missed' | 'busy' | 'error'

export interface ActiveCall {
  // Backend tomonidan yaratiladigan ID. Caller uchun boshida bo'sh string,
  // backend CALL signalini caller'ga qaytarganda to'ldiriladi (Problem 3).
  callId: string
  peerId: string
  peerName: string
  state: CallState
  isCaller: boolean
  startedAt?: number
  endedReason?: EndedReason
}

// useWebRTC ichida ishlatiladigan ICE candidate ko'rinishi — backend
// candidate'ni JSON-string qilib yuboradi, biz uni parse qilamiz.
export type SerializedIceCandidate = RTCIceCandidateInit | string
