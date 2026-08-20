// LanguagesEditor — EditProfile ichida joylashadigan, o'zicha ishlaydigan
// (mustaqil saqlaydigan) blok: native va learning tillarni qo'shish,
// o'chirish. "Change" (tilni almashtirish) — eskisini o'chirib, yangisini
// qo'shish orqali amalga oshiriladi.
//
// MUHIM QOIDA (backendda ham mustahkamlangan): har doim kamida 1 ta
// native va 1 ta learning til qolishi SHART. Oxirgi tilni o'chirishga
// urinilsa, backend 409 qaytaradi — biz shu xabarni to'g'ridan-to'g'ri
// ko'rsatamiz.

import { useEffect, useState } from 'react'
import { languageApi } from '../lib/languageApi'
import { CEFR_LEVELS, LANGUAGES, languageFlag, languageName } from '../lib/languages'
import type { UserLanguage } from '../lib/profileApi'

export default function LanguagesEditor() {
  const [languages, setLanguages] = useState<UserLanguage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const load = () => {
    languageApi
      .list()
      .then(setLanguages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Tillar yuklanmadi.'))
  }

  useEffect(load, [])

  const natives = (languages ?? []).filter((l) => l.languageRole === 'NATIVE')
  const learning = (languages ?? []).filter((l) => l.languageRole === 'LEARNING')

  const remove = async (code: string) => {
    setError(null)
    setBusyCode(code)
    try {
      await languageApi.remove(code)
      setLanguages((prev) => (prev ? prev.filter((l) => l.languageCode !== code) : prev))
    } catch (err) {
      // Backenddan keladigan 409 xabari ("You must keep at least one
      // native/learning language") shu yerda to'g'ridan-to'g'ri
      // ko'rsatiladi — foydalanuvchi nima uchun o'chira olmayotganini
      // aniq tushunadi.
      setError(err instanceof Error ? err.message : "O'chirilmadi. Qayta urinib ko'ring.")
    } finally {
      setBusyCode(null)
    }
  }

  const add = async (role: 'NATIVE' | 'LEARNING', code: string, cefrLevel: string) => {
    setError(null)
    setBusyCode(code)
    try {
      const created = await languageApi.add({ languageCode: code, languageRole: role, cefrLevel })
      setLanguages((prev) => (prev ? [...prev, created] : [created]))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qo'shilmadi. Qayta urinib ko'ring.")
    } finally {
      setBusyCode(null)
    }
  }

  if (!languages) {
    return <p className="text-xs text-ink-muted">Tillar yuklanmoqda…</p>
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream/60 p-4">
      <LanguageGroup
        title="Native languages"
        hint="Ona tilingiz — kamida 1 ta bo'lishi shart."
        role="NATIVE"
        items={natives}
        canRemove={natives.length > 1}
        busyCode={busyCode}
        excludeCodes={languages.map((l) => l.languageCode)}
        onRemove={remove}
        onAdd={(code) => add('NATIVE', code, 'C2')}
      />

      <LanguageGroup
        title="Learning languages"
        hint="O'rganayotgan tilingiz — kamida 1 ta bo'lishi shart."
        role="LEARNING"
        items={learning}
        canRemove={learning.length > 1}
        busyCode={busyCode}
        excludeCodes={languages.map((l) => l.languageCode)}
        onRemove={remove}
        onAdd={(code, level) => add('LEARNING', code, level ?? 'A1')}
        showLevel
      />

      {error && <p className="text-sm text-coral-700">{error}</p>}
    </div>
  )
}

function LanguageGroup({
  title,
  hint,
  items,
  canRemove,
  busyCode,
  excludeCodes,
  onRemove,
  onAdd,
  showLevel,
}: {
  title: string
  hint: string
  role: 'NATIVE' | 'LEARNING'
  items: UserLanguage[]
  canRemove: boolean
  busyCode: string | null
  excludeCodes: string[]
  onRemove: (code: string) => void
  onAdd: (code: string, level?: string) => void
  showLevel?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [pickCode, setPickCode] = useState('')
  const [pickLevel, setPickLevel] = useState('A1')

  const available = LANGUAGES.filter((l) => !excludeCodes.includes(l.code))

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-soft">{title}</span>
        <span className="text-[10px] text-ink-muted">{hint}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((l) => (
          <span
            key={l.languageCode}
            className="flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3 py-1.5 text-xs font-medium text-ink"
          >
            <span>{languageFlag(l.languageCode)}</span>
            <span>{languageName(l.languageCode)}</span>
            {showLevel && l.cefrLevel && (
              <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                {l.cefrLevel}
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(l.languageCode)}
              disabled={!canRemove || busyCode === l.languageCode}
              title={!canRemove ? `Kamida 1 ta ${title.toLowerCase()} qolishi kerak` : 'Remove'}
              className="ml-0.5 rounded-full p-0.5 text-ink-muted transition hover:bg-coral-50 hover:text-coral-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setPickCode(available[0]?.code ?? '')
            }}
            disabled={available.length === 0}
            className="flex items-center gap-1 rounded-full border border-dashed border-ink/20 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white p-2">
          <select
            value={pickCode}
            onChange={(e) => setPickCode(e.target.value)}
            className="rounded-lg border border-ink/12 bg-cream px-2 py-1.5 text-xs text-ink outline-none"
          >
            {available.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>

          {showLevel && (
            <select
              value={pickLevel}
              onChange={(e) => setPickLevel(e.target.value)}
              className="rounded-lg border border-ink/12 bg-cream px-2 py-1.5 text-xs text-ink outline-none"
            >
              {CEFR_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              if (!pickCode) return
              onAdd(pickCode, pickLevel)
              setAdding(false)
            }}
            disabled={!pickCode || busyCode === pickCode}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
