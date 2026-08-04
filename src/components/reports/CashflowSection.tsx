'use client'

import { useState, useEffect, useCallback } from 'react'

interface CashflowTxn {
  id: string
  date: string
  assetClass: string
  name: string
  amount: number
  direction: 'in' | 'out'
}

interface CashflowData {
  month: string
  monthLabel: string
  transactions: CashflowTxn[]
  monthlyGain: number | null
  availableMonths: Array<{ value: string; label: string }>
}

const ASSET_BADGE: Record<string, { bg: string; color: string }> = {
  'Stocks':        { bg: 'var(--color-surface-raised)',    color: 'var(--color-text-secondary)'   },
  'Mutual Funds':  { bg: '#F0FDF4',                        color: '#16A34A'                       },
  'EPF':           { bg: '#EEF2FF',                        color: '#4338CA'                       },
  'FD':            { bg: 'var(--color-treemap-gold-bg)',   color: 'var(--color-treemap-gold-text)' },
  'RD':            { bg: 'var(--color-treemap-debt-bg)',   color: 'var(--color-treemap-debt-text)' },
  'International': { bg: 'var(--color-treemap-intl-bg)',   color: 'var(--color-treemap-intl-text)' },
}

const FALLBACK_BADGE = { bg: '#F5F0FF', color: '#7C3AED' }

const SK: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

const GRID = '0.6fr 2fr 1fr 1fr'

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function badgeFor(assetClass: string) {
  return ASSET_BADGE[assetClass] ?? FALLBACK_BADGE
}

interface Props {
  initialMonth?: string
}

export default function CashflowSection({ initialMonth }: Props) {
  const [data,          setData]          = useState<CashflowData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? '')

  const fetchData = useCallback(async (month?: string) => {
    setLoading(true)
    try {
      const url = month ? `/api/reports/cashflow?month=${month}` : '/api/reports/cashflow'
      const res = await fetch(url)
      if (res.ok) {
        const d = await res.json() as CashflowData
        setData(d)
        if (!month) setSelectedMonth(d.month)
      }
    } catch (err) {
      console.error('Failed to load cashflow data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth)
      fetchData(initialMonth)
    } else {
      fetchData()
    }
  }, [fetchData, initialMonth])

  function handleMonthChange(month: string) {
    setSelectedMonth(month)
    fetchData(month)
  }

  // Initial skeleton — only before first load
  if (loading && !data) {
    return (
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ ...SK, height: 14, width: 55 }} />
          <div style={{ ...SK, height: 30, width: 145, borderRadius: '7px' }} />
          <div style={{ marginLeft: 'auto', ...SK, height: 14, width: 90 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ ...SK, height: 12, width: '55%' }} />)}
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', padding: '13px 22px', borderBottom: '0.5px solid var(--color-border-subtle)', alignItems: 'center' }}>
            <div style={{ ...SK, height: 12, width: '75%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ ...SK, height: 13, width: '80%' }} />
            </div>
            <div style={{ ...SK, height: 18, width: 72, borderRadius: '12px' }} />
            <div style={{ ...SK, height: 13, width: '65%', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    )
  }

  const txns   = data?.transactions ?? []
  const months = data?.availableMonths ?? []

  const CANONICAL = ['Stocks', 'Mutual Funds', 'EPF', 'FD', 'RD', 'International']

  // Group by assetClass
  const grouped = txns.reduce<Record<string, CashflowTxn[]>>((acc, txn) => {
    if (!acc[txn.assetClass]) acc[txn.assetClass] = []
    acc[txn.assetClass].push(txn)
    return acc
  }, {})

  // Order: canonical first, then custom classes alphabetically
  const allClasses = Object.keys(grouped)
  const assetClasses = [
    ...CANONICAL.filter(c => grouped[c]),
    ...allClasses.filter(c => !CANONICAL.includes(c)).sort(),
  ]

  return (
    <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden', opacity: loading ? 0.7 : 1, transition: 'opacity 150ms ease' }}>

      {/* Filter bar */}
      <div style={{ padding: '14px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Showing</span>
        <select
          value={selectedMonth}
          onChange={e => handleMonthChange(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: '7px',
            border: '0.5px solid var(--color-border)',
            background: 'var(--color-surface-raised)',
            fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
            color: 'var(--color-text-primary)', cursor: 'pointer', outline: 'none',
          }}
        >
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {txns.length} transaction{txns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty state */}
      {txns.length === 0 ? (
        <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            No transactions this month
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', maxWidth: '300px', textAlign: 'center', lineHeight: 1.6 }}>
            Transactions will appear here as you add data to your portfolio
          </div>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
            {(['Date', 'Transaction', 'Asset Class', 'Amount'] as const).map((h, i) => (
              <div key={h} style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: i === 3 ? 'right' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows grouped by asset class */}
          {assetClasses.map(cls => {
            const rows = grouped[cls]
            const bs = badgeFor(cls)
            return rows.map((txn, i) => {
              const isLast = i === rows.length - 1
              const isIn = txn.direction === 'in'
              return (
                <div
                  key={txn.id}
                  style={{
                    display: 'grid', gridTemplateColumns: GRID, gap: '8px',
                    padding: '13px 22px', alignItems: 'center',
                    borderBottom: '0.5px solid var(--color-border-subtle)',
                    ...(isLast ? { borderBottomColor: 'var(--color-border)' } : {}),
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {formatDate(txn.date)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {txn.name}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: bs.bg, color: bs.color, whiteSpace: 'nowrap' }}>
                      {cls}
                    </span>
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: isIn ? 'var(--color-gain)' : 'var(--color-loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {isIn ? '+' : '-'}{formatINR(txn.amount)}
                  </div>
                </div>
              )
            })
          })}

          {/* Monthly gain summary */}
          {data?.monthlyGain != null && (
            <div style={{ padding: '14px 22px', borderTop: '0.5px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: data.monthlyGain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                {data.monthlyGain >= 0
                  ? `Portfolio gain this month: +${formatINR(data.monthlyGain)}`
                  : `Portfolio loss this month: -${formatINR(Math.abs(data.monthlyGain))}`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
