'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2 } from 'lucide-react'

interface Milestone {
  id: string
  title: string
  targetAmount: number
  targetAsset: string | null
  achievedDate: string | null
  isAchieved: boolean
  progressPct: number
  amountAway: number
  currentValue: number
}

type MilestoneDialog =
  | { mode: 'add' }
  | { mode: 'edit'; milestone: Milestone }
  | null

const ASSET_OPTIONS = [
  { label: 'Total portfolio', value: 'total' },
  { label: 'Stocks',          value: 'stocks' },
  { label: 'Mutual Funds',    value: 'mf' },
  { label: 'EPF',             value: 'epf' },
  { label: 'FDs & RDs',       value: 'fd' },
  { label: 'International',   value: 'us' },
  { label: 'Any asset',       value: '' },
]

function formatShort(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatDateShort(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SK: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '7px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '13.5px', fontFamily: 'inherit', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11.5px', color: 'var(--color-text-muted)',
  marginBottom: '5px', display: 'block',
}

interface Props {
  onLoaded?: (sub: string) => void
}

export default function MilestonesSection({ onLoaded }: Props) {
  const [milestones,   setMilestones]   = useState<Milestone[]>([])
  const [loading,      setLoading]      = useState(true)
  const [dialog,       setDialog]       = useState<MilestoneDialog>(null)
  const [mlTitle,      setMlTitle]      = useState('')
  const [mlAmount,     setMlAmount]     = useState('')
  const [mlAsset,      setMlAsset]      = useState('total')
  const [mlSubmitting, setMlSubmitting] = useState(false)
  const [mlError,      setMlError]      = useState('')
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // Stable ref so fetchData doesn't need onLoaded in its deps
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => { onLoadedRef.current = onLoaded })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/milestones')
      if (res.ok) {
        const d = await res.json() as { milestones: Milestone[] }
        setMilestones(d.milestones)
        const achieved = d.milestones.filter(m => m.isAchieved).length
        onLoadedRef.current?.(`${achieved} achieved`)
      }
    } catch (err) {
      console.error('Failed to load milestones', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Escape closes dialog
  useEffect(() => {
    if (!dialog) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setDialog(null) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [dialog])

  function openAdd() {
    setMlTitle(''); setMlAmount(''); setMlAsset('total'); setMlError('')
    setDialog({ mode: 'add' })
  }

  function openEdit(m: Milestone) {
    setMlTitle(m.title)
    setMlAmount(String(m.targetAmount))
    setMlAsset(m.targetAsset ?? 'total')
    setMlError('')
    setDialog({ mode: 'edit', milestone: m })
  }

  async function handleSubmit() {
    if (!dialog) return
    const trimTitle = mlTitle.trim()
    const amount = parseFloat(mlAmount)
    if (!trimTitle) { setMlError('Goal title is required'); return }
    if (!mlAmount || isNaN(amount) || amount <= 0) { setMlError('Target amount must be greater than 0'); return }
    setMlSubmitting(true)
    setMlError('')
    try {
      const targetAsset = mlAsset || null
      const url    = dialog.mode === 'add' ? '/api/milestones' : `/api/milestones/${dialog.milestone.id}`
      const method = dialog.mode === 'add' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimTitle, targetAmount: amount, targetAsset }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setMlError(d.error ?? 'Failed to save')
        return
      }
      setDialog(null)
      await fetchData()
    } finally {
      setMlSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await fetch(`/api/milestones/${id}`, { method: 'DELETE' })
      setDeleteId(null)
      await fetchData()
    } finally {
      setDeleting(false)
    }
  }

  const achieved   = milestones.filter(m => m.isAchieved).length
  const inProgress = milestones.filter(m => !m.isAchieved).length

  return (
    <>
      {/* Summary pills */}
      {!loading && milestones.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: '#F0FDF4', color: '#16A34A' }}>
            {achieved} achieved
          </span>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: '#F7F6F2', color: '#555555' }}>
            {inProgress} in progress
          </span>
        </div>
      )}

      {/* Main card */}
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Your goals</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Set targets and track your progress</div>
          </div>
          <button
            onClick={openAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            + Add goal
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '14px 22px', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
                <div style={{ ...SK, height: 14, width: '45%', marginBottom: '8px' }} />
                <div style={{ ...SK, height: 4, borderRadius: '2px' }} />
              </div>
            ))}
          </>
        ) : milestones.length === 0 ? (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No milestones yet</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '280px', textAlign: 'center', lineHeight: 1.5 }}>
              Add your first financial goal to start tracking progress.
            </div>
            <button
              onClick={openAdd}
              style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              + Add goal
            </button>
          </div>
        ) : (
          milestones.map((m, i) => (
            <div
              key={m.id}
              style={{ padding: '14px 22px', borderBottom: i < milestones.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              {/* Left: title + subtitle + progress bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => openEdit(m)}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Target: {formatShort(m.targetAmount)}
                    {m.targetAsset ? ` in ${ASSET_OPTIONS.find(o => o.value === m.targetAsset)?.label ?? m.targetAsset}` : ''}
                  </div>
                </button>
                <div style={{ height: '4px', background: 'var(--color-surface-raised)', borderRadius: '2px', overflow: 'hidden', marginTop: '7px' }}>
                  <div className={m.isAchieved ? 'milestone-bar-achieved' : 'milestone-bar-progress'} style={{ height: '100%', width: `${m.progressPct}%`, borderRadius: '2px', transition: 'width 600ms ease' }} />
                </div>
              </div>

              {/* Right: achieved badge or progress % */}
              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
                {m.isAchieved ? (
                  <>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'var(--color-gain-subtle)', color: 'var(--color-gain)', display: 'inline-block', marginBottom: '2px' }}>
                      ✓ Achieved
                    </span>
                    {m.achievedDate && (
                      <div className="milestone-text-achieved" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                        {formatDateShort(m.achievedDate)}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{m.progressPct}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatShort(m.amountAway)} away</div>
                  </>
                )}
              </div>

              {/* Delete control */}
              <div style={{ flexShrink: 0 }}>
                {deleteId === m.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: '#DC2626', whiteSpace: 'nowrap' }}>Delete?</span>
                    <button
                      onClick={() => setDeleteId(null)}
                      style={{ padding: '4px 8px', borderRadius: '5px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deleting}
                      style={{ padding: '4px 8px', borderRadius: '5px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '11.5px', fontFamily: 'inherit', cursor: deleting ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {deleting ? '…' : 'Yes'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteId(m.id)}
                    style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 0, borderRadius: '4px', transition: 'color 120ms ease, background 120ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FFF5F5' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit dialog */}
      {dialog !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDialog(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="dialog-panel"
            style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
          >
            <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {dialog.mode === 'add' ? 'Add milestone' : 'Edit milestone'}
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Goal title</label>
                <input
                  type="text" placeholder="e.g. ₹5L total portfolio"
                  style={inputStyle} value={mlTitle}
                  onChange={e => setMlTitle(e.target.value)} autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Target amount (₹)</label>
                <input
                  type="number" min={1} placeholder="500000"
                  style={inputStyle} value={mlAmount}
                  onChange={e => setMlAmount(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Track against</label>
                <select
                  value={mlAsset} onChange={e => setMlAsset(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}
                >
                  {ASSET_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {mlError && (
                <div style={{ fontSize: '12px', color: 'var(--color-loss)', padding: '8px 10px', background: 'var(--color-loss-subtle)', borderRadius: '6px' }}>
                  {mlError}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setDialog(null)}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit} disabled={mlSubmitting}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: mlSubmitting ? 'default' : 'pointer', opacity: mlSubmitting ? 0.7 : 1 }}
              >
                {mlSubmitting ? 'Saving…' : dialog.mode === 'add' ? 'Add goal' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
