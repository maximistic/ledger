'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'
import type { SnapshotData, TabKey } from './types'
import { card, SK, formatINR, getChartLabel } from './shared'

interface Props {
  snapshots:       SnapshotData | null
  activeTab:       TabKey
  takingSnapshot:  boolean
  onTabChange:     (t: TabKey) => void
  onSnapshot:      () => void
}

export default function NetWorthTrendCard({ snapshots, activeTab, takingSnapshot, onTabChange, onSnapshot }: Props) {
  const [hoveredPoint,  setHoveredPoint]  = useState<{ x: number; y: number; value: number; investedValue: number; date: Date; pct: number } | null>(null)
  const [showInvested,  setShowInvested]  = useState(true)

  const chartData = snapshots?.chartData ?? []
  const hasChart  = chartData.length > 0

  let pathD         = ''
  let fillD         = ''
  let investedPathD = ''
  let lastPt        = { x: 900, y: 5 }
  let monthLabels:   { label: string; x: number }[] = []
  let chartTimes:    number[] = []
  let chartMinTime  = 0
  let chartTimeRange = 1

  if (hasChart) {
    const times     = chartData.map(s => new Date(s.date + 'T00:00:00').getTime())
    const minTime   = times[0]
    const maxTime   = times[times.length - 1]
    const timeRange = maxTime - minTime || 1
    chartTimes     = times
    chartMinTime   = minTime
    chartTimeRange = timeRange

    const allValues = [...chartData.map(s => s.totalNetWorth), ...chartData.map(s => s.investedValue)]
    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const range  = maxVal - minVal || 1

    const xOf = (i: number) => chartData.length === 1 ? 450 : ((times[i] - minTime) / timeRange) * 900
    const yOf = (v: number) => 150 - ((v - minVal) / range) * 130

    const pts  = chartData.map((s, i) => ({ x: xOf(i), y: yOf(s.totalNetWorth) }))
    const ipts = chartData.map((s, i) => ({ x: xOf(i), y: yOf(s.investedValue)  }))

    const buildPath = (points: { x: number; y: number }[]) =>
      points.reduce((d, pt, i) => {
        if (i === 0) return `M${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
        const prev = points[i - 1]
        const cpx  = ((prev.x + pt.x) / 2).toFixed(1)
        return d + ` C${cpx},${prev.y.toFixed(1)} ${cpx},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
      }, '')

    pathD         = buildPath(pts)
    investedPathD = buildPath(ipts)
    const firstPt = pts[0]
    lastPt        = pts[pts.length - 1]
    fillD         = pathD + ` L${lastPt.x.toFixed(1)},160 L${firstPt.x.toFixed(1)},160 Z`

    const intervalDays: Record<TabKey, number> = { '1M': 3, '6M': 21, '1Y': 60, '5Y': 365 }
    const intervalMs = intervalDays[activeTab] * 24 * 60 * 60 * 1000
    let t = minTime
    while (t <= maxTime) {
      const x = timeRange === 0 ? 450 : ((t - minTime) / timeRange) * 900
      monthLabels.push({ label: getChartLabel(new Date(t), activeTab), x })
      t += intervalMs
    }
    const lastX     = ((maxTime - minTime) / timeRange) * 900
    const lastLabel = getChartLabel(new Date(maxTime), activeTab)
    if (monthLabels.length === 0 || lastX - monthLabels[monthLabels.length - 1].x > 90) {
      monthLabels.push({ label: lastLabel, x: lastX })
    }
  }

  return (
    <div className="dashboard-card" style={{ ...card, padding: '20px 24px', marginBottom: '14px', animationDelay: '60ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '3px' }}>
            Net Worth Trend
          </div>
          <div style={{ fontSize: '13px' }}>
            {hasChart && snapshots ? (
              <>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {formatINR(snapshots.chartData[snapshots.chartData.length - 1].totalNetWorth)}
                </strong>
                <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                <span style={{ color: snapshots.changePct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                  {snapshots.changePct >= 0 ? '+' : ''}{snapshots.changePct.toFixed(1)}% since first snapshot
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>Take a snapshot to start tracking</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={() => setShowInvested(prev => !prev)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', padding: '3px 8px', borderRadius: '20px',
              border: '0.5px solid var(--color-border)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer', userSelect: 'none',
              opacity: showInvested ? 1 : 0.45,
            }}
          >
            <span style={{ display: 'inline-block', width: '14px', height: '0px', borderTop: '1.5px dashed var(--color-text-muted)' }} />
            Invested{' '}
            <span style={{ color: 'var(--color-text-muted)' }}>{showInvested ? '· on' : '· off'}</span>
          </div>
          <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '6px', padding: '3px' }}>
            {(['1M', '6M', '1Y', '5Y'] as TabKey[]).map(t => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                style={{
                  padding: '4px 11px', borderRadius: '4px', fontSize: '11.5px',
                  fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                  color:      activeTab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  background: activeTab === t ? 'var(--color-surface)'      : 'transparent',
                  boxShadow:  activeTab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'background 160ms ease, color 160ms ease, box-shadow 160ms ease',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasChart ? (
        <div style={{ height: '130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Camera size={32} color="var(--color-text-muted)" />
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>No snapshot history yet</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '280px', textAlign: 'center' }}>
            Take your first snapshot to start tracking your net worth over time
          </div>
          <button
            onClick={onSnapshot}
            disabled={takingSnapshot}
            style={{ marginTop: '4px', padding: '5px 14px', borderRadius: '6px', border: '0.5px solid var(--btn-ghost-border)', background: 'transparent', color: 'var(--btn-ghost-text)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {takingSnapshot ? 'Saving…' : 'Take snapshot'}
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {hoveredPoint && (
            <div style={{
              position: 'absolute', top: 8,
              left: `${(hoveredPoint.x / 900) * 100}%`,
              transform: hoveredPoint.pct < 0.2
                ? 'translateX(8px)'
                : hoveredPoint.pct > 0.8
                  ? 'translateX(calc(-100% - 8px))'
                  : 'translateX(-50%)',
              background: 'var(--color-text-primary)',
              color: 'var(--color-surface)',
              borderRadius: 7, padding: '6px 11px',
              fontSize: 12, pointerEvents: 'none', zIndex: 10,
              fontFamily: 'DM Sans,sans-serif',
              transition: 'left 60ms ease',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{formatINR(hoveredPoint.value)}</div>
              {showInvested && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Invested {formatINR(hoveredPoint.investedValue)}
                </div>
              )}
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>
                {hoveredPoint.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
              </div>
            </div>
          )}
          <svg viewBox="0 0 900 160" preserveAspectRatio="none" style={{ width: '100%', height: '160px', display: 'block' }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--chart-line)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={fillD} fill="var(--chart-line)" fillOpacity={0.06} stroke="none" />
            {showInvested && <path d={investedPathD} fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.5} />}
            <path d={pathD} fill="none" stroke="var(--chart-line)" strokeWidth={1.5} strokeLinecap="round" />
            <circle cx={lastPt.x} cy={lastPt.y} r={3.5} fill="var(--chart-line)" />
            <circle cx={lastPt.x} cy={lastPt.y} r={7}   fill="var(--chart-line)" fillOpacity={0.1} />
            {hoveredPoint && (
              <>
                <line x1={hoveredPoint.x} y1={0} x2={hoveredPoint.x} y2={160} stroke="var(--color-text-muted)" strokeDasharray="3 3" strokeWidth={1} />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={4} fill="var(--color-text-primary)" />
              </>
            )}
            <rect x="0" y="0" width="900" height="160" fill="transparent"
              onMouseMove={(e) => {
                const svg = e.currentTarget.closest('svg')
                if (!svg || !snapshots?.chartData?.length) return
                const rect     = svg.getBoundingClientRect()
                const pct      = (e.clientX - rect.left) / rect.width
                const data     = snapshots.chartData
                const cursorTime = chartMinTime + pct * chartTimeRange
                const idx      = chartTimes.reduce((best, t, i) =>
                  Math.abs(t - cursorTime) < Math.abs(chartTimes[best] - cursorTime) ? i : best, 0)
                const snap = data[idx]
                if (!snap) return
                const allVals = [...data.map(s => s.totalNetWorth), ...data.map(s => s.investedValue)]
                const min  = Math.min(...allVals)
                const max  = Math.max(...allVals)
                const rng  = max - min || 1
                const xPos = data.length === 1 ? 450 : ((chartTimes[idx] - chartMinTime) / chartTimeRange) * 900
                setHoveredPoint({
                  x: xPos,
                  y: 150 - ((snap.totalNetWorth - min) / rng) * 130,
                  value:         snap.totalNetWorth,
                  investedValue: snap.investedValue,
                  date:          new Date(snap.date + 'T00:00:00'),
                  pct,
                })
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          </svg>
          <div style={{ position: 'relative', height: '16px', marginTop: '6px' }}>
            {monthLabels.map((m, i) => (
              <span key={i} style={{ position: 'absolute', left: `${(m.x / 900) * 100}%`, transform: 'translateX(-50%)', fontSize: '10px', color: '#C8C4B8', whiteSpace: 'nowrap' }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
