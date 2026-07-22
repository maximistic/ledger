'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, TrendingUp, Upload, Info } from 'lucide-react'
import { formatINR, formatShortSigned, formatPctSigned } from '@/lib/utils'
import AddEditFundDialog from './AddEditFundDialog'
import FundDetailDialog from './FundDetailDialog'
import ImportCASDialog from './ImportCASDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SipConfig {
  id: string; fundId: string; amount: number; dayOfMonth: number
  startDate: string; lastProcessedDate: string | null; status: string
}

export interface MFItem {
  id: string; name: string; isin: string | null; folioNumber: string | null
  amfiCode: string | null; platform: string | null; fundHouse: string | null
  fundCategory: string | null; expenseRatio: number | null; exitLoad: string | null
  units: number; avgNav: number; currentNav: number
  investedValue: number; currentValue: number
  gainLoss: number; gainLossPct: number
  hasActiveSip: boolean; lastNavUpdatedAt: string | null
  firstInvestmentDate: string | null
  sipConfig: SipConfig | null
  hasSIPTx: boolean; hasLumpsumTx: boolean
}

interface Totals {
  totalCurrentValue: number; totalInvested: number
  totalGainLoss: number; totalGainLossPct: number; count: number
}

interface Props {
  onSummaryRefresh?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const gridCols = '2.4fr 0.7fr 0.9fr 0.9fr 1fr 1fr 1fr'

const headerCell: React.CSSProperties = {
  fontSize: '10.5px', color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600,
}

const DEFAULT_TOTALS: Totals = {
  totalCurrentValue: 0, totalInvested: 0, totalGainLoss: 0, totalGainLossPct: 0, count: 0,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
        borderRadius: '10px', overflow: 'hidden', minWidth: '700px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
          background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)',
          padding: '10px 20px',
        }}>
          {['Fund', 'Units', 'Avg NAV', 'Cur NAV', 'Invested', 'Current', 'P&L'].map(h => (
            <div key={h} style={headerCell}>{h}</div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
            padding: '14px 20px', alignItems: 'center',
            borderBottom: i < 4 ? '0.5px solid var(--color-border-subtle)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ height: 13, width: '80%', borderRadius: 4, background: 'var(--color-bg)', marginBottom: 5, animation: 'pulse 1.4s ease infinite' }} />
                <div style={{ height: 11, width: '50%', borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
              </div>
            </div>
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} style={{ height: 13, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
            ))}
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFunds({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', gap: '12px',
    }}>
      <TrendingUp size={36} color="var(--color-text-muted)" strokeWidth={1.5} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No mutual funds yet</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Import your CAS or add a fund manually
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={onImport} style={ghostBtn}>Import CAS</button>
        <button onClick={onAdd} style={primaryBtn}>Add fund</button>
      </div>
    </div>
  )
}

// ─── Funds table ──────────────────────────────────────────────────────────────

function FundsTable({
  funds,
  onRowClick,
}: {
  funds: MFItem[]
  onRowClick: (f: MFItem) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
        borderRadius: '10px', overflow: 'hidden', minWidth: '700px',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
          background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)',
          padding: '10px 20px',
        }}>
          <div style={headerCell}>Fund</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Units</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Avg NAV</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Cur NAV</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Invested</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>Current</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>P&amp;L</div>
        </div>

        {funds.map((fund, i) => {
          const isLast    = i === funds.length - 1
          const gainColor = fund.gainLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
          const isHovered = hoveredId === fund.id
          const navStale  = fund.currentNav === 0
          const initials  = fund.name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || fund.name.slice(0, 2).toUpperCase()
          const currentColor =
            navStale ? 'var(--color-text-muted)'
            : fund.currentValue > fund.investedValue ? 'var(--color-gain)'
            : fund.currentValue < fund.investedValue ? 'var(--color-loss)'
            : 'var(--color-text-primary)'

          return (
            <div
              key={fund.id}
              onMouseEnter={() => setHoveredId(fund.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onRowClick(fund)}
              style={{
                display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
                padding: '13px 20px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
                alignItems: 'center',
                cursor: 'pointer',
                background: isHovered ? 'var(--color-surface-raised)' : 'transparent',
                transition: 'background 120ms ease',
              }}
            >
              {/* Fund cell */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '38px', height: '38px', minWidth: '38px', borderRadius: '8px',
                  background: 'var(--color-surface-raised)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 700, color: '#555',
                  overflow: 'hidden', padding: '0 4px', flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500,
                    lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {fund.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {fund.platform ?? '—'}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {(fund.hasSIPTx || fund.hasActiveSip) && (
                      <span style={{
                        fontSize: '9.5px', fontWeight: 700, padding: '1.5px 6px',
                        borderRadius: '3px', background: '#F0FDF4', color: '#16A34A',
                      }}>SIP</span>
                    )}
                    {fund.hasLumpsumTx && (
                      <span style={{
                        fontSize: '9.5px', fontWeight: 700, padding: '1.5px 6px',
                        borderRadius: '3px', background: '#EFF6FF', color: '#2563EB',
                      }}>Lumpsum</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Units */}
              <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fund.units.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
              </div>

              {/* Avg NAV */}
              <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                ₹{fund.avgNav.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </div>

              {/* Current NAV */}
              <div style={{ textAlign: 'right' }}>
                {navStale ? (
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>—</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', marginTop: '1px' }}>Not updated</div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    ₹{fund.currentNav.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </div>
                )}
              </div>

              {/* Invested */}
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(fund.investedValue)}
              </div>

              {/* Current */}
              <div style={{ fontSize: '13px', fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: currentColor }}>
                {navStale ? '—' : formatINR(fund.currentValue)}
              </div>

              {/* P&L */}
              <div style={{ textAlign: 'right' }}>
                {navStale ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</div>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: gainColor, fontVariantNumeric: 'tabular-nums' }}>
                      {formatShortSigned(fund.gainLoss)}
                    </div>
                    <div style={{ fontSize: '10.5px', color: gainColor, marginTop: '1px' }}>
                      {formatPctSigned(fund.gainLossPct)}
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

// ─── Main tab ─────────────────────────────────────────────────────────────────

type Filter = 'all' | 'sip' | 'lumpsum'

export default function MutualFundsTab({ onSummaryRefresh }: Props) {
  const [funds, setFunds] = useState<MFItem[]>([])
  const [totals, setTotals] = useState<Totals>(DEFAULT_TOTALS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState('')
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [showAdd, setShowAdd]       = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedFund, setSelectedFund] = useState<MFItem | null>(null)
  const [editFund, setEditFund]     = useState<MFItem | null>(null)

  const onSummaryRef = useRef(onSummaryRefresh)
  useEffect(() => { onSummaryRef.current = onSummaryRefresh }, [onSummaryRefresh])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)

    fetch('/api/mf')
      .then(r => r.json() as Promise<{ funds?: MFItem[]; totals?: Totals; error?: string }>)
      .then(data => {
        if (cancelled) return
        const freshFunds = data.funds ?? []
        setFunds(freshFunds)
        setTotals(data.totals ?? DEFAULT_TOTALS)
        setSelectedFund(prev => prev ? (freshFunds.find(f => f.id === prev.id) ?? null) : null)
        if (refreshKey > 0) onSummaryRef.current?.()
      })
      .catch(err => {
        console.error('fetchFunds error:', err)
        if (!cancelled) setError('Could not load funds. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [refreshKey]) // onSummaryRefresh excluded — accessed via ref

  async function handleNavRefresh() {
    setRefreshing(true); setRefreshStatus('')
    try {
      const res = await fetch('/api/mf/nav/refresh', { method: 'POST' })
      const data = await res.json() as { updated?: number; failed?: number; skipped?: number }
      setRefreshStatus(`Updated ${data.updated ?? 0} · Failed ${data.failed ?? 0} · Skipped ${data.skipped ?? 0}`)
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => setRefreshStatus(''), 4000)
      refresh()
    } catch (err) {
      console.error('NAV refresh error:', err)
      setRefreshStatus('NAV refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = funds.filter(f =>
    filter === 'sip'     ? (f.hasSIPTx || f.hasActiveSip)
    : filter === 'lumpsum' ? f.hasLumpsumTx
    : true
  )

  const gainColor = totals.totalGainLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'

  return (
    <>
      {/* Section header */}
      <div className="section-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px', fontWeight: 600 }}>
            Mutual Funds
          </div>
          <div className="section-big-value" style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {formatINR(totals.totalCurrentValue > 0 ? totals.totalCurrentValue : totals.totalInvested)}
          </div>
          {!loading && funds.length > 0 && (
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Invested </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{formatINR(totals.totalInvested)}</span>
              {totals.totalCurrentValue > 0 && (
                <>
                  <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                  <span style={{ color: gainColor }}>{formatShortSigned(totals.totalGainLoss)}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                  <span style={{ color: gainColor }}>{formatPctSigned(totals.totalGainLossPct)}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div className="section-header-actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleNavRefresh}
              disabled={refreshing}
              style={{ ...ghostBtn, gap: '5px', opacity: refreshing ? 0.7 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Updating…' : 'Refresh NAV'}
            </button>
            <button onClick={() => setShowImport(true)} style={ghostBtn}>
              <Upload size={13} /> Import CAS
            </button>
            <button onClick={() => setShowAdd(true)} style={primaryBtn}>
              <Plus size={13} /> Add fund
            </button>
          </div>
          {refreshStatus && (
            <div style={{ fontSize: '11.5px', color: 'var(--color-gain)' }}>{refreshStatus}</div>
          )}
        </div>
      </div>

      {/* NAV source disclaimer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 0', marginBottom: '4px' }}>
        <Info size={12} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          NAV prices fetched from Yahoo Finance. If a price looks wrong, click any fund → <strong style={{ fontWeight: 600 }}>Edit NAV</strong> to update it manually.
        </span>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['all', 'sip', 'lumpsum'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px', borderRadius: '6px', border: '0.5px solid',
              borderColor: filter === f ? 'var(--color-text-primary)' : 'var(--color-border)',
              background: filter === f ? 'var(--color-text-primary)' : 'var(--color-surface)',
              color: filter === f ? 'var(--color-surface)' : 'var(--color-text-secondary)',
              fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: filter === f ? 600 : 400, transition: 'all 120ms ease',
            }}
          >
            {f === 'all' ? 'All' : f === 'sip' ? 'SIP' : 'Lumpsum'}
          </button>
        ))}
      </div>

      {/* Table / states */}
      {loading ? (
        <SkeletonTable />
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', fontSize: '13px', color: 'var(--color-loss)' }}>
          {error}
          <button onClick={refresh} style={ghostBtn}>Retry</button>
        </div>
      ) : funds.length === 0 ? (
        <EmptyFunds onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)} />
      ) : (
        <FundsTable funds={filtered} onRowClick={setSelectedFund} />
      )}

      {/* Dialogs */}
      {selectedFund && (
        <FundDetailDialog
          fund={selectedFund}
          onClose={() => setSelectedFund(null)}
          onEdit={() => { setEditFund(selectedFund); setSelectedFund(null) }}
          onDelete={() => { refresh(); onSummaryRef.current?.() }}
          onRefresh={refresh}
        />
      )}

      {showAdd && (
        <AddEditFundDialog
          mode="add"
          onClose={() => setShowAdd(false)}
          onSuccess={() => { refresh(); onSummaryRef.current?.(); setShowAdd(false) }}
        />
      )}

      {editFund && (
        <AddEditFundDialog
          mode="edit"
          fund={editFund}
          onClose={() => setEditFund(null)}
          onSuccess={() => { refresh(); onSummaryRef.current?.(); setEditFund(null) }}
        />
      )}

      {showImport && (
        <ImportCASDialog
          onClose={() => setShowImport(false)}
          onSuccess={() => { refresh(); onSummaryRef.current?.() }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

// ─── Shared button styles ─────────────────────────────────────────────────────

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px', border: 'none',
  background: 'var(--color-text-primary)',
  color: 'var(--color-surface)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}
