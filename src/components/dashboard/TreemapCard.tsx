'use client'

import type { DashboardSummary } from './types'
import { card, SK, formatShort } from './shared'

interface Props {
  summary: DashboardSummary | null
  loading: boolean
}

const DEFS = [
  { key: 'equity'        as const, label: 'EQUITY', bg: 'var(--color-treemap-equity-bg)', textColor: 'var(--color-treemap-equity-text)', labelColor: 'var(--color-treemap-equity-text)' },
  { key: 'debt'          as const, label: 'DEBT',   bg: 'var(--color-treemap-debt-bg)',   textColor: 'var(--color-treemap-debt-text)',   labelColor: 'var(--color-treemap-debt-text)'   },
  { key: 'gold'          as const, label: 'GOLD',   bg: 'var(--color-treemap-gold-bg)',   textColor: 'var(--color-treemap-gold-text)',   labelColor: 'var(--color-treemap-gold-text)'   },
  { key: 'international' as const, label: 'INTL',   bg: 'var(--color-treemap-intl-bg)',   textColor: 'var(--color-treemap-intl-text)',   labelColor: 'var(--color-treemap-intl-text)'   },
]

export default function TreemapCard({ summary, loading }: Props) {
  const segments = summary?.riskProfile
    ? DEFS
        .map(d => ({ ...d, pct: summary.riskProfile[d.key].pct, value: summary.riskProfile[d.key].value }))
        .filter(s => s.pct > 0)
        .sort((a, b) => b.pct - a.pct)
    : null

  return (
    <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '150ms' }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '14px' }}>
        Equity · Debt · Gold · Intl
      </div>
      {loading || !segments ? (
        <div style={{ display: 'grid', gridTemplateColumns: '68fr 32fr', gridTemplateRows: '1fr 1fr', gap: '5px', height: '168px' }}>
          <div style={{ ...SK, gridRow: '1 / 3', borderRadius: '9px' }} />
          <div style={{ ...SK, borderRadius: '9px' }} />
          <div style={{ ...SK, borderRadius: '9px' }} />
        </div>
      ) : segments.length === 0 ? (
        <div style={{ height: '168px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          No data
        </div>
      ) : (() => {
        const [dominant, ...rest] = segments
        const domFs = dominant.pct >= 50 ? '32px' : dominant.pct >= 25 ? '26px' : '20px'
        return (
          <div style={{
            display:             'grid',
            gridTemplateColumns: rest.length === 0 ? '1fr' : `${dominant.pct}fr ${100 - dominant.pct}fr`,
            gap:                 '5px',
            height:              '168px',
          }}>
            <div className="treemap-block" style={{ background: dominant.bg, borderRadius: '9px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: dominant.labelColor, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{dominant.label}</span>
              <div>
                <div className="treemap-pct" style={{ fontSize: domFs, fontWeight: 700, color: dominant.textColor, letterSpacing: '-1px', lineHeight: 1 }}>{dominant.pct}%</div>
                <div style={{ fontSize: '12px', color: dominant.labelColor, marginTop: '4px' }}>{formatShort(dominant.value)}</div>
              </div>
            </div>
            {rest.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {rest.length <= 2 ? (
                  rest.map(s => {
                    const fs = s.pct >= 20 ? '20px' : s.pct >= 10 ? '16px' : '13px'
                    return (
                      <div key={s.key} style={{ flex: 1, background: s.bg, borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '9.5px', color: s.labelColor, textTransform: 'uppercase' }}>{s.label}</span>
                        <div>
                          <div style={{ fontSize: fs, fontWeight: 700, color: s.textColor, lineHeight: 1 }}>{s.pct}%</div>
                          <div style={{ fontSize: '10px', color: s.labelColor, marginTop: '1px' }}>{formatShort(s.value)}</div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <>
                    {rest.slice(0, 1).map(s => {
                      const fs = s.pct >= 20 ? '20px' : s.pct >= 10 ? '16px' : '13px'
                      return (
                        <div key={s.key} style={{ flex: 1, background: s.bg, borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '9.5px', color: s.labelColor, textTransform: 'uppercase' }}>{s.label}</span>
                          <div>
                            <div style={{ fontSize: fs, fontWeight: 700, color: s.textColor, lineHeight: 1 }}>{s.pct}%</div>
                            <div style={{ fontSize: '10px', color: s.labelColor, marginTop: '1px' }}>{formatShort(s.value)}</div>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                      {rest.slice(1).map(s => {
                        const fs = s.pct >= 20 ? '20px' : s.pct >= 10 ? '16px' : '13px'
                        return (
                          <div key={s.key} style={{ background: s.bg, borderRadius: '9px', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '8.5px', color: s.labelColor, textTransform: 'uppercase' }}>{s.label}</span>
                            <div>
                              <div style={{ fontSize: fs, fontWeight: 700, color: s.textColor, lineHeight: 1 }}>{s.pct}%</div>
                              <div style={{ fontSize: '9px', color: s.labelColor, marginTop: '1px' }}>{formatShort(s.value)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
