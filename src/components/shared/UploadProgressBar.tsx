// Umumiy yuklash progress ko'rsatkichi — Chat, Listening, Reading,
// Writing, Post — barcha fayl/rasm/audio yuklash joylarida bir xil,
// chiroyli va izchil ko'rinish uchun.
//
// Ikki holat:
//   • percent < 100 — haqiqiy yuklash progressi (XHR orqali)
//   • percent >= 100 — "processing" (server javob berayotgan payt,
//     yuklash tugagan lekin javob hali kelmagan) — silliq nafas
//     oluvchi animatsiya bilan, foydalanuvchiga "hali ishlayapti"
//     signalini beradi.

import { motion } from 'framer-motion'

export default function UploadProgressBar({
  percent,
  label,
  fileName,
}: {
  percent: number
  label?: string
  fileName?: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const processing = clamped >= 100

  return (
    <div className="rounded-2xl border border-indigo-500/15 bg-indigo-50/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <motion.span
            animate={processing ? { rotate: 360 } : { rotate: 0 }}
            transition={processing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            className="flex-shrink-0 text-indigo-500"
          >
            {processing ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
              </svg>
            )}
          </motion.span>
          <span className="truncate text-xs font-medium text-ink-soft">
            {fileName ?? label ?? (processing ? 'Processing…' : 'Uploading…')}
          </span>
        </div>
        <span className="flex-shrink-0 font-mono text-xs font-bold text-indigo-600">
          {processing ? '…' : `${clamped}%`}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-indigo-500/10">
        {processing ? (
          <motion.div
            className="h-full w-1/3 rounded-full bg-indigo-500"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="h-full rounded-full bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  )
}
