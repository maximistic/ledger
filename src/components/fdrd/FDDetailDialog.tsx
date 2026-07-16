'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'
import { FDAccount, bankInitials, getDaysToMaturity, getMaturityStatus, ghostBtnStyle } from './FDRDTab'

const COMPOUNDING_LABEL: Record<string, string> = {
  SIMPLE: 'Simple Interest', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly', ANNUALLY: 'Annually',
}

interface Props {
  fd: FDAccount
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function FDDetailDialog({ fd, onClose, onEdit, onDelete }: Props) {
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const status   = getMaturityStatus(fd.maturityDate)
  const days     = getDaysToMaturity(fd.maturityDate)
  const isMatured = status === 'MATURED'

  const daysColor = status === 'OK' ? 'var(--color-text-primary)'
    : status === 'WARNING' ? '#F59E0B'
    : 'var(--color-loss)'
  const daysDisplay = isMatured ? 'Matured' : `${days} days`

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res  = await fetch(`/api/fd/${fd.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setDeleteError(data.error ?? 'Delete failed')
        return
      }
      onDelete()
      onClose()
    } catch {
      setDeleteError('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const infoItems = [
    { label: 'Bank',         value: fd.bankName },
    { label: 'Platform',     value: fd.platform },
    { label: 'Rate',         value: `${fd.interestRate.toFixed(2)}% p.a.` },
    { label: 'Compounding',  value: COMPOUNDING_LABEL[fd.compoundingType] ?? fd.compoundingType },
    { label: 'Type',         value: fd.fdType === 'NON_CUMULATIVE' ? 'Non-Cumulative' : fd.fdType.charAt(0) + fd.fdType.slice(1).toLowerCase() },
    { label: 'Start Date',   value: formatDate(fd.startDate) },
    { label: 'Maturity Date',value: formatDate(fd.maturityDate) },
    { label: 'Auto-renew',   value: fd.isAutoRenew ? 'Yes' : 'No' },
  ]

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        className="dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, minWidth: 42, borderRadius: '9px', background: 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              {bankInitials(fd.bankName)}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{fd.name}</div>
              <div style={{ display: 'inline-block', marginTop: '3px', fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-surface-raised)', padding: '2px 7px', borderRadius: '3px' }}>
                {fd.platform}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '16px 20px' }}>
            {([
              { label: 'Current Value',    value: formatINR(fd.currentValue) },
              { label: 'Principal',        value: formatINR(fd.principal) },
              { label: 'Interest Earned',  value: `+${formatINR(fd.interestEarned)}`, color: 'var(--color-gain)' },
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
            {infoItems.map(item => (
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

          {/* Projection strip */}
          <div style={{ padding: '14px 20px', background: 'var(--color-surface)', borderBottom: '0.5px solid var(--color-border)' }}>
            {isMatured ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Matured on {formatDate(fd.maturityDate)}
              </div>
            ) : (
              <>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Maturity Value
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(fd.maturityValue)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                  On {formatDate(fd.maturityDate)}
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          {fd.notes && (
            <div style={{ padding: '14px 20px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '5px' }}>
                Notes
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {fd.notes}
              </div>
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
              style={{
                padding: '7px 14px', borderRadius: '6px',
                border: '0.5px solid var(--color-loss)',
                background: 'transparent',
                color: deleting ? 'var(--color-text-muted)' : 'var(--color-loss)',
                fontSize: '12.5px', fontFamily: 'inherit',
                cursor: deleting ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '5px',
              }}
            >
              {deleting && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            {deleteError && <span style={{ fontSize: '11.5px', color: 'var(--color-loss)' }}>{deleteError}</span>}
          </div>
          <button
            onClick={onClose}
            style={{ padding: '7px 16px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
