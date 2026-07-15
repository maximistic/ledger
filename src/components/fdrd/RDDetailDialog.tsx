'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Trash2, Plus } from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'
import { RDAccount, RDTopUp, bankInitials, getDaysToMaturity, getMaturityStatus, ghostBtnStyle } from './FDRDTab'

interface Props {
  rd: RDAccount
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--color-text-primary)' : 'var(--color-border)', position: 'relative', cursor: 'pointer', transition: 'background 200ms ease', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

export default function RDDetailDialog({ rd: initialRd, onClose, onEdit, onDelete, onRefresh }: Props) {
  const [rd, setRd]             = useState<RDAccount>(initialRd)
  const [deleting, setDeleting]  = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Top-up add form state
  const [showAddTopUp, setShowAddTopUp]     = useState(false)
  const [topUpAmount,  setTopUpAmount]       = useState('')
  const [topUpDate,    setTopUpDate]         = useState('')
  const [topUpRecurring, setTopUpRecurring] = useState(false)
  const [topUpNotes,   setTopUpNotes]        = useState('')
  const [addingTopUp,  setAddingTopUp]       = useState(false)
  const [topUpError,   setTopUpError]        = useState('')
  const [deletingTopUpId, setDeletingTopUpId] = useState<string | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function refreshRD() {
    try {
      const res  = await fetch(`/api/rd/${rd.id}`)
      const data = await res.json() as { rd?: RDAccount }
      if (data.rd) setRd(data.rd)
      onRefresh()
    } catch {}
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true); setDeleteError('')
    try {
      const res = await fetch(`/api/rd/${rd.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setDeleteError(data.error ?? 'Delete failed')
        return
      }
      onDelete(); onClose()
    } catch {
      setDeleteError('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddTopUp() {
    const amount = parseFloat(topUpAmount) || 0
    if (amount <= 0) { setTopUpError('Amount must be > 0'); return }
    if (!topUpDate)  { setTopUpError('Start date is required'); return }

    setAddingTopUp(true); setTopUpError('')
    try {
      const res = await fetch(`/api/rd/${rd.id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, startDate: topUpDate, isRecurring: topUpRecurring, notes: topUpNotes || null }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setTopUpError(data.error ?? 'Failed to add top-up')
        return
      }
      setTopUpAmount(''); setTopUpDate(''); setTopUpRecurring(false); setTopUpNotes('')
      setShowAddTopUp(false)
      await refreshRD()
    } catch {
      setTopUpError('Something went wrong. Please try again.')
    } finally {
      setAddingTopUp(false)
    }
  }

  async function handleDeleteTopUp(topUpId: string) {
    setDeletingTopUpId(topUpId)
    try {
      const res = await fetch(`/api/rd/${rd.id}/topup/${topUpId}`, { method: 'DELETE' })
      if (res.ok) await refreshRD()
    } catch {}
    finally { setDeletingTopUpId(null) }
  }

  const status   = getMaturityStatus(rd.maturityDate)
  const days     = getDaysToMaturity(rd.maturityDate)
  const isMatured = status === 'MATURED'
  const daysColor = status === 'OK' ? 'var(--color-text-primary)' : status === 'WARNING' ? '#F59E0B' : 'var(--color-loss)'
  const daysDisplay = isMatured ? 'Matured' : `${days} days`

  const inputSt: React.CSSProperties = {
    width: '100%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
    borderRadius: '7px', padding: '7px 10px', fontSize: '13px',
    color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, minWidth: 42, borderRadius: '9px', background: 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              {bankInitials(rd.bankName)}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{rd.name}</div>
              <div style={{ display: 'inline-block', marginTop: '3px', fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-surface-raised)', padding: '2px 7px', borderRadius: '3px' }}>
                {rd.platform}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '16px 20px' }}>
            {([
              { label: 'Current Value',    value: formatINR(rd.currentValue) },
              { label: 'Total Invested',   value: formatINR(rd.totalInvested) },
              { label: 'Interest Earned',  value: `+${formatINR(rd.interestEarned)}`, color: 'var(--color-gain)' },
              { label: 'Days to Maturity', value: daysDisplay, color: daysColor },
            ] as { label: string; value: string; color?: string }[]).map(card => (
              <div key={card.label} style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '5px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: card.color ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Info strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', padding: '12px 20px', borderTop: '0.5px solid var(--color-border)', borderBottom: '0.5px solid var(--color-border)' }}>
            {([
              { label: 'Bank',           value: rd.bankName },
              { label: 'Platform',       value: rd.platform },
              { label: 'Monthly Amount', value: formatINR(rd.monthlyAmount) },
              { label: 'Rate',           value: `${rd.interestRate.toFixed(2)}% p.a.` },
              { label: 'Start Date',     value: formatDate(rd.startDate) },
              { label: 'Maturity Date',  value: formatDate(rd.maturityDate) },
              { label: 'Day of Month',   value: `${rd.dayOfMonth}${rd.dayOfMonth === 1 ? 'st' : rd.dayOfMonth === 2 ? 'nd' : rd.dayOfMonth === 3 ? 'rd' : 'th'}` },
              { label: 'Auto-renew',     value: rd.isAutoRenew ? 'Yes' : 'No' },
            ]).map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Projection */}
          <div style={{ padding: '14px 20px', background: 'var(--color-surface)', borderBottom: '0.5px solid var(--color-border)' }}>
            {isMatured ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Matured on {formatDate(rd.maturityDate)}</div>
            ) : (
              <>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Maturity Value</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(rd.maturityValue)}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px' }}>On {formatDate(rd.maturityDate)}</div>
              </>
            )}
          </div>

          {/* Top-ups section */}
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)' }}>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
              Top-ups
            </div>

            {rd.topUps.length === 0 && !showAddTopUp && (
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                No top-ups added.
              </div>
            )}

            {rd.topUps.map((tu: RDTopUp) => (
              <div key={tu.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    +{formatINR(tu.amount)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                    {tu.isRecurring ? 'monthly' : 'one-time'}
                  </span>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    From {formatDate(tu.startDate)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTopUp(tu.id)}
                  disabled={deletingTopUpId === tu.id}
                  style={{ padding: '5px', border: 'none', background: 'none', cursor: deletingTopUpId === tu.id ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', borderRadius: '4px', lineHeight: 0 }}
                >
                  {deletingTopUpId === tu.id
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Trash2 size={13} />
                  }
                </button>
              </div>
            ))}

            {/* Inline add form */}
            {showAddTopUp && (
              <div style={{ marginTop: '10px', padding: '12px', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Amount (₹)</div>
                    <input type="number" min="0" step="any" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="0" style={{ ...inputSt, fontVariantNumeric: 'tabular-nums' }}
                      onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Start Date</div>
                    <input type="date" value={topUpDate} onChange={e => setTopUpDate(e.target.value)} style={{ ...inputSt, colorScheme: 'light dark' }}
                      onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Recurring monthly</span>
                  <Toggle on={topUpRecurring} onChange={setTopUpRecurring} />
                </div>
                {topUpError && <div style={{ fontSize: '11px', color: 'var(--color-loss)' }}>{topUpError}</div>}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowAddTopUp(false); setTopUpError('') }} style={{ ...ghostBtnStyle, fontSize: '12px', padding: '5px 12px' }}>Cancel</button>
                  <button
                    onClick={handleAddTopUp}
                    disabled={addingTopUp}
                    style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: addingTopUp ? 'var(--color-text-muted)' : 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '12px', fontFamily: 'inherit', cursor: addingTopUp ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    {addingTopUp && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                    {addingTopUp ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            {!showAddTopUp && (
              <button
                onClick={() => setShowAddTopUp(true)}
                style={{ marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
              >
                <Plus size={13} /> Add top-up
              </button>
            )}
          </div>

          {/* Notes */}
          {rd.notes && (
            <div style={{ padding: '14px 20px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '5px' }}>Notes</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{rd.notes}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onEdit} style={ghostBtnStyle}>Edit</button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ padding: '7px 14px', borderRadius: '6px', border: '0.5px solid var(--color-loss)', background: 'transparent', color: deleting ? 'var(--color-text-muted)' : 'var(--color-loss)', fontSize: '12.5px', fontFamily: 'inherit', cursor: deleting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              {deleting && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            {deleteError && <span style={{ fontSize: '11.5px', color: 'var(--color-loss)' }}>{deleteError}</span>}
          </div>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
