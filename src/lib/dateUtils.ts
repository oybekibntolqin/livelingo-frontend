// dateUtils.ts — backend'dan kelgan vaqt satrlarini TO'G'RI (UTC
// sifatida) parse qilish uchun umumiy yordamchi.
//
// SABAB: Backend (Spring Boot) chat/post/comment va h.k. vaqtlarini
// oddiy `LocalDateTime` sifatida saqlaydi va JSON'ga "2026-08-27T12:07:00"
// kabi, VAQT ZONASI BELGISISIZ (oxirida "Z" yoki "+05:00" kabi qo'shimcha
// bo'lmagan holda) chiqaradi. Server (Docker konteyner) UTC vaqt
// zonasida ishlagani uchun bu qiymat ASLIDA UTC — lekin brauzer,
// `new Date("2026-08-27T12:07:00")` chaqirilganda, vaqt zonasi
// belgisi yo'qligi sababli buni UTC EMAS, balki BRAUZERNING O'Z
// MAHALLIY vaqti deb noto'g'ri talqin qiladi. Natijada, masalan
// Toshkentdagi (UTC+5) foydalanuvchi uchun xabar vaqti 5 soat
// oldinga (masalan 17:07 o'rniga 12:07) noto'g'ri ko'rsatilardi.
//
// Yechim: agar satrda vaqt zonasi belgisi bo'lmasa, oxiriga "Z"
// qo'shib qo'yamiz — shunda brauzer buni to'g'ri UTC deb tushunib,
// ekranga chiqarishda o'zi avtomatik ravishda foydalanuvchining
// MAHALLIY vaqt zonasiga aylantiradi.
export function parseServerDate(iso: string | null | undefined): Date {
    if (!iso) return new Date(NaN)
    // Agar allaqachon vaqt zonasi belgisi bo'lsa (Z, +05:00, -03:00
    // kabi) — tegmaymiz, aks holda "Z" qo'shamiz.
    const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso)
    return new Date(hasTimezone ? iso : `${iso}Z`)
}
