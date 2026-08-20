import { API_BASE } from './api'
import type { SignalMessage } from './chatTypes'

type Subscriber = (signal: SignalMessage) => void
type StatusListener = (connected: boolean) => void

// Backend tomonidan ishlatiladigan maxsus WebSocket close code.
// 4003 = Account banned.
const ACCOUNT_BANNED_CLOSE_CODE = 4003

class ChatSocket {
  private ws: WebSocket | null = null
  private subscribers = new Set<Subscriber>()
  private statusListeners = new Set<StatusListener>()

  private reconnectAttempts = 0
  private reconnectTimer: number | null = null

  private manualClose = false
  private connected = false

  // Ban bo'lganidan keyin qayta ulanishni butunlay to'xtatadi.
  private permanentlyClosed = false

  // WS URL
  private buildUrl(): string | null {
    const token = localStorage.getItem('jwt')

    if (!token) {
      return null
    }

    // MUHIM: API_BASE endi bo'sh (nisbiy) bo'lishi mumkin (vite dev
    // proxy orqali /ws backend'ga yo'naltiriladi — qarang: lib/api.ts,
    // vite.config.ts). WebSocket konstruktori esa nisbiy URL'ni
    // http(s) sxemasi bilan qabul QILMAYDI (SyntaxError beradi) —
    // shuning uchun bu holatda joriy sahifa manzilidan (window.location)
    // to'g'ri ws(s):// URL o'zimiz quramiz.
    const wsBase = API_BASE
      ? API_BASE.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

    return `${wsBase}/ws?token=${encodeURIComponent(token)}`
  }

  connect() {
    // Account banned bo'lsa, hech qachon qayta ulanmaymiz.
    if (this.permanentlyClosed) {
      return
    }

    // Manual disconnect bo'lsa ham ulanmaymiz.
    if (this.manualClose) {
      return
    }

    if (
        this.ws &&
        (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
        )
    ) {
      return
    }

    const url = this.buildUrl()

    if (!url) {
      return
    }

    try {
      this.ws = new WebSocket(url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      // Ban sababli boshqa connection yopilgan bo'lsa,
      // bu connectionni qabul qilmaymiz.
      if (this.permanentlyClosed) {
        this.ws?.close()
        return
      }

      this.connected = true
      this.reconnectAttempts = 0

      this.emitStatus(true)
    }

    this.ws.onmessage = (event) => {
      let signal: SignalMessage

      try {
        signal = JSON.parse(event.data)
      } catch {
        return
      }

      // =========================================================
      // ACCOUNT BANNED
      // =========================================================

      if (signal.type === 'ACCOUNT_BANNED') {
        console.warn(
            '[ChatSocket] Account banned. WebSocket reconnect disabled.'
        )

        this.permanentlyClosed = true
        this.manualClose = true

        if (this.reconnectTimer != null) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }

        this.ws?.close(4003, 'Account suspended')

        return
      }

      // =========================================================
      // NORMAL SIGNAL
      // =========================================================

      this.subscribers.forEach((fn) => {
        try {
          fn(signal)
        } catch {
          // subscriber xatosi izolyatsiya qilinadi
        }
      })
    }

    this.ws.onclose = (event) => {
      this.connected = false
      this.emitStatus(false)

      this.ws = null

      // =========================================================
      // ACCOUNT BANNED
      // =========================================================

      if (event.code === ACCOUNT_BANNED_CLOSE_CODE) {
        console.warn(
            '[ChatSocket] Account banned. WebSocket reconnect disabled.'
        )

        this.permanentlyClosed = true
        this.manualClose = true

        // Oldindan rejalashtirilgan reconnect bo'lsa,
        // uni ham bekor qilamiz.
        if (this.reconnectTimer != null) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }

        return
      }

      // =========================================================
      // NORMAL CLOSE / NETWORK ERROR
      // =========================================================

      if (!this.manualClose && !this.permanentlyClosed) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // onerror'dan keyin browser odatda onclose chaqiradi.
      // Shuning uchun reconnectni bu yerda qilmaymiz.
      //
      // Muhim:
      // Agar account banned bo'lsa, onclose 4003 orqali
      // permanentlyClosed=true qiladi.
      //
      // Oddiy network xatosida esa onclose reconnect qiladi.

      if (this.permanentlyClosed) {
        return
      }

      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    // Ban yoki manual disconnect bo'lsa reconnect qilinmaydi.
    if (this.manualClose || this.permanentlyClosed) {
      return
    }

    // Bir vaqtning o'zida faqat bitta timer.
    if (this.reconnectTimer != null) {
      return
    }

    const delay = Math.min(
        1000 * 2 ** this.reconnectAttempts,
        15000
    )

    this.reconnectAttempts++

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null

      if (this.manualClose || this.permanentlyClosed) {
        return
      }

      this.connect()
    }, delay)
  }

  send(signal: SignalMessage): boolean {
    if (
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        !this.permanentlyClosed
    ) {
      this.ws.send(JSON.stringify(signal))
      return true
    }

    return false
  }

  // Joriy online foydalanuvchilar ro'yxatini QAYTA so'raydi.
  //
  // Nega kerak: ONLINE_USERS_LIST server tomonidan FAQAT ulanish
  // o'rnatilganda (bir marta) yuboriladi. Lekin bu socket butun
  // ilova uchun BITTA singleton — agar boshqa sahifa (masalan
  // Dashboard) allaqachon ulangan bo'lsa, keyinroq ochilgan sahifa
  // (masalan Chat) hech qachon shu dastlabki ro'yxatni olmaydi,
  // chunki connect() socket allaqachon OPEN bo'lsa hech narsa
  // qilmaydi. Natijada onlineIds to'liq bo'lmay qoladi — masalan
  // haqiqatda onlayn bo'lgan foydalanuvchi qidiruvda "offline" bo'lib
  // ko'rinadi, toki keyingi USER_ONLINE/OFFLINE signali kelmaguncha.
  //
  // Yechim: har safar bu kerak bo'lgan komponent mount bo'lganda
  // (yoki socket qayta ulanganda) shu metodni chaqiramiz — agar
  // socket allaqachon OPEN bo'lsa, serverga aniq so'rov yuboramiz;
  // hali ulanmagan bo'lsa hech narsa qilmaymiz (chunki connect()
  // tugagach ONLINE_USERS_LIST baribir avtomatik keladi).
  requestOnlineUsersRefresh(): void {
    this.send({ type: 'GET_ONLINE_USERS' } as SignalMessage)
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)

    return () => {
      this.subscribers.delete(fn)
    }
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn)

    // Joriy holatni darhol beramiz.
    fn(this.connected)

    return () => {
      this.statusListeners.delete(fn)
    }
  }

  private emitStatus(connected: boolean) {
    this.statusListeners.forEach((fn) => {
      try {
        fn(connected)
      } catch {
        // Status listener xatosi izolyatsiya qilinadi.
      }
    })
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect() {
    this.manualClose = true

    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.ws?.close()
    this.ws = null

    this.connected = false
  }

  markPermanentlyClosed() {
    this.permanentlyClosed = true
    this.manualClose = true

    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectAttempts = 0
  }

  /**
   * Account ban bo'lganidan keyin logout/login orqali
   * yangi session boshlash uchun reset.
   */
  reset() {
    this.permanentlyClosed = false
    this.manualClose = false
    this.reconnectAttempts = 0

    // Agar eski socket yopiq bo'lsa, yangi ulanishni boshlaydi
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect()
    }
  }
}

// Singleton — butun ilova uchun bitta WebSocket.
export const chatSocket = new ChatSocket()