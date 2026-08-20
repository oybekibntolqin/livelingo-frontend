// JWT'dan foydalanuvchi ID'sini olish (imzo tekshirmasdan — faqat
// payload'ni o'qish, ID'ni bilish uchun).  Xavfsizlik backend tomonда.

export function getUserIdFromToken(): string | null {
  const token = localStorage.getItem('jwt')
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    // base64url → base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const claims = JSON.parse(json)
    // Backend JwtService sub yoki userId ishlatishi mumkin
    return claims.sub ?? claims.userId ?? claims.id ?? null
  } catch {
    return null
  }
}
