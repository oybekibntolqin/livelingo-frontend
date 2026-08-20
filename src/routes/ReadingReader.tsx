import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PdfLoader, PdfHighlighter, Popup } from 'react-pdf-highlighter'
import 'react-pdf-highlighter/dist/style.css'

import Logo from '../components/Logo'
import TextReader from '../components/reading/TextReader'
import { api, ApiError } from '../lib/api'
import { isAuthenticated } from '../lib/auth'

// ─────────────────────────────────────────────────────────────────
// One-time global quality patch.
// ─────────────────────────────────────────────────────────────────
    ;(async () => {
    const w = window as unknown as { __livelingoPdfPatched?: boolean }
    if (w.__livelingoPdfPatched) return
    w.__livelingoPdfPatched = true
    try {
        const mod: any = await import('pdfjs-dist/legacy/web/pdf_viewer.mjs')
        const PDFPageView = mod?.PDFPageView
        if (!PDFPageView?.prototype) return

        const originalDraw = PDFPageView.prototype.draw
        if ((originalDraw as any).__livelingoPatched) return

        const patchedDraw = function patchedDraw(this: any, ...args: any[]) {
                this.maxCanvasPixels = 256 * 1024 * 1024
                return originalDraw.apply(this, args)
            }
        ;(patchedDraw as any).__livelingoPatched = true
        PDFPageView.prototype.draw = patchedDraw
    } catch {
        // pdfjs-dist not resolvable
    }
})()

/* eslint-disable @typescript-eslint/no-explicit-any */
type IHighlight = any
type ScaledPosition = any
type Content = any
type LTWHP = any
/* eslint-enable @typescript-eslint/no-explicit-any */

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

interface BackendRect {
    x1: number
    y1: number
    x2: number
    y2: number
    pageWidth: number
    pageHeight: number
}

interface BackendPdfHighlight {
    id: string
    materialId: string
    type: 'PDF'
    highlightedText: string
    pageNumber: number
    boundingRect: BackendRect
    rects: BackendRect[]
    color: string
    note: string | null
    createdAt: string
}

interface BackendTextHighlight {
    id: string
    materialId: string
    type: 'TEXT'
    highlightedText: string
    startOffset: number
    endOffset: number
    color: string
    note: string | null
    createdAt: string
}

type BackendHighlight = BackendPdfHighlight | BackendTextHighlight

interface ReadingMaterial {
    id: string
    title: string
    content: string
    languageCode: string
    cefrLevel: CefrLevel
    certificateType: string | null
    topic: string | null
    source: string | null
    originalFileUrl: string | null
    year: number | null
    createdAt: string
}

const HIGHLIGHT_COLORS = [
    { value: '#FDE047', dot: '#CA8A04', label: 'Yellow' },
    { value: '#86EFAC', dot: '#15803D', label: 'Green'  },
    { value: '#FCA5A5', dot: '#B91C1C', label: 'Red'    },
    { value: '#C4B5FD', dot: '#6D28D9', label: 'Purple' },
] as const

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0]

// ─────────────────────────────────────────────────────────────────
// Format normalizatorlari: camelCase va snake_case mosligini ta'minlash
// ─────────────────────────────────────────────────────────────────
function normalizeRect(r: any): BackendRect | null {
    if (!r) return null
    return {
        x1: r.x1 ?? 0,
        y1: r.y1 ?? 0,
        x2: r.x2 ?? 0,
        y2: r.y2 ?? 0,
        pageWidth: r.pageWidth ?? r.page_width ?? r.width ?? 0,
        pageHeight: r.pageHeight ?? r.page_height ?? r.height ?? 0,
    }
}

function normalizeHighlight(h: any): BackendHighlight {
    if (!h) return h
    return {
        id: h.id,
        materialId: h.materialId ?? h.material_id,
        type: h.type,
        highlightedText: h.highlightedText ?? h.highlighted_text ?? '',
        pageNumber: h.pageNumber ?? h.page_number,
        boundingRect: h.boundingRect || h.bounding_rect ? normalizeRect(h.boundingRect ?? h.bounding_rect) : null,
        rects: (h.rects ?? []).map(normalizeRect),
        color: h.color,
        note: h.note,
        createdAt: h.createdAt ?? h.created_at,
        startOffset: h.startOffset ?? h.start_offset,
        endOffset: h.endOffset ?? h.end_offset,
    } as BackendHighlight
}

function backendRectToLib(r: BackendRect, pageNumber: number) {
    if (!r) return { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0, pageNumber, left: 0, top: 0 }
    return {
        x1: r.x1,
        y1: r.y1,
        x2: r.x2,
        y2: r.y2,
        width: r.pageWidth,
        height: r.pageHeight,
        pageNumber,
        left: r.x1,
        top: r.y1,
    }
}

function backendHighlightToLib(h: BackendPdfHighlight): IHighlight {
    if (!h) return null
    return {
        id: h.id,
        content: { text: h.highlightedText ?? '' },
        position: {
            pageNumber: h.pageNumber ?? 1,
            boundingRect: backendRectToLib(h.boundingRect, h.pageNumber ?? 1),
            rects: (h.rects ?? []).map((r) => backendRectToLib(r, h.pageNumber ?? 1)),
        },
        comment: { text: h.note ?? '', emoji: '' },
    }
}

function libPositionToBackend(
    position: ScaledPosition,
    content: Content,
    color: string,
    materialId: string,
    note?: string
) {
    const mapRect = (r: any): BackendRect => ({
        x1: r.x1,
        y1: r.y1,
        x2: r.x2,
        y2: r.y2,
        pageWidth: r.width,
        pageHeight: r.height,
    })
    return {
        materialId,
        type: 'PDF' as const,
        highlightedText: content.text ?? '',
        pageNumber: position.pageNumber,
        boundingRect: mapRect(position.boundingRect),
        rects: (position.rects ?? []).map(mapRect),
        color,
        note: note ?? null,
    }
}

function isPdfMaterial(m: ReadingMaterial): boolean {
    const url = m.originalFileUrl
    if (!url) return false
    const path = url.toLowerCase().split('?')[0]
    return path.endsWith('.pdf')
}

const HIGHLIGHT_CACHE_KEY = (materialId: string) =>
    `livelingo:highlights:${materialId}`

function loadCachedHighlights(materialId: string): BackendHighlight[] | null {
    try {
        const raw = localStorage.getItem(HIGHLIGHT_CACHE_KEY(materialId))
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map(normalizeHighlight) : null
    } catch {
        return null
    }
}

function saveCachedHighlights(materialId: string, highlights: BackendHighlight[]) {
    try {
        localStorage.setItem(
            HIGHLIGHT_CACHE_KEY(materialId),
            JSON.stringify(highlights)
        )
    } catch {}
}

function clearCachedHighlights(materialId: string) {
    try {
        localStorage.removeItem(HIGHLIGHT_CACHE_KEY(materialId))
    } catch {}
}

export default function ReadingReader() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const canDelete = params.get('mine') === '1'

    useEffect(() => {
        if (!isAuthenticated()) navigate('/sign-in', { replace: true })
    }, [navigate])

    const [material, setMaterial] = useState<ReadingMaterial | null>(null)
    const [highlights, setHighlights] = useState<BackendHighlight[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!id) return
        let cancelled = false
        setLoading(true)
        setError(null)

        const cached = loadCachedHighlights(id)
        if (cached && cached.length) {
            setHighlights(cached)
        }

        Promise.all([
            api.get<ReadingMaterial>(`/api/reading/materials/${id}`),
            api.get<any[]>(`/api/reading/materials/${id}/highlights`),
        ])
            .then(([m, h]) => {
                if (cancelled) return
                const rawList = Array.isArray(h) ? h : []
                // Backend javobini xavfsiz normalizatsiya qilish
                const fresh = rawList.map(normalizeHighlight)
                setMaterial(m)
                setHighlights(fresh)
                saveCachedHighlights(id, fresh)
            })
            .catch((err) => {
                if (cancelled) return
                if (err instanceof ApiError && err.status === 401) {
                    navigate('/sign-in', { replace: true })
                    return
                }
                setError(err instanceof Error ? err.message : 'Could not load this material.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [id, navigate])

    const createHighlight = useCallback(
        async (
            position: ScaledPosition,
            content: Content,
            color: string,
            note?: string
        ) => {
            if (!material) return
            try {
                const dto = libPositionToBackend(position, content, color, material.id, note)
                const saved = await api.post<any>('/api/reading/highlights', dto)
                const normalized = normalizeHighlight(saved)
                setHighlights((prev) => {
                    const next = [...prev, normalized]
                    saveCachedHighlights(material.id, next)
                    return next
                })
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Could not save highlight.')
            }
        },
        [material]
    )

    const deleteHighlight = useCallback(
        async (highlightId: string) => {
            if (!material) return
            try {
                await api.del(`/api/reading/highlights/${highlightId}`)
                setHighlights((prev) => {
                    const next = prev.filter((h) => h.id !== highlightId)
                    saveCachedHighlights(material.id, next)
                    return next
                })
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Could not delete highlight.')
            }
        },
        [material]
    )

    const updateNote = useCallback(
        async (...args: any[]) => {
            if (!material) return
            console.log('updateNote funksiyasiga kelgan argumentlar:', args)

            let highlightId: string | undefined
            let note: string | undefined

            if (args[0] && typeof args[0] === 'object') {
                highlightId = args[0].id ?? args[0].highlightId
                note = args[0].note
            } else {
                highlightId = args[0]
                note = args[1]
            }

            if (!highlightId) {
                console.error('Highlight ID topilmadi. Argumentlar:', args)
                return
            }

            try {
                await api.put(`/api/reading/highlights/${highlightId}/note`, note ?? '')
                setHighlights((prev) => {
                    const next = prev.map((h) =>
                        h.id === highlightId ? { ...h, note: note ?? null } : h
                    )
                    saveCachedHighlights(material.id, next)
                    return next
                })
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Could not save note.')
            }
        },
        [material]
    )

    const [confirmDelete, setConfirmDelete] = useState(false)
    const deleteMaterial = useCallback(async () => {
        if (!material) return
        try {
            await api.del(`/api/reading/materials/${material.id}/my`)
            clearCachedHighlights(material.id)
            navigate('/learn/reading', { replace: true })
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) {
                alert('You can only delete your own uploads.')
                return
            }
            alert(err instanceof Error ? err.message : 'Could not delete this material.')
        }
    }, [material, navigate])

    // PDF turidagi highlightlarni ajratib olish (Xavfsiz mantiq)
    const pdfHighlights = useMemo(() => {
        return highlights.filter((h): h is BackendPdfHighlight => {
            const type = h.type?.toUpperCase()
            if (type === 'PDF') return true
            if (type === 'TEXT') return false
            return 'pageNumber' in h || 'boundingRect' in h
        })
    }, [highlights])

    // TEXT turidagi highlightlarni ajratib olish (Xavfsiz mantiq)
    const textHighlights = useMemo(() => {
        return highlights.filter((h): h is BackendTextHighlight => {
            const type = h.type?.toUpperCase()
            if (type === 'TEXT') return true
            if (type === 'PDF') return false
            return 'startOffset' in h
        })
    }, [highlights])

    if (loading) return <FullScreenLoader label="Loading…" />
    if (error || !material) return <FullScreenError message={error ?? 'Material not found.'} />

    if (isPdfMaterial(material)) {
        return (
            <>
                <PdfReader
                    material={material}
                    highlights={pdfHighlights}
                    onCreate={createHighlight}
                    onDelete={deleteHighlight}
                    onUpdateNote={updateNote}
                    onRequestDelete={canDelete ? () => setConfirmDelete(true) : undefined}
                />
                {confirmDelete && (
                    <ConfirmDialog
                        title="Delete this material?"
                        message={`"${material.title}" and all your highlights on it will be removed. This can't be undone.`}
                        confirmLabel="Delete"
                        danger
                        onCancel={() => setConfirmDelete(false)}
                        onConfirm={() => {
                            setConfirmDelete(false)
                            deleteMaterial()
                        }}
                    />
                )}
            </>
        )
    }

    return (
        <>
            <TextReader
                material={material}
                highlights={textHighlights.map((h) => ({
                    id: h.id,
                    startOffset: h.startOffset,
                    endOffset: h.endOffset,
                    color: h.color,
                    note: h.note,
                    highlightedText: h.highlightedText,
                }))}
                onCreate={async (...args: any[]) => {
                    if (!material) return
                    console.log('TextReader onCreate funksiyasiga kelgan argumentlar:', args)

                    let startOffset: number | undefined
                    let endOffset: number | undefined
                    let highlightedText: string | undefined
                    let color: string | undefined
                    let note: string | null = null

                    if (args[0] && typeof args[0] === 'object') {
                        const h = args[0]
                        startOffset = h.startOffset
                        endOffset = h.endOffset
                        highlightedText = h.highlightedText
                        color = h.color
                        note = h.note ?? null
                    } else {
                        if (typeof args[0] === 'number' && typeof args[1] === 'number') {
                            startOffset = args[0]
                            endOffset = args[1]
                            highlightedText = args[2]
                            color = args[3]
                            note = args[4] ?? null
                        } else if (typeof args[0] === 'string' && typeof args[1] === 'number' && typeof args[2] === 'number') {
                            highlightedText = args[0]
                            startOffset = args[1]
                            endOffset = args[2]
                            color = args[3]
                            note = args[4] ?? null
                        }
                    }

                    if (startOffset === undefined || endOffset === undefined) {
                        console.error('Matn koordinatalarini argumentlardan ajratib boʻlmadi:', args)
                        return
                    }

                    try {
                        const dto = {
                            materialId: material.id,
                            type: 'TEXT' as const,
                            highlightedText: highlightedText ?? '',
                            startOffset,
                            endOffset,
                            color: color ?? '#FDE047',
                            note: note ?? null,
                        }

                        console.log('Backendga yuborilayotgan DTO:', dto)

                        const saved = await api.post<any>('/api/reading/highlights', dto)
                        const normalized = normalizeHighlight(saved)
                        setHighlights((prev) => {
                            const next = [...prev, normalized]
                            saveCachedHighlights(material.id, next)
                            return next
                        })
                    } catch (err) {
                        alert(err instanceof Error ? err.message : 'Could not save highlight.')
                    }
                }}
                onDelete={deleteHighlight}
                onUpdateNote={updateNote}
                canDelete={canDelete}
                onRequestDelete={canDelete ? () => setConfirmDelete(true) : undefined}
            />
            {confirmDelete && (
                <ConfirmDialog
                    title="Delete this material?"
                    message={`"${material.title}" will be removed. This can't be undone.`}
                    confirmLabel="Delete"
                    danger
                    onCancel={() => setConfirmDelete(false)}
                    onConfirm={() => {
                        setConfirmDelete(false)
                        deleteMaterial()
                    }}
                />
            )}
        </>
    )
}

// ─────────────────────────────────────────────────────────────────
// PDF Reader components
// ─────────────────────────────────────────────────────────────────
function PdfReader({
                       material,
                       highlights,
                       onCreate,
                       onDelete,
                       onUpdateNote,
                       onRequestDelete,
                   }: {
    material: ReadingMaterial
    highlights: BackendPdfHighlight[]
    onCreate: (p: ScaledPosition, c: Content, color: string, n?: string) => void
    onDelete: (id: string) => void
    onUpdateNote: (id: string, note: string) => void
    onRequestDelete?: () => void
}) {
    return (
        <div className="fixed inset-0 flex flex-col bg-[#f0f0f4]">
            <PdfLoader
                url={material.originalFileUrl!}
                beforeLoad={
                    <FullScreenLoader label={`Loading ${material.title}…`} />
                }
            >
                {(pdfDocument) => (
                    <PdfContent
                        pdfDocument={pdfDocument}
                        material={material}
                        highlights={highlights}
                        onCreate={onCreate}
                        onDelete={onDelete}
                        onUpdateNote={onUpdateNote}
                        onRequestDelete={onRequestDelete}
                    />
                )}
            </PdfLoader>
            <ReaderStyles />
        </div>
    )
}

function PdfContent({
                        pdfDocument,
                        material,
                        highlights,
                        onCreate,
                        onDelete,
                        onUpdateNote,
                        onRequestDelete,
                    }: {
    pdfDocument: { numPages: number }
    material: ReadingMaterial
    highlights: BackendPdfHighlight[]
    onCreate: (p: ScaledPosition, c: Content, color: string, n?: string) => void
    onDelete: (id: string) => void
    onUpdateNote: (id: string, note: string) => void
    onRequestDelete?: () => void
}) {
    const totalPages = pdfDocument.numPages
    const [zoom, setZoom] = useState(1)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageInput, setPageInput] = useState('1')
    const containerRef = useRef<HTMLDivElement>(null)
    const highlighterRef = useRef<any>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        let observer: IntersectionObserver | null = null
        let tries = 0

        const setup = () => {
            const pages = container.querySelectorAll<HTMLElement>('.page[data-page-number]')
            if (pages.length === 0) {
                if (tries++ < 30) setTimeout(setup, 200)
                return
            }
            observer = new IntersectionObserver(
                (entries) => {
                    const best = entries
                        .filter((e) => e.isIntersecting)
                        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
                    if (best) {
                        const n = Number(best.target.getAttribute('data-page-number'))
                        if (n && !Number.isNaN(n)) setCurrentPage(n)
                    }
                },
                { root: container, threshold: [0.1, 0.5, 0.9] }
            )
            pages.forEach((p) => observer!.observe(p))
        }
        setup()

        return () => {
            observer?.disconnect()
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | null = null

        const applyOnce = () => {
            if (cancelled) return
            const viewer = highlighterRef.current?.viewer
            if (!viewer) {
                if (attempts++ < 40) timer = setTimeout(applyOnce, 150)
                return
            }
            viewer.maxCanvasPixels = 256 * 1024 * 1024
        }
        applyOnce()

        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | null = null

        const applyScale = () => {
            if (cancelled) return
            const viewer = highlighterRef.current?.viewer
            if (!viewer) {
                if (attempts++ < 40) timer = setTimeout(applyScale, 100)
                return
            }
            try {
                viewer.currentScaleValue = String(zoom)
            } catch {}
        }
        applyScale()

        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [zoom])

    const [inputFocused, setInputFocused] = useState(false)
    useEffect(() => {
        if (!inputFocused) setPageInput(String(currentPage))
    }, [currentPage, inputFocused])

    const goToPage = useCallback((n: number) => {
        const clamped = Math.max(1, Math.min(totalPages, n))
        const el = containerRef.current?.querySelector<HTMLElement>(
            `.page[data-page-number="${clamped}"]`
        )
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, [totalPages])

    const commitPageInput = () => {
        setInputFocused(false)
        const n = Number(pageInput)
        if (n && !Number.isNaN(n)) {
            goToPage(n)
        } else {
            setPageInput(String(currentPage))
        }
    }

    const zoomIn = useCallback(() => {
        setZoom((z) => ZOOM_STEPS.find((s) => s > z) ?? z)
    }, [])
    const zoomOut = useCallback(() => {
        setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z) ?? z)
    }, [])
    const resetZoom = useCallback(() => setZoom(1), [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault()
                zoomIn()
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault()
                zoomOut()
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault()
                resetZoom()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [zoomIn, zoomOut, resetZoom])

    const libHighlights = useMemo(
        () => highlights.map(backendHighlightToLib),
        [highlights]
    )

    const byId = useMemo(() => {
        const m = new Map<string, BackendPdfHighlight>()
        for (const h of highlights) m.set(h.id, h)
        return m
    }, [highlights])

    const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {})

    return (
        <>
            <PdfToolbar
                title={material.title}
                currentPage={currentPage}
                totalPages={totalPages}
                pageInput={pageInput}
                onPageInputChange={setPageInput}
                onPageInputFocus={() => setInputFocused(true)}
                onPageInputCommit={commitPageInput}
                zoom={zoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onResetZoom={resetZoom}
                onDelete={onRequestDelete}
                downloadUrl={material.originalFileUrl ?? undefined}
            />

            <div
                ref={containerRef}
                className="relative flex-1 overflow-hidden"
            >
                {/* Kalit qiymati faqat material.id qilib o'zgartirildi. Bu har safar highlight qo'shilganda yoki o'chirilganda PDF-ning butunlay qayta yuklanishi va miltillashini oldini oladi. */}
                <PdfHighlighter
                    key={material.id}
                    ref={highlighterRef}
                    pdfDocument={pdfDocument as any}
                    enableAreaSelection={(e) => e.altKey}
                    onScrollChange={() => {}}
                    scrollRef={(scrollTo) => {
                        scrollViewerTo.current = scrollTo
                    }}
                    pdfScaleValue={String(zoom)}
                    onSelectionFinished={(
                        position: any,
                        content: any,
                        hideTipAndSelection: () => void
                    ) => (
                        <SelectionTip
                            selectedText={content?.text ?? ''}
                            onConfirm={(color) => {
                                onCreate(position, content, color)
                                hideTipAndSelection()
                            }}
                        />
                    )}
                    highlightTransform={(
                        highlight: any,
                        _index: number,
                        setTip: any,
                        hideTip: () => void,
                        _vp: any,
                        _ss: any,
                        isScrolledTo: boolean
                    ) => {
                        const original = byId.get(highlight.id)
                        const color = original?.color ?? HIGHLIGHT_COLORS[0].value
                        return (
                            <Popup
                                popupContent={
                                    <HighlightPopupContent
                                        text={highlight.content.text}
                                        note={original?.note ?? null}
                                        onDelete={() => {
                                            onDelete(highlight.id)
                                            hideTip()
                                        }}
                                        onSaveNote={(note) => onUpdateNote(highlight.id, note)}
                                    />
                                }
                                onMouseOver={(popupContent) =>
                                    setTip(highlight, () => popupContent)
                                }
                                onMouseOut={hideTip}
                                key={highlight.id}
                                children={
                                    <ColoredHighlight
                                        position={highlight.position}
                                        color={color}
                                        isScrolledTo={isScrolledTo}
                                    />
                                }
                            />
                        )
                    }}
                    highlights={libHighlights}
                />
            </div>
        </>
    )
}

function PdfToolbar({
                        title,
                        currentPage,
                        totalPages,
                        pageInput,
                        onPageInputChange,
                        onPageInputFocus,
                        onPageInputCommit,
                        zoom,
                        onZoomIn,
                        onZoomOut,
                        onResetZoom,
                        onDelete,
                        downloadUrl,
                    }: {
    title: string
    currentPage: number
    totalPages: number
    pageInput: string
    onPageInputChange: (v: string) => void
    onPageInputFocus: () => void
    onPageInputCommit: () => void
    zoom: number
    onZoomIn: () => void
    onZoomOut: () => void
    onResetZoom: () => void
    onDelete?: () => void
    downloadUrl?: string
}) {
    return (
        <div className="flex h-13 shrink-0 items-center gap-2 bg-[#1c1b2c] px-3 text-white/90 sm:gap-3 sm:px-4"
             style={{ height: 52 }}>
            <Link
                to="/learn/reading"
                aria-label="Back to library"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </Link>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/90">
                    {title}
                </p>
            </div>

            <div className="hidden h-6 w-px bg-white/10 md:block" />

            <div className="hidden items-center gap-1.5 md:flex">
                <button
                    onClick={() => {
                        const el = document.querySelector<HTMLElement>(
                            `.page[data-page-number="${Math.max(1, currentPage - 1)}"]`
                        )
                        el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                    }}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                    className="grid h-7 w-7 place-items-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 15l-6-6-6 6" />
                    </svg>
                </button>

                <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={pageInput}
                        onChange={(e) => onPageInputChange(e.target.value.replace(/[^0-9]/g, ''))}
                        onFocus={(e) => {
                            onPageInputFocus()
                            e.target.select()
                        }}
                        onBlur={onPageInputCommit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.currentTarget.blur()
                            }
                        }}
                        className="h-7 w-11 rounded bg-white/10 px-1.5 text-center text-white/95 outline-none transition-colors focus:bg-white/20"
                        aria-label="Current page"
                    />
                    <span className="text-white/50">/</span>
                    <span className="text-white/70">{totalPages}</span>
                </div>

                <button
                    onClick={() => {
                        const el = document.querySelector<HTMLElement>(
                            `.page[data-page-number="${Math.min(totalPages, currentPage + 1)}"]`
                        )
                        el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                    }}
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                    className="grid h-7 w-7 place-items-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </button>
            </div>

            <div className="hidden h-6 w-px bg-white/10 md:block" />

            <div className="flex items-center rounded-full bg-white/5 p-0.5">
                <button
                    onClick={onZoomOut}
                    disabled={zoom <= ZOOM_STEPS[0]}
                    aria-label="Zoom out"
                    className="grid h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                    </svg>
                </button>
                <button
                    onClick={onResetZoom}
                    className="min-w-14 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white/90 transition-colors hover:bg-white/10"
                    aria-label="Reset zoom"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    onClick={onZoomIn}
                    disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                    aria-label="Zoom in"
                    className="grid h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
            </div>

            {(downloadUrl || onDelete) && (
                <div className="hidden h-6 w-px bg-white/10 sm:block" />
            )}

            {downloadUrl && (
                <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    aria-label="Download original PDF"
                    title="Download"
                    className="hidden h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:grid"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                </a>
            )}

            {onDelete && (
                <button
                    onClick={onDelete}
                    aria-label="Delete this material"
                    title="Delete"
                    className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-300"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6M10 11v6M14 11v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                </button>
            )}

            <div className="ml-1 hidden opacity-60 lg:block">
                <Logo size={22} />
            </div>
        </div>
    )
}

function ColoredHighlight({
                              position,
                              color,
                              isScrolledTo,
                          }: {
    position: { rects: LTWHP[] }
    color: string
    isScrolledTo: boolean
}) {
    return (
        <div>
            {position.rects.map((rect, idx) => (
                <div
                    key={idx}
                    style={{
                        position: 'absolute',
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        backgroundColor: color,
                        opacity: isScrolledTo ? 1 : 0.75,
                        mixBlendMode: 'multiply',
                        cursor: 'pointer',
                        borderRadius: 2,
                        transition: 'opacity 150ms ease',
                        pointerEvents: 'auto',
                    }}
                />
            ))}
        </div>
    )
}

// Selection matnini clipboard'ga nusxalash — asosiy Clipboard API,
// ishlamasa (masalan http yoki eski brauzer) eski execCommand fallback.
async function copyTextToClipboard(text: string): Promise<boolean> {
    if (!text) return false
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // pastdagi fallback'ga o'tamiz
    }
    try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
    } catch {
        return false
    }
}

function SelectionTip({
                           selectedText,
                           onConfirm,
                       }: {
    selectedText: string
    onConfirm: (color: string) => void
}) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        const ok = await copyTextToClipboard(selectedText)
        if (ok) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }
    }

    return (
        <div
            className="flex items-center gap-1 rounded-full bg-[#1c1b2c] p-1.5"
            style={{ boxShadow: '0 12px 32px rgba(20, 20, 43, 0.28)' }}
        >
            <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy text'}
                title={copied ? 'Copied!' : 'Copy'}
                className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition-transform hover:scale-110 hover:bg-white/10 active:scale-95"
            >
                {copied ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                )}
            </button>

            <div className="h-5 w-px bg-white/15" />

            {HIGHLIGHT_COLORS.map((c) => (
                <button
                    key={c.value}
                    type="button"
                    onClick={() => onConfirm(c.value)}
                    aria-label={`Highlight ${c.label}`}
                    className="group relative grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: c.value }}
                >
          <span
              className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-125"
              style={{ backgroundColor: c.dot }}
          />
                </button>
            ))}
        </div>
    )
}

function HighlightPopupContent({
                                   text,
                                   note,
                                   onDelete,
                                   onSaveNote,
                               }: {
    text: string
    note: string | null
    onDelete: () => void
    onSaveNote: (note: string) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(note ?? '')

    return (
        <div
            className="w-72 overflow-hidden rounded-2xl bg-white"
            style={{ boxShadow: '0 12px 40px rgba(20, 20, 43, 0.18)' }}
        >
            <div className="border-b border-ink/6 px-4 py-3">
                <p className="text-[13px] italic leading-relaxed text-ink-soft line-clamp-3">
                    "{text}"
                </p>
            </div>

            {editing ? (
                <div className="p-3">
          <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-lg border border-ink/10 bg-cream-warm p-2.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
                    <div className="mt-2 flex justify-end gap-1">
                        <button
                            onClick={() => {
                                setEditing(false)
                                setDraft(note ?? '')
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-cream-warm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onSaveNote(draft)
                                setEditing(false)
                            }}
                            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink/90"
                        >
                            Save note
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {note && (
                        <div className="px-4 py-3">
                            <p className="text-[13px] leading-relaxed text-ink">{note}</p>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-ink/6 px-2 py-1.5">
                        <button
                            onClick={() => setEditing(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-cream-warm hover:text-ink"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z" />
                            </svg>
                            {note ? 'Edit' : 'Add note'}
                        </button>
                        <button
                            onClick={onDelete}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6M10 11v6M14 11v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                            Delete
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

function FullScreenLoader({ label }: { label: string }) {
    return (
        <main className="fixed inset-0 grid place-items-center bg-cream">
            <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
                <p className="mt-4 text-sm text-ink-soft">{label}</p>
            </div>
        </main>
    )
}

function FullScreenError({ message }: { message: string }) {
    return (
        <main className="fixed inset-0 grid place-items-center bg-cream px-5">
            <div className="max-w-md text-center">
                <p className="text-coral-600">{message}</p>
                <Link
                    to="/learn/reading"
                    className="mt-4 inline-block text-sm font-medium underline"
                >
                    Back to materials
                </Link>
            </div>
        </main>
    )
}

function ConfirmDialog({
                           title,
                           message,
                           confirmLabel,
                           onCancel,
                           onConfirm,
                           danger,
                       }: {
    title: string
    message: string
    confirmLabel: string
    onCancel: () => void
    onConfirm: () => void
    danger?: boolean
}) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onCancel])

    return (
        <div
            className="fixed inset-0 z-[100] grid place-items-center bg-ink/50 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                className="mx-5 w-full max-w-md overflow-hidden rounded-3xl bg-white"
                style={{ boxShadow: '0 24px 64px rgba(20, 20, 43, 0.22)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <h3 className="font-display text-lg font-semibold text-ink">
                        {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        {message}
                    </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-ink/6 bg-cream-warm/50 px-4 py-3">
                    <button
                        onClick={onCancel}
                        className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        autoFocus
                        className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-colors ${
                            danger
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-ink hover:bg-ink/90'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ReaderStyles() {
    return (
        <style>{`
      .PdfHighlighter {
        background: #f0f0f4 !important;
        padding: 0 !important;
      }
      .PdfHighlighter .page {
        border: none !important;
        border-image: none !important;
        margin: 12px auto !important;
        box-shadow:
          0 1px 3px rgba(20, 20, 43, 0.06),
          0 4px 20px rgba(20, 20, 43, 0.08) !important;
        border-radius: 2px;
      }
      .PdfHighlighter .textLayer {
        opacity: 1 !important;
      }
      .PdfHighlighter .textLayer > span {
        color: transparent;
      }
      .Highlight__part {
        background: transparent !important;
      }
      .Highlight__emoji {
        display: none !important;
      }
      .Tip__compact,
      .Tip__card {
        background: transparent !important;
        border: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .MouseSelection {
        background: rgba(102, 105, 238, 0.15) !important;
        border: 2px dashed #6669EE !important;
      }
      .PdfHighlighter .textLayer ::selection {
        background: rgba(102, 105, 238, 0.3);
      }
      .PdfHighlighter::-webkit-scrollbar {
        width: 12px;
      }
      .PdfHighlighter::-webkit-scrollbar-track {
        background: transparent;
      }
      .PdfHighlighter::-webkit-scrollbar-thumb {
        background: rgba(20, 20, 43, 0.15);
        border-radius: 6px;
        border: 3px solid #f0f0f4;
      }
      .PdfHighlighter::-webkit-scrollbar-thumb:hover {
        background: rgba(20, 20, 43, 0.25);
      }
    `}</style>
    )
}