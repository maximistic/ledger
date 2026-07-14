'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, TrendingUp, Upload, Pencil } from 'lucide-react'
import { formatINR, formatPctSigned, formatShortSigned } from '@/lib/utils'
import FundDetailDialog from './FundDetailDialog'
import AddEditFundDialog from './AddEditFundDialog'
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
  sipConfig: SipConfig | null; transactionCount: number
}

interface Totals {
  totalInvested: number; totalCurrentValue: number
  totalGainLoss: number; totalGainLossPct: number; count: number
}

interface Props {
  onStatsChange?: (totals: Totals) => void
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

const gridCols = '2.4fr 0.8fr 0.8fr 1fr 1fr 32px'

const headerCell: React.CSSProperties = {
  fontSize: '10.5px', color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
        borderRadius: '10px', overflow: 'hidden', minWidth: '580px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
          background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)',
          padding: '10px 20px',
        }}>
          {['Fund', 'Units', 'Avg NAV', 'Current NAV', 'Value', ''].map(h => (
            <div key={h} style={headerCell}>{h}</div>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
            padding: '14px 20px', alignItems: 'center',
            borderBottom: i < 3 ? '0.5px solid var(--color-border-subtle)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
              <div>
                <div style={{ height: 13, width: 140, borderRadius: 4, background: 'var(--color-bg)', marginBottom: 5, animation: 'pulse 1.4s ease infinite' }} />
                <div style={{ height: 11, width: 80, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
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
        Upload your CAS or add a fund manually
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={onImport} style={ghostBtnStyle}>Import CAS</button>
        <button onClick={onAdd} style={primaryBtnStyle}>Add fund</button>
      </div>
    </div>
  )
}

// ─── Funds table ──────────────────────────────────────────────────────────────

function FundsTable({
  funds,
  onRowClick,
  onEditClick,
}: {
  funds: MFItem[]
  onRowClick: (f: MFItem) => void
  onEditClick: (f: MFItem) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
        borderRadius: '10px', overflow: 'hidden', minWidth: '580px',
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
          <div style={{ ...headerCell, textAlign: 'right' }}>Current NAV</div>
          <div style={{ ...headerCell, textAlign: 'right' }}>P&amp;L</div>
          <div />
        </div>

        {funds.map((fund, i) => {
          const isLast     = i === funds.length - 1
          const gainColor  = fund.gainLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
          const isHovered  = hoveredId === fund.id
          const navStale   = fund.currentNav === 0
          const avatarText = fund.name.split(' ')[0].slice(0, 6).toUpperCase()
          const pnlSign    = fund.gainLoss >= 0 ? '+' : '−'

          return (
            <div
              key={fund.id}
              onMouseEnter={() => setHoveredId(fund.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onRowClick(fund)}
              style={{
                display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
                padding: '12px 20px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
                alignItems: 'center',
                cursor: 'pointer',
                background: isHovered ? '#FAFAF8' : 'transparent',
                transition: 'background 120ms ease',
              }}
            >
              {/* Fund name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', minWidth: '36px', flexShrink: 0,
                  borderRadius: '8px', background: 'var(--color-surface-raised)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 700, color: '#555',
                }}>
                  {avatarText}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {fund.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {fund.fundHouse ?? (fund.platform ?? 'Mutual Fund')}
                    {fund.hasActiveSip && (
                      <span style={{
                        marginLeft: '5px', fontSize: '9px', fontWeight: 700,
                        padding: '1px 4px', borderRadius: '3px',
                        background: '#F0FDF4', color: '#16A34A',
                      }}>SIP</span>
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

              {/* P&L */}
              <div style={{ textAlign: 'right' }}>
                {navStale ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</div>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: gainColor, fontVariantNumeric: 'tabular-nums' }}>
                      {pnlSign}₹{Math.abs(fund.gainLoss).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '10.5px', color: gainColor, marginTop: '1px' }}>
                      {formatPctSigned(fund.gainLossPct)}
                    </div>
                  </>
                )}
              </div>

              {/* Edit icon */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); onEditClick(fund) }}
                  style={{
                    width: '26px', height: '26px', borderRadius: '5px',
                    border: '0.5px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)', cursor: 'pointer',
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

// ─── Filter strip ─────────────────────────────────────────────────────────────

type Filter = 'all' | 'sip' | 'lumpsum'

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function MutualFundsTab({ onStatsChange }: Props) {
  const [funds, setFunds] = useState<MFItem[]>([])
  const [totals, setTotals] = useState<Totals>({ totalInvested: 0, totalCurrentValue: 0, totalGainLoss: 0, totalGainLossPct: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // NAV refresh
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState('')
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Dialogs
  const [detailFund, setDetailFund] = useState<MFItem | null>(null)
  const [editFund, setEditFund] = useState<MFItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Sync detailFund ref so fetchFunds can update it
  const detailFundRef = useRef<MFItem | null>(null)
  useEffect(() => { detailFundRef.current = detailFund }, [detailFund])

  const fetchFunds = useCallback(async () => {
    setLoading(true); setFetchError('')
    try {
      const typeParam = filter === 'sip' ? '?type=SIP' : filter === 'lumpsum' ? '?type=LUMPSUM' : ''
      const res = await fetch(`/api/mf${typeParam}`)
      const data = await res.json() as { funds?: MFItem[]; totals?: Totals; error?: string }
      if (!res.ok) throw new Error(data.error)
      const freshFunds = data.funds ?? []
      setFunds(freshFunds)
      const t = data.totals ?? { totalInvested: 0, totalCurrentValue: 0, totalGainLoss: 0, totalGainLossPct: 0, count: 0 }
      setTotals(t)
      onStatsChange?.(t)
      if (detailFundRef.current) {
        const fresh = freshFunds.find(f => f.id === detailFundRef.current!.id)
        if (fresh) setDetailFund(fresh)
      }
    } catch {
      setFetchError('Could not load funds. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [filter, onStatsChange])

  useEffect(() => { fetchFunds() }, [fetchFunds])

  async function handleNavRefresh() {
    setRefreshing(true); setRefreshStatus('')
    try {
      const res = await fetch('/api/mf/nav/refresh', { method: 'POST' })
      const data = await res.json() as { updated?: number; failed?: number; skipped?: number }
      setRefreshStatus(`Updated ${data.updated ?? 0} · Failed ${data.failed ?? 0} · Skipped ${data.skipped ?? 0}`)
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => setRefreshStatus(''), 4000)
      await fetchFunds()
    } catch {
      setRefreshStatus('NAV refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const gainColor = totals.totalGainLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'

  return (
    <>
      {/* ── Section header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            Mutual Funds
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {totals.totalCurrentValue > 0
              ? formatINR(totals.totalCurrentValue)
              : totals.totalInvested > 0 ? formatINR(totals.totalInvested) : '₹0'}
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
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* NAV refresh */}
            <button
              onClick={handleNavRefresh}
              disabled={refreshing}
              style={{ ...ghostBtnStyle, gap: '5px', opacity: refreshing ? 0.7 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Updating…' : 'Refresh NAV'}
            </button>

            {/* Import */}
            <button onClick={() => setShowImport(true)} style={ghostBtnStyle}>
              <Upload size={13} /> Import CAS
            </button>

            {/* Add */}
            <button onClick={() => setShowAdd(true)} style={primaryBtnStyle}>
              <Plus size={13} /> Add fund
            </button>
          </div>

          {refreshStatus && (
            <div style={{ fontSize: '11.5px', color: 'var(--color-gain)' }}>{refreshStatus}</div>
          )}
        </div>
      </div>

      {/* ── Filter strip ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['all', 'sip', 'lumpsum'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px',
              borderRadius: '6px',
              border: '0.5px solid',
              borderColor: filter === f ? 'var(--color-text-primary)' : 'var(--color-border)',
              background: filter === f ? 'var(--color-text-primary)' : 'var(--color-surface)',
              color: filter === f ? 'var(--color-surface)' : 'var(--color-text-secondary)',
              fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: filter === f ? 600 : 400,
              transition: 'all 120ms ease',
            }}
          >
            {f === 'all' ? 'All' : f === 'sip' ? 'SIP' : 'Lumpsum'}
          </button>
        ))}
      </div>

      {/* ── Table / states ───────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonTable />
      ) : fetchError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', fontSize: '13px', color: 'var(--color-loss)' }}>
          {fetchError}
          <button onClick={fetchFunds} style={ghostBtnStyle}>Retry</button>
        </div>
      ) : funds.length === 0 ? (
        <EmptyFunds onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)} />
      ) : (
        <FundsTable
          funds={funds}
          onRowClick={f => setDetailFund(f)}
          onEditClick={f => setEditFund(f)}
        />
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      {detailFund && (
        <FundDetailDialog
          fund={detailFund}
          onClose={() => setDetailFund(null)}
          onEdit={() => { setEditFund(detailFund); setDetailFund(null) }}
          onDelete={fetchFunds}
          onRefresh={fetchFunds}
        />
      )}

      {showAdd && (
        <AddEditFundDialog
          mode="add"
          onClose={() => setShowAdd(false)}
          onSuccess={() => { fetchFunds(); setShowAdd(false) }}
        />
      )}

      {editFund && (
        <AddEditFundDialog
          mode="edit"
          fund={editFund}
          onClose={() => setEditFund(null)}
          onSuccess={() => { fetchFunds(); setEditFund(null) }}
        />
      )}

      {showImport && (
        <ImportCASDialog
          onClose={() => setShowImport(false)}
          onSuccess={fetchFunds}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
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
