'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { MFItem } from './MutualFundsTab'

interface SearchResult {
  amfiCode: string; schemeName: string; fundHouse: string
}

interface Props {
  mode: 'add' | 'edit'
  fund?: MFItem
  onClose: () => void
  onSuccess: () => void
}

const PLATFORMS = ['Groww', 'Zerodha Coin', 'Kuvera', 'MFCentral', 'Direct (AMC)', 'INDmoney', 'Other']

const labelStyle: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13px', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const errStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px',
}

export default function AddEditFundDialog({ mode, fund, onClose, onSuccess }: Props) {
  // Fund identity
  const [searchQuery, setSearchQuery]   = useState(fund?.name ?? '')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown]   = useState(false)
  const [amfiCode, setAmfiCode]         = useState(fund?.amfiCode ?? '')
  const [name, setName]                 = useState(fund?.name ?? '')
  const [platform, setPlatform]         = useState(fund?.platform ?? '')
  const [fundHouse, setFundHouse]       = useState(fund?.fundHouse ?? '')
  const [fundCategory, setFundCategory] = useState(fund?.fundCategory ?? '')
  const [isin, setIsin]                 = useState(fund?.isin ?? '')
  const [folioNumber, setFolioNumber]   = useState(fund?.folioNumber ?? '')

  // Numerics
  const [units, setUnits]               = useState(fund ? String(fund.units) : '')
  const [avgNav, setAvgNav]             = useState(fund ? String(fund.avgNav) : '')
  const [investedValue, setInvestedValue] = useState(fund ? String(fund.investedValue) : '')

  // Date
  const [firstDate, setFirstDate] = useState(
    fund?.firstInvestmentDate
      ? new Date(fund.firstInvestmentDate).toISOString().split('T')[0]
      : ''
  )

  // UI state
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounced search
  useEffect(() => {
    if (mode === 'edit') return
    clearTimeout(debounceRef.current)
    const q = searchQuery.trim()
    if (!q || q === name) { setSearchResults([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mf/search?q=${encodeURIComponent(q)}`)
        const data = await res.json() as { results?: SearchResult[] }
        setSearchResults(data.results ?? [])
        setShowDropdown(true)
      } catch (err) {
        console.error('search error:', err)
      }
    }, 400)
  }, [searchQuery, mode, name])

  function selectResult(r: SearchResult) {
    setSearchQuery(r.schemeName)
    setName(r.schemeName)
    setAmfiCode(r.amfiCode)
    setFundHouse(r.fundHouse)
    setShowDropdown(false)

    // Background metadata fetch
    fetch(`https://api.mfapi.in/mf/${r.amfiCode}`)
      .then(res => res.json() as Promise<{ meta?: { fund_house?: string; scheme_category?: string } }>)
      .then(data => {
        if (data?.meta?.fund_house) setFundHouse(data.meta.fund_house)
        if (data?.meta?.scheme_category) setFundCategory(data.meta.scheme_category)
      })
      .catch(() => {})
  }

  function recalculate(changed: 'units' | 'avgNav' | 'invested', value: string) {
    const u   = parseFloat(units)
    const n   = parseFloat(avgNav)

    if (changed === 'units') {
      const newU = parseFloat(value)
      if (Number.isFinite(newU) && Number.isFinite(n) && n > 0)
        setInvestedValue((newU * n).toFixed(2))
      setUnits(value)
    } else if (changed === 'avgNav') {
      const newN = parseFloat(value)
      if (Number.isFinite(newN) && Number.isFinite(u) && u > 0)
        setInvestedValue((u * newN).toFixed(2))
      setAvgNav(value)
    } else {
      const newInv = parseFloat(value)
      if (Number.isFinite(newInv) && Number.isFinite(n) && n > 0)
        setUnits((newInv / n).toFixed(4))
      setInvestedValue(value)
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name required'
    const u = parseFloat(units)
    if (!Number.isFinite(u) || u <= 0) errs.units = 'Must be > 0'
    const n = parseFloat(avgNav)
    if (!Number.isFinite(n) || n <= 0) errs.avgNav = 'Must be > 0'
    const inv = parseFloat(investedValue)
    if (!Number.isFinite(inv) || inv <= 0) errs.investedValue = 'Must be > 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true); setSubmitError('')

    const body = {
      name: name.trim(),
      amfiCode:             amfiCode || undefined,
      isin:                 isin || undefined,
      folioNumber:          folioNumber || undefined,
      platform:             platform || undefined,
      fundHouse:            fundHouse || undefined,
      fundCategory:         fundCategory || undefined,
      units:                parseFloat(units),
      avgNav:               parseFloat(avgNav),
      investedValue:        parseFloat(investedValue),
      firstInvestmentDate:  firstDate || undefined,
      source:               'MANUAL',
    }

    try {
      const url    = mode === 'add' ? '/api/mf' : `/api/mf/${fund!.id}`
      const method = mode === 'add' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setSubmitError(data.error ?? 'Something went wrong.')
        return
      }
      onSuccess()
      onClose()
      // Second refresh after background NAV fetch completes
      if (mode === 'add') setTimeout(onSuccess, 12000)
    } catch (err) {
      console.error('handleSubmit error:', err)
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        className="dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)', borderRadius: '12px',
          width: '100%', maxWidth: '560px', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '18px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {mode === 'add' ? 'Add fund' : 'Edit fund'}
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Row 1: Fund search + Platform */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            {/* Fund search */}
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={labelStyle}>{mode === 'edit' ? 'Fund name' : 'Search fund'}</div>
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Type to search fund…"
                disabled={mode === 'edit'}
                style={{ ...inputStyle, opacity: mode === 'edit' ? 0.7 : 1 }}
              />
              {errors.name && <div style={errStyle}>{errors.name}</div>}
              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--color-bg)', border: '0.5px solid var(--color-border)',
                  borderRadius: '8px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', marginTop: '2px',
                }}>
                  {searchResults.map(r => (
                    <div
                      key={r.amfiCode}
                      onMouseDown={() => selectResult(r)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                        color: 'var(--color-text-primary)',
                        borderBottom: '0.5px solid var(--color-border-subtle)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 500 }}>{r.schemeName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{r.fundHouse}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Platform */}
            <div style={{ width: '140px' }}>
              <div style={labelStyle}>Platform</div>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Select…</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Name + Fund house */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Fund name</div>
              <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }} style={inputStyle} placeholder="Full fund name" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Fund house</div>
              <input value={fundHouse} onChange={e => setFundHouse(e.target.value)} style={inputStyle} placeholder="e.g. HDFC Mutual Fund" />
            </div>
          </div>

          {/* Row 3: Category + ISIN */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Category</div>
              <input value={fundCategory} onChange={e => setFundCategory(e.target.value)} style={inputStyle} placeholder="e.g. Equity - Large Cap" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>ISIN (optional)</div>
              <input value={isin} onChange={e => setIsin(e.target.value)} style={inputStyle} placeholder="e.g. INF090I01239" />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', margin: '4px 0 14px' }} />

          {/* Row 4: Units + Avg NAV + Invested */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '4px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Units</div>
              <input
                type="number" min="0" step="any" value={units}
                onChange={e => { recalculate('units', e.target.value); setErrors(p => ({ ...p, units: '' })) }}
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                placeholder="0"
              />
              {errors.units && <div style={errStyle}>{errors.units}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Avg NAV (₹)</div>
              <input
                type="number" min="0" step="any" value={avgNav}
                onChange={e => { recalculate('avgNav', e.target.value); setErrors(p => ({ ...p, avgNav: '' })) }}
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                placeholder="0.00"
              />
              {errors.avgNav && <div style={errStyle}>{errors.avgNav}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Invested (₹)</div>
              <input
                type="number" min="0" step="any" value={investedValue}
                onChange={e => { recalculate('invested', e.target.value); setErrors(p => ({ ...p, investedValue: '' })) }}
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                placeholder="0.00"
              />
              {errors.investedValue && <div style={errStyle}>{errors.investedValue}</div>}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Any two fields auto-calculate the third
          </div>

          {/* Row 5: Folio + Date */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Folio number (optional)</div>
              <input value={folioNumber} onChange={e => setFolioNumber(e.target.value)} style={inputStyle} placeholder="e.g. 1234567890" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>First investment date</div>
              <input
                type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'light dark' }}
              />
            </div>
          </div>

          {submitError && (
            <div style={{ background: '#FFF5F5', border: '0.5px solid #FECDD3', borderRadius: '8px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', marginBottom: '4px' }}>
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, borderTop: '0.5px solid var(--color-border)',
          padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: '8px',
        }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: submitting ? 0.7 : 1 }}
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
