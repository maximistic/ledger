'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Plus, TrendingUp, RefreshCw, Pencil, PackageOpen } from 'lucide-react'
import { formatINR, formatShort, formatShortSigned, formatPctSigned } from '@/lib/utils'
import AddEditStockDialog from '@/components/stocks/AddEditStockDialog'
import TransactionDialog from '@/components/stocks/TransactionDialog'
import ImportDialog from '@/components/stocks/ImportDialog'
import MutualFundsTab from '@/components/mf/MutualFundsTab'
import EPFTab from '@/components/epf/EPFTab'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'stocks' | 'mf' | 'fd' | 'epf' | 'us'

interface StockItem {
  id: string
  ticker: string
  name: string
  exchange: string
  sector?: string | null
  quantity: number
  avgPrice: number
  currentPrice: number
  holdingsQuantity: number
  investedValue: number
  currentValue: number
  displayCurrentValue: number
  gainLoss: number
  gainLossPct: number
  transactionCount: number
  priceStale: boolean
}

// ─── Static rail data for non-stocks/mf/epf tabs ─────────────────────────────

const otherAssets: { value: Exclude<Tab, 'stocks' | 'mf' | 'epf'>; label: string; countLabel: string; invested: number }[] = [
  { value: 'fd', label: 'FDs & RDs', countLabel: '2 accounts', invested: 200000 },
  { value: 'us', label: 'US Stocks', countLabel: '4 holdings', invested: 85000  },
]

// ─── Grid ─────────────────────────────────────────────────────────────────────

const gridCols = '2.2fr 0.6fr 1fr 1fr 1fr 32px'

const headerCell: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontWeight: 500,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        minWidth: '520px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
          background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)',
          padding: '10px 20px',
        }}>
          {['Name', 'Qty', 'Avg Price', 'Current', 'P&L', ''].map(h => (
            <div key={h} style={headerCell}>{h}</div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
            padding: '14px 20px',
            borderBottom: i < 4 ? '0.5px solid var(--color-border-subtle)' : 'none',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 7, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
              <div>
                <div style={{ height: 13, width: 120, borderRadius: 4, background: 'var(--color-bg)', marginBottom: 5, animation: 'pulse 1.4s ease infinite' }} />
                <div style={{ height: 11, width: 70, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{ height: 13, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
            ))}
            <div />
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyStocks({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', gap: '12px',
    }}>
      <TrendingUp size={36} color="var(--color-text-muted)" strokeWidth={1.5} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No stocks yet</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Add your first stock or import from Zerodha
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={onImport} style={ghostBtnStyle}>Import</button>
        <button onClick={onAdd} style={primaryBtnStyle}>Add stock</button>
      </div>
    </div>
  )
}

function AllSoldEmpty({ onImport }: { onImport: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', gap: '12px',
    }}>
      <PackageOpen size={36} color="var(--color-text-muted)" strokeWidth={1.5} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No active positions</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        All your positions have been closed
      </div>
      <button onClick={onImport} style={ghostBtnStyle}>Import holdings</button>
    </div>
  )
}

// ─── Stocks table ─────────────────────────────────────────────────────────────

function StocksTable({
  stocks,
  onRowClick,
  onEditClick,
}: {
  stocks: StockItem[]
  onRowClick: (s: StockItem) => void
  onEditClick: (s: StockItem) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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
          display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
          background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)',
          padding: '10px 20px',
        }}>
          <div style={headerCell}>Name</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Qty</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Avg Price</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Current</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>P&amp;L</div>
          <div />
        </div>

        {stocks.map((stock, i) => {
          const isLast    = i === stocks.length - 1
          const gainColor = stock.gainLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
          const isHovered = hoveredId === stock.id
          const pnlSign   = stock.gainLoss >= 0 ? '+' : '−'

          return (
            <div
              key={stock.id}
              onMouseEnter={() => setHoveredId(stock.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onRowClick(stock)}
              style={{
                display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
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
                  fontSize: '8px', fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', padding: '0 4px',
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
                {stock.quantity}
              </div>

              {/* Avg Price */}
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(stock.avgPrice)}
              </div>

              {/* Current price / stale indicator */}
              <div style={{ textAlign: 'right' }}>
                {stock.priceStale ? (
                  <div>
                    <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      —
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                      Price not updated
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatINR(stock.currentPrice)}
                  </div>
                )}
              </div>

              {/* P&L */}
              <div style={{ textAlign: 'right' }}>
                {stock.priceStale ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</div>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: gainColor, fontVariantNumeric: 'tabular-nums' }}>
                      {pnlSign}₹{Math.abs(stock.gainLoss).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '10.5px', color: gainColor, marginTop: '1px' }}>
                      {formatPctSigned(stock.gainLossPct)}
                    </div>
                  </>
                )}
              </div>

              {/* Edit icon */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); onEditClick(stock) }}
                  style={{
                    width: '26px', height: '26px', borderRadius: '5px',
                    border: '0.5px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 120ms ease',
                  }}
                >
                  <Pencil size={12} />
                </button>
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

  // Stocks data
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [totalIncludingZero, setTotalIncludingZero] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  // MF rail stats
  const [mfStats, setMfStats] = useState({ count: 0, totalInvested: 0, totalCurrentValue: 0 })

  // EPF rail stats
  const [epfCorpus, setEpfCorpus] = useState(0)
  const [epfHasAccount, setEpfHasAccount] = useState(false)

  // Price refresh
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState('')
  const refreshStatusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Dialogs
  const [showAdd, setShowAdd] = useState(false)
  const [editStock, setEditStock] = useState<StockItem | null>(null)
  const [txStock, setTxStock] = useState<StockItem | null>(null)
  const [showImport, setShowImport] = useState(false)

  // Keep a ref to txStock so fetchStocks can update it without being a dependency
  const txStockRef = useRef<StockItem | null>(null)
  useEffect(() => { txStockRef.current = txStock }, [txStock])

  const fetchStocks = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/stocks')
      const data = await res.json() as { stocks?: StockItem[]; totalIncludingZero?: number; error?: string }
      if (!res.ok) throw new Error(data.error)
      const freshStocks = data.stocks ?? []
      setStocks(freshStocks)
      setTotalIncludingZero(data.totalIncludingZero ?? 0)
      // Keep TransactionDialog in sync with fresh stock data
      if (txStockRef.current) {
        const fresh = freshStocks.find(s => s.id === txStockRef.current!.id)
        if (fresh) setTxStock(fresh)
      }
    } catch {
      setFetchError('Could not load your stocks. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStocks() }, [fetchStocks])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshStatus('')
    try {
      const res = await fetch('/api/stocks/price', { method: 'POST' })
      const data = await res.json() as { updated?: number; failed?: number; skipped?: number }
      setRefreshStatus(`Updated ${data.updated ?? 0} · Failed ${data.failed ?? 0} · Skipped ${data.skipped ?? 0}`)
      clearTimeout(refreshStatusTimer.current)
      refreshStatusTimer.current = setTimeout(() => setRefreshStatus(''), 4000)
      await fetchStocks()
    } catch {
      setRefreshStatus('Price refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  // For the header stats, use displayCurrentValue (falls back to investedValue when price is stale)
  const stocksInvested   = stocks.reduce((s, x) => s + x.investedValue, 0)
  const stocksCurrent    = stocks.reduce((s, x) => s + x.displayCurrentValue, 0)
  const stocksGain       = stocksCurrent - stocksInvested
  const stocksGainPct    = stocksInvested > 0 ? (stocksGain / stocksInvested) * 100 : 0
  const stocksGainColor  = stocksGain >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'

  const activeOther = (activeTab !== 'stocks' && activeTab !== 'mf' && activeTab !== 'epf')
    ? otherAssets.find(a => a.value === activeTab)
    : null

  // Empty state variant
  const allSold = stocks.length === 0 && totalIncludingZero > 0

  return (
    <div style={{ display: 'flex', gap: '16px' }}>

      {/* ── Left rail ───────────────────────────────────────────────────────── */}
      <div style={{ width: '170px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Stocks card */}
        <div
          onClick={() => setActiveTab('stocks')}
          style={{
            background: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRight: activeTab === 'stocks' ? '2px solid var(--color-text-primary)' : '2px solid transparent',
            borderRadius: '10px',
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 160ms ease',
          }}
        >
          <div style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600,
            color: activeTab === 'stocks' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          }}>Stocks</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {stocks.length} {stocks.length === 1 ? 'holding' : 'holdings'}
          </div>
          <div style={{
            fontSize: '15px', fontWeight: 600,
            color: activeTab === 'stocks' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            marginTop: '6px', fontVariantNumeric: 'tabular-nums',
          }}>
            {formatShort(stocksInvested)}
          </div>
        </div>

        {/* Mutual Funds card */}
        {(() => {
          const active = activeTab === 'mf'
          const mfDisplay = mfStats.totalCurrentValue > 0 ? mfStats.totalCurrentValue : mfStats.totalInvested
          return (
            <div
              onClick={() => setActiveTab('mf')}
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
                fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}>Mutual Funds</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {mfStats.count} {mfStats.count === 1 ? 'scheme' : 'schemes'}
              </div>
              <div style={{
                fontSize: '15px', fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                marginTop: '6px', fontVariantNumeric: 'tabular-nums',
              }}>
                {formatShort(mfDisplay)}
              </div>
            </div>
          )
        })()}

        {/* EPF card */}
        {(() => {
          const active = activeTab === 'epf'
          return (
            <div
              onClick={() => setActiveTab('epf')}
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
                fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}>EPF</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {epfHasAccount ? '1 account' : 'Not configured'}
              </div>
              <div style={{
                fontSize: '15px', fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                marginTop: '6px', fontVariantNumeric: 'tabular-nums',
              }}>
                {epfHasAccount ? formatShort(epfCorpus) : '₹0'}
              </div>
            </div>
          )
        })()}

        {/* Other asset class cards */}
        {otherAssets.map(ac => {
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
                fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}>{ac.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{ac.countLabel}</div>
              <div style={{
                fontSize: '15px', fontWeight: 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                marginTop: '6px', fontVariantNumeric: 'tabular-nums',
              }}>
                {formatShort(ac.invested)}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Right content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {activeTab === 'mf' ? (
          <MutualFundsTab
            onStatsChange={t => setMfStats({ count: t.count, totalInvested: t.totalInvested, totalCurrentValue: t.totalCurrentValue })}
          />
        ) : activeTab === 'stocks' ? (
          <>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Stocks
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                  {formatShort(stocksCurrent)}
                </div>
                {!loading && stocks.length > 0 && (
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Invested </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{formatShort(stocksInvested)}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                    <span style={{ color: stocksGainColor }}>{formatShortSigned(stocksGain)}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                    <span style={{ color: stocksGainColor }}>{formatPctSigned(stocksGainPct)}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Refresh prices */}
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    style={{ ...ghostBtnStyle, gap: '5px', opacity: refreshing ? 0.7 : 1 }}
                  >
                    <RefreshCw
                      size={13}
                      style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
                    />
                    {refreshing ? 'Updating…' : 'Refresh prices'}
                  </button>

                  {/* Import */}
                  <button onClick={() => setShowImport(true)} style={ghostBtnStyle}>
                    <Upload size={13} /> Import
                  </button>

                  {/* Add stock */}
                  <button onClick={() => setShowAdd(true)} style={primaryBtnStyle}>
                    <Plus size={13} /> Add stock
                  </button>
                </div>

                {/* Inline refresh status */}
                {refreshStatus && (
                  <div style={{ fontSize: '11.5px', color: 'var(--color-gain)' }}>{refreshStatus}</div>
                )}
              </div>
            </div>

            {/* Table area */}
            {loading ? (
              <SkeletonTable />
            ) : fetchError ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', fontSize: '13px', color: 'var(--color-loss)' }}>
                {fetchError}
                <button onClick={fetchStocks} style={ghostBtnStyle}>Retry</button>
              </div>
            ) : allSold ? (
              <AllSoldEmpty onImport={() => setShowImport(true)} />
            ) : stocks.length === 0 ? (
              <EmptyStocks onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)} />
            ) : (
              <StocksTable
                stocks={stocks}
                onRowClick={s => setTxStock(s)}
                onEditClick={s => setEditStock(s)}
              />
            )}
          </>
        ) : activeTab === 'epf' ? (
          <EPFTab
            onCorpusChange={(corpus, hasAccount) => {
              setEpfCorpus(corpus)
              setEpfHasAccount(hasAccount)
            }}
          />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  {activeOther?.label}
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                  {formatShort(activeOther?.invested ?? 0)}
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '200px', color: 'var(--color-text-muted)', fontSize: '14px',
            }}>
              {activeOther?.label} — coming soon
            </div>
          </>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {showAdd && (
        <AddEditStockDialog
          mode="add"
          onClose={() => setShowAdd(false)}
          onSuccess={fetchStocks}
        />
      )}

      {editStock && (
        <AddEditStockDialog
          mode="edit"
          stock={editStock}
          onClose={() => setEditStock(null)}
          onSuccess={() => { fetchStocks(); setEditStock(null) }}
        />
      )}

      {txStock && (
        <TransactionDialog
          stock={txStock}
          onClose={() => setTxStock(null)}
          onEdit={() => { setEditStock(txStock); setTxStock(null) }}
          onDelete={fetchStocks}
          onRefresh={fetchStocks}
        />
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onSuccess={fetchStocks}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Shared button styles ─────────────────────────────────────────────────────

const ghostBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: 'none',
  background: 'var(--color-text-primary)',
  color: 'var(--color-surface)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}
