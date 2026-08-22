import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages uchun: agar repo nomi 'livelingo-frontend' bo'lsa, base = '/livelingo-frontend/'
// Custom domain yoki user pages (username.github.io) uchun base = '/'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/',
  server: {
    allowedHosts: true,
    // MUHIM (xavfsizlik bilan bog'liq): refresh token endi httpOnly
    // cookie orqali ishlaydi. Brauzer bu cookie'ni faqat cookie
    // "SameSite" siyosatiga mos so'rovlarda yuboradi. Agar frontend
    // (localhost:5173) va backend (localhost:8080) to'g'ridan-to'g'ri,
    // proxy'siz gaplashsa, bular brauzer nuqtai nazaridan IKKI XIL
    // origin bo'lib, cookie yuborilishi uchun SameSite=None+Secure
    // (demak HTTPS) kerak bo'lardi — lokal http muhitda bu ishlamaydi.
    //
    // Yechim: dev serverda /api va /ws so'rovlarini backend'ga PROXY
    // qilamiz — shunda brauzer nuqtai nazaridan hammasi BIR XIL
    // origin (localhost:5173), oddiy SameSite=Lax + Secure=false
    // yetarli bo'ladi (qarang: backend application-dev.properties).
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
}))
