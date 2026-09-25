'use client'

import type { UpcomingEvents } from './types'
import { card, SK, TITLE_STYLE, formatINR, eventDotColor, eventTypeLabel } from './shared'

interface Props {
  upcoming: UpcomingEvents | null
  loading:  boolean
}

export default function UpcomingEventsCard({ upcoming, loading }: Props) {
  return (
    <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '14px', animationDelay: '270ms' }}>
      <div style={TITLE_STYLE}>Upcoming</div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ ...SK, height: 36, borderRadius: '8px' }} />)}
        </div>
      ) : !upcoming?.events?.length ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px 0' }}>
          No upcoming events in the next 90 days
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {upcoming.events.slice(0, 6).map((ev) => {
            const isUrgent = ev.urgency === 'HIGH'
            const dot      = eventDotColor(ev)
            const typeText = eventTypeLabel(ev)
            const evDate   = new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '9px', background: isUrgent ? '#FFF5F5' : 'var(--color-surface-raised)', border: `0.5px solid ${isUrgent ? '#FECDD3' : 'var(--color-border)'}` }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{typeText}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isUrgent ? '#DC2626' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatINR(ev.amount)}
                  </div>
                  <div style={{ fontSize: '11px', color: isUrgent ? '#DC2626' : 'var(--color-text-muted)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>
                    {evDate}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
