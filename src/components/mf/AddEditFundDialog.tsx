'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X, Search } from 'lucide-react'
import { formatINR } from '@/lib/utils'

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

interface MFItem {
  id: string; name: string; isin: string | null; folioNumber: string | null
  amfiCode: string | null; platform: string | null; fundHouse: string | null
  fundCategory: string | null; expenseRatio: number | null; exitLoad: string | null
  units: number; avgNav: number; currentNav: number
  investedValue: number; currentValue: number
}

interface Props {
  mode: 'add' | 'edit'
  fund?: MFItem
  onClose: () => void
  onSuccess: () => void
}

interface SearchResult {
  amfiCode: string
  schemeName: string
  fundHouse: string
}

const fieldLabel: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px',
}
const fieldInput: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13.5px', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none',
}
const errText: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px',
}
const ghostBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '7px 18px', borderRadius: '6px', border: 'none',
  background: 'var(--color-text-primary)', color: 'var(--color-surface)',
  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
}

const PLATFORMS = ['Groww', 'Zerodha Coin', 'Kuvera', 'INDmoney', 'MFCentral', 'Direct (AMC)', 'Other']

export default function AddEditFundDialog({ mode, fund, onClose, onSuccess }: Props) {
  // Fund search
  const [fundQuery, setFundQuery] = useState(fund?.name ?? '')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Fields
  const [name, setName] = useState(fund?.name ?? '')
  const [amfiCode, setAmfiCode] = useState(fund?.amfiCode ?? '')
  const [fundHouse, setFundHouse] = useState(fund?.fundHouse ?? '')
  const [fundCategory, setFundCategory] = useState(fund?.fundCategory ?? '')
  const [isin, setIsin] = useState(fund?.isin ?? '')
  const [platform, setPlatform] = useState(fund?.platform ?? '')
  const [folioNumber, setFolioNumber] = useState(fund?.folioNumber ?? '')
  const [units, setUnits] = useState(fund ? String(fund.units) : '')
  const [avgNav, setAvgNav] = useState(fund ? String(fund.avgNav) : '')
  const [invested, setInvested] = useState(fund ? String(fund.investedValue) : '')
  const [ivManuallyEdited, setIvManuallyEdited] = useState(false)
  const [date, setDate] = useState('')

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  // Auto-calculate invested value when units or avgNav change (unless manually edited)
  useEffect(() => {
    if (ivManuallyEdited) return
    const u = parseFloat(units) || 0
    const n = parseFloat(avgNav) || 0
    if (u > 0 && n > 0) {
      setInvested(String(parseFloat((u * n).toFixed(4))))
    } else {
      setInvested('')
    }
  }, [units, avgNav, ivManuallyEdited])

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setDropdownOpen(false); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/mf/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as { results: SearchResult[] }
      setSearchResults(data.results ?? [])
      setDropdownOpen(true)
      setHighlightedIdx(0)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function handleFundQueryChange(val: string) {
    setFundQuery(val)
    setName(val)
    clearTimeout(searchTimeout.current)
    if (mode === 'add') {
      searchTimeout.current = setTimeout(() => doSearch(val), 300)
    }
  }

  async function selectResult(r: SearchResult) {
    setFundQuery(r.schemeName)
    setName(r.schemeName)
    setAmfiCode(r.amfiCode)
    setFundHouse(r.fundHouse)
    setDropdownOpen(false)
    setErrors(prev => ({ ...prev, name: '' }))
    console.log('Fund selected:', { name: r.schemeName, amfiCode: r.amfiCode, fundHouse: r.fundHouse })
    // Fetch full metadata in background — auto-fill category
    try {
      const metaRes = await fetch(
        `https://api.mfapi.in/mf/${r.amfiCode}`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (metaRes.ok) {
        const metaData = await metaRes.json() as { meta?: { fund_house?: string; scheme_category?: string } }
        if (metaData.meta?.fund_house) setFundHouse(metaData.meta.fund_house)
        if (metaData.meta?.scheme_category) setFundCategory(metaData.meta.scheme_category)
      }
    } catch {
      // metadata fetch failed — fields stay as manually entered
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!dropdownOpen) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, searchResults.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (searchResults[highlightedIdx]) selectResult(searchResults[highlightedIdx]) }
    if (e.key === 'Escape')    { setDropdownOpen(false) }
  }

  function handleInvestedChange(val: string) {
    setInvested(val)
    setIvManuallyEdited(true)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Fund name is required'
    const u = parseFloat(units)
    if (!units.trim() || isNaN(u) || u <= 0) errs.units = 'Must be > 0'
    const n = parseFloat(avgNav)
    if (!avgNav.trim() || isNaN(n) || n <= 0) errs.avgNav = 'Must be > 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    console.log('Submit called with:', { name, amfiCode, units, avgNav, investedValue: invested })
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        isin: isin.trim() || null,
        folioNumber: folioNumber.trim() || null,
        platform: platform || null,
        amfiCode: amfiCode.trim() || null,
        fundHouse: fundHouse.trim() || null,
        fundCategory: fundCategory.trim() || null,
        units: parseFloat(units),
        avgNav: parseFloat(avgNav),
        investedValue: invested ? parseFloat(invested) : parseFloat(units) * parseFloat(avgNav),
      }

      if (mode === 'add' && date) payload.firstInvestmentDate = date

      const url    = mode === 'add' ? '/api/mf' : `/api/mf/${fund!.id}`
      const method = mode === 'add' ? 'POST' : 'PUT'

      console.log('Making API call to', url)
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

  const u = parseFloat(units) || 0
  const n = parseFloat(avgNav) || 0
  const computedInvested = invested ? parseFloat(invested) : 0

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
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 16px',
          borderBottom: '0.5px solid var(--color-border)',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {mode === 'add' ? 'Add fund' : 'Edit fund'}
          </div>
          <button
            onClick={onClose}
            style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Row 1: Fund search + Platform */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Fund search / name */}
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={fieldLabel}>Fund</div>
              {mode === 'edit' ? (
                <div style={{
                  ...fieldInput,
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-surface-raised)',
                  userSelect: 'none',
                }}>
                  {fund?.name ?? '—'}
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={fundQuery}
                      onChange={e => handleFundQueryChange(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                      onFocus={() => { if (searchResults.length > 0) setDropdownOpen(true) }}
                      placeholder="Search fund name…"
                      style={{ ...fieldInput, paddingRight: '32px' }}
                    />
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', lineHeight: 0 }}>
                      {searchLoading
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Search size={13} />}
                    </div>
                  </div>
                  {errors.name && <div style={errText}>{errors.name}</div>}

                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100,
                      background: 'var(--color-surface)',
                      border: '0.5px solid var(--color-border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)',
                      overflow: 'hidden',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {searchResults.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          No matches found
                        </div>
                      ) : searchResults.map((r, i) => (
                        <div
                          key={r.amfiCode}
                          onMouseDown={() => selectResult(r)}
                          onMouseEnter={() => setHighlightedIdx(i)}
                          style={{
                            padding: '9px 14px',
                            background: i === highlightedIdx ? 'var(--color-surface-raised)' : 'transparent',
                            cursor: 'pointer',
                            borderBottom: i < searchResults.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.schemeName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{r.fundHouse}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Platform select */}
            <div style={{ width: '140px', flexShrink: 0 }}>
              <div style={fieldLabel}>Platform</div>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                style={{ ...fieldInput, cursor: 'pointer' }}
              >
                <option value="">Select…</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Fund name + Fund house */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Fund name</div>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })) }}
                placeholder="Full fund name"
                style={fieldInput}
              />
              {errors.name && <div style={errText}>{errors.name}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Fund house <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={fundHouse}
                onChange={e => setFundHouse(e.target.value)}
                placeholder="Auto-filled from search"
                style={fieldInput}
              />
            </div>
          </div>

          {/* Row 3: Category + ISIN */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Category <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={fundCategory}
                onChange={e => setFundCategory(e.target.value)}
                placeholder="e.g. Large Cap"
                style={fieldInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>ISIN <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={isin}
                onChange={e => setIsin(e.target.value)}
                placeholder="e.g. INF123A01XY5"
                style={fieldInput}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)' }} />

          {/* Row 4: Units + Avg NAV + Invested */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Units</div>
              <input
                type="number"
                min="0"
                step="any"
                value={units}
                onChange={e => { setUnits(e.target.value); setErrors(prev => ({ ...prev, units: '' })) }}
                placeholder="0"
                style={{ ...fieldInput, fontVariantNumeric: 'tabular-nums' }}
              />
              {errors.units && <div style={errText}>{errors.units}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Avg NAV (₹)</div>
              <input
                type="number"
                min="0"
                step="any"
                value={avgNav}
                onChange={e => { setAvgNav(e.target.value); setErrors(prev => ({ ...prev, avgNav: '' })) }}
                placeholder="0.00"
                style={{ ...fieldInput, fontVariantNumeric: 'tabular-nums' }}
              />
              {errors.avgNav && <div style={errText}>{errors.avgNav}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Invested (₹)</div>
              <input
                type="number"
                min="0"
                step="any"
                value={invested}
                onChange={e => handleInvestedChange(e.target.value)}
                placeholder="0.00"
                style={{ ...fieldInput, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
          </div>

          {/* Row 5: Folio + Date */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Folio number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={folioNumber}
                onChange={e => setFolioNumber(e.target.value)}
                placeholder="e.g. 12345678"
                style={fieldInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Date of first investment</div>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                style={{ ...fieldInput, colorScheme: 'light dark' }}
              />
            </div>
          </div>

          {/* Hint */}
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
            Current NAV fetched automatically after saving
          </div>
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
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...primaryBtn,
              background: submitting ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Saving…' : mode === 'add' ? 'Add fund' : 'Save changes'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
