'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CashflowSection   from '@/components/reports/CashflowSection'
import MilestonesSection from '@/components/reports/MilestonesSection'
import SnapshotsSection  from '@/components/reports/SnapshotsSection'
import XIRRSection       from '@/components/reports/XIRRSection'

type ReportSection = 'cashflow' | 'milestones' | 'snapshots' | 'xirr'

const BASE_RAIL: Array<{ key: ReportSection; label: string; sub: string }> = [
  { key: 'cashflow',   label: 'CASHFLOW',   sub: 'Monthly analysis' },
  { key: 'milestones', label: 'MILESTONES', sub: 'Track your goals' },
  { key: 'snapshots',  label: 'SNAPSHOTS',  sub: 'Net worth history' },
  { key: 'xirr',       label: 'XIRR',       sub: 'Annualised returns' },
]

const SECTION_META: Record<ReportSection, { title: string; subtitle: string }> = {
  cashflow:   { title: 'Monthly cashflow',   subtitle: 'All investments made across your portfolio' },
  milestones: { title: 'Milestones',         subtitle: 'Track and celebrate your financial goals' },
  snapshots:  { title: 'Snapshots',          subtitle: 'Your net worth history over time' },
  xirr:       { title: 'XIRR',              subtitle: 'Annualised returns by asset class' },
}

function ReportsContent() {
  const [activeSection, setActiveSection] = useState<ReportSection>('cashflow')
  const [subOverrides,  setSubOverrides]  = useState<Partial<Record<ReportSection, string>>>({})
  const searchParams = useSearchParams()

  const cashflowMonth = searchParams.get('month') ?? undefined

  useEffect(() => {
    const section = searchParams.get('section')
    if (section) setActiveSection(section as ReportSection)
  }, [searchParams])

  const onMilestoneLoaded = useCallback((sub: string) => {
    setSubOverrides(prev => ({ ...prev, milestones: sub }))
  }, [])

  const onSnapshotLoaded = useCallback((sub: string) => {
    setSubOverrides(prev => ({ ...prev, snapshots: sub }))
  }, [])

  const RAIL = BASE_RAIL.map(item => ({
    ...item,
    sub: subOverrides[item.key] ?? item.sub,
  }))

  const { title, subtitle } = SECTION_META[activeSection]

  return (
    <>
      {/* Mobile tab strip */}
      <div className="settings-mobile-tabs mobile-page-chips hide-scrollbar">
        {RAIL.map(({ key, label }) => {
          const active = activeSection === key
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontFamily: 'inherit',
                fontWeight: active ? 600 : 400,
                border: active ? '1.5px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                background: active ? 'var(--color-text-primary)' : 'var(--color-surface)',
                color: active ? 'var(--color-surface)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 140ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {label.charAt(0) + label.slice(1).toLowerCase()}
            </button>
          )
        })}
      </div>

      <div className="page-layout" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* Left rail */}
        <div className="assets-rail page-rail-col" style={{ width: '190px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {RAIL.map(({ key, label, sub }) => {
            const active = activeSection === key
            return (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  textAlign: 'left',
                  background: 'var(--color-surface)',
                  border: '0.5px solid var(--color-border)',
                  borderRight: `2px solid ${active ? 'var(--color-text-primary)' : 'transparent'}`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-right-color 140ms ease',
                }}
              >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                  {label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{sub}</div>
              </button>
            )
          })}
        </div>

        {/* Right content */}
        <div className="page-content-col" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}>
              {title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{subtitle}</div>
          </div>

          {activeSection === 'cashflow'   && <CashflowSection initialMonth={cashflowMonth} />}
          {activeSection === 'milestones' && <MilestonesSection onLoaded={onMilestoneLoaded} />}
          {activeSection === 'snapshots'  && <SnapshotsSection  onLoaded={onSnapshotLoaded}  />}
          {activeSection === 'xirr'       && <XIRRSection />}
        </div>
      </div>
    </>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsContent />
    </Suspense>
  )
}
