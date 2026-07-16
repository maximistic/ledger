'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { TrendingUp, LayoutDashboard, Camera, X, Check, Flag, Plus } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = '1M' | '6M' | '1Y' | '5Y'

interface Visibility {
  trendCard: boolean
  allocationCard: boolean
  treemapCard: boolean
  cashflowCard: boolean
  performersCard: boolean
  eventsCard: boolean
  milestonesCard: boolean
}

interface RiskBucket { value: number; pct: number }

interface DashboardSummary {
  totalNetWorth: number
  totalInvested: number
  gainLoss: number
  gainLossPct: number
  riskProfile: {
    equity:        RiskBucket
    debt:          RiskBucket
    gold:          RiskBucket
    international: RiskBucket
  }
  allocation: {
    stocks: number
    mf: number
    epf: number
    fd: number
    rd: number
    usStocks: number
  }
  breakdown: {
    stocks:   { value: number; invested: number }
    mf:       { value: number; invested: number }
    epf:      { value: number; invested: number }
    fd:       { value: number; invested: number }
    rd:       { value: number; invested: number }
    usStocks: { value: number; invested: number }
  }
}

interface SnapshotPoint {
  date: string
  totalNetWorth: number
}

interface SnapshotData {
  period: string
  changeAmt: number
  changePct: number
  chartData: SnapshotPoint[]
}

interface Performer {
  name: string
  ticker: string
  assetClass: string
  gainLossPct: number
  currentValue: number
}

interface Performers {
  gainers: Performer[]
  losers: Performer[]
}

interface UpcomingEvent {
  id: string
  type: 'FD_MATURITY' | 'RD_MATURITY' | 'EPF_CONTRIBUTION' | 'RD_INSTALLMENT'
  label: string
  date: string
  amount: number
  daysLeft: number
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface UpcomingEvents {
  events: UpcomingEvent[]
}

interface Milestone {
  id: string
  title: string
  targetAmount: number
  targetAsset: string | null
  achievedDate: string | null
  isAchieved: boolean
  currentValue: number
  progressPct: number
  amountAway: number
}

interface HoveredBar {
  month: string
  investedAmt: number
  returnsAmt: number
  barIndex: number
}

// ── Static data ───────────────────────────────────────────────────────────────

const DEFAULT_VIS: Visibility = {
  trendCard: true,
  allocationCard: true,
  treemapCard: true,
  cashflowCard: true,
  performersCard: true,
  eventsCard: true,
  milestonesCard: true,
}

const BARS = [
  { month: 'Feb', inv: 52, ret: 30, now: false, investedAmt: 9300,  returnsAmt: 2800 },
  { month: 'Mar', inv: 58, ret: 40, now: false, investedAmt: 10500, returnsAmt: 4200 },
  { month: 'Apr', inv: 52, ret: 24, now: false, investedAmt: 9300,  returnsAmt: 2100 },
  { month: 'May', inv: 52, ret: 36, now: false, investedAmt: 9300,  returnsAmt: 3500 },
  { month: 'Jun', inv: 52, ret: 44, now: false, investedAmt: 9300,  returnsAmt: 4800 },
  { month: 'Jul', inv: 52, ret: 36, now: true,  investedAmt: 9300,  returnsAmt: 3200 },
]

const TOGGLES = [
  { key: 'trendCard'      as const, label: 'Net worth trend',         locked: true  },
  { key: 'allocationCard' as const, label: 'Asset allocation',        locked: false },
  { key: 'treemapCard'    as const, label: 'Equity breakdown',        locked: false },
  { key: 'cashflowCard'   as const, label: 'Monthly cashflow',        locked: false },
  { key: 'performersCard' as const, label: 'Best & worst performers', locked: false },
  { key: 'eventsCard'     as const, label: 'Upcoming events',         locked: false },
  { key: 'milestonesCard' as const, label: 'Milestones',              locked: false },
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const card = {
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  borderRadius: '12px',
}

const TITLE_STYLE: CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  letterSpacing: '0.7px',
  fontWeight: 500,
  marginBottom: '14px',
}

const SK: CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShort(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`
  if (value >= 100_000)    return `₹${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000)      return `₹${(value / 1_000).toFixed(1)}K`
  return `₹${Math.round(value)}`
}

function formatMilestoneDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function eventDotColor(ev: UpcomingEvent): string {
  if (ev.type === 'FD_MATURITY')      return ev.urgency === 'HIGH' ? '#DC2626' : '#D97706'
  if (ev.type === 'RD_MATURITY')      return '#D97706'
  if (ev.type === 'RD_INSTALLMENT')   return '#D97706'
  if (ev.type === 'EPF_CONTRIBUTION') return '#6366F1'
  return '#AAA8A0'
}

function eventTypeLabel(ev: UpcomingEvent): string {
  if (ev.type === 'FD_MATURITY')      return `FD · ${ev.daysLeft}d`
  if (ev.type === 'RD_MATURITY')      return 'RD maturity'
  if (ev.type === 'RD_INSTALLMENT')   return 'RD'
  if (ev.type === 'EPF_CONTRIBUTION') return 'EPF'
  return ev.type
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [summary,        setSummary]        = useState<DashboardSummary | null>(null)
  const [snapshots,      setSnapshots]      = useState<SnapshotData | null>(null)
  const [performers,     setPerformers]     = useState<Performers | null>(null)
  const [upcoming,       setUpcoming]       = useState<UpcomingEvents | null>(null)
  const [milestones,     setMilestones]     = useState<Milestone[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeTab,      setActiveTab]      = useState<TabKey>('1Y')
  const [snapshotToast,  setSnapshotToast]  = useState(false)
  const [takingSnapshot, setTakingSnapshot] = useState(false)
  const [modal,          setModal]          = useState(false)
  const [vis,            setVis]            = useState<Visibility>(DEFAULT_VIS)
  const [hoveredBar,     setHoveredBar]     = useState<HoveredBar | null>(null)

  // Restore persisted visibility
  useEffect(() => {
    try {
      const s = localStorage.getItem('ledger-dashboard-visibility')
      if (s) setVis(v => ({ ...v, ...JSON.parse(s) }))
    } catch {}
  }, [])

  // Escape closes modal
  useEffect(() => {
    if (!modal) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [modal])

  // Fetch summary, performers, upcoming, milestones on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [summaryRes, performersRes, upcomingRes, milestonesRes] = await Promise.all([
          fetch('/api/dashboard/summary'),
          fetch('/api/dashboard/performers'),
          fetch('/api/dashboard/upcoming'),
          fetch('/api/milestones'),
        ])
        if (summaryRes.ok)    setSummary(await summaryRes.json())
        if (performersRes.ok) setPerformers(await performersRes.json())
        if (upcomingRes.ok)   setUpcoming(await upcomingRes.json())
        if (milestonesRes.ok) {
          const d = await milestonesRes.json() as { milestones: Milestone[] }
          setMilestones(d.milestones)
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err)
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

  // ── Derived values ──────────────────────────────────────────────────────────

  const monthYear  = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const isPositive = (summary?.gainLoss ?? 0) >= 0
  const chartData  = snapshots?.chartData ?? []
  const hasChart   = chartData.length > 0

  // SVG chart paths
  let pathD       = ''
  let fillD       = ''
  let lastPt      = { x: 900, y: 5 }
  let monthLabels: string[] = []

  if (hasChart) {
    const values = chartData.map(s => s.totalNetWorth)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const range  = maxVal - minVal || 1
    const pts    = chartData.map((s, i) => ({
      x: chartData.length === 1 ? 450 : (i / (chartData.length - 1)) * 900,
      y: 95 - ((s.totalNetWorth - minVal) / range) * 85,
    }))
    pathD  = pts.reduce((d, pt, i) => {
      if (i === 0) return `M${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
      const prev = pts[i - 1]
      const cpx  = ((prev.x + pt.x) / 2).toFixed(1)
      return d + ` C${cpx},${prev.y.toFixed(1)} ${cpx},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
    }, '')
    fillD  = pathD + ' L900,100 L0,100 Z'
    lastPt = pts[pts.length - 1]

    const step = Math.max(1, Math.floor(chartData.length / 12))
    for (let i = 0; i < chartData.length; i += step) {
      monthLabels.push(new Date(chartData[i].date).toLocaleDateString('en-IN', { month: 'short' }))
    }
    monthLabels = monthLabels.slice(0, 12)
  }

  // Pie segments (r=70, cx=cy=80, SVG 160×160)
  const pieSegments = summary ? (() => {
    const { allocation: a, breakdown: b } = summary
    const fdRdPct = (a.fd ?? 0) + (a.rd ?? 0)
    const segs = [
      { label: 'Stocks',        pct: a.stocks ?? 0,   val: b.stocks.value,          color: '#111111' },
      { label: 'Mutual Funds',  pct: a.mf ?? 0,       val: b.mf.value,              color: '#E8E4DC' },
      { label: 'EPF',           pct: a.epf ?? 0,      val: b.epf.value,             color: '#16A34A' },
      { label: 'FDs & RDs',     pct: fdRdPct,         val: b.fd.value + b.rd.value, color: '#D97706' },
      { label: 'International', pct: a.usStocks ?? 0, val: b.usStocks.value,        color: '#6366F1' },
    ]
    const cx = 80, cy = 80, r = 70
    let angle = -Math.PI / 2
    return segs.map(s => {
      const sweep = (s.pct / 100) * 2 * Math.PI
      const sx = cx + r * Math.cos(angle)
      const sy = cy + r * Math.sin(angle)
      angle += sweep
      const ex = cx + r * Math.cos(angle)
      const ey = cy + r * Math.sin(angle)
      const largeArc = sweep > Math.PI ? 1 : 0
      const path = `M ${cx},${cy} L ${sx.toFixed(2)},${sy.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)} Z`
      return { ...s, pctStr: `${Math.round(s.pct)}%`, valStr: formatShort(s.val), path, show: s.pct > 0.5 }
    })
  })() : null

  // Treemap from riskProfile (4-segment)
  const treemap = summary?.riskProfile ? (() => {
    const rp = summary.riskProfile
    return {
      equityPct: rp.equity.pct,        equityVal: rp.equity.value,
      debtPct:   rp.debt.pct,          debtVal:   rp.debt.value,
      goldPct:   rp.gold.pct,          goldVal:   rp.gold.value,
      intlPct:   rp.international.pct, intlVal:   rp.international.value,
    }
  })() : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── ROW 1: Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.8px', marginBottom: '4px' }}>
            Net worth · {monthYear}
          </div>

          {loading ? (
            <div style={{ ...SK, width: 200, height: 40, marginBottom: 8 }} />
          ) : (
            <div style={{ fontSize: '38px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {formatINR(summary?.totalNetWorth ?? 0)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            {loading ? (
              <div style={{ ...SK, width: 140, height: 22, borderRadius: '20px' }} />
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: isPositive ? '#F0FDF6' : 'var(--color-loss-subtle)',
                color: isPositive ? '#15803D' : 'var(--color-loss)',
                borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 500,
              }}>
                <TrendingUp size={11} />
                {isPositive ? '+' : ''}{formatINR(summary?.gainLoss ?? 0)} all time · {(summary?.gainLossPct ?? 0).toFixed(2)}%
              </span>
            )}
            {!loading && (
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Invested {formatINR(summary?.totalInvested ?? 0)}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
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

      {/* ── ROW 2: Net worth trend card ── */}
      <div className="dashboard-card" style={{ ...card, padding: '20px 24px', marginBottom: '14px', animationDelay: '60ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '3px' }}>
              Net Worth Trend
            </div>
            <div style={{ fontSize: '13px' }}>
              {hasChart && snapshots ? (
                <>
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    {formatINR(snapshots.chartData[snapshots.chartData.length - 1].totalNetWorth)}
                  </strong>
                  <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                  <span style={{ color: snapshots.changePct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                    {snapshots.changePct >= 0 ? '+' : ''}{snapshots.changePct.toFixed(1)}% since first snapshot
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>Take a snapshot to start tracking</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '6px', padding: '3px' }}>
            {(['1M', '6M', '1Y', '5Y'] as TabKey[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '4px 11px', borderRadius: '4px', fontSize: '11.5px',
                  fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                  color: activeTab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  background: activeTab === t ? 'var(--color-surface)' : 'transparent',
                  boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'background 160ms ease, color 160ms ease, box-shadow 160ms ease',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {!hasChart ? (
          <div style={{ height: '130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Camera size={32} color="var(--color-text-muted)" />
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>No snapshot history yet</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '280px', textAlign: 'center' }}>
              Take your first snapshot to start tracking your net worth over time
            </div>
            <button
              onClick={handleSnapshot}
              disabled={takingSnapshot}
              style={{ marginTop: '4px', padding: '5px 14px', borderRadius: '6px', border: '0.5px solid var(--btn-ghost-border)', background: 'transparent', color: 'var(--btn-ghost-text)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {takingSnapshot ? 'Saving…' : 'Take snapshot'}
            </button>
          </div>
        ) : (
          <>
            <svg viewBox="0 0 900 100" preserveAspectRatio="none" style={{ width: '100%', height: '100px', display: 'block' }}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--chart-line)" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={fillD} fill="url(#cg)" />
              <path d={pathD} fill="none" stroke="var(--chart-line)" strokeWidth={1.5} strokeLinecap="round" />
              <circle cx={lastPt.x} cy={lastPt.y} r={3.5} fill="var(--chart-line)" />
              <circle cx={lastPt.x} cy={lastPt.y} r={7}   fill="var(--chart-line)" fillOpacity={0.1} />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#C8C4B8', marginTop: '6px' }}>
              {monthLabels.map((m, i) => <span key={i}>{m}</span>)}
            </div>
          </>
        )}
      </div>

      {/* ── ROW 3: Allocation + Treemap ── */}
      {(vis.allocationCard || vis.treemapCard) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

          {vis.allocationCard && (
            <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '120ms' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '14px' }}>
                Asset Allocation
              </div>
              {loading || !pieSegments ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <div style={{ ...SK, width: 160, height: 160, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...SK, height: 13, width: '80%' }} />)}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  {/* Pie chart: r=70, cx=cy=80, SVG 160×160 */}
                  <svg width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
                    {pieSegments.filter(s => s.show).map(s => (
                      <path key={s.label} d={s.path} fill={s.color} />
                    ))}
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: 0 }}>
                    {pieSegments.map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12.5px', color: '#555', flex: 1, minWidth: 0 }}>{s.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>{s.pctStr}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '52px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.valStr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {vis.treemapCard && (
            <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '150ms' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '14px' }}>
                Equity · Debt · Gold · Intl
              </div>
              {loading || !treemap ? (
                <div style={{ display: 'grid', gridTemplateColumns: '68fr 32fr', gridTemplateRows: '1fr 1fr', gap: '5px', height: '168px' }}>
                  <div style={{ ...SK, gridRow: '1 / 3', borderRadius: '9px' }} />
                  <div style={{ ...SK, borderRadius: '9px' }} />
                  <div style={{ ...SK, borderRadius: '9px' }} />
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `${treemap.equityPct || 60}fr ${(treemap.debtPct + treemap.goldPct + treemap.intlPct) || 40}fr`,
                    gridTemplateRows: '1fr 1fr',
                    gap: '5px',
                    height: '168px',
                  }}
                >
                  {/* Equity — spans full height */}
                  <div style={{ gridRow: '1 / 3', background: '#111111', borderRadius: '9px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Equity</span>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{treemap.equityPct}%</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>{formatShort(treemap.equityVal)}</div>
                    </div>
                  </div>
                  {/* Debt — top right */}
                  <div style={{ background: '#FEF3C7', borderRadius: '9px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: '#92400E', textTransform: 'uppercase' }}>Debt</span>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#92400E', letterSpacing: '-0.5px', lineHeight: 1 }}>{treemap.debtPct}%</div>
                      <div style={{ fontSize: '11px', color: '#B45309', marginTop: '2px' }}>{formatShort(treemap.debtVal)}</div>
                    </div>
                  </div>
                  {/* Gold + Intl — bottom right, side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    <div style={{ background: '#FFFBEB', borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9.5px', color: '#B45309', textTransform: 'uppercase' }}>Gold</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#D97706', letterSpacing: '-0.3px', lineHeight: 1 }}>{treemap.goldPct}%</div>
                        <div style={{ fontSize: '10px', color: '#B45309', marginTop: '1px' }}>{formatShort(treemap.goldVal)}</div>
                      </div>
                    </div>
                    <div style={{ background: '#EEF2FF', borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9.5px', color: '#4338CA', textTransform: 'uppercase' }}>Intl</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#6366F1', letterSpacing: '-0.3px', lineHeight: 1 }}>{treemap.intlPct}%</div>
                        <div style={{ fontSize: '10px', color: '#4338CA', marginTop: '1px' }}>{formatShort(treemap.intlVal)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ROW 4: Cashflow (static) ── */}
      {vis.cashflowCard && (
        <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '14px', animationDelay: '180ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px' }}>Monthly Cashflow</div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Last 6 months</span>
          </div>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px' }}>
                {BARS.map((b, barIdx) => (
                  <div
                    key={b.month}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}
                    onMouseEnter={() => setHoveredBar({ month: b.month, investedAmt: b.investedAmt, returnsAmt: b.returnsAmt, barIndex: barIdx })}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%' }}>
                      <div style={{ height: b.inv, flex: 1, borderRadius: '4px 4px 0 0', background: b.now ? 'var(--color-text-primary)' : '#E8E6DE' }} />
                      <div style={{ height: b.ret, flex: 1, borderRadius: '4px 4px 0 0', background: b.now ? 'var(--color-text-secondary)' : '#D4D0C8' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar hover tooltip */}
              {hoveredBar !== null && (() => {
                const leftPct = ((hoveredBar.barIndex + 0.5) / BARS.length) * 100
                return (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '108px',
                      left: `${leftPct}%`,
                      transform: 'translateX(-50%)',
                      background: 'var(--color-text-primary)',
                      color: 'var(--color-surface)',
                      borderRadius: '7px',
                      padding: '7px 11px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '3px' }}>{hoveredBar.month}</div>
                    <div>Invested: ₹{hoveredBar.investedAmt.toLocaleString('en-IN')}</div>
                    <div style={{ color: 'var(--color-gain)' }}>Returns: +₹{hoveredBar.returnsAmt.toLocaleString('en-IN')}</div>
                  </div>
                )
              })()}

              <div style={{ height: '0.5px', background: 'var(--color-border-subtle)' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {BARS.map(b => (
                  <div key={b.month} style={{ flex: 1, textAlign: 'center', fontSize: '9.5px', color: b.now ? 'var(--color-text-primary)' : '#C8C4B8', fontWeight: b.now ? 600 : 400 }}>
                    {b.month}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '2px', background: 'var(--color-text-primary)' }} />
                  Invested
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '2px', background: '#AAA8A0' }} />
                  Returns
                </span>
              </div>
            </div>
            <div style={{ width: '0.5px', background: 'var(--color-border-subtle)', alignSelf: 'stretch', marginBottom: '22px' }} />
            <div style={{ width: '170px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '22px' }}>
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.5px', marginBottom: '3px' }}>This month</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>₹9,300</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>invested in Jul</div>
              </div>
              <div style={{ height: '0.5px', background: 'var(--color-border-subtle)' }} />
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.5px', marginBottom: '3px' }}>Returns</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-gain)', letterSpacing: '-0.3px', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>+₹8,910</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>this month</div>
              </div>
              <div style={{ height: '0.5px', background: 'var(--color-border-subtle)' }} />
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.5px', marginBottom: '3px' }}>6M Total</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>₹55,800</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>deployed since Feb</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 5: Performers ── */}
      {vis.performersCard && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

          <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '210ms' }}>
            <div style={TITLE_STYLE}>Top Performers</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} style={{ ...SK, height: 36, borderRadius: '8px' }} />)}
              </div>
            ) : !performers?.gainers?.length ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px 0' }}>
                No positive performers yet
              </div>
            ) : (
              <div>
                {performers.gainers.map((g, i) => (
                  <div key={g.ticker} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < performers.gainers.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--color-surface-raised)', fontSize: '8.5px', fontWeight: 700, color: '#555', overflow: 'hidden', padding: '0 3px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      {g.ticker}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.name.length > 25 ? g.name.slice(0, 25) + '…' : g.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{g.assetClass}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-gain)', fontVariantNumeric: 'tabular-nums' }}>+{g.gainLossPct.toFixed(2)}%</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>{formatShort(g.currentValue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '240ms' }}>
            <div style={TITLE_STYLE}>Underperformers</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} style={{ ...SK, height: 36, borderRadius: '8px' }} />)}
              </div>
            ) : !performers?.losers?.length ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px 0' }}>
                No underperformers
              </div>
            ) : (
              <div>
                {performers.losers.map((p, i) => (
                  <div key={p.ticker} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < performers.losers.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none' }}>
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
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-loss)', fontVariantNumeric: 'tabular-nums' }}>{p.gainLossPct.toFixed(2)}%</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>{formatShort(p.currentValue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROW 6: Upcoming events ── */}
      {vis.eventsCard && (
        <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '14px', animationDelay: '270ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={TITLE_STYLE}>Upcoming</div>
          </div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[1, 2, 3, 4].map(i => <div key={i} style={{ ...SK, height: 90, borderRadius: '9px' }} />)}
            </div>
          ) : !upcoming?.events?.length ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px 0' }}>
              No upcoming events in the next 90 days
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {upcoming.events.slice(0, 4).map(ev => {
                const isUrgent = ev.urgency === 'HIGH'
                const dot      = eventDotColor(ev)
                const typeText = eventTypeLabel(ev)
                const evDate   = new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                return (
                  <div key={ev.id} style={{ background: isUrgent ? '#FFF5F5' : 'var(--color-surface-raised)', borderRadius: '9px', border: `0.5px solid ${isUrgent ? '#FECDD3' : 'var(--color-border)'}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                      <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: isUrgent ? '#DC2626' : 'var(--color-text-muted)', fontWeight: 500 }}>
                        {typeText}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                      {ev.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {formatINR(ev.amount)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: isUrgent ? '#DC2626' : 'var(--color-text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
                      {evDate}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ROW 7: Milestones ── */}
      {vis.milestonesCard && (
        <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '0', animationDelay: '300ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ ...TITLE_STYLE, marginBottom: 0 }}>Milestones</div>
            <button
              onClick={() => router.push('/settings')}
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
                            ? <Check size={11} color="var(--color-surface)" strokeWidth={2.5} />
                            : <Flag  size={11} color="var(--color-text-muted)" />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.title}</div>
                          <div style={{ fontSize: '11px', color: m.isAchieved ? 'var(--color-gain)' : 'var(--color-text-muted)', marginTop: '1px' }}>{sub}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0, marginLeft: '16px', fontVariantNumeric: 'tabular-nums' }}>
                        {formatShort(m.targetAmount)}
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'var(--color-surface-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${m.progressPct}%`, background: m.isAchieved ? 'var(--color-gain)' : 'var(--color-text-primary)', borderRadius: '2px', transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Customise modal ── */}
      {modal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '360px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Customise dashboard</div>
              <button onClick={() => setModal(false)} style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '6px 0' }}>
              {TOGGLES.map(item => {
                const on = vis[item.key]
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleCard(item.key)}
                    disabled={item.locked}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px 11px 16px', background: 'none', border: 'none', borderRight: on ? '3px solid var(--color-text-primary)' : '3px solid transparent', cursor: item.locked ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'border-color 160ms ease' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: on ? 'var(--color-text-primary)' : 'transparent', border: on ? 'none' : '1.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 160ms ease, border-color 160ms ease' }}>
                        {on && <Check size={10} color="var(--color-surface)" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'left' }}>{item.label}</span>
                    </div>
                    {item.locked && (
                      <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>Always on</span>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)' }}>
              <button
                onClick={() => setModal(false)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
