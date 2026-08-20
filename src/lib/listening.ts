// Shared types for the Listening feature — mirror the backend DTOs.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type ListeningQuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER'

export interface ListeningMaterial {
  id: string
  title: string
  audioUrl: string           // signed URL from R2
  durationSeconds: number | null
  languageCode: string
  cefrLevel: CefrLevel
  certificateType: string | null
  topic: string | null
  source: string | null
  year: number | null
  createdAt: string
}

export interface ListeningProgress {
  materialId: string
  lastPositionSeconds: number
  listenedSeconds: number
  loopStartSeconds: number | null
  loopEndSeconds: number | null
  playbackSpeed: number
  transcriptViewed: boolean
  completed: boolean
  lastListenedAt: string
}

// Question during exam — NO correct answer (backend hides it)
export interface ListeningQuestionPublic {
  id: string
  section: string | null
  question: string
  questionType: ListeningQuestionType
  options: string | null           // JSON string, e.g. '["A","B","C","D"]'
  orderIndex: number
  timestampSeconds: number | null
}

// Faqat "Generate with AI" (Mode B) materiallarida ishlatiladi —
// AI oldindan 10 ta variant (5 EASY + 5 HARD) tayyorlaydi.
export type ListeningDifficulty = 'EASY' | 'HARD'

// GET /materials/{id}/exam-questions javobi — endi bevosita massiv
// EMAS, variant ma'lumoti bilan birga keladi.
export interface ListeningExamResponse {
  difficulty: ListeningDifficulty | null
  variantIndex: number | null
  totalVariants: number
  questions: ListeningQuestionPublic[]
}

// GET /materials/{id}/exam-start javobi — Exam rejimi uchun: random
// tanlangan savollar (Easy/Hard aralash) + vaqt limiti.
export interface ListeningExamStartResponse {
  questions: ListeningQuestionPublic[]
  timeLimitSeconds: number
}

// Full question — includes correctAnswer (shown after grading, or to admins)
export interface ListeningQuestionFull extends ListeningQuestionPublic {
  materialId: string
  correctAnswer: string
  createdAt: string
}

// Submit payload
export interface SubmitListeningExamDTO {
  materialId: string
  // true — Exam rejimida (vaqt cheklangan, aralash random savollar)
  examMode?: boolean
  timeTakenSeconds?: number | null
  answers: Array<{ questionId: string; userAnswer: string }>
}

// Per-answer result inside a submission
export interface AnswerResult {
  questionId: string
  question: string
  section: string | null
  questionType: ListeningQuestionType
  options: string | null
  userAnswer: string
  correctAnswer: string
  correct: boolean
  orderIndex: number
  timestampSeconds: number | null
}

export interface ListeningSubmission {
  id: string
  materialId: string
  materialTitle: string
  // Faqat "Generate with AI" materiallarida bo'ladi — Mode A'da ikkalasi ham null
  difficulty: ListeningDifficulty | null
  variantIndex: number | null
  // true — bu Exam rejimida (vaqt cheklangan) topshirilgan urinish
  examMode: boolean
  correctCount: number
  totalCount: number
  scorePercent: number
  timeTakenSeconds: number | null
  submittedAt: string
  answers: AnswerResult[]
}

// Spring Page<T>
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

// ─────────────────────────────────────────────────────────────────
// UI constants
// ─────────────────────────────────────────────────────────────────

export const LANG_OPTIONS: { code: string; flag: string; name: string }[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'German' },
  { code: 'ko', flag: '🇰🇷', name: 'Korean' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese' },
  { code: 'fr', flag: '🇫🇷', name: 'French' },
  { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese' },
  { code: 'ru', flag: '🇷🇺', name: 'Russian' },
  { code: 'uz', flag: '🇺🇿', name: 'Uzbek' },
]

export const CERTS_BY_LANG: Record<string, string[]> = {
  en: ['IELTS', 'IELTS_ACADEMIC', 'IELTS_GENERAL', 'TOEFL', 'CAMBRIDGE', 'GENERAL'],
  de: ['GOETHE', 'TESTDAF', 'GENERAL'],
  ko: ['TOPIK', 'GENERAL'],
  ja: ['JLPT', 'GENERAL'],
  fr: ['DELF', 'DALF', 'GENERAL'],
  es: ['DELE', 'GENERAL'],
  zh: ['HSK', 'GENERAL'],
  ru: ['TORFL', 'GENERAL'],
  uz: ['GENERAL'],
}

export const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const LEVEL_TINT: Record<CefrLevel, string> = {
  A1: 'bg-mint-50 text-mint-600 border-mint-500/30',
  A2: 'bg-mint-50 text-mint-600 border-mint-500/30',
  B1: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  B2: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  C1: 'bg-coral-50 text-coral-600 border-coral-500/30',
  C2: 'bg-coral-50 text-coral-600 border-coral-500/30',
}

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** MM:SS format for durations */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '--:--'
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Parse an options JSON string safely — returns [] on any error. */
export function parseOptions(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** Group an array of items by section, preserving order. */
export function groupBySection<T extends { section: string | null }>(
  items: T[]
): Array<{ section: string; items: T[] }> {
  const groups: Array<{ section: string; items: T[] }> = []
  const map = new Map<string, T[]>()
  for (const it of items) {
    const key = it.section?.trim() || 'Other'
    if (!map.has(key)) {
      const arr: T[] = []
      map.set(key, arr)
      groups.push({ section: key, items: arr })
    }
    map.get(key)!.push(it)
  }
  return groups
}
