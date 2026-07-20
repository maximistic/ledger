'use client'

import { useState, useEffect } from 'react'

interface CustomClassXIRR {
  id:   string
  name: string
  xirr: number | null
}

interface XIRRData {
  overall:       number | null
  stocks:        number | null
  mf:            number | null
  epf:           number | null
  fd:            number | null
  rd:            number | null
  us:            number | null
  customClasses?: CustomClassXIRR[]
}

const SK: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

function xirrColor(val: number | null): string {
  if (val === null) return 'var(--color-text-muted)'
  if (val > 12) return 'var(--color-gain)'
  if (val > 8)  return '#D97706'
  if (val > 0)  return 'var(--color-text-primary)'
  return 'var(--color-loss)'
}

function xirrSublabel(val: number | null): string {
  if (val === null) return 'Not enough data'
  if (val > 12) return 'Above benchmark'
  if (val > 8)  return 'Above inflation'
  if (val > 0)  return 'Positive returns'
  return 'Negative returns'
}

function formatXIRR(val: number | null): string {
  if (val === null) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

const ASSET_CLASSES: Array<{ key: keyof Omit<XIRRData, 'overall' | 'customClasses'>; label: string }> = [
  { key: 'stocks', label: 'Stocks' },
  { key: 'mf',     label: 'Mutual Funds' },
  { key: 'epf',    label: 'EPF' },
  { key: 'fd',     label: 'Fixed Deposits' },
  { key: 'rd',     label: 'Recurring Deposits' },
  { key: 'us',     label: 'International' },
]

export default function XIRRSection() {
  const [data,    setData]    = useState<XIRRData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/reports/xirr')
        if (res.ok) setData(await res.json() as XIRRData)
      } catch (err) {
        console.error('Failed to load XIRR data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Overall XIRR card */}
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px', padding: '28px 28px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ ...SK, height: 13, width: 100 }} />
            <div style={{ ...SK, height: 52, width: 220, borderRadius: '6px' }} />
            <div style={{ ...SK, height: 13, width: 280 }} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px' }}>
              Overall XIRR
            </div>
            <div style={{ fontSize: '44px', fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1, color: xirrColor(data?.overall ?? null), fontVariantNumeric: 'tabular-nums', marginBottom: '8px' }}>
              {formatXIRR(data?.overall ?? null)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Annualised return across all investments
            </div>
          </>
        )}
      </div>

      {/* Per-asset-class grid */}
      <div className="xirr-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {ASSET_CLASSES.map(({ key, label }) => {
          const val   = data?.[key] ?? null
          const color = xirrColor(val)
          return (
            <div key={key} style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', padding: '16px 18px' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ ...SK, height: 11, width: 80 }} />
                  <div style={{ ...SK, height: 26, width: 100, borderRadius: '4px' }} />
                  <div style={{ ...SK, height: 11, width: 110 }} />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', color, fontVariantNumeric: 'tabular-nums', marginBottom: '3px' }}>
                    {formatXIRR(val)}
                  </div>
                  <div style={{ fontSize: '11.5px', color }}>
                    {xirrSublabel(val)}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {(data?.customClasses ?? []).map(cc => {
          const val   = cc.xirr
          const color = xirrColor(val)
          return (
            <div key={cc.id} style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', padding: '16px 18px' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ ...SK, height: 11, width: 80 }} />
                  <div style={{ ...SK, height: 26, width: 100, borderRadius: '4px' }} />
                  <div style={{ ...SK, height: 11, width: 110 }} />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                    {cc.name}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', color, fontVariantNumeric: 'tabular-nums', marginBottom: '3px' }}>
                    {formatXIRR(val)}
                  </div>
                  <div style={{ fontSize: '11.5px', color }}>
                    {xirrSublabel(val)}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* About XIRR note */}
      <div style={{ background: 'var(--color-surface-raised)', border: '0.5px solid var(--color-border)', borderRadius: '10px', padding: '14px 18px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
          About XIRR
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          XIRR (Extended Internal Rate of Return) accounts for the timing of each investment. Unlike simple returns, it reflects the actual annualised growth rate given when money was invested. A benchmark of 12% is used for equity comparisons; 8% approximates long-term inflation.
        </div>
      </div>
    </div>
  )
}
