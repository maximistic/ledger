'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Pencil, Trash2, Plus, Loader2 } from 'lucide-react'
import { formatINR, formatINRSigned, formatPctSigned, formatDate, formatShort } from '@/lib/utils'
import { USStock, formatUSD, USD_BADGE } from './USStocksTab'

interface USTransaction {
  id: string
  stockId: string
  date: string
  type: string
  quantity: number
  priceUSD: number
  amountUSD: number
  amountINR: number
  exchangeRate: number
}

interface Props {
  stock: USStock
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

type View = 'list' | 'add-form' | 'confirm-delete'

export default function USStockDetailDialog({ stock, onClose, onEdit, onDelete, onRefresh }: Props) {
  const [transactions, setTransactions] = useState<USTransaction[]>([])
  const [txLoading, setTxLoading]       = useState(true)
  const [txError, setTxError]           = useState('')
  const [view, setView]                 = useState<View>('list')

  const [txType, setTxType]             = useState<'BUY' | 'SELL'>('BUY')
  const [txDate, setTxDate]             = useState('')
  const [txQty, setTxQty]               = useState('')
  const [txPriceUSD, setTxPriceUSD]     = useState('')
  const [txRate, setTxRate]             = useState(String(stock.exchangeRate > 0 ? stock.exchangeRate : 84))
  const [txErrors, setTxErrors]         = useState<Record<string, string>>({})
  const [txSubmitting, setTxSubmitting] = useState(false)
  const [txSubmitError, setTxSubmitError] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchTransactions() }, [stock.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  async function fetchTransactions() {
    setTxLoading(true); setTxError('')
    try {
      const res  = await fetch(`/api/us-stocks/${stock.id}/transactions`)
      const data = await res.json() as { transactions?: USTransaction[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setTransactions(data.transactions ?? [])
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setTxLoading(false)
    }
  }

  const priceStale = stock.currentPriceUSD === 0
  const gainColor  = stock.gainLossINR >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'

  function validateTx(): boolean {
    const e: Record<string, string> = {}
    const qty   = parseFloat(txQty)
    const price = parseFloat(txPriceUSD)
    const rate  = parseFloat(txRate)
    if (!txDate) e.date = 'Required'
    else if (new Date(txDate) > new Date()) e.date = 'Cannot be future'
    if (!txQty   || qty   <= 0) e.qty   = 'Must be > 0'
    if (!txPriceUSD || price <= 0) e.price = 'Must be > 0'
    if (!txRate  || rate  <= 0) e.rate  = 'Must be > 0'
    setTxErrors(e)
    return Object.keys(e).length === 0
  }

  async function submitTransaction() {
    if (!validateTx()) return
    setTxSubmitting(true); setTxSubmitError('')
    try {
      const res = await fetch(`/api/us-stocks/${stock.id}/transactions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:         txType,
          date:         txDate,
          quantity:     parseFloat(txQty),
          priceUSD:     parseFloat(txPriceUSD),
          exchangeRate: parseFloat(txRate),
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setTxQty(''); setTxPriceUSD(''); setTxDate('')
      setView('list')
      await fetchTransactions()
      onRefresh()
    } catch (err) {
      setTxSubmitError(err instanceof Error ? err.message : 'Error saving transaction')
    } finally {
      setTxSubmitting(false)
    }
  }

  async function confirmDelete() {
    try {
      await fetch(`/api/us-stocks/${stock.id}`, { method: 'DELETE' })
      onDelete(); onClose()
    } catch { /* noop */ }
  }

  const qty      = parseFloat(txQty)     || 0
  const priceNum = parseFloat(txPriceUSD) || 0
  const rateNum  = parseFloat(txRate)    || 84
  const totalUSD = qty * priceNum
  const totalINR = totalUSD * rateNum

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', borderRadius: '12px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '7px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 700, color: 'var(--color-text-secondary)', overflow: 'hidden', padding: '0 4px' }}>
                {stock.ticker}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{stock.name}</div>
                  <div style={USD_BADGE}>USD</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {stock.ticker} · {stock.exchange}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '14px' }}>
            {[
              { label: 'Value (INR)',    value: formatShort(stock.currentValueINR),  color: 'var(--color-text-primary)' },
              { label: 'Invested (INR)', value: formatShort(stock.investedValueINR), color: 'var(--color-text-primary)' },
              { label: 'P&L (INR)',      value: priceStale ? '—' : formatINRSigned(stock.gainLossINR), color: priceStale ? 'var(--color-text-muted)' : gainColor },
              { label: 'Returns',        value: priceStale ? '—' : formatPctSigned(stock.gainLossPct), color: priceStale ? 'var(--color-text-muted)' : gainColor },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: '8px', padding: '9px 10px' }}>
                <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Info strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: '12px' }}>
            {[
              { label: 'Avg Price',      value: formatUSD(stock.avgPriceUSD) },
              { label: 'Current Price',  value: priceStale ? '—' : formatUSD(stock.currentPriceUSD) },
              { label: 'Exchange Rate',  value: `₹${stock.exchangeRate.toFixed(2)}/USD` },
              { label: 'Exchange',       value: stock.exchange },
              { label: 'Last Updated',   value: stock.lastPriceUpdatedAt ? formatDate(stock.lastPriceUpdatedAt) : 'Never' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px', padding: '16px 20px' }}>
          {view === 'list' && (
            <>
              <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                Transaction history
              </div>
              {txLoading ? <SkeletonRows /> : txError ? (
                <div style={{ fontSize: '13px', color: 'var(--color-loss)' }}>{txError}</div>
              ) : transactions.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  No transaction history yet. Import your Order Report from INDmoney to see history.
                </div>
              ) : transactions.map((tx, i) => {
                const isLast = i === transactions.length - 1
                const isBuy  = tx.type === 'BUY'
                return (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)' }}>
                    <div style={{ width: '38px', minWidth: '38px', height: '22px', borderRadius: '4px', background: isBuy ? 'var(--color-gain-subtle)' : 'var(--color-loss-subtle)', color: isBuy ? 'var(--color-gain)' : 'var(--color-loss)', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {tx.type}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{formatDate(tx.date)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        {formatUSD(tx.priceUSD)} per share
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatUSD(tx.amountUSD)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        ≈ {formatINR(tx.amountINR)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {view === 'add-form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                Add transaction
              </div>

              {/* BUY / SELL toggle */}
              <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '7px', border: '0.5px solid var(--color-border)', overflow: 'hidden', width: 'fit-content' }}>
                {(['BUY', 'SELL'] as const).map(t => (
                  <button key={t} onClick={() => setTxType(t)} style={{ padding: '6px 20px', fontSize: '12.5px', fontWeight: 600, background: txType === t ? 'var(--color-text-primary)' : 'transparent', color: txType === t ? 'var(--color-surface)' : 'var(--color-text-muted)', fontFamily: 'inherit', cursor: 'pointer', border: 'none', transition: 'all 140ms' }}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={fLabel}>Date</div>
                  <input type="date" value={txDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setTxDate(e.target.value)} style={{ ...fInput, colorScheme: 'light dark' }} />
                  {txErrors.date && <div style={errTxt}>{txErrors.date}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={fLabel}>Quantity</div>
                  <input type="number" min="0" step="any" value={txQty} onChange={e => setTxQty(e.target.value)} placeholder="0" style={{ ...fInput, fontVariantNumeric: 'tabular-nums' }} />
                  {txErrors.qty && <div style={errTxt}>{txErrors.qty}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={fLabel}>Price per share (USD)</div>
                  <input type="number" min="0" step="any" value={txPriceUSD} onChange={e => setTxPriceUSD(e.target.value)} placeholder="0.00" style={{ ...fInput, fontVariantNumeric: 'tabular-nums' }} />
                  {txErrors.price && <div style={errTxt}>{txErrors.price}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={fLabel}>Exchange rate (₹/$)</div>
                  <input type="number" min="0" step="any" value={txRate} onChange={e => setTxRate(e.target.value)} placeholder="84" style={{ ...fInput, fontVariantNumeric: 'tabular-nums' }} />
                  {txErrors.rate && <div style={errTxt}>{txErrors.rate}</div>}
                </div>
              </div>

              {qty > 0 && priceNum > 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                  Total: <strong style={{ color: 'var(--color-text-primary)' }}>{formatUSD(totalUSD)}</strong>
                  <span> · ≈ </span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{formatINR(totalINR)}</strong>
                </div>
              )}
              {txSubmitError && <div style={{ fontSize: '12px', color: 'var(--color-loss)' }}>{txSubmitError}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          {view === 'confirm-delete' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Delete <strong>{stock.name}</strong>? This cannot be undone.
              </span>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => setView('list')} style={ghostBtn}>Cancel</button>
                <button onClick={confirmDelete} style={deleteBtn}>Confirm delete</button>
              </div>
            </div>
          ) : view === 'add-form' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => { setView('list'); setTxErrors({}); setTxSubmitError('') }} style={ghostBtn}>Cancel</button>
              <button onClick={submitTransaction} disabled={txSubmitting} style={primaryBtn}>
                {txSubmitting && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                {txSubmitting ? 'Saving…' : 'Save transaction'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onEdit} style={ghostBtn}><Pencil size={12} /> Edit</button>
                <button onClick={() => setView('confirm-delete')} style={redGhostBtn}><Trash2 size={12} /> Delete</button>
              </div>
              <button onClick={() => setView('add-form')} style={primaryBtn}>
                <Plus size={12} /> Add transaction
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < 3 ? '0.5px solid var(--color-border-subtle)' : 'none' }}>
          <div style={{ width: 38, height: 22, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 13, width: '50%', borderRadius: 4, background: 'var(--color-bg)', marginBottom: 4, animation: 'pulse 1.4s ease infinite' }} />
            <div style={{ height: 11, width: '35%', borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
          </div>
          <div style={{ width: 70, height: 26, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
        </div>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

const fLabel: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px',
}
const fInput: React.CSSProperties = {
  width: '100%', background: 'var(--color-bg)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '7px 10px', fontSize: '13px', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none',
}
const errTxt: React.CSSProperties = { fontSize: '10.5px', color: 'var(--color-loss)', marginTop: '2px' }
const ghostBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: '6px', border: '0.5px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-text-secondary)',
  fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const redGhostBtn: React.CSSProperties = {
  ...ghostBtn, color: 'var(--color-loss)', borderColor: 'var(--color-loss-subtle)',
}
const deleteBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: '6px', border: 'none',
  background: 'var(--color-loss)', color: '#fff',
  fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '6px 16px', borderRadius: '6px', border: 'none',
  background: 'var(--color-text-primary)', color: 'var(--color-surface)',
  fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '5px',
}
