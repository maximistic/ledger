'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, LayoutDashboard, Camera, AlertCircle } from 'lucide-react'

import type { DashboardSummary, SnapshotData, Performers, UpcomingEvents, Milestone, TabKey, Visibility } from '@/components/dashboard/types'
import { DEFAULT_VIS, formatINR, SK } from '@/components/dashboard/shared'
import NetWorthTrendCard  from '@/components/dashboard/NetWorthTrendCard'
import AllocationCard     from '@/components/dashboard/AllocationCard'
import TreemapCard        from '@/components/dashboard/TreemapCard'
import PerformersCard     from '@/components/dashboard/PerformersCard'
import UpcomingEventsCard from '@/components/dashboard/UpcomingEventsCard'
import MilestonesCard     from '@/components/dashboard/MilestonesCard'
import CustomiseModal     from '@/components/dashboard/CustomiseModal'

export default function DashboardPage() {
  const [summary,        setSummary]        = useState<DashboardSummary | null>(null)
  const [snapshots,      setSnapshots]      = useState<SnapshotData | null>(null)
  const [performers,     setPerformers]     = useState<Performers | null>(null)
  const [upcoming,       setUpcoming]       = useState<UpcomingEvents | null>(null)
  const [milestones,     setMilestones]     = useState<Milestone[]>([])
  const [loading,        setLoading]        = useState(true)
  const [fetchError,     setFetchError]     = useState<string | null>(null)
  const [activeTab,      setActiveTab]      = useState<TabKey>('1Y')
  const [snapshotToast,  setSnapshotToast]  = useState(false)
  const [takingSnapshot, setTakingSnapshot] = useState(false)
  const [modal,          setModal]          = useState(false)
  const [vis,            setVis]            = useState<Visibility>(DEFAULT_VIS)

  // Restore persisted visibility
  useEffect(() => {
    try {
      const s = localStorage.getItem('ledger-dashboard-visibility')
      if (s) setVis(v => ({ ...v, ...JSON.parse(s) }))
    } catch {}
  }, [])

  // Fetch summary, performers, upcoming, milestones on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const [summaryRes, performersRes, upcomingRes, milestonesRes] = await Promise.all([
          fetch('/api/dashboard/summary'),
          fetch('/api/dashboard/performers'),
          fetch('/api/dashboard/upcoming'),
          fetch('/api/milestones'),
        ])

        if (!summaryRes.ok) {
          const err = await summaryRes.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? `Summary failed (${summaryRes.status})`)
        }

        setSummary(await summaryRes.json())
        if (performersRes.ok) setPerformers(await performersRes.json())
        if (upcomingRes.ok)   setUpcoming(await upcomingRes.json())
        if (milestonesRes.ok) {
          const d = await milestonesRes.json() as { milestones: Milestone[] }
          setMilestones(d.milestones)
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Re-fetch snapshots whenever tab changes
  useEffect(() => {
    const fetchSnapshots = async () => {
      const res = await fetch(`/api/dashboard/snapshot?period=${activeTab}`)
      if (res.ok) setSnapshots(await res.json())
    }
    fetchSnapshots()
  }, [activeTab])

  function toggleCard(key: keyof Visibility) {
    if (key === 'trendCard') return
    const next = { ...vis, [key]: !vis[key] }
    setVis(next)
    try { localStorage.setItem('ledger-dashboard-visibility', JSON.stringify(next)) } catch {}
  }

  async function handleSnapshot() {
    setTakingSnapshot(true)
    try {
      const res = await fetch('/api/dashboard/snapshot', { method: 'POST' })
      if (res.ok) {
        setSnapshotToast(true)
        setTimeout(() => setSnapshotToast(false), 3000)
        const snapshotRes = await fetch(`/api/dashboard/snapshot?period=${activeTab}`)
        if (snapshotRes.ok) setSnapshots(await snapshotRes.json())
      }
    } finally {
      setTakingSnapshot(false)
    }
  }

  const monthYear  = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const isPositive = (summary?.gainLoss ?? 0) >= 0

  return (
    <>
      {/* ── Header ── */}
      <div className="dashboard-header-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.8px', marginBottom: '4px' }}>
            Net worth · {monthYear}
          </div>

          {loading ? (
            <div style={{ ...SK, width: 200, height: 40, marginBottom: 8 }} />
          ) : (
            <div className="dashboard-header-amount" style={{ fontSize: '38px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {formatINR(summary?.totalNetWorth ?? 0)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            {loading ? (
              <div style={{ ...SK, width: 140, height: 22, borderRadius: '20px' }} />
            ) : (
              <span className="dashboard-header-gain" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: isPositive ? '#F0FDF6' : 'var(--color-loss-subtle)',
                color:      isPositive ? '#15803D' : 'var(--color-loss)',
                borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 500,
              }}>
                <TrendingUp size={11} />
                {isPositive ? '+' : ''}{formatINR(summary?.gainLoss ?? 0)} all time · {(summary?.gainLossPct ?? 0).toFixed(2)}%
              </span>
            )}
            {!loading && (
              <span className="dashboard-header-meta" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Invested {formatINR(summary?.totalInvested ?? 0)}
              </span>
            )}
          </div>
        </div>

        <div className="dashboard-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: '0.5px solid var(--btn-ghost-border)', background: 'transparent', color: 'var(--btn-ghost-text)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', transition: 'border-color 160ms ease' }}
          >
            <LayoutDashboard size={14} />
            Customise
          </button>
          <button
            onClick={handleSnapshot}
            disabled={takingSnapshot}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontFamily: 'inherit', cursor: takingSnapshot ? 'default' : 'pointer', opacity: takingSnapshot ? 0.7 : 1 }}
          >
            <Camera size={14} />
            {takingSnapshot ? 'Saving…' : 'Snapshot'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: '#FFF5F5', border: '0.5px solid #FECDD3', color: '#DC2626',
          padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
          marginBottom: '12px',
        }}>
          <AlertCircle size={15} />
          <span>{fetchError}</span>
          <button
            onClick={() => window.location.reload()}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#DC2626', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Snapshot success strip */}
      {snapshotToast && (
        <div style={{
          background: '#F0FDF4', border: '0.5px solid #BBF7D0', color: '#15803D',
          padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
          marginBottom: '12px', animation: 'fadeSlideUp 200ms ease forwards',
        }}>
          ✓ Snapshot saved — net worth recorded for today
        </div>
      )}

      {/* Net worth trend */}
      <NetWorthTrendCard
        snapshots={snapshots}
        activeTab={activeTab}
        takingSnapshot={takingSnapshot}
        onTabChange={setActiveTab}
        onSnapshot={handleSnapshot}
      />

      {/* Allocation + Treemap */}
      {(vis.allocationCard || vis.treemapCard) && (
        <div className="dashboard-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          {vis.allocationCard && <AllocationCard summary={summary} loading={loading} />}
          {vis.treemapCard    && <TreemapCard    summary={summary} loading={loading} />}
        </div>
      )}

      {/* Performers */}
      {vis.performersCard && <PerformersCard performers={performers} loading={loading} />}

      {/* Upcoming events */}
      {vis.eventsCard && <UpcomingEventsCard upcoming={upcoming} loading={loading} />}

      {/* Milestones */}
      {vis.milestonesCard && <MilestonesCard milestones={milestones} loading={loading} />}

      {/* Customise modal */}
      {modal && <CustomiseModal vis={vis} onToggle={toggleCard} onClose={() => setModal(false)} />}
    </>
  )
}
