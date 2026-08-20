// callAudio — chaqiruvchi va qabul qiluvchi uchun signal ovozlari.
//
//   • ringback — "gudok" ovozi, CALLER eshitadi (call.state === 'calling')
//   • ringtone — kiruvchi qo'ng'iroq ovozi, CALLEE eshitadi (call.state === 'incoming')
//
// Tashqi mp3/audio fayl talab qilinmasligi uchun Web Audio API orqali
// ohang generatsiya qilinadi (ikkita sinus tovush — klassik telefoniya
// uslubi). Brauzerlarning autoplay siyosati AudioContext'ni foydalanuvchi
// gesture'isiz ishga tushirishga to'sqinlik qiladi, shuning uchun birinchi
// pointerdown/keydown'da context oldindan "unlock" qilib qo'yiladi —
// shunda keyinchalik WebSocket signalidan kelib chalinadigan ovoz
// (gesture bo'lmasa ham) muvaffaqiyatli ishga tushadi.

type ToneKind = 'ringtone' | 'ringback'

class CallAudio {
  private ctx: AudioContext | null = null
  private timer: number | null = null
  private activeKind: ToneKind | null = null

  constructor() {
    if (typeof window === 'undefined') return
    const unlock = () => {
      const ctx = this.getCtx()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
    }
    return this.ctx
  }

  private beep(freqs: number[], duration: number, startAt: number) {
    const ctx = this.getCtx()
    const t0 = ctx.currentTime + startAt
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.03)
      gain.gain.setValueAtTime(0.12, t0 + duration - 0.05)
      gain.gain.linearRampToValueAtTime(0, t0 + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + duration + 0.02)
    })
  }

  play(kind: ToneKind) {
    if (this.activeKind === kind) return // allaqachon chalinmoqda
    this.stop()
    this.activeKind = kind

    const ctx = this.getCtx()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    if (kind === 'ringtone') {
      // Kiruvchi qo'ng'iroq: ikkita tez bip, so'ng pauza — 2.4s davr
      const cycle = () => {
        this.beep([880, 1108], 0.35, 0)
        this.beep([880, 1108], 0.35, 0.45)
      }
      cycle()
      this.timer = window.setInterval(cycle, 2400)
    } else {
      // Ringback ("gudok"): 1s ovoz, 2s sukunat — 3s davr
      const cycle = () => this.beep([440, 480], 1.0, 0)
      cycle()
      this.timer = window.setInterval(cycle, 3000)
    }
  }

  stop() {
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.activeKind = null
  }
}

export const callAudio = new CallAudio()
