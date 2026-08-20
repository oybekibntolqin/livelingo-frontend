// Exercises — types + the "skill path" checkpoint structure.
//
// MUHIM: backend'да "dars/lesson" tushunchasi yo'q — faqat XP,
// daraja, streak bor (UserProgress). Shuning uchun "path" — bu
// FRONTEND'да aniqlangan, XP chegaralariga asoslangan checkpoint
// ketma-ketligi. Backend'gа hech qanday o'zgarish kerak emas —
// mavjud GET /api/exercises?type=X orqali har checkpoint uchun
// mashqlar olinadi.
//
// V1 — faqat A1+A2, 6 ta tur, AUDIOSIZ (DICTATION — B1, V1.2'да
// qo'shiladi).

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type ExerciseType =
  | 'WORD_TRANSLATE'
  | 'IMAGE_MATCH'
  | 'SENTENCE_BUILD'
  | 'FILL_IN_BLANK'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  // B1+ — V1.2'да ulanadi, hozircha path'da yo'q
  | 'DICTATION'
  | 'SENTENCE_ARRANGE'
  | 'ERROR_CORRECTION'
  | 'PARAPHRASE'
  | 'WORD_FORM'
  | 'MATCHING'

export interface Exercise {
  id: string
  type: ExerciseType
  question: string
  mediaUrl: string | null
  options: string[] | null
  languageCode: string
  cefrLevel: CefrLevel
  xpReward: number
  // correctAnswer YO'Q — backend ataylab yubormaydi
}

export interface UserProgress {
  languageCode: string
  totalXp: number
  currentLevel: CefrLevel
  streakDays: number
  longestStreak: number
  lastActivityDate: string | null
  todayXp: number
  todayExercises: number
  totalExercises: number
  totalCorrect: number
  accuracyPercent: number
  readingUnlocked: boolean
  writingUnlocked: boolean
  listeningUnlocked: boolean
  xpToNextLevel: number
  xpForCurrentLevel: number
  dailyChallengeTarget: number
  dailyBonusXp: number
  dailyBonusClaimed: boolean
  dailyBonusAvailable: boolean
}

export interface SubmitExerciseDTO {
  exerciseId: string
  userAnswer: string
  timeTakenMs: number
}

export interface ExerciseResult {
  exerciseId: string
  correct: boolean
  correctAnswer: string
  explanation: string | null
  xpEarned: number
  totalXp: number
  streakDays: number
  leveledUp: boolean
  newLevel: string | null
}

// ─────────────────────────────────────────────────────────────────
// SKILL PATH — checkpoint ketma-ketligi
// ─────────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string
  title: string
  icon: 'translate' | 'image' | 'build' | 'blank' | 'choice' | 'truefalse'
  type: ExerciseType
  cefrLevel: CefrLevel
  // Shu checkpoint OCHILISHI uchun kerak bo'lgan minimal XP
  xpToUnlock: number
  exerciseCount: number
}

// MUHIM TUZATISH: avval har checkpoint bor-yo'g'i 10 ta mashqdan
// iborat edi — 6 ta checkpoint (jami 60 ta savol) bir o'tirishda
// tugatilib, foydalanuvchi 20-30 daqiqada CEFR darajasini
// (A1 -> A2 -> deyarli B1) "oshirib" yuborardi. Bu haqiqiy til
// o'rganish sur'atiga mutlaqo zid edi. Endi har checkpoint 70-100 ta
// mashqdan iborat — foydalanuvchi qancha ko'p mashq qilsa, shuncha
// ko'p yangi (hali ko'rilmagan) savol bilan davom eta oladi.
// xpToUnlock qiymatlari SHU checkpoint'ni to'liq tugatgandan
// keyingina keyingisi ochilishi uchun ketma-ket (kumulyativ)
// hisoblangan. (Haqiqiy CEFR darajasi endi backend'da alohida,
// kamida 45 kunlik amaliyot talab qiladigan qoida bilan
// boshqariladi — bu yerdagi xpToUnlock faqat "path" ichidagi
// checkpoint'larni bosqichma-bosqich ochish uchun, backend
// darajasiga bevosita ta'sir qilmaydi.)
export const CHECKPOINT_PATH: Checkpoint[] = [
  { id: 'ck-1', title: 'First Words', icon: 'translate', type: 'WORD_TRANSLATE', cefrLevel: 'A1', xpToUnlock: 0, exerciseCount: 70 },
  { id: 'ck-2', title: 'See & Say', icon: 'image', type: 'IMAGE_MATCH', cefrLevel: 'A1', xpToUnlock: 700, exerciseCount: 70 },
  { id: 'ck-3', title: 'Build a Sentence', icon: 'build', type: 'SENTENCE_BUILD', cefrLevel: 'A1', xpToUnlock: 1400, exerciseCount: 85 },
  { id: 'ck-4', title: 'Fill the Gap', icon: 'blank', type: 'FILL_IN_BLANK', cefrLevel: 'A2', xpToUnlock: 2250, exerciseCount: 85 },
  { id: 'ck-5', title: 'Pick the Answer', icon: 'choice', type: 'MULTIPLE_CHOICE', cefrLevel: 'A2', xpToUnlock: 3100, exerciseCount: 100 },
  { id: 'ck-6', title: 'True or False', icon: 'truefalse', type: 'TRUE_FALSE', cefrLevel: 'A2', xpToUnlock: 4100, exerciseCount: 100 },
]

/** Checkpoint holati — progress.totalXp asosida hisoblanadi. */
export type CheckpointState = 'locked' | 'current' | 'completed'

export function checkpointState(cp: Checkpoint, index: number, totalXp: number): CheckpointState {
  if (totalXp >= cp.xpToUnlock) {
    const next = CHECKPOINT_PATH[index + 1]
    if (next && totalXp >= next.xpToUnlock) return 'completed'
    return 'current'
  }
  return 'locked'
}
