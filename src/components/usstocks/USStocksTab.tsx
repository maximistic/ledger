'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Upload, Plus, TrendingUp } from 'lucide-react'
import { formatINR, formatINRSigned, formatPctSigned, formatShort, formatShortSigned } from '@/lib/utils'
import USStockDetailDialog from './USStockDetailDialog'
import AddEditUSStockDialog from './AddEditUSStockDialog'
import ImportUSStocksDialog from './ImportUSStocksDialog'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface USStock {
  id: string
  name: string
  ticker: string
  exchange: string
  quantity: number
  avgPriceUSD: number
  currentPriceUSD: number
  exchangeRate: number
  investedValueINR: number
  currentValueINR: number
  holdingsQuantity: number
  lastPriceUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  gainLossUSD: number
  gainLossINR: number
  gainLossPct: number
}

export function formatUSD(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Shared styles exported for child dialogs ──────────────────────────────────

export const ghostBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

export const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: 'none',
  background: 'var(--color-text-primary)',
  color: 'var(--color-surface)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

export const labelStyle: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  borderRadius: '7px',
  padding: '8px 11px',
  fontSize: '13.5px',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
}

export const USD_BADGE: React.CSSProperties = {
  fontSize: '9px', fontWeight: 600,
  background: '#EFF6FF', color: '#2563EB',
  border: '0.5px solid #BFDBFE',
  borderRadius: '3px', padding: '1px 5px',
  flexShrink: 0, lineHeight: '14px',
}

// ── Table ─────────────────────────────────────────────────────────────────────

const GRID = '2.2fr 0.6fr 1fr 1fr 0.9fr 0.9fr 1fr'

const hCell: React.CSSProperties = {
  fontSize: '10.5px', color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500,
}

function SkeletonTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', minWidth: '900px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
          {['Name', 'Qty', 'Avg (USD)', 'Current (USD)', 'Invested (INR)', 'Current (INR)', 'P&L'].map(h => (
            <div key={h} style={hCell}>{h}</div>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', padding: '14px 20px', borderBottom: i < 3 ? '0.5px solid var(--color-border-subtle)' : 'none', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 7, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
              <div>
                <div style={{ height: 13, width: 110, borderRadius: 4, background: 'var(--color-bg)', marginBottom: 5, animation: 'pulse 1.4s ease infinite' }} />
                <div style={{ height: 11, width: 70, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
              </div>
            </div>
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} style={{ height: 13, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
            ))}
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
      <TrendingUp size={36} color="var(--color-text-muted)" strokeWidth={1.5} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No international stocks yet</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Add or import from INDmoney
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={onImport} style={ghostBtnStyle}>Import</button>
        <button onClick={onAdd} style={primaryBtnStyle}>Add stock</button>
      </div>
    </div>
  )
}

function StocksTable({ stocks, onRowClick }: { stocks: USStock[]; onRowClick: (s: USStock) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', minWidth: '900px' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
          <div style={hCell}>Name</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Qty</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Avg (USD)</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Current (USD)</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Invested (INR)</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Current (INR)</div>
          <div style={{ ...hCell, textAlign: 'right' }}>P&amp;L</div>
        </div>

        {stocks.map((stock, i) => {
          const isLast     = i === stocks.length - 1
          const isHovered  = hoveredId === stock.id
          const gainColor  = stock.gainLossINR >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
          const priceStale = stock.currentPriceUSD === 0

          return (
            <div
              key={stock.id}
              onMouseEnter={() => setHoveredId(stock.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onRowClick(stock)}
              style={{
                display: 'grid', gridTemplateColumns: GRID, gap: '8px',
                padding: '12px 20px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
                alignItems: 'center',
                cursor: 'pointer',
                background: isHovered ? 'var(--color-surface-raised)' : 'transparent',
                transition: 'background 120ms ease',
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', minWidth: '38px', maxWidth: '38px',
                  flexShrink: 0, borderRadius: '7px',
                  background: 'var(--color-surface-raised)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8.5px', fontWeight: 700, color: 'var(--color-text-secondary)',
                  overflow: 'hidden', padding: '0 4px',
                }}>
                  {stock.ticker}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {stock.name}
                    </div>
                    <div style={USD_BADGE}>USD</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {stock.ticker} · {stock.exchange}
                  </div>
                </div>
              </div>

              {/* Qty */}
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {stock.quantity}
              </div>

              {/* Avg USD */}
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatUSD(stock.avgPriceUSD)}
              </div>

              {/* Current USD */}
              <div style={{ textAlign: 'right' }}>
                {priceStale ? (
                  <>
                    <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 600 }}>—</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', marginTop: '1px' }}>Not updated</div>
                  </>
                ) : (
                  <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(stock.currentPriceUSD)}
                  </div>
                )}
              </div>

              {/* Invested INR */}
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(stock.investedValueINR)}
              </div>

              {/* Current INR */}
              <div style={{
                fontSize: '13px', fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                color: priceStale
                  ? 'var(--color-text-muted)'
                  : stock.currentValueINR > stock.investedValueINR
                    ? 'var(--color-gain)'
                    : stock.currentValueINR < stock.investedValueINR
                      ? 'var(--color-loss)'
                      : 'var(--color-text-primary)',
              }}>
                {priceStale ? '—' : formatINR(stock.currentValueINR)}
              </div>

              {/* P&L */}
              <div style={{ textAlign: 'right' }}>
                {priceStale ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</div>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: gainColor, fontVariantNumeric: 'tabular-nums' }}>
                      {formatINRSigned(stock.gainLossINR)}
                    </div>
                    <div style={{ fontSize: '10.5px', color: gainColor, marginTop: '1px' }}>
                      {formatPctSigned(stock.gainLossPct)}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onTotalsChange: (t: { count: number; currentValue: number }) => void
}

export default function USStocksTab({ onTotalsChange }: Props) {
  const [stocks, setStocks]   = useState<USStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [selectedStock, setSelectedStock] = useState<USStock | null>(null)
  const [editStock, setEditStock]         = useState<USStock | null>(null)
  const [showAdd, setShowAdd]             = useState(false)
  const [showImport, setShowImport]       = useState(false)

  const [refreshing, setRefreshing]       = useState(false)
  const [refreshStatus, setRefreshStatus] = useState('')
  const refreshTimer   = useRef<ReturnType<typeof setTimeout>>(undefined)
  const selectedRef    = useRef<USStock | null>(null)
  const onTotalsRef    = useRef(onTotalsChange)

  useEffect(() => { selectedRef.current = selectedStock }, [selectedStock])
  useEffect(() => { onTotalsRef.current = onTotalsChange })

  const fetchStocks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/us-stocks')
      const data = await res.json() as {
        stocks?: USStock[]
        totals?: { totalCurrentValueINR?: number; count?: number }
        error?: string
      }
      if (!res.ok) throw new Error(data.error)
      const fresh = data.stocks ?? []
      setStocks(fresh)
      onTotalsRef.current({
        count:        data.totals?.count        ?? fresh.length,
        currentValue: data.totals?.totalCurrentValueINR ?? 0,
      })
      if (selectedRef.current) {
        const updated = fresh.find(s => s.id === selectedRef.current!.id)
        if (updated) setSelectedStock(updated)
      }
    } catch {
      setError('Could not load international stocks. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStocks() }, [fetchStocks])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshStatus('')
    try {
      const res  = await fetch('/api/us-stocks/price/refresh', { method: 'POST' })
      const data = await res.json() as { updated?: number; exchangeRate?: number | null }
      const rateStr = data.exchangeRate ? ` · Rate: ₹${data.exchangeRate.toFixed(2)}/USD` : ''
      setRefreshStatus(`Updated ${data.updated ?? 0}${rateStr}`)
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => setRefreshStatus(''), 5000)
      await fetchStocks()
    } catch {
      setRefreshStatus('Price refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const totalCurrent  = stocks.reduce((s, x) => s + x.currentValueINR, 0)
  const totalInvested = stocks.reduce((s, x) => s + x.investedValueINR, 0)
  const totalGain     = totalCurrent - totalInvested
  const totalGainPct  = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0
  const gainColor     = totalGain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  const currentRate   = stocks.find(s => s.exchangeRate > 0)?.exchangeRate ?? 84

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            International
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {formatShort(totalCurrent)}
          </div>
          {!loading && stocks.length > 0 && (
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Invested </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{formatShort(totalInvested)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: gainColor }}>{formatShortSigned(totalGain)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: gainColor }}>{formatPctSigned(totalGainPct)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · Rate: ₹{currentRate.toFixed(2)}/USD</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ ...ghostBtnStyle, opacity: refreshing ? 0.7 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Updating…' : 'Refresh prices'}
            </button>
            <button onClick={() => setShowImport(true)} style={ghostBtnStyle}>
              <Upload size={13} /> Import
            </button>
            <button onClick={() => setShowAdd(true)} style={primaryBtnStyle}>
              <Plus size={13} /> Add stock
            </button>
          </div>
          {refreshStatus && (
            <div style={{ fontSize: '11.5px', color: 'var(--color-gain)' }}>{refreshStatus}</div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable />
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', fontSize: '13px', color: 'var(--color-loss)' }}>
          {error}
          <button onClick={fetchStocks} style={ghostBtnStyle}>Retry</button>
        </div>
      ) : stocks.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)} />
      ) : (
        <StocksTable stocks={stocks} onRowClick={s => setSelectedStock(s)} />
      )}

      {/* Dialogs */}
      {selectedStock && (
        <USStockDetailDialog
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onEdit={() => { setEditStock(selectedStock); setSelectedStock(null) }}
          onDelete={fetchStocks}
          onRefresh={fetchStocks}
        />
      )}

      {(showAdd || editStock) && (
        <AddEditUSStockDialog
          mode={showAdd ? 'add' : 'edit'}
          stock={editStock ?? undefined}
          onClose={() => { setShowAdd(false); setEditStock(null) }}
          onSuccess={() => { fetchStocks(); setShowAdd(false); setEditStock(null) }}
        />
      )}

      {showImport && (
        <ImportUSStocksDialog
          onClose={() => setShowImport(false)}
          onSuccess={fetchStocks}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
