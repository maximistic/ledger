'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { USStock, formatUSD, labelStyle, inputStyle } from './USStocksTab'

interface SearchResult {
  ticker: string
  name: string
  exchange: string
}

interface Props {
  mode: 'add' | 'edit'
  stock?: USStock
  onClose: () => void
  onSuccess: () => void
}

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

export default function AddEditUSStockDialog({ mode, stock, onClose, onSuccess }: Props) {
  const [tickerQuery, setTickerQuery]         = useState(stock?.ticker ?? '')
  const [searchResults, setSearchResults]     = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading]     = useState(false)
  const [dropdownOpen, setDropdownOpen]       = useState(false)
  const [highlightedIdx, setHighlightedIdx]   = useState(0)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [exchange, setExchange]     = useState(stock?.exchange ?? 'NASDAQ')
  const [name, setName]             = useState(stock?.name ?? '')
  const [quantity, setQuantity]     = useState(stock ? String(stock.quantity) : '')
  const [avgPriceUSD, setAvgPrice]  = useState(stock ? String(stock.avgPriceUSD) : '')
  const [exchangeRate, setRate]     = useState(stock ? String(stock.exchangeRate) : '')
  const [rateLoading, setRateLoading] = useState(false)
  const [date, setDate]             = useState('')

  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const overlayRef    = useRef<HTMLDivElement>(null)
  const firstFocusRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFocusRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Fetch live exchange rate for new stocks
  useEffect(() => {
    if (stock) return // editing — use stored rate
    setRateLoading(true)
    fetch('/api/us-stocks/exchange-rate')
      .then(r => r.json())
      .then((data: { rate?: number }) => {
        if (data.rate && data.rate > 0) setRate(String(data.rate.toFixed(2)))
        else setRate('84')
      })
      .catch(() => setRate('84'))
      .finally(() => setRateLoading(false))
  }, [stock])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setDropdownOpen(false); return }
    setSearchLoading(true)
    try {
      const res  = await fetch(`/api/us-stocks/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as SearchResult[]
      setSearchResults(data)
      setDropdownOpen(true)
      setHighlightedIdx(0)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function handleTickerChange(val: string) {
    setTickerQuery(val)
    clearTimeout(searchTimeout.current)
    if (mode === 'add') searchTimeout.current = setTimeout(() => doSearch(val), 300)
  }

  function selectResult(r: SearchResult) {
    setTickerQuery(r.ticker)
    setName(r.name)
    setExchange(r.exchange)
    setDropdownOpen(false)
    setErrors(prev => ({ ...prev, ticker: '' }))
  }

  function handleTickerKeyDown(e: React.KeyboardEvent) {
    if (!dropdownOpen) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, searchResults.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (searchResults[highlightedIdx]) selectResult(searchResults[highlightedIdx]) }
    if (e.key === 'Escape')    { setDropdownOpen(false) }
  }

  const qty   = parseFloat(quantity)    || 0
  const price = parseFloat(avgPriceUSD) || 0
  const rate  = parseFloat(exchangeRate) || 84
  const totalUSD = qty * price
  const totalINR = totalUSD * rate

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!tickerQuery.trim())         errs.ticker   = 'Ticker is required'
    if (!quantity.trim() || qty <= 0) errs.quantity = 'Must be > 0'
    if (!avgPriceUSD.trim() || price <= 0) errs.avgPrice = 'Must be > 0'
    if (!exchangeRate.trim() || rate <= 0) errs.rate = 'Must be > 0'
    if (mode === 'add') {
      if (!date) errs.date = 'Date is required'
      else if (new Date(date) > new Date()) errs.date = 'Cannot be in the future'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true); setSubmitError('')
    try {
      const payload: Record<string, unknown> = {
        ticker:       tickerQuery.trim().toUpperCase(),
        name:         name.trim() || tickerQuery.trim().toUpperCase(),
        exchange,
        quantity:     qty,
        avgPriceUSD:  price,
        exchangeRate: rate,
      }

      const url    = mode === 'add' ? '/api/us-stocks' : `/api/us-stocks/${stock!.id}`
      const method = mode === 'add' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setSubmitError(cleanError(data.error))
        return
      }

      onSuccess(); onClose()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        className="dialog-panel"
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '0.5px solid var(--color-border)' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {mode === 'add' ? 'Add US stock' : 'Edit US stock'}
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Row 1: Ticker + Exchange */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={labelStyle}>Ticker</div>
              <div style={{ position: 'relative' }}>
                <input
                  ref={firstFocusRef}
                  value={tickerQuery}
                  onChange={e => handleTickerChange(e.target.value)}
                  onKeyDown={handleTickerKeyDown}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  onFocus={() => { if (searchResults.length > 0 && mode === 'add') setDropdownOpen(true) }}
                  placeholder={mode === 'add' ? 'Search ticker…' : undefined}
                  style={{ ...inputStyle, paddingRight: '32px', textTransform: 'uppercase' }}
                  readOnly={mode === 'edit'}
                />
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', lineHeight: 0 }}>
                  {searchLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
                </div>
              </div>
              {errors.ticker && <div style={errText}>{errors.ticker}</div>}

              {/* Dropdown */}
              {dropdownOpen && mode === 'add' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100, background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--color-text-muted)' }}>No matches found</div>
                  ) : searchResults.map((r, i) => (
                    <div
                      key={r.ticker}
                      onMouseDown={() => selectResult(r)}
                      onMouseEnter={() => setHighlightedIdx(i)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px',
                        background: i === highlightedIdx ? 'var(--color-surface-raised)' : 'transparent',
                        cursor: 'pointer',
                        borderBottom: i < searchResults.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.ticker}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{r.name}</div>
                      </div>
                      <div style={{ fontSize: '10px', padding: '2px 7px', background: 'var(--color-surface-raised)', border: '0.5px solid var(--color-border)', borderRadius: '999px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                        {r.exchange}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '130px', flexShrink: 0 }}>
              <div style={labelStyle}>Exchange</div>
              <select
                value={exchange}
                onChange={e => setExchange(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                disabled={mode === 'edit'}
              >
                <option value="NASDAQ">NASDAQ</option>
                <option value="NYSE">NYSE</option>
                <option value="AMEX">AMEX</option>
              </select>
            </div>
          </div>

          {/* Row 2: Company name */}
          <div>
            <div style={labelStyle}>Company name</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Auto-filled from search"
              style={inputStyle}
            />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', marginTop: '2px' }} />

          {/* Row 3: Date + Qty + Avg Price USD */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {mode === 'add' && (
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Date</div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ ...inputStyle, colorScheme: 'light dark' }}
                />
                {errors.date && <div style={errText}>{errors.date}</div>}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Quantity</div>
              <input
                type="number" min="0" step="any"
                value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
              />
              {errors.quantity && <div style={errText}>{errors.quantity}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Avg price (USD)</div>
              <input
                type="number" min="0" step="any"
                value={avgPriceUSD} onChange={e => setAvgPrice(e.target.value)}
                placeholder="0.00"
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
              />
              {errors.avgPrice && <div style={errText}>{errors.avgPrice}</div>}
            </div>
          </div>

          {/* Row 4: Exchange rate */}
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Exchange rate (₹ per $)</div>
            <input
              type="number" min="0" step="any"
              value={exchangeRate} onChange={e => setRate(e.target.value)}
              placeholder={rateLoading ? 'Fetching…' : '84'}
              style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
            />
            {errors.rate && <div style={errText}>{errors.rate}</div>}
            {!errors.rate && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                {rateLoading ? 'Fetching live rate…' : exchangeRate ? `Live rate: ₹${exchangeRate}/USD` : ''}
              </div>
            )}
          </div>

          {/* Live total pill */}
          {totalUSD > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '999px', padding: '5px 14px', fontSize: '12.5px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total invested:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatUSD(totalUSD)}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> · ≈ </span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatINR(totalINR)}</span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                Current USD price fetched automatically.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          {submitError && <span style={{ fontSize: '12px', color: 'var(--color-loss)', flex: 1 }}>{submitError}</span>}
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: submitting ? 'var(--color-text-muted)' : 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontFamily: 'inherit', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {submitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Saving…' : mode === 'add' ? 'Add stock' : 'Save changes'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const errText: React.CSSProperties = { fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px' }
