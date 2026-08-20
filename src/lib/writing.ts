// Shared types for the Writing feature. Mirrors the backend DTOs so
// there's exactly one place to update if the API shape moves.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type ErrorType =
  | 'Grammar'
  | 'Vocabulary'
  | 'Spelling'
  | 'Punctuation'
  | 'Style'
  | 'Coherence'
  | string

export type WritingTaskType =
  | 'IELTS_TASK_1'
  | 'IELTS_TASK_2'
  | 'TOPIK_Q53'
  | 'TOPIK_Q54'
  | 'HSK_SENTENCE'
  | 'HSK_SHORT_ESSAY'
  | 'HSK_SUMMARY'
  | 'GENERAL_ESSAY'

export interface WritingQuestion {
  id: string
  question: string
  instructions: string | null
  languageCode: string
  cefrLevel: CefrLevel
  certificateType: string | null
  taskType: WritingTaskType | null
  topic: string | null
  minWords: number | null
  maxWords: number | null
  recommendedMinutes: number | null
  year: number | null

  // Renderable visual — either structured (Chart.js/table/mermaid) or a
  // raw image URL. Never both in practice; UI prefers visualJson.
  visualJson: string | null
  visualImageUrl: string | null

  createdAt: string
}

// Structured visual shapes that visualJson can carry.
// AI generation emits nested objects; the backend stores them as JSON
// strings; the frontend parses back before rendering.

export interface ChartVisual {
  type: 'chart'
  chartType: 'bar' | 'line' | 'pie' | 'doughnut'
  title?: string
  subtitle?: string
  xAxisLabel?: string
  yAxisLabel?: string
  labels: string[]
  datasets: Array<{ label: string; data: number[] }>
}

export interface TableVisual {
  type: 'table'
  title?: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export interface DiagramVisual {
  type: 'diagram'
  diagramType: 'mermaid'
  code: string
  title?: string
}

export type Visual = ChartVisual | TableVisual | DiagramVisual

// Spring's Page<T> shape — same as Reading uses.
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

// Submission bodies

export interface CreateWritingSubmissionDTO {
  questionId: string
  // Exam rejimida — bir necha vazifani (Task1+Task2) BITTA urinish
  // sifatida birlashtirish uchun.  Practice'да — undefined/null.
  examSessionId?: string | null
  content: string
  timeTakenMinutes?: number | null
}

export interface WritingSubmission {
  id: string
  examSessionId: string | null
  questionId: string | null
  questionText: string | null
  content: string
  wordCount: number
  timeTakenMinutes: number | null

  // 4-criteria scores, all optional depending on the exam rubric.
  overallScore: number | null
  taskAchievementScore: number | null
  coherenceScore: number | null
  lexicalScore: number | null
  grammarScore: number | null

  aiFeedback: string | null
  errors: string | null // serialized JSON string
  checked: boolean
  createdAt: string
}

// GET /writing/exam-start javobi — bir nechta vazifa, umumiy sessiya
export interface WritingExamStartResponse {
  examSessionId: string
  tasks: Array<{ question: WritingQuestion; timeLimitSeconds: number }>
  totalTimeSeconds: number
}

// GET /writing/exam-session/{id} javobi — yig'ma natija
export interface WritingExamSessionResult {
  examSessionId: string
  overallScore: number
  maxScore: number
  tasks: WritingSubmission[]
}

export const TASK_TYPE_LABEL: Record<WritingTaskType, string> = {
  IELTS_TASK_1: 'IELTS Task 1',
  IELTS_TASK_2: 'IELTS Task 2',
  TOPIK_Q53: 'TOPIK — 53-savol',
  TOPIK_Q54: 'TOPIK — 54-savol',
  HSK_SENTENCE: 'HSK — Gap tuzish',
  HSK_SHORT_ESSAY: 'HSK — Qisqa insho',
  HSK_SUMMARY: 'HSK — Qisqartirish',
  GENERAL_ESSAY: 'Insho',
}

// The AI feedback shape (matches WritingFeedbackDTO on the backend).
// The backend returns this bundled inside the submission response.

export interface WritingFeedback {
  overallScore: number | null
  taskAchievementScore: number | null
  coherenceScore: number | null
  lexicalScore: number | null
  grammarScore: number | null
  generalFeedback: string | null
  errors: WritingErrorItem[]
  improvements: string[]
  nextLevelTip: string | null
}

export interface WritingErrorItem {
  original: string
  corrected: string
  explanation: string
  errorType: ErrorType
}

// The submit endpoint returns this — submission + feedback together.
export interface SubmissionResponse extends WritingSubmission {
  feedback?: WritingFeedback
}

// UI-friendly language + cert taxonomy. Kept in sync with the backend
// enums used elsewhere in the app.
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

// Character-based languages count units differently than word-based ones.
// Korean/Chinese/Japanese use characters; everyone else uses words.
export const isCharacterBased = (langCode: string): boolean =>
  ['ko', 'zh', 'ja'].includes(langCode)

export const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const LEVEL_TINT: Record<CefrLevel, string> = {
  A1: 'bg-mint-50 text-mint-600 border-mint-500/30',
  A2: 'bg-mint-50 text-mint-600 border-mint-500/30',
  B1: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  B2: 'bg-indigo-50 text-indigo-600 border-indigo-500/30',
  C1: 'bg-coral-50 text-coral-600 border-coral-500/30',
  C2: 'bg-coral-50 text-coral-600 border-coral-500/30',
}

// Count words in Latin-script languages, characters in CJK.
// Falls back to word-count for anything unknown.
export function countUnits(text: string, langCode: string): number {
  if (!text) return 0
  if (isCharacterBased(langCode)) {
    // Match visible characters (drop whitespace and punctuation the way
    // TOPIK and HSK official rubrics do).
    return [...text.replace(/\s/g, '')].length
  }
  return text.trim().split(/\s+/).filter(Boolean).length
}
