# 2 ta muammo — tuzatildi

## 1. Fayl/audio refresh'да qayta yopilib qolishi

**Sabab:** `ConversationView.tsx`да `downloadedIds` faqat `useState`
edi — hech qayerga saqlanmasdi.  Refresh bo'lganda komponent qaytadan
mount bo'lib, holat bo'sh obyektga qaytardi — hattoki avval ochilgan
(tap-to-download qilingan) fayllar ham yana yopiq holatga qaytardi.

**Yechim:** `downloadedIds` endi **localStorage**'да saqlanadi
(`livelingo:downloaded:{peerId}` kaliti bilan, har suhbat uchun
alohida).  Bir marta ochilgan fayl endi **doim ochiq** qoladi —
xuddi Telegram'да bo'lgani kabi.

Fayl: `src/components/chat/ConversationView.tsx` — ALMASHTIRING

## 2. Dashboard'даги Flashcards tugmasi bosilmayapti

**Sabab ikki qismli edi:**
1. `Dashboard.tsx`да link hali `to: '#'` edi (ulanmagan)
2. Flashcard sahifalari (`Flashcards.tsx`, `FlashcardDeck.tsx`,
   `FlashcardStudy.tsx`, `lib/flashcard.ts`) oldingi delivery'дан
   loyihaga hali ko'chirilmagan edi — shuning uchun `App.tsx`да route
   ham yo'q edi.

**Yechim:**
- `Dashboard.tsx` — link `/flashcards`ga ulandi
- `App.tsx` — 3 ta flashcard route qo'shildi
- 4 fayl (routes + lib) shu paketga qo'shildi

## Fayllar (7 ta)

```
src/components/chat/ConversationView.tsx   ← ALMASHTIRING (localStorage fix)
src/routes/Dashboard.tsx                    ← ALMASHTIRING (link ulandi)
src/App.tsx                                 ← ALMASHTIRING (route qo'shildi)
src/lib/flashcard.ts                        ← YANGI (agar hali yo'q bo'lsa)
src/routes/Flashcards.tsx                   ← YANGI (agar hali yo'q bo'lsa)
src/routes/FlashcardDeck.tsx                ← YANGI (agar hali yo'q bo'lsa)
src/routes/FlashcardStudy.tsx               ← YANGI (agar hali yo'q bo'lsa)
```

## Test

### Fayl refresh
1. Chat'да rasm/audio/fayl yuboring yoki qabul qiling
2. "Yuklab olish" bosing — ochiladi
3. Sahifani **refresh** qiling (F5)
4. Fayl **ochiq** holatda qolishi kerak (yana "Yuklab olish" chiqmasin)

### Flashcards
1. Dashboard'да "Flashcards" bosing → `/flashcards` sahifasi ochilsin
2. "New deck" bilan deck yarating, kartochka qo'shing
3. "Study" bilan 3D flip session ishga tushsin
