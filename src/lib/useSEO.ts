// useSEO — sets per-route <title>, meta description, canonical URL,
// Open Graph / Twitter tags, and (optionally) a JSON-LD block.
//
// WHY THIS EXISTS: LiveLingo is a client-side-rendered React SPA with
// no server-side rendering. There is no per-route HTML from the
// server, so every route's <head> has to be set at runtime. This is
// safe for SEO because Google (and most modern crawlers) render
// JavaScript before indexing a page, so tags applied here are present
// by the time the page is indexed — but it does mean the *very first*
// HTML byte always carries the homepage's default title/description
// (from index.html) until this hook runs. That's a known, accepted
// limitation of the SPA architecture (see the SEO audit notes) and is
// not something this hook can fully solve without server rendering.
//
// Usage:
//   useSEO({
//     title: 'Language Exchange — Practice With Real People | LiveLingo',
//     description: '...',
//     path: '/language-exchange',
//   })

import { useEffect } from 'react'

const SITE_NAME = 'LiveLingo'
const SITE_URL = 'https://livelingo.uz'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export interface SEOOptions {
  /** Full page title. Should already include " | LiveLingo" or similar — not appended automatically, so each page controls its own title exactly. */
  title: string
  /** Unique, human-written meta description (~120–160 chars ideal). */
  description: string
  /** Path only, e.g. "/language-exchange" — used to build the canonical + OG URL. Use "/" for the homepage. */
  path: string
  /** Optional absolute image URL for Open Graph / Twitter. Defaults to the site's default OG image. */
  image?: string
  /** Optional JSON-LD object(s) to inject as <script type="application/ld+json">. */
  jsonLd?: object | object[]
  /** Set true for pages that must not be indexed (defensive — private pages are also excluded via robots.txt and route guards). */
  noindex?: boolean
}

function setMetaByName(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setMetaByProperty(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

const JSON_LD_ID = 'seo-json-ld'

function setJsonLd(data: object | object[] | undefined) {
  const existing = document.getElementById(JSON_LD_ID)
  if (existing) existing.remove()
  if (!data) return
  const script = document.createElement('script')
  script.id = JSON_LD_ID
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}

export function useSEO(opts: SEOOptions) {
  useEffect(() => {
    const url = `${SITE_URL}${opts.path === '/' ? '' : opts.path}`
    const image = opts.image ?? DEFAULT_OG_IMAGE

    document.title = opts.title
    setMetaByName('description', opts.description)
    setMetaByName('robots', opts.noindex ? 'noindex, nofollow' : 'index, follow')
    setCanonical(url)

    // Open Graph
    setMetaByProperty('og:site_name', SITE_NAME)
    setMetaByProperty('og:type', 'website')
    setMetaByProperty('og:title', opts.title)
    setMetaByProperty('og:description', opts.description)
    setMetaByProperty('og:url', url)
    setMetaByProperty('og:image', image)

    // Twitter / X
    setMetaByName('twitter:card', 'summary_large_image')
    setMetaByName('twitter:title', opts.title)
    setMetaByName('twitter:description', opts.description)
    setMetaByName('twitter:image', image)

    setJsonLd(opts.jsonLd)

    // No cleanup: the next route's useSEO call overwrites these tags.
    // On unmount we deliberately leave tags in place to avoid a
    // flash of empty <head> during route transitions.
  }, [opts.title, opts.description, opts.path, opts.image, opts.noindex, opts.jsonLd])
}
