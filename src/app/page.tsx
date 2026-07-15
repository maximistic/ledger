'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, LayoutDashboard, Camera, X, Check, Flag, Plus } from 'lucide-react'

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

const DEFAULT_VIS: Visibility = {
  trendCard: true,
  allocationCard: true,
  treemapCard: true,
  cashflowCard: true,
  performersCard: true,
  eventsCard: true,
  milestonesCard: true,
}

const DONUT = [
  { label: 'Stocks',        pct: '40%', val: '₹81.9K', color: '#111111',             dash: '80 121', offset: 0    },
  { label: 'EPF',           pct: '14%', val: '₹28.7K', color: '#16A34A',             dash: '28 173', offset: -80  },
  { label: 'FDs & RDs',     pct: '10%', val: '₹20.5K', color: '#D97706',             dash: '20 181', offset: -108 },
  { label: 'International', pct: '7%',  val: '₹14.3K', color: '#6366F1',             dash: '14 187', offset: -128 },
  { label: 'Others',        pct: '29%', val: '₹59.4K', color: 'var(--color-border)', dash: '59 142', offset: -142 },
]

const BARS = [
  { month: 'Feb', inv: 52, ret: 30, now: false },
  { month: 'Mar', inv: 58, ret: 40, now: false },
  { month: 'Apr', inv: 52, ret: 24, now: false },
  { month: 'May', inv: 52, ret: 36, now: false },
  { month: 'Jun', inv: 52, ret: 44, now: false },
  { month: 'Jul', inv: 52, ret: 36, now: true  },
]

const MONTHS = ["Aug '25", 'Sep', 'Oct', 'Nov', 'Dec', "Jan '26", 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']

const TOP_PERFORMERS = [
  { ticker: 'NMDC',      type: 'Stock · NSE',         pct: '+130.99%', gain: '+₹6,260' },
  { ticker: 'SOUTHBANK', type: 'Stock · NSE',         pct: '+98.70%',  gain: '+₹6,940' },
  { ticker: 'TMCV',      type: 'Stock · NSE',         pct: '+86.94%',  gain: '+₹6,091' },
]

const UNDERPERFORMERS = [
  { ticker: 'NIFTYBEES', type: 'Stock · NSE',         pct: '-1.22%',  loss: '-₹482'   },
  { ticker: 'MSFT',      type: 'Intl stock · NASDAQ', pct: '-3.40%',  loss: '-₹2,140' },
  { ticker: 'PPFAS',     type: 'Mutual fund',         pct: '-0.80%',  loss: '-₹540'   },
]

const EVENTS = [
  { dot: '#6366F1', type: 'EPF',         name: 'Auto contribution', detail: 'Monthly · ₹6,300',    date: '1 Aug 2026',  urgent: false },
  { dot: '#D97706', type: 'RD',          name: 'Suryoday RD',       detail: 'Monthly · ₹5,000',    date: '5 Aug 2026',  urgent: false },
  { dot: '#DC2626', type: 'FD · 11 days',name: 'Bajaj Finance FD',  detail: 'Maturity · ₹54,200',  date: '18 Aug 2026', urgent: true  },
  { dot: '#D97706', type: 'FD · 45 days',name: 'HDFC FD',           detail: 'Maturity · ₹1,00,000',date: '29 Aug 2026', urgent: false },
]

const MILESTONES = [
  { title: '₹1,00,000 total portfolio', target: '₹1,00,000', progress: 100, achieved: true,  sub: 'Achieved · 12 Mar 2026'        },
  { title: '₹5,00,000 total portfolio', target: '₹5,00,000', progress: 41,  achieved: false, sub: '₹2,95,146 away · 41% there'   },
  { title: '₹50,000 in mutual funds',   target: '₹50,000',   progress: 0,   achieved: false, sub: 'Not started yet · ₹0 invested' },
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

const card = {
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  borderRadius: '12px',
}

const TITLE_STYLE = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  color: 'var(--color-text-muted)',
  letterSpacing: '0.7px',
  fontWeight: 500,
  marginBottom: '14px',
}

export default function DashboardPage() {
  const [tab,   setTab]   = useState<TabKey>('1Y')
  const [modal, setModal] = useState(false)
  const [toast, setToast] = useState(false)
  const [vis,   setVis]   = useState<Visibility>(DEFAULT_VIS)

  useEffect(() => {
    try {
      const s = localStorage.getItem('ledger-dashboard-visibility')
      if (s) setVis(v => ({ ...v, ...JSON.parse(s) }))
    } catch {}
  }, [])

  useEffect(() => {
    if (!modal) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [modal])

  function toggleCard(key: keyof Visibility) {
    if (key === 'trendCard') return
    const next = { ...vis, [key]: !vis[key] }
    setVis(next)
    try { localStorage.setItem('ledger-dashboard-visibility', JSON.stringify(next)) } catch {}
  }

  function handleSnapshot() {
    setToast(true)
    setTimeout(() => setToast(false), 2500)
  }

  return (
    <>
      {/* ── ROW 1: Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.8px', marginBottom: '4px' }}>
            Net worth · July 2026
          </div>
          <div style={{ fontSize: '38px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            ₹2,04,854
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F0FDF6', color: '#15803D', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 500 }}>
              <TrendingUp size={11} />
              +₹18,210 this month · +9.7%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Invested ₹1,86,644 · XIRR 14.2%
            </span>
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <Camera size={14} />
            Snapshot
          </button>
        </div>
      </div>

      {/* ── ROW 2: Net worth trend card ── */}
      <div className="dashboard-card" style={{ ...card, padding: '20px 24px', marginBottom: '14px', animationDelay: '60ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '3px' }}>
              Net Worth Trend
            </div>
            <div style={{ fontSize: '13px' }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>₹2,04,854</strong>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: 'var(--color-gain)' }}>+14.2% since Jan</span>
            </div>
          </div>
          <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '6px', padding: '3px' }}>
            {(['1M', '6M', '1Y', '5Y'] as TabKey[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '4px 11px', borderRadius: '4px', fontSize: '11.5px',
                  fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                  color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  background: tab === t ? 'var(--color-surface)' : 'transparent',
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'background 160ms ease, color 160ms ease, box-shadow 160ms ease',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <svg viewBox="0 0 900 100" preserveAspectRatio="none" style={{ width: '100%', height: '100px', display: 'block' }}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--chart-line)" stopOpacity={0.06} />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d="M0,88 C80,84 140,80 200,73 S310,64 400,54 S500,40 590,30 S710,16 800,10 S860,7 900,5 L900,100 L0,100 Z" fill="url(#cg)" />
          <path d="M0,88 C80,84 140,80 200,73 S310,64 400,54 S500,40 590,30 S710,16 800,10 S860,7 900,5" fill="none" stroke="var(--chart-line)" strokeWidth={1.5} strokeLinecap="round" />
          <circle cx={900} cy={5} r={3.5} fill="var(--chart-line)" />
          <circle cx={900} cy={5} r={7}   fill="var(--chart-line)" fillOpacity={0.1} />
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#C8C4B8', marginTop: '6px' }}>
          {MONTHS.map(m => <span key={m}>{m}</span>)}
        </div>
      </div>

      {/* ── ROW 3: Allocation + Treemap ── */}
      {(vis.allocationCard || vis.treemapCard) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          {vis.allocationCard && (
            <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '120ms' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '14px' }}>
                Asset Allocation
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <svg width={90} height={90} viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
                  <circle cx={45} cy={45} r={32} fill="none" stroke="var(--color-surface-raised)" strokeWidth={12} />
                  {DONUT.map(s => (
                    <circle key={s.label} cx={45} cy={45} r={32} fill="none" stroke={s.color} strokeWidth={12} strokeDasharray={s.dash} strokeDashoffset={s.offset} transform="rotate(-90 45 45)" />
                  ))}
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: 0 }}>
                  {DONUT.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', color: '#555', flex: 1, minWidth: 0 }}>{s.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>{s.pct}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '52px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {vis.treemapCard && (
            <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '150ms' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px', marginBottom: '14px' }}>
                Equity · Debt · Gold
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '68fr 32fr', gridTemplateRows: '1fr 1fr', gap: '5px', height: '168px' }}>
                <div style={{ gridRow: '1 / 3', background: '#111111', borderRadius: '9px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Equity</span>
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>68%</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>₹1.39L</div>
                  </div>
                </div>
                <div style={{ background: '#FEF3C7', borderRadius: '9px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: '#92400E', textTransform: 'uppercase' }}>Debt</span>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#92400E', letterSpacing: '-0.5px', lineHeight: 1 }}>16%</div>
                    <div style={{ fontSize: '11px', color: '#B45309', marginTop: '2px' }}>₹32.8K</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                  <div style={{ background: '#FFFBEB', borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9.5px', color: '#B45309', textTransform: 'uppercase' }}>Gold</span>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#D97706', letterSpacing: '-0.3px', lineHeight: 1 }}>10%</div>
                      <div style={{ fontSize: '10px', color: '#B45309', marginTop: '1px' }}>₹20.5K</div>
                    </div>
                  </div>
                  <div style={{ background: '#EEF2FF', borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9.5px', color: '#4338CA', textTransform: 'uppercase' }}>Intl</span>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#6366F1', letterSpacing: '-0.3px', lineHeight: 1 }}>6%</div>
                      <div style={{ fontSize: '10px', color: '#4338CA', marginTop: '1px' }}>₹12.3K</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROW 4: Cashflow ── */}
      {vis.cashflowCard && (
        <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '14px', animationDelay: '180ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px' }}>Monthly Cashflow</div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Last 6 months</span>
          </div>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px' }}>
                {BARS.map(b => (
                  <div key={b.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%' }}>
                      <div style={{ height: b.inv, flex: 1, borderRadius: '4px 4px 0 0', background: b.now ? 'var(--color-text-primary)' : '#E8E6DE' }} />
                      <div style={{ height: b.ret, flex: 1, borderRadius: '4px 4px 0 0', background: b.now ? 'var(--color-text-secondary)' : '#D4D0C8' }} />
                    </div>
                  </div>
                ))}
              </div>
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

      {/* ── ROW 5: Top performers + Underperformers ── */}
      {vis.performersCard && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          {/* Top performers */}
          <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '210ms' }}>
            <div style={TITLE_STYLE}>Top Performers</div>
            <div>
              {TOP_PERFORMERS.map((p, i) => (
                <div
                  key={p.ticker}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 0',
                    borderBottom: i < TOP_PERFORMERS.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '8px',
                    background: 'var(--color-surface-raised)',
                    fontSize: '8.5px', fontWeight: 700, color: '#555',
                    overflow: 'hidden', padding: '0 3px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  }}>
                    {p.ticker}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ticker}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{p.type}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-gain)', fontVariantNumeric: 'tabular-nums' }}>{p.pct}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>{p.gain}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Underperformers */}
          <div className="dashboard-card" style={{ ...card, padding: '18px 22px', animationDelay: '240ms' }}>
            <div style={TITLE_STYLE}>Underperformers</div>
            <div>
              {UNDERPERFORMERS.map((p, i) => (
                <div
                  key={p.ticker}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 0',
                    borderBottom: i < UNDERPERFORMERS.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '8px',
                    background: 'var(--color-surface-raised)',
                    fontSize: '8.5px', fontWeight: 700, color: '#555',
                    overflow: 'hidden', padding: '0 3px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  }}>
                    {p.ticker}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ticker}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{p.type}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-loss)', fontVariantNumeric: 'tabular-nums' }}>{p.pct}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>{p.loss}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 6: Upcoming events ── */}
      {vis.eventsCard && (
        <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '14px', animationDelay: '270ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={TITLE_STYLE}>Upcoming</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {EVENTS.map((ev, i) => (
              <div
                key={i}
                style={{
                  background: ev.urgent ? '#FFF5F5' : 'var(--color-surface-raised)',
                  borderRadius: '9px',
                  border: `0.5px solid ${ev.urgent ? '#FECDD3' : 'var(--color-border)'}`,
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: ev.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: ev.urgent ? '#DC2626' : 'var(--color-text-muted)', fontWeight: 500 }}>
                    {ev.type}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                  {ev.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {ev.detail}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: ev.urgent ? '#DC2626' : 'var(--color-text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
                  {ev.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ROW 7: Milestones ── */}
      {vis.milestonesCard && (
        <div className="dashboard-card" style={{ ...card, padding: '18px 22px', marginBottom: '0', animationDelay: '300ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ ...TITLE_STYLE, marginBottom: 0 }}>Milestones</div>
            <button
              onClick={() => console.log('add goal')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontFamily: 'inherit' }}
            >
              <Plus size={13} color="var(--color-text-muted)" />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Add goal</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {MILESTONES.map((m, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    {/* Status icon */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: m.achieved ? 'var(--color-text-primary)' : 'var(--color-surface-raised)',
                      border: m.achieved ? 'none' : '0.5px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {m.achieved
                        ? <Check size={11} color="var(--color-surface)" strokeWidth={2.5} />
                        : <Flag  size={11} color="var(--color-text-muted)" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: '11px', color: m.achieved ? 'var(--color-gain)' : 'var(--color-text-muted)', marginTop: '1px' }}>
                        {m.sub}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0, marginLeft: '16px', fontVariantNumeric: 'tabular-nums' }}>
                    {m.target}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: '5px', background: 'var(--color-surface-raised)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.progress}%`, background: 'var(--color-text-primary)', borderRadius: '3px', transition: 'width 600ms ease' }} />
                </div>
              </div>
            ))}
          </div>
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
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 20px 11px 16px',
                      background: 'none', border: 'none',
                      borderRight: on ? '3px solid var(--color-text-primary)' : '3px solid transparent',
                      cursor: item.locked ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 160ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: on ? 'var(--color-text-primary)' : 'transparent',
                        border: on ? 'none' : '1.5px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 160ms ease, border-color 160ms ease',
                      }}>
                        {on && <Check size={10} color="var(--color-surface)" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'left' }}>
                        {item.label}
                      </span>
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

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-text-primary)', color: 'var(--color-surface)',
          padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          boxShadow: 'var(--shadow-md)', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '7px',
          animation: 'fadeSlideUp 200ms ease forwards',
          whiteSpace: 'nowrap',
        }}>
          <Check size={14} />
          Snapshot saved!
        </div>
      )}
    </>
  )
}
