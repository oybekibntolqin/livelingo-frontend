// Avatar — user rasmi bo'lsa ko'rsatadi, bo'lmasa default (kulrang
// doira + odam silueti) ko'rsatadi.  Referens rasmga mos.

interface AvatarProps {
  url?: string | null
  name?: string
  size?: number
  className?: string
  // Ban qilingan ("Deleted Account") foydalanuvchi uchun — Telegram
  // uslubidagi ko'k doira + arvoh siluetini ko'rsatadi, haqiqiy rasm
  // bo'lsa ham (u yashiriladi, chunki backend allaqachon null qaytaradi).
  deleted?: boolean
}

export default function Avatar({ url, size = 96, className = '', deleted = false }: AvatarProps) {
  const style = { width: size, height: size }

  if (deleted) {
    return <GhostAvatar size={size} className={className} />
  }

  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return <DefaultAvatar size={size} className={className} />
}

// "Deleted Account" — Telegram'даgi kabi ko'k doira + arvoh siluet.
export function GhostAvatar({
  size = 96,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={`flex-shrink-0 rounded-full ${className}`}
    >
      <circle cx="48" cy="48" r="48" fill="#8B93A7" />
      <path
        d="M48 22c-11 0-20 9-20 20v22c0 2 2.4 3 3.8 1.5l4.2-4.5 4.2 4.5c1 1 2.6 1 3.6 0l4.2-4.5 4.2 4.5c1 1 2.6 1 3.6 0l4.2-4.5 4.2 4.5c1.4 1.5 3.8.5 3.8-1.5V42c0-11-9-20-20-20z"
        fill="#F4F6FA"
      />
      <circle cx="41" cy="44" r="3" fill="#8B93A7" />
      <circle cx="55" cy="44" r="3" fill="#8B93A7" />
    </svg>
  )
}

// Referens rasmdagi kabi: to'q kulrang fon + ochroq rangli, KONTUR
// (stroke) uslubidagi odam siluet. MUHIM: avval "bosh" qismi TO'LIQ
// RANGLI (filled) alohida doira sifatida chizilgan edi — bu kichik
// o'lchamda (masalan 40px, "People to follow" ro'yxatida) ikkita
// ALOHIDA DOIRA bo'lib ko'rinib, foydalanuvchilarga "ikkita avatar"
// degan noto'g'ri taassurot qoldirardi. Endi bosh+yelka BITTA ochiq
// (stroke) chiziq sifatida chizilgan — hech qachon alohida "doira"
// bo'lib o'qilmaydi.
export function DefaultAvatar({
  size = 96,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={`flex-shrink-0 rounded-full ${className}`}
    >
      <circle cx="48" cy="48" r="48" fill="#3A3A42" />
      <g stroke="#9A9AA6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="48" cy="39" r="11" />
        <path d="M25 79c2.5-15.5 11.5-24.5 23-24.5s20.5 9 23 24.5" />
      </g>
    </svg>
  )
}
