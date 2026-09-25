'use client'

import { useRouter } from 'next/navigation'
import { Flag, Check, Plus } from 'lucide-react'
import type { Milestone } from './types'
import { card, SK, TITLE_STYLE, formatShort, formatMilestoneDate } from './shared'

interface Props {
  milestones: Milestone[]
  loading:    boolean
}

export default function MilestonesCard({ milestones, loading }: Props) {
  const router = useRouter()

  return (
    <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '0', animationDelay: '300ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ ...TITLE_STYLE, marginBottom: 0 }}>Milestones</div>
        <button
          onClick={() => router.push('/reports?section=milestones')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontFamily: 'inherit' }}
        >
          <Plus size={13} color="var(--color-text-muted)" />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Add goal</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ ...SK, height: 14, width: '55%' }} />
              <div style={{ ...SK, height: 5, borderRadius: '3px' }} />
            </div>
          ))}
        </div>
      ) : milestones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <Flag size={24} color="var(--color-text-muted)" />
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            No goals set ·{' '}
            <button
              onClick={() => router.push('/settings')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'inherit', textDecoration: 'underline' }}
            >
              Add milestones in Settings
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {milestones.map(m => {
            const sub = m.isAchieved
              ? `Achieved · ${formatMilestoneDate(m.achievedDate)}`
              : m.progressPct > 0
                ? `${formatShort(m.amountAway)} away · ${m.progressPct}% there`
                : 'Not started yet'
            return (
              <div key={m.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: m.isAchieved ? 'var(--color-text-primary)' : 'var(--color-surface-raised)', border: m.isAchieved ? 'none' : '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.isAchieved
                        ? <Check size={11} color="var(--btn-primary-text)" strokeWidth={2.5} />
                        : <Flag  size={11} color="var(--color-text-muted)" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.title}</div>
                      <div className={m.isAchieved ? 'milestone-text-achieved' : 'milestone-text-progress'} style={{ fontSize: '11px', marginTop: '1px' }}>{sub}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0, marginLeft: '16px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatShort(m.targetAmount)}
                  </div>
                </div>
                <div style={{ height: '4px', background: 'var(--color-surface-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div className={m.isAchieved ? 'milestone-bar-achieved' : 'milestone-bar-progress'} style={{ height: '100%', width: `${m.progressPct}%`, borderRadius: '2px', transition: 'width 600ms ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
