'use client'

import type { Performers } from './types'
import { card, SK, TITLE_STYLE, formatShort } from './shared'

interface Props {
  performers: Performers | null
  loading:    boolean
}

function PerformerRow({ p, isLast, isGainer }: { p: Performers['gainers'][number]; isLast: boolean; isGainer: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--color-surface-raised)', fontSize: '8.5px', fontWeight: 700, color: '#555', overflow: 'hidden', padding: '0 3px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {p.ticker}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name.length > 25 ? p.name.slice(0, 25) + '…' : p.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{p.assetClass}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: isGainer ? 'var(--color-gain)' : 'var(--color-loss)', fontVariantNumeric: 'tabular-nums' }}>
          {isGainer ? '+' : ''}{p.gainLossPct.toFixed(2)}%
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>{formatShort(p.currentValue)}</div>
      </div>
    </div>
  )
}

export default function PerformersCard({ performers, loading }: Props) {
  const skeletonRows = [1, 2, 3].map(i => <div key={i} style={{ ...SK, height: 36, borderRadius: '8px' }} />)

  return (
    <div className="dashboard-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
      <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '210ms' }}>
        <div style={TITLE_STYLE}>Top Performers</div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{skeletonRows}</div>
        ) : !performers?.gainers?.length ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px 0' }}>No positive performers yet</div>
        ) : (
          <div>
            {performers.gainers.map((g, i) => (
              <PerformerRow key={g.ticker} p={g} isLast={i === performers.gainers.length - 1} isGainer={true} />
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '240ms' }}>
        <div style={TITLE_STYLE}>Underperformers</div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{skeletonRows}</div>
        ) : !performers?.losers?.length ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px 0' }}>No underperformers</div>
        ) : (
          <div>
            {performers.losers.map((p, i) => (
              <PerformerRow key={p.ticker} p={p} isLast={i === performers.losers.length - 1} isGainer={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
