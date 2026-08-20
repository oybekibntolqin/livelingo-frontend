/**
 * TextReader — Text-based reading materials (uploaded TXT/DOCX after
 * extraction, or AI-generated passages) uchun highlight ko'rsatuvchi
 * va yaratuvchi komponent.
 *
 * PDF Reader'dan farqi:
 *  • Pozitsiya char offset'lar (startOffset/endOffset) — sahifa/koord emas
 *  • Highlight'lar HTML <span> orqali render qilinadi
 *  • Overlapping highlight'lar segment-splitting bilan hal qilinadi
 *
 * Foydalanuvchi flow:
 *  1. Matnda so'z(lar)ni tanlaydi
 *  2. Popup ochiladi — rang tanlash + optional izoh
 *  3. Save → backend, cache, va DOM'da darhol ko'rinadi
 *  4. Mavjud highlight ustiga bosish → note editor / delete
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../Logo'

// Types — parent (ReadingReader) dan olinadi.  Bu yerda ular
// intersect qiluvchi shape sifatida qayta e'lon qilinmagan;
// props orqali keladi.
export interface TextHighlightItem {
  id: string
  startOffset: number
  endOffset: number
  color: string
  note: string | null
  highlightedText: string
}

const HIGHLIGHT_COLORS = [
  { value: '#FDE047', dot: '#CA8A04', label: 'Yellow' },
  { value: '#86EFAC', dot: '#15803D', label: 'Green'  },
  { value: '#FCA5A5', dot: '#B91C1C', label: 'Red'    },
  { value: '#C4B5FD', dot: '#6D28D9', label: 'Purple' },
] as const

// ═════════════════════════════════════════════════════════════════
// Props
// ═════════════════════════════════════════════════════════════════
interface Props {
  material: {
    id: string
    title: string
    content: string
    cefrLevel?: string
    certificateType?: string | null
  }
  highlights: TextHighlightItem[]
  onCreate: (h: {
    startOffset: number
    endOffset: number
    color: string
    highlightedText: string
    note?: string
  }) => Promise<void>
  onUpdateNote: (id: string, note: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  canDelete?: boolean
  onRequestDelete?: () => void
}

// ═════════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════════
export default function TextReader({
  material,
  highlights,
  onCreate,
  onUpdateNote,
  onDelete,
  canDelete,
  onRequestDelete,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)

  // ── Selection popup ──────────────────────────────────────────
  const [pendingSelection, setPendingSelection] = useState<{
    start: number
    end: number
    text: string
    // Popup joylashuvi (viewport koord)
    x: number
    y: number
  } | null>(null)

  // ── Existing highlight popup ─────────────────────────────────
  const [openHighlight, setOpenHighlight] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)

  // Klik bo'lmagan joyga bosilsa popup yopiladi
  useEffect(() => {
    if (!pendingSelection && !openHighlight) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-popup="1"]')) return
      if (t.closest('[data-highlight-id]')) return
      setPendingSelection(null)
      setOpenHighlight(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pendingSelection, openHighlight])

  // ── Selection tutish (mouseup) ───────────────────────────────
  const captureSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return

    const range = sel.getRangeAt(0)
    const contentEl = contentRef.current
    if (!contentEl) return

    // Selection contentEl ichida ekanini tekshiramiz
    if (
      !contentEl.contains(range.startContainer) ||
      !contentEl.contains(range.endContainer)
    ) {
      return
    }

    // Char offset hisoblash — content ichidagi matnli belgilar bo'yicha.
    // preRange contentEl boshidan selection boshigacha matnni oladi;
    // uning uzunligi startOffset.  Selection.toString() uzunligi
    // endOffset - startOffset.  Bu span'lar (mavjud highlight'lar)
    // ichida ham to'g'ri ishlaydi — Selection.toString() faqat matnli
    // node'lardan yig'iladi.
    const preRange = document.createRange()
    preRange.selectNodeContents(contentEl)
    preRange.setEnd(range.startContainer, range.startOffset)
    const startOffset = preRange.toString().length

    const text = sel.toString()
    if (text.length === 0) return
    const endOffset = startOffset + text.length

    // Popup pozitsiyasini selection tepasiga qo'yamiz
    const rect = range.getBoundingClientRect()
    setPendingSelection({
      start: startOffset,
      end: endOffset,
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    setOpenHighlight(null)
  }, [])

  // Segmentlarni tuzish — highlight chegaralarida matnni bo'lamiz.
  // Har segment: matn + qaysi highlight'lar unga tegishli.
  const segments = useMemo(
    () => buildSegments(material.content, highlights),
    [material.content, highlights]
  )

  const createWithColor = async (color: string) => {
    if (!pendingSelection) return
    try {
      await onCreate({
        startOffset: pendingSelection.start,
        endOffset: pendingSelection.end,
        color,
        highlightedText: pendingSelection.text,
      })
      setPendingSelection(null)
      window.getSelection()?.removeAllRanges()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save highlight.')
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <main className="fixed inset-0 flex flex-col bg-cream">
      {/* Top toolbar */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-ink/8 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/learn/reading"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <span className="truncate max-w-[380px] text-sm font-medium text-ink">
            {material.title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {canDelete && onRequestDelete && (
            <button
              onClick={onRequestDelete}
              className="rounded-full p-2 text-ink-muted transition hover:bg-coral-50 hover:text-coral-600"
              title="Delete this material"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
          )}
          <Logo size={26} />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <article
          ref={contentRef}
          onMouseUp={captureSelection}
          className="mx-auto max-w-3xl px-5 py-10 sm:px-8"
          style={{ userSelect: 'text' }}
        >
          <div className="prose prose-lg max-w-none whitespace-pre-wrap font-serif text-lg leading-[1.75] text-ink">
            {segments.map((seg, i) => {
              if (seg.highlights.length === 0) {
                return <span key={i}>{seg.text}</span>
              }
              // Overlapping bo'lsa — eng oxirgi qo'shilganini
              // tepada ko'rsatamiz (visual jihatdan yangi rang eski
              // rang ustidan chiqadi).
              const active = seg.highlights[seg.highlights.length - 1]
              return (
                <span
                  key={i}
                  data-highlight-id={active.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    const r = (e.target as HTMLElement).getBoundingClientRect()
                    setOpenHighlight({
                      id: active.id,
                      x: r.left + r.width / 2,
                      y: r.top,
                    })
                    setPendingSelection(null)
                  }}
                  style={{
                    backgroundColor: active.color,
                    // Note bor bo'lsa nuqtali underline bilan belgilaymiz
                    boxShadow: active.note
                      ? `inset 0 -2px 0 0 rgba(0,0,0,0.25)`
                      : undefined,
                    cursor: 'pointer',
                    borderRadius: 2,
                    padding: '2px 1px',
                    mixBlendMode: 'multiply',
                  }}
                >
                  {seg.text}
                </span>
              )
            })}
          </div>

          {/* Meta */}
          <footer className="mt-12 border-t border-ink/8 pt-4 text-xs text-ink-muted">
            {material.cefrLevel && <span>Level: {material.cefrLevel} · </span>}
            {material.certificateType && (
              <span>{material.certificateType.replace(/_/g, ' ')} · </span>
            )}
            <span>{highlights.length} highlight{highlights.length === 1 ? '' : 's'}</span>
          </footer>
        </article>
      </div>

      {/* New selection popup */}
      {pendingSelection && (
        <FloatingPopup x={pendingSelection.x} y={pendingSelection.y}>
          <div className="flex items-center gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => createWithColor(c.value)}
                title={c.label}
                className="group h-8 w-8 rounded-full transition hover:scale-110"
                style={{ backgroundColor: c.value }}
              >
                <span className="sr-only">{c.label}</span>
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-ink/10" />
            <button
              onClick={() => setPendingSelection(null)}
              className="rounded-full p-1.5 text-ink-muted transition hover:bg-ink/5 hover:text-ink"
              title="Cancel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </FloatingPopup>
      )}

      {/* Existing highlight popup */}
      {openHighlight && (
        <ExistingHighlightPopup
          highlight={highlights.find((h) => h.id === openHighlight.id)!}
          x={openHighlight.x}
          y={openHighlight.y}
          onDelete={async () => {
            await onDelete(openHighlight.id)
            setOpenHighlight(null)
          }}
          onSaveNote={async (note) => {
            await onUpdateNote(openHighlight.id, note)
            setOpenHighlight(null)
          }}
          onClose={() => setOpenHighlight(null)}
        />
      )}
    </main>
  )
}

// ═════════════════════════════════════════════════════════════════
// Segment building — highlight chegaralarida matnni bo'lamiz.
// Har segment bir necha highlight'ga tegishli bo'lishi mumkin.
// ═════════════════════════════════════════════════════════════════
type Segment = { text: string; highlights: TextHighlightItem[] }

function buildSegments(
  content: string,
  highlights: TextHighlightItem[]
): Segment[] {
  if (highlights.length === 0) return [{ text: content, highlights: [] }]

  // Chegara pozitsiyalar (boshlanish va oxirlar) —
  // bularda matnni bo'lamiz.
  const boundariesSet = new Set<number>()
  boundariesSet.add(0)
  boundariesSet.add(content.length)
  for (const h of highlights) {
    boundariesSet.add(Math.max(0, Math.min(content.length, h.startOffset)))
    boundariesSet.add(Math.max(0, Math.min(content.length, h.endOffset)))
  }
  const boundaries = [...boundariesSet].sort((a, b) => a - b)

  // Yaratilgan tartibda saqlaymiz — overlap'da eng yangisi
  // tepada ko'rinadi.
  const ordered = [...highlights].sort(
    (a, b) => a.startOffset - b.startOffset
  )

  const segments: Segment[] = []
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    if (start === end) continue
    const text = content.slice(start, end)
    const active = ordered.filter(
      (h) => h.startOffset < end && h.endOffset > start
    )
    segments.push({ text, highlights: active })
  }
  return segments
}

// ═════════════════════════════════════════════════════════════════
// Floating popup — ekran chetlarida to'g'ri joylashish bilan
// ═════════════════════════════════════════════════════════════════
function FloatingPopup({
  x,
  y,
  children,
}: {
  x: number
  y: number
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // Selection tepasida ochamiz.  Ekranga sig'masa pastga tushiramiz.
    const margin = 8
    let left = Math.max(margin, Math.min(
      window.innerWidth - rect.width - margin,
      x - rect.width / 2
    ))
    let top = y - rect.height - margin
    if (top < margin) top = y + margin + 24 // selection ostiga
    setPos({ left, top })
  }, [x, y])

  return (
    <div
      ref={ref}
      data-popup="1"
      className="fixed z-50 rounded-full border border-ink/10 bg-white p-1.5 shadow-xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Mavjud highlight uchun popup — note editor + delete
// ═════════════════════════════════════════════════════════════════
function ExistingHighlightPopup({
  highlight,
  x,
  y,
  onDelete,
  onSaveNote,
  onClose,
}: {
  highlight: TextHighlightItem
  x: number
  y: number
  onDelete: () => Promise<void>
  onSaveNote: (note: string) => Promise<void>
  onClose: () => void
}) {
  const [note, setNote] = useState(highlight.note ?? '')
  const [editing, setEditing] = useState(!!highlight.note === false)

  return (
    <FloatingPopup x={x} y={y}>
      <div className="w-72 rounded-2xl bg-white p-3">
        {editing ? (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              autoFocus
              rows={3}
              className="mb-2 w-full resize-none rounded-xl border border-ink/12 bg-cream p-2 text-sm outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={onDelete}
                className="rounded-lg px-2 py-1 text-xs font-medium text-coral-600 hover:bg-coral-50"
              >
                Delete
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={onClose}
                  className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSaveNote(note)}
                  className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600"
                >
                  Save
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 whitespace-pre-wrap text-sm text-ink">
              {highlight.note}
            </p>
            <div className="flex items-center justify-between border-t border-ink/8 pt-2">
              <button
                onClick={onDelete}
                className="rounded-lg px-2 py-1 text-xs font-medium text-coral-600 hover:bg-coral-50"
              >
                Delete
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </FloatingPopup>
  )
}
