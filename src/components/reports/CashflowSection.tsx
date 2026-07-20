'use client'

import { useState, useEffect, useCallback } from 'react'

type BadgeKey = 'STOCK' | 'SIP' | 'LUMPSUM' | 'EPF' | 'RD' | 'FD' | 'INTL' | 'CUSTOM'

interface CashflowTxn {
  date: string
  name: string
  subtitle: string
  type: string
  badge: string
  amount: number
}

interface Summary {
  total: number
  stocks: number
  mf: number
  epf: number
  rd: number
  fd: number
  us: number
  custom?: number
}

interface CashflowData {
  month: string
  monthLabel: string
  transactions: CashflowTxn[]
  summary: Summary
  availableMonths: Array<{ value: string; label: string }>
}

const BADGE: Record<BadgeKey, { bg: string; color: string }> = {
  STOCK:   { bg: '#F0F0EE', color: '#555555' },
  SIP:     { bg: '#F0FDF4', color: '#16A34A' },
  LUMPSUM: { bg: '#EFF6FF', color: '#2563EB' },
  EPF:     { bg: '#EEF2FF', color: '#4338CA' },
  RD:      { bg: '#FEF3C7', color: '#92400E' },
  FD:      { bg: '#FFFBEB', color: '#B45309' },
  INTL:    { bg: '#F5F3FF', color: '#7C3AED' },
  CUSTOM:  { bg: '#F5F0FF', color: '#7C3AED' },
}

const SK: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

const GRID = '0.6fr 2fr 1fr 1fr'

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatShort(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function CashflowSection() {
  const [data,          setData]          = useState<CashflowData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')

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

  useEffect(() => { fetchData() }, [fetchData])

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
              <div style={{ ...SK, height: 11, width: '60%' }} />
            </div>
            <div style={{ ...SK, height: 18, width: 52, borderRadius: '12px' }} />
            <div style={{ ...SK, height: 13, width: '65%', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    )
  }

  const txns    = data?.transactions ?? []
  const summary = data?.summary
  const months  = data?.availableMonths ?? []

  // Summary strip: Total always first, then asset classes with amount > 0
  const strip: Array<{ label: string; value: number; count: number }> = []
  if (summary) {
    strip.push({ label: 'TOTAL', value: summary.total, count: txns.length })
    if (summary.stocks         > 0) strip.push({ label: 'STOCKS', value: summary.stocks,         count: txns.filter(t => t.badge === 'STOCK').length })
    if (summary.mf             > 0) strip.push({ label: 'MF',     value: summary.mf,             count: txns.filter(t => t.badge === 'SIP' || t.badge === 'LUMPSUM').length })
    if (summary.epf            > 0) strip.push({ label: 'EPF',    value: summary.epf,            count: txns.filter(t => t.badge === 'EPF').length })
    if (summary.fd             > 0) strip.push({ label: 'FD',     value: summary.fd,             count: txns.filter(t => t.badge === 'FD').length })
    if (summary.rd             > 0) strip.push({ label: 'RD',     value: summary.rd,             count: txns.filter(t => t.badge === 'RD').length })
    if (summary.us             > 0) strip.push({ label: 'INTL',   value: summary.us,             count: txns.filter(t => t.badge === 'INTL').length })
    if ((summary.custom ?? 0)  > 0) strip.push({ label: 'CUSTOM', value: summary.custom ?? 0,    count: txns.filter(t => t.badge === 'CUSTOM').length })
  }

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

      {/* Summary strip */}
      {strip.length > 0 && txns.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${strip.length}, 1fr)`, borderBottom: '0.5px solid var(--color-border)' }}>
          {strip.map((item, i) => (
            <div key={item.label} style={{ padding: '14px 16px', borderRight: i < strip.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: '2px' }}>
                {formatShort(item.value)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {item.count} {item.count === 1 ? 'entry' : 'entries'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {txns.length === 0 ? (
        <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            No investments in {data?.monthLabel}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', maxWidth: '300px', textAlign: 'center', lineHeight: 1.6 }}>
            Transactions will appear here as you add data to your portfolio
          </div>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
            {(['Date', 'Transaction', 'Type', 'Amount'] as const).map((h, i) => (
              <div key={h} style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: i === 3 ? 'right' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {txns.map((txn, i) => {
            const bs = BADGE[txn.badge as BadgeKey] ?? { bg: '#F0F0EE', color: '#555' }
            return (
              <div
                key={`${txn.date}-${txn.badge}-${i}`}
                style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', padding: '13px 22px', alignItems: 'center', borderBottom: i < txns.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none' }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {formatDate(txn.date)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {txn.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {txn.subtitle}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: bs.bg, color: bs.color, whiteSpace: 'nowrap' }}>
                    {txn.badge}
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(txn.amount)}
                </div>
              </div>
            )
          })}

          {/* Footer */}
          <div style={{ padding: '14px 22px', borderTop: '0.5px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {data?.monthLabel} · {txns.length} transaction{txns.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {formatINR(summary?.total ?? 0)} invested
            </span>
          </div>
        </>
      )}
    </div>
  )
}
