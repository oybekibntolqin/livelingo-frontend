// Flashcard — tiplar va API chaqiruvlari.
//
// Backend xatti-harakati (tekshirilgan):
//   • GET /decks/my, /decks/public  → Page<FlashcardDeckDTO> ({content: [...]})
//   • GET /decks/{id}/cards         → List<FlashcardCardDTO> (oddiy massiv!)
//   • GET /decks/{id}/cards/shuffle → List<FlashcardCardDTO> (oddiy massiv!)
//   • POST /cards/{id}/mark?know=true|false → 200 OK (body yo'q)
//
// MUHIM: decks Page qaytaradi (content ajratish kerak), lekin cards
// oddiy List qaytaradi (to'g'ridan-to'g'ri massiv) — ikkisi FARQLI.

import { api } from './api'
import type { CefrLevel } from './listening'

export interface FlashcardDeck {
  id: string
  title: string
  description: string | null
  languageCode: string
  cefrLevel: CefrLevel | null
  isPublic: boolean
  cardCount: number
  ownerId: string
  ownerName: string
  knownCount: number
  createdAt: string
}

export interface FlashcardCard {
  id: string
  front: string
  back: string
  exampleSentence: string | null
  orderIndex: number
  known: boolean
  viewCount: number
  correctCount: number
}

export interface CreateDeckInput {
  title: string
  description?: string
  languageCode: string
  cefrLevel?: CefrLevel | null
  isPublic: boolean
}

export interface CreateCardInput {
  front: string
  back: string
  exampleSentence?: string
}

// Til kodidan native (o'z tilidagi) nom — flashcard kartasida
// chiroyli ko'rsatish uchun (landing page namunasidagi kabi).
// LANG_OPTIONS'даги inglizcha nomdan farqli — u yerga tegmaymiz,
// chunki boshqa ko'p joyda ishlatiladi.
export const NATIVE_LANG_NAME: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  ko: '한국어',
  ja: '日本語',
  fr: 'Français',
  es: 'Español',
  zh: '中文',
  ru: 'Русский',
  uz: "O'zbekcha",
}

interface PageResponse<T> {
  content?: T[]
  totalElements?: number
  totalPages?: number
}

// Page yoki oddiy massiv — ikkalasini ham xavfsiz qabul qilamiz
function unwrapList<T>(res: T[] | PageResponse<T> | null | undefined): T[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return []
}

export const flashcardApi = {
  // ── Decks ──
  myDecks: async (page = 0, size = 50): Promise<FlashcardDeck[]> => {
    const res = await api.get<FlashcardDeck[] | PageResponse<FlashcardDeck>>(
      `/api/flashcards/decks/my?page=${page}&size=${size}`
    )
    return unwrapList(res)
  },

  publicDecks: async (
    lang?: string,
    page = 0,
    size = 50
  ): Promise<FlashcardDeck[]> => {
    const qs = new URLSearchParams({ page: String(page), size: String(size) })
    if (lang) qs.set('lang', lang)
    const res = await api.get<FlashcardDeck[] | PageResponse<FlashcardDeck>>(
      `/api/flashcards/decks/public?${qs}`
    )
    return unwrapList(res)
  },

  createDeck: (input: CreateDeckInput) =>
    api.post<FlashcardDeck>('/api/flashcards/decks', input),

  updateDeck: (deckId: string, input: CreateDeckInput) =>
    api.put<FlashcardDeck>(`/api/flashcards/decks/${deckId}`, input),

  deleteDeck: (deckId: string) =>
    api.del(`/api/flashcards/decks/${deckId}`),

  // ── Cards ──
  // Diqqat: backend bu yerda oddiy List qaytaradi, Page emas.
  getCards: async (deckId: string): Promise<FlashcardCard[]> => {
    const res = await api.get<FlashcardCard[]>(
      `/api/flashcards/decks/${deckId}/cards`
    )
    return Array.isArray(res) ? res : []
  },

  getCardsShuffled: async (deckId: string): Promise<FlashcardCard[]> => {
    const res = await api.get<FlashcardCard[]>(
      `/api/flashcards/decks/${deckId}/cards/shuffle`
    )
    return Array.isArray(res) ? res : []
  },

  addCard: (deckId: string, input: CreateCardInput) =>
    api.post<FlashcardCard>(`/api/flashcards/decks/${deckId}/cards`, input),

  updateCard: (cardId: string, input: CreateCardInput) =>
    api.put<FlashcardCard>(`/api/flashcards/cards/${cardId}`, input),

  deleteCard: (cardId: string) =>
    api.del(`/api/flashcards/cards/${cardId}`),

  markCard: (cardId: string, know: boolean) =>
    api.post(`/api/flashcards/cards/${cardId}/mark?know=${know}`, undefined),
}
