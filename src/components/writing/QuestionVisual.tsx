// Renders the "visual" portion of a Writing question — the chart,
// table, diagram, or image that Task-1-style prompts hang their essay
// off of.
//
// Priority is:  visualJson  >  visualImageUrl  >  nothing
//
// visualJson is parsed and dispatched by `type`:
//   • chart   → Chart.js (bar / line / pie / doughnut)
//   • table   → styled HTML table
//   • diagram → mermaid.js (dynamic import so we don't drag it into the
//               bundle for pages that never render diagrams)
//
// Anything unrecognised falls through to the image path and, failing
// that, silently renders nothing so a bad payload doesn't blow up the
// whole session view.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'
import type { Visual, ChartVisual, TableVisual, DiagramVisual } from '../../lib/writing'

// Register once per bundle.  Chart.js is tree-shakable but requires
// explicit component registration — omitting a scale silently fails.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

// Palette pulled from the app's design tokens so charts feel at home
// alongside the rest of the UI. First few colors are the strongest;
// beyond that Chart.js will cycle through automatically.
const PALETTE = [
  '#5B5FE9', // indigo
  '#FF8A65', // coral
  '#4ECDC4', // mint
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#10B981', // emerald
  '#3B82F6', // blue
]

// ═════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════
interface Props {
  visualJson?: string | null
  visualImageUrl?: string | null
  className?: string
}

export default function QuestionVisual({
  visualJson,
  visualImageUrl,
  className,
}: Props) {
  const parsed = useMemo<Visual | null>(() => {
    if (!visualJson) return null
    try {
      const v = JSON.parse(visualJson)
      if (v && typeof v === 'object' && 'type' in v) return v as Visual
    } catch {
      // Malformed JSON — fall through to the image path.
    }
    return null
  }, [visualJson])

  if (parsed) {
    switch (parsed.type) {
      case 'chart':
        return <ChartBlock data={parsed} className={className} />
      case 'table':
        return <TableBlock data={parsed} className={className} />
      case 'diagram':
        return <DiagramBlock data={parsed} className={className} />
    }
  }

  if (visualImageUrl) {
    return (
      <figure
        className={`overflow-hidden rounded-3xl border border-ink/8 bg-white shadow-sm ${className ?? ''}`}
      >
        <img
          src={visualImageUrl}
          alt="Question visual"
          className="block h-auto w-full"
          loading="lazy"
        />
      </figure>
    )
  }

  return null
}

// ═════════════════════════════════════════════════════════════════
// Chart
// ═════════════════════════════════════════════════════════════════
function ChartBlock({
  data,
  className,
}: {
  data: ChartVisual
  className?: string
}) {
  const chartData = useMemo(
    () => ({
      labels: data.labels ?? [],
      datasets: (data.datasets ?? []).map((ds, i) => {
        const base = PALETTE[i % PALETTE.length]
        // pie/doughnut want one color per slice, not per dataset
        if (data.chartType === 'pie' || data.chartType === 'doughnut') {
          return {
            label: ds.label,
            data: ds.data ?? [],
            backgroundColor: (ds.data ?? []).map(
              (_, j) => PALETTE[j % PALETTE.length]
            ),
            borderColor: '#ffffff',
            borderWidth: 2,
          }
        }
        return {
          label: ds.label,
          data: ds.data ?? [],
          backgroundColor:
            data.chartType === 'line' ? 'transparent' : `${base}CC`,
          borderColor: base,
          borderWidth: 2,
          borderRadius: data.chartType === 'bar' ? 6 : 0,
          tension: 0.3,
          pointBackgroundColor: base,
          pointRadius: 3,
        }
      }),
    }),
    [data]
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: (data.datasets?.length ?? 0) > 1
            || data.chartType === 'pie'
            || data.chartType === 'doughnut',
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { size: 12 },
            color: '#4A4A6A',
          },
        },
        title: data.title
          ? {
              display: true,
              text: data.title,
              font: { size: 15, weight: 600 },
              color: '#14142B',
              padding: { top: 4, bottom: data.subtitle ? 2 : 12 },
            }
          : undefined,
        subtitle: data.subtitle
          ? {
              display: true,
              text: data.subtitle,
              font: { size: 12, weight: 400, style: 'italic' as const },
              color: '#6B6B87',
              padding: { bottom: 12 },
            }
          : undefined,
        tooltip: {
          backgroundColor: '#14142B',
          titleColor: '#FAFAFA',
          bodyColor: '#FAFAFA',
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales:
        data.chartType === 'pie' || data.chartType === 'doughnut'
          ? undefined
          : {
              x: {
                title: data.xAxisLabel
                  ? { display: true, text: data.xAxisLabel, color: '#6B6B87' }
                  : undefined,
                grid: { display: false },
                ticks: { color: '#6B6B87' },
              },
              y: {
                title: data.yAxisLabel
                  ? { display: true, text: data.yAxisLabel, color: '#6B6B87' }
                  : undefined,
                grid: { color: '#EEEEF3' },
                ticks: { color: '#6B6B87' },
                beginAtZero: true,
              },
            },
    }),
    [data]
  )

  const ChartComponent =
    data.chartType === 'line'
      ? Line
      : data.chartType === 'pie'
        ? Pie
        : data.chartType === 'doughnut'
          ? Doughnut
          : Bar

  return (
    <div
      className={`rounded-3xl border border-ink/8 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      <div className="h-72 sm:h-80">
        <ChartComponent data={chartData} options={options as never} />
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Table
// ═════════════════════════════════════════════════════════════════
function TableBlock({
  data,
  className,
}: {
  data: TableVisual
  className?: string
}) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-ink/8 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      {data.title && (
        <h3 className="mb-3 font-display text-sm font-semibold text-ink">
          {data.title}
        </h3>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {(data.columns ?? []).map((c, i) => (
                <th
                  key={i}
                  className="border-b border-ink/10 bg-cream px-3 py-2.5 text-left font-medium text-ink"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.rows ?? []).map((row, ri) => (
              <tr key={ri} className="hover:bg-cream/60">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b border-ink/6 px-3 py-2.5 text-ink-soft"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Diagram (mermaid)
// ═════════════════════════════════════════════════════════════════
// Loaded lazily on first render so pages that never show a diagram
// don't pay for the ~500KB mermaid runtime.
function DiagramBlock({
  data,
  className,
}: {
  data: DiagramVisual
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#EEF0FE',
            primaryTextColor: '#14142B',
            primaryBorderColor: '#5B5FE9',
            lineColor: '#6B6B87',
            secondaryColor: '#FFF3EF',
            tertiaryColor: '#F0FDF9',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          },
        })
        // Unique id per render to avoid mermaid's global-id collisions.
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(id, data.code)
        if (!cancelled) setSvg(svg)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Diagram failed to render.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data.code])

  return (
    <div
      className={`rounded-3xl border border-ink/8 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      {data.title && (
        <h3 className="mb-3 font-display text-sm font-semibold text-ink">
          {data.title}
        </h3>
      )}
      {error ? (
        <pre className="whitespace-pre-wrap rounded-xl bg-cream p-3 text-xs text-ink-soft">
          {data.code}
        </pre>
      ) : svg ? (
        // eslint-disable-next-line react/no-danger — SVG comes from
        // mermaid, which sanitizes its own output.
        <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
          Preparing diagram…
        </div>
      )}
    </div>
  )
}
