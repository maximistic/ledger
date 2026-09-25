'use client'

import { useState } from 'react'
import type { DashboardSummary } from './types'
import { card, SK, formatShort } from './shared'

interface Props {
  summary: DashboardSummary | null
  loading: boolean
}

export default function AllocationCard({ summary, loading }: Props) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)

  const pieSegments = summary ? (() => {
    const { breakdown: b } = summary
    const totalNW = summary.totalNetWorth || 1

    const allCustom    = [...(b.customClasses ?? [])].sort((a, c) => c.value - a.value)
    const topCustom    = allCustom.slice(0, 3)
    const otherCustomV = allCustom.slice(3).reduce((s, c) => s + c.value, 0)

    const segs = [
      { label: 'Stocks',        val: b.stocks.value,          color: 'var(--color-asset-stocks)' },
      { label: 'Mutual Funds',  val: b.mf.value,              color: 'var(--color-asset-mf)'     },
      { label: 'EPF',           val: b.epf.value,             color: 'var(--color-asset-epf)'    },
      { label: 'FDs & RDs',     val: b.fd.value + b.rd.value, color: 'var(--color-asset-fdrd)'   },
      { label: 'International', val: b.usStocks.value,        color: 'var(--color-asset-us)'     },
      ...topCustom.map((c, i) => ({ label: c.name, val: c.value, color: `var(--color-asset-custom-${i + 1})` })),
      ...(otherCustomV > 0 ? [{ label: 'Other', val: otherCustomV, color: 'var(--color-asset-other)' }] : []),
    ].filter(s => s.val > 0)

    const cx = 80, cy = 80, r = 70
    let angle = -Math.PI / 2
    return segs.map(s => {
      const pct   = (s.val / totalNW) * 100
      const sweep = (pct / 100) * 2 * Math.PI
      const sx    = cx + r * Math.cos(angle)
      const sy    = cy + r * Math.sin(angle)
      angle += sweep
      const ex      = cx + r * Math.cos(angle)
      const ey      = cy + r * Math.sin(angle)
      const largeArc = sweep > Math.PI ? 1 : 0
      const path    = `M ${cx},${cy} L ${sx.toFixed(2)},${sy.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)} Z`
      return { ...s, pct, pctStr: `${Math.round(pct)}%`, valStr: formatShort(s.val), path, show: pct > 0.5 }
    })
  })() : null

  return (
    <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '120ms' }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '14px' }}>
        Asset Allocation
      </div>
      {loading || !pieSegments ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ ...SK, width: 160, height: 160, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...SK, height: 13, width: '80%' }} />)}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <svg className="pie-chart-svg" width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
            {pieSegments.filter(s => s.show).map(s => (
              <path
                key={s.label}
                d={s.path}
                onMouseEnter={() => setHoveredSegment(s.label)}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{
                  fill:            s.color,
                  opacity:         hoveredSegment && hoveredSegment !== s.label ? 0.3 : 1,
                  transform:       hoveredSegment === s.label ? 'scale(1.08)' : 'scale(1)',
                  transformOrigin: '80px 80px',
                  transition:      'opacity 160ms ease, transform 160ms ease',
                  cursor:          'pointer',
                }}
              />
            ))}
          </svg>
          <div className="pie-chart-legend" style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: 0 }}>
            {pieSegments.map(s => (
              <div
                key={s.label}
                onMouseEnter={() => setHoveredSegment(s.label)}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  background: hoveredSegment === s.label ? 'var(--color-surface-raised)' : 'transparent',
                  opacity:    hoveredSegment && hoveredSegment !== s.label ? 0.5 : 1,
                  borderRadius: 6, padding: '3px 6px', margin: '-3px -6px',
                  transition: 'all 160ms ease', cursor: 'pointer',
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', color: '#555', flex: 1, minWidth: 0 }}>{s.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>{s.pctStr}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '52px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.valStr}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
