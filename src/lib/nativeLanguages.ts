// Foydalanuvchining "ona til"lari (LanguageRole.NATIVE) — flashcard
// back tomonidagi talaffuz/ta'rifni qaysi tilda qidirishni bilish
// uchun.  Mavjud /api/languages endpoint'idan foydalanadi (boshqa
// sahifalarda ham shu pattern ishlatiladi).

import { api } from './api'

export async function fetchNativeLanguageCodes(): Promise<string[]> {
  try {
    const langs = await api.get<
      { languageCode: string; languageRole: 'NATIVE' | 'LEARNING' }[]
    >('/api/languages')
    return langs
      .filter((l) => l.languageRole === 'NATIVE')
      .map((l) => l.languageCode)
  } catch {
    return []
  }
}

// Foydalanuvchi o'rganayotgan til(lar)i. Onboarding'da user bir nechta
// til tanlashi mumkin, shuning uchun ro'yxatni to'liq qaytaramiz —
// chaqiruvchi tomon birinchisini "aktiv til" sifatida ishlatishi yoki
// tanlov ko'rsatishi mumkin. Avval ko'p joyda bu tekshirilmay to'g'ridan
// -to'g'ri 'en' ishlatilardi, shu sabab boshqa til o'rganayotgan
// foydalanuvchilar uchun progress/mashqlar doim inglizcha ko'rsatilardi.
export async function fetchLearningLanguageCodes(): Promise<string[]> {
  try {
    const langs = await api.get<
      { languageCode: string; languageRole: 'NATIVE' | 'LEARNING' }[]
    >('/api/languages')
    return langs
      .filter((l) => l.languageRole === 'LEARNING')
      .map((l) => l.languageCode)
  } catch {
    return []
  }
}

// Qulaylik uchun: birinchi (asosiy) o'rganilayotgan tilni oladi,
// hech narsa topilmasa 'en'ga tushadi (masalan onboarding hali
// tugallanmagan bo'lsa).
export async function fetchPrimaryLearningLanguageCode(): Promise<string> {
  const codes = await fetchLearningLanguageCodes()
  return codes[0] ?? 'en'
}

export interface LearningLanguage {
  languageCode: string
  cefrLevel: string
}

// Dashboard'dagi "Your progress" kartochkasi uchun: userning barcha
// o'rganayotgan tillari, daraja bilan birga, backend qaytargan tartibda
// (birinchi qo'shilgan til birinchi). Bo'sh bo'lsa — onboarding hali
// tugallanmagan degani.
export async function fetchLearningLanguages(): Promise<LearningLanguage[]> {
  try {
    const langs = await api.get<
      { languageCode: string; languageRole: 'NATIVE' | 'LEARNING'; cefrLevel: string }[]
    >('/api/languages')
    return langs
      .filter((l) => l.languageRole === 'LEARNING')
      .map((l) => ({ languageCode: l.languageCode, cefrLevel: l.cefrLevel }))
  } catch {
    return []
  }
}
