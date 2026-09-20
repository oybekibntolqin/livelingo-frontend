import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'


// BrowserRouter (real paths like /language-exchange) instead of
// HashRouter (/#/language-exchange).
//
// SEO REQUIRES THIS: hash-fragment URLs are not reliably treated by
// Google as distinct, indexable pages — everything after "#" is
// invisible to the server and to most crawler URL models, which
// would defeat the whole point of having unique canonical URLs,
// unique metadata, and a sitemap.xml per route (see the SEO spec).
//
// TRADE-OFF: BrowserRouter requires the production web server to
// serve index.html for any unknown path (a standard "SPA fallback" /
// rewrite rule) so that e.g. a direct visit or crawl of
// https://livelingo.uz/language-exchange returns the app instead of
// a 404 from the server. This repo now ships that config for the
// most common static hosts (see public/_redirects for
// Netlify/Cloudflare Pages, and vercel.json for Vercel) — pick the
// one matching your host, or add the equivalent rule for your own
// server (e.g. nginx `try_files $uri /index.html;`). This was
// previously HashRouter specifically to avoid needing that
// server-side rule (see git history) — that trade-off is no longer
// compatible with the SEO requirements.
//
// StrictMode olib tashlangan: u dev rejimida har bir komponentni
// ataylab ikki marta mount qiladi (mount -> unmount -> qayta mount),
// bu esa react-pdf-highlighter (pdf.js) kabi DOM'ga imperativ tarzda
// sahifalarni qo'shadigan kutubxonalar bilan mos kelmaydi — eski
// sahifalar tozalanmay, ustiga yangi nusxa qo'shilib ketadi (masalan
// 4 sahifali PDF 8 sahifaga aylanib qoladi). StrictMode faqat dev
// rejimida ishlaydi, production build'ga ta'sir qilmaydi — shuning
// uchun uni olib tashlash xavfsiz.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
