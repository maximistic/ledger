import type { CSSProperties } from 'react'
import type { UpcomingEvent, Visibility, TabKey } from './types'

export const card: CSSProperties = {
  background:   'var(--color-surface)',
  border:       '0.5px solid var(--color-border)',
  borderRadius: '12px',
}

export const TITLE_STYLE: CSSProperties = {
  fontSize:        '11px',
  textTransform:   'uppercase',
  color:           'var(--color-text-muted)',
  letterSpacing:   '0.7px',
  fontWeight:      600,
  marginBottom:    '14px',
}

export const SK: CSSProperties = {
  background:  'var(--color-surface-raised)',
  borderRadius: '6px',
  animation:   'pulse 1.5s ease-in-out infinite',
}

export const DEFAULT_VIS: Visibility = {
  trendCard:      true,
  allocationCard: true,
  treemapCard:    true,
  performersCard: true,
  eventsCard:     true,
  milestonesCard: true,
}

export const TOGGLES: { key: keyof Visibility; label: string; locked: boolean }[] = [
  { key: 'trendCard',      label: 'Net worth trend',         locked: true  },
  { key: 'allocationCard', label: 'Asset allocation',        locked: false },
  { key: 'treemapCard',    label: 'Equity breakdown',        locked: false },
  { key: 'performersCard', label: 'Best & worst performers', locked: false },
  { key: 'eventsCard',     label: 'Upcoming events',         locked: false },
  { key: 'milestonesCard', label: 'Milestones',              locked: false },
]

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                'currency',
    currency:             'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatShort(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`
  if (value >= 100_000)    return `₹${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000)      return `₹${(value / 1_000).toFixed(1)}K`
  return `₹${Math.round(value)}`
}

export function formatMilestoneDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function eventDotColor(ev: UpcomingEvent): string {
  if (ev.type === 'FD_MATURITY')      return ev.urgency === 'HIGH' ? 'var(--color-loss)' : 'var(--color-asset-fdrd)'
  if (ev.type === 'RD_MATURITY')      return 'var(--color-asset-fdrd)'
  if (ev.type === 'RD_INSTALLMENT')   return 'var(--color-asset-fdrd)'
  if (ev.type === 'EPF_CONTRIBUTION') return 'var(--color-asset-epf)'
  if (ev.type === 'SIP')              return 'var(--color-asset-epf)'
  return 'var(--color-text-muted)'
}

export function eventTypeLabel(ev: UpcomingEvent): string {
  if (ev.type === 'FD_MATURITY')      return `FD · ${ev.daysLeft}d`
  if (ev.type === 'RD_MATURITY')      return 'RD maturity'
  if (ev.type === 'RD_INSTALLMENT')   return 'RD'
  if (ev.type === 'EPF_CONTRIBUTION') return 'EPF'
  if (ev.type === 'SIP')              return 'SIP'
  return ev.type
}

export function getChartLabel(date: Date, period: TabKey): string {
  if (period === '1M') return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  if (period === '5Y') return date.toLocaleDateString('en-IN', { year: 'numeric' })
  const showYear = date.getMonth() === 0
  return date.toLocaleDateString('en-IN', { month: 'short', ...(showYear ? { year: '2-digit' } : {}) })
}
