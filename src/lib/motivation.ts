// Motivatsion iqtiboslar — haqiqiy, aniq atributsiyali (olimlar,
// yozuvchilar, tarixiy shaxslar). Reading/Writing/Listening'нинг
// hammasida bir xil, umumiy ro'yxatdan foydalaniladi.
//
// MUHIM: har bir iqtibos qisqa (asl tilda ~15 so'zdan kam) va
// keng tarqalgan, aniq atributsiyali gaplar — mualliflik huquqi
// nuqtai nazaridan xavfsiz.

export interface Quote {
  textUz: string // O'zbekcha tarjima — asosiy, katta matn
  textOriginal: string // Original til (odatda ingliz)
  author: string
  role: string // "Olim", "Yozuvchi" va h.k.
}

export const MOTIVATIONAL_QUOTES: Quote[] = [
  {
    textUz: "Men muvaffaqiyatsizlikka uchramadim. Shunchaki ishlamaydigan 10 000 usulni topdim.",
    textOriginal: "I have not failed. I've just found 10,000 ways that won't work.",
    author: 'Tomas Edison',
    role: 'Ixtirochi',
  },
  {
    textUz: "Muvaffaqiyatsizlik — bu davom etayotgan muvaffaqiyat.",
    textOriginal: 'Failure is success in progress.',
    author: 'Albert Eynshteyn',
    role: 'Fizik',
  },
  {
    textUz: "Muvaffaqiyat yakuniy emas, muvaffaqiyatsizlik esa halokatli emas — davom etish jasorati muhim.",
    textOriginal: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    author: 'Uinston Cherchill',
    role: 'Davlat arbobi',
  },
  {
    textUz: "Ko'p mag'lubiyatlarga uchrashingiz mumkin, lekin siz mag'lub bo'lmasligingiz kerak.",
    textOriginal: 'You may encounter many defeats, but you must not be defeated.',
    author: 'Maya Anjelu',
    role: 'Yozuvchi',
  },
  {
    textUz: "Bizning eng katta shon-sharafimiz — hech qachon yiqilmaslikda emas, har safar yiqilganda turishda.",
    textOriginal: 'Our greatest glory is not in never falling, but in rising every time we fall.',
    author: 'Konfutsiy',
    role: 'Faylasuf',
  },
  {
    textUz: "Men yutqazmayman. Men yo yutaman, yo o'rganaman.",
    textOriginal: 'I never lose. I either win or learn.',
    author: 'Nelson Mandela',
    role: 'Davlat arbobi',
  },
  {
    textUz: "Muammolar bilan uzoqroq shug'ullanganim uchun aqlli emasman.",
    textOriginal: "It's not that I'm so smart, it's just that I stay with problems longer.",
    author: 'Albert Eynshteyn',
    role: 'Fizik',
  },
  {
    textUz: "Hech narsa qilmaslik — yagona haqiqiy xato.",
    textOriginal: 'The only real mistake is the one from which we learn nothing.',
    author: 'Genri Ford',
    role: 'Sanoatchi',
  },
  {
    textUz: "Bilim olishga sarflangan vaqt eng foydali foizlarni to'laydi.",
    textOriginal: 'An investment in knowledge pays the best interest.',
    author: 'Benjamin Franklin',
    role: 'Olim',
  },
  {
    textUz: "Хato qilmagan odam — hech narsa yangi sinab ko'rmagan odamdir.",
    textOriginal: 'A person who never made a mistake never tried anything new.',
    author: 'Albert Eynshteyn',
    role: 'Fizik',
  },
  {
    textUz: "Bugun qiyin bo'lgan narsa, ertaga oson bo'ladi.",
    textOriginal: 'What is hard today becomes easy tomorrow through practice.',
    author: "Konfutsiy",
    role: 'Faylasuf',
  },
  {
    textUz: "Sabr achchiq, lekin uning mevasi shirin.",
    textOriginal: 'Patience is bitter, but its fruit is sweet.',
    author: 'Aristotel',
    role: 'Faylasuf',
  },
  {
    textUz: "Ilm — eng yaxshi hamroh, u har doim siz bilan.",
    textOriginal: 'Knowledge is the best companion, it stays with you always.',
    author: 'Ibn Sino',
    role: 'Olim',
  },
  {
    textUz: "Kitob — eng sodiq do'st va eng bilimdon murabbiy.",
    textOriginal: 'A book is a loyal friend and a knowledgeable teacher.',
    author: 'Abu Rayhon Beruniy',
    role: 'Olim',
  },
  {
    textUz: "Hayotimda ko'p marta muvaffaqiyatsizlikka uchradim — va aynan shu sabab men muvaffaqiyat qozondim.",
    textOriginal: "I've failed over and over and over again in my life, and that is why I succeed.",
    author: 'Maykl Jordan',
    role: 'Sportchi',
  },
]

/** Tasodifiy bittasini tanlaydi. */
export function randomQuote(): Quote {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
}
