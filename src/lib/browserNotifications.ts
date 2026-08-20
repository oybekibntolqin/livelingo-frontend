// Brauzer (device) push bildirishnomalari — Notification Web API.
//
// MUHIM: bu — brauzer/qurilma darajasidagi native bildirishnoma
// (tab yopiq/fon rejimida bo'lsa ham ko'rinadi), backend'даgi
// real-time WebSocket push bilan BIRGA ishlaydi:
//   WebSocket'дан yangi signal keladi → agar ruxsat berilgan bo'lsa
//   VA foydalanuvchi shu tabда emas (document.hidden) → native
//   bildirishnoma ko'rsatiladi.

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function getPermissionState(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as PermissionState
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  try {
    const result = await Notification.requestPermission()
    return result as PermissionState
  } catch {
    return 'denied'
  }
}

/**
 * Agar ruxsat berilgan bo'lsa VA foydalanuvchi hozir shu tabda
 * ko'rmayotgan bo'lsa (boshqa tab/oyna/fon) — native bildirishnoma
 * ko'rsatadi. Tab ochiq/faol bo'lsa — ko'rsatilmaydi, chunki
 * in-app panel allaqachon yangilanadi, ikkalasi birga ortiqcha.
 */
export function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (getPermissionState() !== 'granted') return
  if (typeof document !== 'undefined' && !document.hidden) return

  try {
    const n = new Notification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
    })
    if (onClick) {
      n.onclick = () => {
        window.focus()
        onClick()
        n.close()
      }
    }
  } catch {
    // Ba'zi brauzerlar/muhitlarda Notification konstruktori
    // ishlamasligi mumkin (masalan ba'zi mobil brauzerlar) —
    // ilova buzilmasligi kerak.
  }
}
