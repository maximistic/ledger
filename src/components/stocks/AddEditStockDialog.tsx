'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  // Hide Prisma internals and raw stack traces
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200) {
    return 'Something went wrong. Please try again.'
  }
  return msg
}

interface StockResult {
  ticker: string
  name: string
  exchange: string
  sector: string
}

interface Stock {
  id: string
  ticker: string
  name: string
  exchange: string
  sector?: string | null
  quantity: number
  avgPrice: number
  currentPrice: number
  investedValue: number
  currentValue: number
}

interface Props {
  mode: 'add' | 'edit'
  stock?: Stock
  onClose: () => void
  onSuccess: () => void
}

const label: React.CSSProperties = {
  fontSize: '10.5px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: '5px',
}

const inputStyle: React.CSSProperties = {
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

const errorText: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-loss)',
  marginTop: '3px',
}

export default function AddEditStockDialog({ mode, stock, onClose, onSuccess }: Props) {
  // Ticker autocomplete
  const [tickerQuery, setTickerQuery] = useState(stock?.ticker ?? '')
  const [searchResults, setSearchResults] = useState<StockResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Fields
  const [exchange, setExchange] = useState(stock?.exchange ?? 'NSE')
  const [name, setName] = useState(stock?.name ?? '')
  const [sector, setSector] = useState(stock?.sector ?? '')
  const [date, setDate] = useState('')
  const [quantity, setQuantity] = useState(stock ? String(stock.quantity) : '')
  const [avgPrice, setAvgPrice] = useState(stock ? String(stock.avgPrice) : '')

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const firstFocusRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFocusRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setDropdownOpen(false); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as { results: StockResult[] }
      setSearchResults(data.results ?? [])
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
    if (mode === 'add') {
      searchTimeout.current = setTimeout(() => doSearch(val), 300)
    }
  }

  function selectResult(r: StockResult) {
    setTickerQuery(r.ticker)
    setName(r.name)
    setSector(r.sector ?? '')
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

  const qty = parseFloat(quantity) || 0
  const price = parseFloat(avgPrice) || 0
  const totalInvested = qty * price

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!tickerQuery.trim()) errs.ticker = 'Ticker is required'
    if (!quantity.trim() || qty <= 0) errs.quantity = 'Must be > 0'
    if (!avgPrice.trim() || price <= 0) errs.avgPrice = 'Must be > 0'
    if (mode === 'add') {
      if (!date) errs.date = 'Date is required'
      else if (new Date(date) > new Date()) errs.date = 'Cannot be in the future'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const payload: Record<string, unknown> = {
        ticker:   tickerQuery.trim().toUpperCase(),
        name:     name.trim() || tickerQuery.trim().toUpperCase(),
        exchange,
        sector:   sector.trim() || null,
        quantity: qty,
        avgPrice: price,
      }

      if (mode === 'add' && date) payload.purchaseDate = date

      const url    = mode === 'add' ? '/api/stocks' : `/api/stocks/${stock!.id}`
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

      onSuccess()
      onClose()
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
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="dialog-panel"
        style={{
          background: 'var(--color-bg)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 16px',
          borderBottom: '0.5px solid var(--color-border)',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {mode === 'add' ? 'Add stock' : 'Edit stock'}
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Row 1: Ticker + Exchange */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={label}>Ticker</div>
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
              {errors.ticker && <div style={errorText}>{errors.ticker}</div>}

              {/* Dropdown */}
              {dropdownOpen && mode === 'add' && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100,
                  background: 'var(--color-surface)',
                  border: '0.5px solid var(--color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  overflow: 'hidden',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      No matches found
                    </div>
                  ) : searchResults.map((r, i) => (
                    <div
                      key={r.ticker}
                      onMouseDown={() => selectResult(r)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px',
                        background: i === highlightedIdx ? 'var(--color-surface-raised)' : 'transparent',
                        cursor: 'pointer',
                        borderBottom: i < searchResults.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none',
                      }}
                      onMouseEnter={() => setHighlightedIdx(i)}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.ticker}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{r.name}</div>
                      </div>
                      {r.sector && (
                        <div style={{
                          fontSize: '10px', padding: '2px 7px',
                          background: 'var(--color-surface-raised)',
                          border: '0.5px solid var(--color-border)',
                          borderRadius: '999px',
                          color: 'var(--color-text-muted)',
                          whiteSpace: 'nowrap',
                          marginLeft: '8px',
                        }}>
                          {r.sector}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '120px', flexShrink: 0 }}>
              <div style={label}>Exchange</div>
              <select
                value={exchange}
                onChange={e => setExchange(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                disabled={mode === 'edit'}
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
                <option value="US">US</option>
              </select>
            </div>
          </div>

          {/* Row 2: Name + Sector */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Company name</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Auto-filled from search"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={label}>Sector <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={sector}
                onChange={e => setSector(e.target.value)}
                placeholder="e.g. Technology"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', marginTop: '2px' }} />

          {/* Row 3: Date + Qty + Price */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {mode === 'add' && (
              <div style={{ flex: 1 }}>
                <div style={label}>Date of purchase</div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ ...inputStyle, colorScheme: 'light dark' }}
                />
                {errors.date && <div style={errorText}>{errors.date}</div>}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={label}>Quantity</div>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
              />
              {errors.quantity && <div style={errorText}>{errors.quantity}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={label}>Avg buy price</div>
              <input
                type="number"
                min="0"
                step="any"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                placeholder="0.00"
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
              />
              {errors.avgPrice && <div style={errorText}>{errors.avgPrice}</div>}
            </div>
          </div>

          {/* Total invested pill */}
          {totalInvested > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRadius: '999px',
                padding: '5px 14px',
                fontSize: '12.5px',
                color: 'var(--color-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total invested:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatINR(totalInvested)}</span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                Current price fetched automatically after saving.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '0.5px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
        }}>
          {submitError && (
            <span style={{ fontSize: '12px', color: 'var(--color-loss)', flex: 1 }}>{submitError}</span>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: '6px',
              border: '0.5px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '7px 18px', borderRadius: '6px',
              border: 'none',
              background: submitting ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              color: 'var(--color-surface)',
              fontSize: '13px', fontFamily: 'inherit', cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {submitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Saving…' : mode === 'add' ? 'Add stock' : 'Save changes'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
