import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'


// HashRouter is used instead of BrowserRouter because GitHub Pages
// can't handle client-side routes via path. With hash routes,
// /#/dashboard works on any static host without 404 fallback config.
//
// StrictMode olib tashlandi: u dev rejimida har bir komponentni
// ataylab ikki marta mount qiladi (mount -> unmount -> qayta mount),
// bu esa react-pdf-highlighter (pdf.js) kabi DOM'ga imperativ tarzda
// sahifalarni qo'shadigan kutubxonalar bilan mos kelmaydi — eski
// sahifalar tozalanmay, ustiga yangi nusxa qo'shilib ketadi (masalan
// 4 sahifali PDF 8 sahifaga aylanib qoladi). StrictMode faqat dev
// rejimida ishlaydi, production build'ga ta'sir qilmaydi — shuning
// uchun uni olib tashlash xavfsiz.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>
)
