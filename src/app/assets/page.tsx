'use client'

import { useState } from 'react'
import { Upload, Plus } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'stocks' | 'mf' | 'fd' | 'epf' | 'us'

// ─── Dummy data ───────────────────────────────────────────────────────────────

const assetClasses: { value: Tab; label: string; countLabel: string; invested: number }[] = [
  { value: 'stocks', label: 'Stocks',       countLabel: '5 holdings',  invested: 85290  },
  { value: 'mf',     label: 'Mutual Funds', countLabel: '3 schemes',   invested: 150000 },
  { value: 'fd',     label: 'FDs & RDs',    countLabel: '2 accounts',  invested: 200000 },
  { value: 'epf',    label: 'EPF',          countLabel: '1 account',   invested: 320000 },
  { value: 'us',     label: 'US Stocks',    countLabel: '4 holdings',  invested: 85000  },
]

const tabInfo: Record<Tab, {
  label: string; addLabel: string
  currentValue: number; invested: number; gain: number; gainPct: number
}> = {
  stocks: { label: 'Stocks',       addLabel: 'Add Stock',   currentValue: 88870,  invested: 85290,  gain: 3580,  gainPct: 4.2   },
  mf:     { label: 'Mutual Funds', addLabel: 'Add Fund',    currentValue: 165000, invested: 150000, gain: 15000, gainPct: 10.0  },
  fd:     { label: 'FDs & RDs',    addLabel: 'Add FD',      currentValue: 212000, invested: 200000, gain: 12000, gainPct: 6.0   },
  epf:    { label: 'EPF',          addLabel: 'Update EPF',  currentValue: 356000, invested: 320000, gain: 36000, gainPct: 11.25 },
  us:     { label: 'US Stocks',    addLabel: 'Add Stock',   currentValue: 92000,  invested: 85000,  gain: 7000,  gainPct: 8.2   },
}

interface StockHolding {
  ticker: string; name: string; exchange: string
  qty: number; avgPrice: number; currentPrice: number
}

const stocksData: StockHolding[] = [
  { ticker: 'RELIANCE', name: 'Reliance Industries',      exchange: 'NSE', qty: 10,  avgPrice: 2450.00, currentPrice: 2687.50 },
  { ticker: 'TCS',      name: 'Tata Consultancy Services', exchange: 'NSE', qty: 5,   avgPrice: 3200.00, currentPrice: 3567.80 },
  { ticker: 'GOLDBEES', name: 'Nippon India ETF Gold BeES',exchange: 'NSE', qty: 150, avgPrice: 54.20,   currentPrice: 58.45   },
  { ticker: 'INFY',     name: 'Infosys Ltd',              exchange: 'NSE', qty: 15,  avgPrice: 1580.00, currentPrice: 1423.60 },
  { ticker: 'HDFCBANK', name: 'HDFC Bank Ltd',            exchange: 'NSE', qty: 8,   avgPrice: 1620.00, currentPrice: 1754.30 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`
  if (abs >= 1000)   return `₹${(abs / 1000).toFixed(1)}K`
  return `₹${Math.round(abs)}`
}

function fmtShortSigned(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${fmtShort(Math.abs(value))}`
}

function fmtPctSigned(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(1)}%`
}

function fmtPrice(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPnlAmount(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Stocks table ─────────────────────────────────────────────────────────────

const gridCols = '2.2fr 0.6fr 1fr 1fr 1fr'

const headerCell: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontWeight: 500,
}

function StocksTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        minWidth: '520px',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: '8px',
          background: 'var(--color-bg)',
          borderBottom: '0.5px solid var(--color-border)',
          padding: '10px 20px',
        }}>
          <div style={headerCell}>Name</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Qty</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Avg Price</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Current</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>P&amp;L</div>
        </div>

        {/* Rows */}
        {stocksData.map((stock, i) => {
          const invested = stock.qty * stock.avgPrice
          const current  = stock.qty * stock.currentPrice
          const gain     = current - invested
          const gainPct  = (gain / invested) * 100
          const isLast   = i === stocksData.length - 1
          const gainColor = gain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'

          return (
            <div
              key={stock.ticker}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: '8px',
                padding: '12px 20px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
                alignItems: 'center',
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  maxWidth: '38px',
                  flexShrink: 0,
                  borderRadius: '7px',
                  background: 'var(--color-surface-raised)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0 4px',
                }}>
                  {stock.ticker}
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {stock.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {stock.ticker} · {stock.exchange}
                  </div>
                </div>
              </div>

              {/* Qty */}
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {stock.qty}
              </div>

              {/* Avg Price */}
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmtPrice(stock.avgPrice)}
              </div>

              {/* Current */}
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmtPrice(stock.currentPrice)}
              </div>

              {/* P&L */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: gainColor, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPnlAmount(gain)}
                </div>
                <div style={{ fontSize: '10.5px', color: gainColor, marginTop: '1px' }}>
                  {fmtPctSigned(gainPct)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stocks')
  const info = tabInfo[activeTab]
  const gainColor = info.gain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'

  return (
    <div style={{ display: 'flex', gap: '16px' }}>

      {/* ── Left rail ─────────────────────────────────────────────────────── */}
      <div style={{ width: '170px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {assetClasses.map(ac => {
          const active = activeTab === ac.value
          return (
            <div
              key={ac.value}
              onClick={() => setActiveTab(ac.value)}
              style={{
                background: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRight: active ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                borderRadius: '10px',
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <div style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}>
                {ac.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {ac.countLabel}
              </div>
              <div style={{
                fontSize: '15px',
                fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                marginTop: '6px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtShort(ac.invested)}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Right content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--color-text-muted)',
              marginBottom: '4px',
            }}>
              {info.label}
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.3px',
              lineHeight: 1.1,
            }}>
              {fmtShort(info.currentValue)}
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Invested </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{fmtShort(info.invested)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: gainColor }}>{fmtShortSigned(info.gain)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: gainColor }}>{fmtPctSigned(info.gainPct)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '0.5px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: '12.5px',
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
            }}>
              <Upload size={14} /> Import
            </button>
            <button style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--color-text-primary)',
              color: 'var(--color-surface)',
              fontSize: '12.5px',
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
            }}>
              <Plus size={14} /> {info.addLabel}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'stocks' ? (
          <StocksTable />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: 'var(--color-text-muted)',
            fontSize: '14px',
          }}>
            {info.label} — coming soon
          </div>
        )}
      </div>
    </div>
  )
}
