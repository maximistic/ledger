'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, Trash2 } from 'lucide-react'

interface SnapshotRecord {
  id:            string
  date:          string
  totalNetWorth: number
  investedValue: number
  source:        string
  createdAt:     string
}

const SK: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

const GRID = '1.5fr 1fr 1fr 1fr 80px'

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function Sparkline({ snapshots }: { snapshots: SnapshotRecord[] }) {
  // API returns descending; reverse to get oldest→newest left→right
  const data = [...snapshots].reverse()
  if (data.length < 2) return null

  const values = data.map(s => s.totalNetWorth)
  const min    = Math.min(...values)
  const max    = Math.max(...values)
  const range  = max - min || 1

  const W = 800
  const H = 60
  const PY = 5  // vertical padding inside viewBox

  const pts: [number, number][] = data.map((s, i) => [
    (i / (data.length - 1)) * W,
    H - PY - ((s.totalNetWorth - min) / range) * (H - PY * 2),
  ])

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fillPath = `${linePath} L${W},${H} L0,${H} Z`

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '60px', display: 'block' }}
      >
        <defs>
          <linearGradient id="snapshotSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#111111" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#111111" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#snapshotSparkGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

interface Props {
  onLoaded?: (sub: string) => void
}

export default function SnapshotsSection({ onLoaded }: Props) {
  const [snapshots,      setSnapshots]      = useState<SnapshotRecord[]>([])
  const [loading,        setLoading]        = useState(true)
  const [takingSnapshot, setTakingSnapshot] = useState(false)
  const [deleteId,       setDeleteId]       = useState<string | null>(null)
  const [deleting,       setDeleting]       = useState(false)

  const onLoadedRef = useRef(onLoaded)
  useEffect(() => { onLoadedRef.current = onLoaded })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/snapshot/list')
      if (res.ok) {
        const d = await res.json() as { snapshots: SnapshotRecord[]; count: number }
        setSnapshots(d.snapshots)
        onLoadedRef.current?.(`${d.count} recorded`)
      }
    } catch (err) {
      console.error('Failed to load snapshots', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleTakeSnapshot() {
    setTakingSnapshot(true)
    try {
      const res = await fetch('/api/dashboard/snapshot', { method: 'POST' })
      if (res.ok) await fetchData()
    } finally {
      setTakingSnapshot(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await fetch(`/api/dashboard/snapshot/${id}`, { method: 'DELETE' })
      setDeleteId(null)
      await fetchData()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Card header */}
      <div style={{ padding: '16px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Net worth history</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Snapshots are taken automatically every week and when you click the button
          </div>
        </div>
        <button
          onClick={handleTakeSnapshot}
          disabled={takingSnapshot}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: takingSnapshot ? 'default' : 'pointer', opacity: takingSnapshot ? 0.7 : 1, flexShrink: 0 }}
        >
          <Camera size={13} />
          {takingSnapshot ? 'Saving…' : 'Take snapshot'}
        </button>
      </div>

      {loading ? (
        /* Skeleton */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ ...SK, height: 12, width: '60%' }} />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 22px', borderBottom: '0.5px solid var(--color-border-subtle)', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ ...SK, height: 13, width: '70%' }} />
                <div style={{ ...SK, height: 11, width: '40%' }} />
              </div>
              <div style={{ ...SK, height: 13, width: '80%' }} />
              <div style={{ ...SK, height: 13, width: '75%' }} />
              <div style={{ ...SK, height: 18, width: '50px', borderRadius: '3px' }} />
              <div style={{ ...SK, height: 20, width: 20, borderRadius: '4px', marginLeft: 'auto' }} />
            </div>
          ))}
        </>
      ) : snapshots.length === 0 ? (
        /* Empty state */
        <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Camera size={32} color="var(--color-text-muted)" />
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px' }}>No snapshots yet</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '300px', textAlign: 'center', lineHeight: 1.5 }}>
            Take your first snapshot to start tracking your net worth over time
          </div>
          <button
            onClick={handleTakeSnapshot}
            disabled={takingSnapshot}
            style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontFamily: 'inherit', cursor: takingSnapshot ? 'default' : 'pointer', opacity: takingSnapshot ? 0.7 : 1 }}
          >
            <Camera size={13} />
            {takingSnapshot ? 'Saving…' : 'Take snapshot'}
          </button>
        </div>
      ) : (
        <>
          {/* Sparkline */}
          <Sparkline snapshots={snapshots} />

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
            {(['Date', 'Net Worth', 'Invested', 'Source', ''] as const).map((h, i) => (
              <div key={h || `col-${i}`} style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: i >= 4 ? 'right' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {snapshots.map((sn, i) => {
            const dateLabel = new Date(sn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            const timeLabel = new Date(sn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            const isLast    = i === snapshots.length - 1
            const isDeleting = deleteId === sn.id

            return (
              <div
                key={sn.id}
                style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 22px', alignItems: 'center', borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)', transition: 'background 120ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-raised)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {/* Date */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{dateLabel}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{timeLabel}</div>
                </div>

                {/* Net Worth */}
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(sn.totalNetWorth)}
                </div>

                {/* Invested */}
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(sn.investedValue)}
                </div>

                {/* Source badge */}
                <div>
                  <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '3px', fontWeight: 600, background: sn.source === 'AUTO' ? '#F0F4FF' : '#F7F6F2', color: sn.source === 'AUTO' ? '#4338CA' : '#7A7670' }}>
                    {sn.source === 'AUTO' ? 'Auto' : 'Manual'}
                  </span>
                </div>

                {/* Delete action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {isDeleting ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '11.5px', color: '#DC2626', whiteSpace: 'nowrap' }}>Delete?</span>
                      <button
                        onClick={() => setDeleteId(null)}
                        style={{ padding: '3px 7px', borderRadius: '4px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(sn.id)}
                        disabled={deleting}
                        style={{ padding: '3px 7px', borderRadius: '4px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '11px', fontFamily: 'inherit', cursor: deleting ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {deleting ? '…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(sn.id)}
                      style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', lineHeight: 0, transition: 'color 120ms ease, background 120ms ease' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FFF5F5' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
