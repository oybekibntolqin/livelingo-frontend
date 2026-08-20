// Reading — umumiy turlar va yordamchi funksiyalar.
// lib/listening.ts bilan bir xil naqsh, lekin Reading'ga xos
// farqlar bilan: 6 ta savol turi, CertificateType (audio davomiyligi
// o'rniga), "section" emas "questionType" bo'yicha guruhlash
// (haqiqiy imtihonlarda savollar tur bo'yicha guruhlanadi —
// "Questions 1-5: Matching Headings" kabi).

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type CertificateType =
  | 'IELTS' | 'IELTS_ACADEMIC' | 'IELTS_GENERAL' | 'TOEFL' | 'CAMBRIDGE'
  | 'GOETHE' | 'TESTDAF' | 'TOPIK' | 'JLPT' | 'DELF' | 'DELE' | 'HSK'
  | 'CELI' | 'TORFL' | 'GENERAL'

export type ReadingQuestionType =
  | 'MCQ'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'MATCHING_HEADINGS'
  | 'MATCHING_INFO'
  | 'GAP_FILL'
  | 'SHORT_ANSWER'

export type ReadingDifficulty = 'EASY' | 'HARD'

export interface ReadingMaterial {
  id: string
  title: string
  content: string
  languageCode: string
  cefrLevel: CefrLevel
  certificateType: CertificateType | null
  topic: string | null
  source: string | null
  originalFileUrl: string | null
  year: number | null
  createdAt: string
}

export interface ReadingQuestionPublic {
  id: string
  section: string | null
  question: string
  questionType: ReadingQuestionType
  options: string | null // JSON string
  orderIndex: number
}

// GET /materials/{id}/exam-questions javobi (Practice)
export interface ReadingExamResponse {
  difficulty: ReadingDifficulty | null
  variantIndex: number | null
  totalVariants: number
  questions: ReadingQuestionPublic[]
}

// GET /materials/{id}/exam-start javobi (Exam)
export interface ReadingExamStartResponse {
  questions: ReadingQuestionPublic[]
  timeLimitSeconds: number
}

export interface SubmitReadingExamDTO {
  materialId: string
  examMode?: boolean
  timeTakenSeconds?: number | null
  answers: Array<{ questionId: string; userAnswer: string }>
}

export interface ReadingAnswerResult {
  questionId: string
  question: string
  section: string | null
  questionType: ReadingQuestionType
  options: string | null
  userAnswer: string
  correctAnswer: string
  correct: boolean
  orderIndex: number
  explanation: string | null
}

export interface ReadingSubmission {
  id: string
  materialId: string
  materialTitle: string
  difficulty: ReadingDifficulty | null
  variantIndex: number | null
  examMode: boolean
  correctCount: number
  totalCount: number
  scorePercent: number
  timeTakenSeconds: number | null
  submittedAt: string
  answers: ReadingAnswerResult[]
}

// ─────────────────────────────────────────────────────────────────
// Ko'rinish sozlamalari
// ─────────────────────────────────────────────────────────────────

export const LEVEL_TINT: Record<CefrLevel, string> = {
  A1: 'bg-mint-50 text-mint-600 border-mint-500/30',
  A2: 'bg-mint-50 text-mint-600 border-mint-500/30',
  B1: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  B2: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  C1: 'bg-coral-50 text-coral-600 border-coral-500/30',
  C2: 'bg-coral-50 text-coral-600 border-coral-500/30',
}

// Har savol turi uchun foydalanuvchiga tushunarli sarlavha va
// qisqa ko'rsatma (guruh boshida ko'rsatiladi — haqiqiy imtihon
// uslubida: "Questions 1-5 — Matching Headings").
export const QUESTION_TYPE_LABEL: Record<ReadingQuestionType, string> = {
  MCQ: 'Multiple Choice',
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given',
  MATCHING_HEADINGS: 'Matching Headings',
  MATCHING_INFO: 'Matching Information',
  GAP_FILL: 'Gap Fill',
  SHORT_ANSWER: 'Short Answer',
}

export const QUESTION_TYPE_HINT: Record<ReadingQuestionType, string> = {
  MCQ: 'Choose the correct answer.',
  TRUE_FALSE_NOT_GIVEN:
    "Does the statement agree with the text? Choose True, False, or Not Given (if it isn't mentioned).",
  MATCHING_HEADINGS: 'Choose the correct heading for each paragraph.',
  MATCHING_INFO: 'Which paragraph contains the following information?',
  GAP_FILL: 'Complete the sentence with a word or phrase from the text.',
  SHORT_ANSWER: 'Answer in a few words, using information from the text.',
}

// ─────────────────────────────────────────────────────────────────
// Yordamchi funksiyalar
// ─────────────────────────────────────────────────────────────────

export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '--:--'
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function parseOptions(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/**
 * Savollarni TUR bo'yicha guruhlaydi (section bo'yicha emas) —
 * haqiqiy imtihon formatiga mos: "Questions 1-5 — Matching
 * Headings" kabi.  Tartib — birinchi marta uchragan turlar tartibida
 * (AI odatda MCQ→TF→Matching→GapFill→ShortAnswer tartibida
 * generatsiya qiladi, lekin bu qat'iy emas).
 */
export function groupByQuestionType(
  items: ReadingQuestionPublic[]
): Array<{ type: ReadingQuestionType; label: string; hint: string; items: ReadingQuestionPublic[] }> {
  const groups: Array<{ type: ReadingQuestionType; label: string; hint: string; items: ReadingQuestionPublic[] }> = []
  const map = new Map<string, ReadingQuestionPublic[]>()
  for (const it of items) {
    const key = it.questionType
    if (!map.has(key)) {
      const arr: ReadingQuestionPublic[] = []
      map.set(key, arr)
      groups.push({
        type: it.questionType,
        label: QUESTION_TYPE_LABEL[it.questionType] ?? it.questionType,
        hint: QUESTION_TYPE_HINT[it.questionType] ?? '',
        items: arr,
      })
    }
    map.get(key)!.push(it)
  }
  return groups
}
