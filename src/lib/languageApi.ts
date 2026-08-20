import { api } from './api'
import type { UserLanguage } from './profileApi'

// Backend: uz.livelingo.livelingo.controller.UserLanguageController
export const languageApi = {
  list: () => api.get<UserLanguage[]>('/api/languages'),

  add: (dto: { languageCode: string; languageRole: 'NATIVE' | 'LEARNING'; cefrLevel: string }) =>
    api.post<UserLanguage>('/api/languages', dto),

  updateLevel: (dto: { languageCode: string; cefrLevel: string }) =>
    api.put<UserLanguage>('/api/languages', dto),

  // MUHIM: backend endi kamida 1 ta native va 1 ta learning tilni
  // saqlab qolishni MAJBURIY qiladi — oxirgi tilni o'chirishga
  // urinilsa 409 Conflict va tushunarli xabar qaytaradi (qarang:
  // UserLanguageServiceImpl.removeLanguage). Frontend shu xabarni
  // to'g'ridan-to'g'ri foydalanuvchiga ko'rsatadi.
  remove: (languageCode: string) => api.del(`/api/languages/${languageCode}`),
}
