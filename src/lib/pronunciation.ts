// Flashcard talaffuz (IPA) va ta'rif.  Foydalanuvchi so'z yozib,
// boshqa maydonga o'tganda (blur) chaqiriladi.
//
// Backend (`POST /api/flashcards/pronounce`) ikki bosqichli qidiradi:
//   1. Free Dictionary API (dictionaryapi.dev) — 7 tilni qamraydi:
//      en, de, ko, ja, fr, es, ru.  Topilsa — IPA VA ta'rif bittа
//      so'rovda keladi.
//   2. Topilmasa (til qo'llab-quvvatlanmaydi yoki so'z yo'q) — self
//      hosted espeak-ng'ga fallback — faqat IPA (ta'rif yo'q, chunki
//      espeak lug'at emas).
// Natija backend'da DB'да KESHLANADI — bir xil (til, so'z) uchun
// ikkinchi so'rov (istalgan foydalanuvchidan) tashqi API/espeak-ng'ga
// umuman murojaat qilmasdan, to'g'ridan-to'g'ri DB'dan javob oladi.
//
// Frontend tomonda ham ikki qatlamli kesh bor:
//   1. Xotiradagi Map — shu sahifa sessiyasida eng tez (tarmoq
//      so'rovisiz).
//   2. localStorage — sahifa qayta yuklansa (reload) ham saqlanib
//      qoladi, shuning uchun oldin ko'rilgan kartalar uchun backend'ga
//      ham murojaat qilinmaydi.

import { api } from './api'

export interface PronunciationResult {
  ipa: string | null
  description: string | null
  source: 'dictionary' | 'espeak' | null
  // Dictionary API ba'zan native speaker yozib olgan haqiqiy audio
  // faylini ham qaytaradi (asosan inglizcha so'zlar uchun) — bo'lsa,
  // Web Speech API'ga qaraganda ancha tabiiyroq eshitiladi.
  audioUrl: string | null
}

const EMPTY: PronunciationResult = {
  ipa: null,
  description: null,
  source: null,
  audioUrl: null,
}

// Free Dictionary API shu tillarni qamraydi (backenddagi ro'yxat bilan
// bir xil bo'lishi kerak) — faqat `fetchPronunciationGuessLanguage`
// nomzod tillarni saralashda ishlatadi, chunki dictionary bo'lmagan
// tilni sinab ko'rishning ma'nosi yo'q (baribir espeak-ng'ga tushadi).
const DICTIONARY_API_LANGS = new Set(['en', 'de', 'ko', 'ja', 'fr', 'es', 'ru'])

// ── 1-qatlam: xotiradagi kesh — reload bo'lsa tozalanadi ──
const cache = new Map<string, PronunciationResult>()

// ── 2-qatlam: localStorage — reload'dan keyin ham saqlanadi ──
const LOCAL_STORAGE_KEY = 'livelingo:pronunciation-cache:v1'
// Juda katta bo'lib ketmasligi uchun eng ko'p shuncha so'z saqlanadi
// (eskisi — eng birinchi qo'shilgani — chiqarib tashlanadi).
const LOCAL_STORAGE_MAX_ENTRIES = 2000

function loadLocalCache(): Map<string, PronunciationResult> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as [string, PronunciationResult][]
    return new Map(parsed)
  } catch {
    // Buzilgan/eski formatdagi kesh — e'tiborsiz qoldiramiz
    return new Map()
  }
}

function persistLocalCache(): void {
  if (typeof window === 'undefined') return
  try {
    let entries = Array.from(localCache.entries())
    if (entries.length > LOCAL_STORAGE_MAX_ENTRIES) {
      entries = entries.slice(entries.length - LOCAL_STORAGE_MAX_ENTRIES)
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // masalan localStorage to'lib qolgan (quota) — jim o'tkazib yuboramiz,
    // xotiradagi (session) kesh baribir ishlayveradi
  }
}

const localCache = loadLocalCache()

// languageCode (bizning ilovadagi format) → BCP-47 (Web Speech API talab
// qiladigan format).  Faqat speechSynthesis uchun kerak.
const SPEECH_SYNTH_LANG: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  ko: 'ko-KR',
  ja: 'ja-JP',
  fr: 'fr-FR',
  es: 'es-ES',
  ru: 'ru-RU',
  zh: 'zh-CN',
  uz: 'uz-UZ',
}

/**
 * So'zni ovozli o'qiydi — ikki bosqichli, butunlay bepul:
 *   1. `audioUrl` berilgan bo'lsa (Dictionary API'dan, odatda native
 *      speaker yozib olgan) — o'shani ijro etadi.
 *   2. Bo'lmasa — brauzerning Web Speech API (`speechSynthesis`)
 *      orqali o'qiydi.
 *
 * Har safar chaqirilganda avvalgi ovoz/audio DARHOL to'xtatiladi —
 * aks holda ketma-ket bosishlarda so'zlar navbatga (queue) tushib,
 * noto'g'ri tartibda yoki kech chiqib qolishi mumkin (Chrome'ning
 * ma'lum xatosi).
 *
 * `handlers` — ixtiyoriy: UI'da haqiqiy holatni (masalan "hozir
 * ijro etilyapti" spinner) ko'rsatish uchun.
 *
 * Hech narsa saqlanmaydi, hech qanday backend chaqirilmaydi.
 */
export function speakText(
  text: string,
  languageCode: string,
  audioUrl?: string | null,
  handlers?: { onStart?: () => void; onEnd?: () => void }
): void {
  const word = text.trim()
  if (!word) return

  // Avvalgi so'rov nima bo'lishidan qat'iy nazar — darhol to'xtatamiz.
  stopAllSpeech()

  // ── 1-bosqich: Dictionary API audio fayli ──
  if (audioUrl) {
    const audio = new Audio(audioUrl)
    currentAudio = audio
    audio.addEventListener('playing', () => handlers?.onStart?.())
    audio.addEventListener('ended', () => handlers?.onEnd?.())
    audio.addEventListener('error', () => handlers?.onEnd?.())
    audio.play().catch(() => {
      // Audio ijro bo'lmasa (masalan brauzer bloklagan) — Web Speech'ga
      // tushamiz, foydalanuvchi hech bo'lmasa biror narsa eshitsin.
      void speakWithWebSpeech(word, languageCode, handlers)
    })
    return
  }

  // ── 2-bosqich: Web Speech API ──
  void speakWithWebSpeech(word, languageCode, handlers)
}

/**
 * Hozir ijro etilayotgan har qanday audio/ovozni to'xtatadi. Karta
 * o'zgarganda yoki komponent unmount bo'lganda chaqiriladi — aks
 * holda eski so'z yangi kartaga o'tilgandan keyin ham davom etib
 * eshitilaveradi.
 */
export function stopSpeech(): void {
  stopAllSpeech()
}

let currentAudio: HTMLAudioElement | null = null
// Har `speakText` chaqiruvida oshadi — eskirgan (stale) async so'rovlar
// (masalan ovozlar hali yuklanayotganda foydalanuvchi boshqa so'zni
// bosib qo'ysa) o'zini "bekor qilingan" deb bilib, ijro etmay qo'yadi.
let speechGeneration = 0

function stopAllSpeech(): void {
  speechGeneration++
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const synth = window.speechSynthesis
    // Chrome'ning ma'lum xatosi: agar utterance hali "speaking"
    // holatiga o'tmagan (hali "pending") bo'lsa, faqat cancel()
    // chaqirish uni navbatdan har doim ham to'liq olib
    // tashlamaydi — keyinroq foydalanuvchi istalgan joyni bossa
    // (masalan Know/Don't know), o'sha eskirgan so'z to'satdan
    // chiqib qoladi. Avval pause(), keyin cancel() — bu
    // navbatni ishonchliroq tozalaydi.
    try {
      synth.pause()
    } catch {
      // ba'zi brauzerlarda pause() mavjud emas — muammo emas
    }
    synth.cancel()
  }
}

// ── Ovozlar ro'yxati — brauzer buni asinxron yuklaydi, shuning uchun
//    bir marta kutib olib, keshda saqlaymiz (har safar qayta so'rash
//    ham sekinlashtiradi, ham "hali yuklanmagan" holatda noto'g'ri
//    ovoz tanlanishiga sabab bo'ladi). ──
let voicesCache: SpeechSynthesisVoice[] = []
let voicesLoaded = false

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([])
      return
    }
    const synth = window.speechSynthesis
    const existing = synth.getVoices()
    if (existing.length > 0) {
      voicesCache = existing
      voicesLoaded = true
      resolve(existing)
      return
    }
    const handler = () => {
      voicesCache = synth.getVoices()
      voicesLoaded = true
      synth.removeEventListener('voiceschanged', handler)
      resolve(voicesCache)
    }
    synth.addEventListener('voiceschanged', handler)
    // Ba'zi brauzerlarda voiceschanged umuman otilmaydi — shuning
    // uchun zaxira timeout.
    setTimeout(() => {
      if (!voicesLoaded) {
        voicesCache = synth.getVoices()
        voicesLoaded = true
        resolve(voicesCache)
      }
    }, 500)
  })
}

// Til bo'yicha tanlangan ovozni keshlaymiz — shunda har safar bir xil
// ovoz ishlatiladi (ba'zan tarmoq ovozi, ba'zan lokal ovoz tasodifiy
// tanlanib, tovush "o'zgarib qolayotgandek" tuyulishining oldini oladi).
const pickedVoiceCache = new Map<string, SpeechSynthesisVoice | null>()

function pickVoice(bcp47: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (pickedVoiceCache.has(bcp47)) return pickedVoiceCache.get(bcp47) ?? null

  const lang = bcp47.toLowerCase()
  const langPrefix = lang.split('-')[0]
  const exact = voices.filter((v) => v.lang.toLowerCase() === lang)
  const byPrefix = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix))
  const pool = exact.length > 0 ? exact : byPrefix

  // Lokal (qurilmadagi) ovozlar tarmoq ovozlariga qaraganda tezroq va
  // barqarorroq ishlaydi (Chrome'da tarmoq ovozlari ba'zan sekinlashib
  // yoki "osilib" qoladi) — shuning uchun ularni afzal ko'ramiz.
  const chosen = pool.find((v) => v.localService) ?? pool[0] ?? null
  pickedVoiceCache.set(bcp47, chosen)
  return chosen
}

async function speakWithWebSpeech(
  word: string,
  languageCode: string,
  handlers?: { onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    handlers?.onEnd?.()
    return
  }

  const synth = window.speechSynthesis
  const myGeneration = speechGeneration

  // Chrome'ning ma'lum xatosi: cancel() dan keyin darhol speak()
  // chaqirilsa, ba'zan sukut saqlab navbatga tushib qoladi (ovoz
  // chiqmaydi yoki keyingi so'zdan keyin kech chiqadi). Shu sabab
  // kichik kutish qo'shildi.
  await new Promise((resolve) => setTimeout(resolve, 60))
  if (myGeneration !== speechGeneration) return // shu orada bekor qilingan

  const voices = voicesLoaded ? voicesCache : await loadVoices()
  if (myGeneration !== speechGeneration) return // ovoz yuklanayotganda bekor qilingan

  const bcp47 = SPEECH_SYNTH_LANG[languageCode] ?? languageCode
  const voice = pickVoice(bcp47, voices)

  const makeUtterance = () => {
    const u = new SpeechSynthesisUtterance(word)
    u.lang = bcp47
    if (voice) u.voice = voice
    u.onstart = () => handlers?.onStart?.()
    u.onend = () => handlers?.onEnd?.()
    u.onerror = () => handlers?.onEnd?.()
    return u
  }

  let started = false
  const utterance = makeUtterance()
  utterance.onstart = () => {
    started = true
    handlers?.onStart?.()
  }
  synth.speak(utterance)

  // Ba'zan (asosan tarmoq orqali ishlaydigan ovozlarda) utterance
  // sukut saqlab hech qachon boshlanmaydi — Chrome'ning yana bir
  // ma'lum xatosi.  Shu generation hali eng oxirgisi bo'lsa va
  // haqiqatan ham hech narsa ijro etilmayotgan bo'lsa — bir marta
  // avtomatik qayta urinamiz, foydalanuvchi qayta bosishiga hojat
  // qolmasin.
  setTimeout(() => {
    if (!started && myGeneration === speechGeneration && !synth.speaking) {
      synth.cancel()
      synth.speak(makeUtterance())
    }
  }, 700)

  // ── Majburiy "hang" himoyasi ──
  // Agar shu til uchun brauzerda mos ovoz umuman bo'lmasa (masalan
  // ba'zi tillarda hech qanday voice o'rnatilmagan bo'lishi mumkin),
  // speak() chaqirilgandan keyin `onstart` HECH QACHON otilmasligi
  // mumkin — natijada tugma abadiy "gapiryapti" holatida qolib
  // ketadi va keyinchalik (masalan Know/Don't know bosilganda,
  // qandaydir user gesture Chrome navbatini "uyg'otib yuborsa")
  // eskirgan so'z kutilmaganda chiqib qoladi. Shu sabab: agar
  // 3 soniya ichida hali ham boshlanmagan bo'lsa — butunlay voz
  // kechamiz, navbatni tozalaymiz va UI'ni "tugadi" holatiga
  // qaytaramiz — foydalanuvchi keyingi kartaga xotirjam o'tishi
  // mumkin, orqada hech narsa "kutib" turmaydi.
  setTimeout(() => {
    if (!started && myGeneration === speechGeneration) {
      synth.cancel()
      handlers?.onEnd?.()
    }
  }, 3000)
}

/** Brauzer audio ijro yoki Web Speech'ni qo'llab-quvvatlaydimi — buttonni
 *  yashirish/disable qilish kerak bo'lsa shundan foydalanish mumkin. */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export async function fetchPronunciation(
  text: string,
  languageCode: string
): Promise<PronunciationResult> {
  const word = text.trim().toLowerCase()
  if (!word) return EMPTY

  const key = `${languageCode}:${word}`

  // ── 1-qatlam: xotiradagi kesh ──
  const inMemory = cache.get(key)
  if (inMemory) return inMemory

  // ── 2-qatlam: localStorage (oldingi sessiyalardan) ──
  const fromLocalStorage = localCache.get(key)
  if (fromLocalStorage) {
    cache.set(key, fromLocalStorage)
    return fromLocalStorage
  }

  // ── 3-qatlam: backend (o'zi ham DB'да keshlaydi — Dictionary API
  // yoki espeak-ng'ga faqat DB'da hali yo'q so'zlar uchun murojaat
  // qiladi) ──
  let result: PronunciationResult = EMPTY

  try {
    const res = await api.post<PronunciationResult>('/api/flashcards/pronounce', {
      text: word,
      languageCode,
    })
    if (res && (res.ipa || res.description || res.audioUrl)) {
      result = res
    }
  } catch {
    // Backend ham topa olmadi (yoki tarmoq xatosi) — result EMPTY qoladi.
    // Bo'sh natijani localStorage'ga yozmaymiz, chunki keyinroq
    // (masalan tarmoq tiklanganda) qayta urinib ko'rilsin.
    cache.set(key, result)
    return result
  }

  cache.set(key, result)
  localCache.set(key, result)
  persistLocalCache()
  return result
}

/**
 * Til noma'lum bo'lganda (masalan flashcard "back" tomoni — tarjima
 * qaysi tilda ekani saqlanmagan) — nomzod tillarni ketma-ket sinab
 * ko'radi, birinchi topilganini qaytaradi.
 *
 * Odatda foydalanuvchining "ona til"lari ro'yxati beriladi (1 yoki
 * bir nechta).  Hech biri topilmasa — birinchi nomzod tili bilan
 * espeak-ng orqali faqat IPA olishga urinadi (ta'rifsiz).
 */
export async function fetchPronunciationGuessLanguage(
  text: string,
  candidateLangs: string[]
): Promise<PronunciationResult> {
  const word = text.trim()
  if (!word || candidateLangs.length === 0) return EMPTY

  // Avval faqat Dictionary API qamrab oladigan nomzodlarni ketma-ket
  // sinaymiz — qaysi birida so'z topilsa, o'shani olamiz.
  for (const lang of candidateLangs) {
    if (!DICTIONARY_API_LANGS.has(lang)) continue
    const res = await fetchPronunciation(word, lang)
    if (res.ipa || res.description) return res
  }

  // Hech qaysi tilda dictionary topmadi — birinchi nomzod bilan
  // espeak-ng'дан hech bo'lmasa IPA so'raymiz (ta'rifsiz).
  return fetchPronunciation(word, candidateLangs[0])
}
