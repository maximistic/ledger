'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'

export interface EntryItem {
  id: string
  name: string
  type: string
  purchasePrice: number
  currentValue: number
  purchaseDate: string | null
  notes: string | null
  lastUpdatedAt: string
  createdAt: string
}

interface Props {
  classId:   string
  className: string
  entry?:    EntryItem
  onClose:   () => void
  onSuccess: () => void
}

export default function AddEditEntryDialog({ classId, className, entry, onClose, onSuccess }: Props) {
  const mode = entry ? 'edit' : 'add'

  const [name,          setName]          = useState(entry?.name ?? '')
  const [purchasePrice, setPurchasePrice] = useState(entry ? String(entry.purchasePrice) : '')
  const [currentValue,  setCurrentValue]  = useState(entry ? String(entry.currentValue)  : '')
  const [purchaseDate,  setPurchaseDate]  = useState(() => {
    if (!entry?.purchaseDate) return ''
    return new Date(entry.purchaseDate).toISOString().split('T')[0]
  })
  const [notes,  setNotes]  = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  // Live gain/loss preview
  const cv = parseFloat(currentValue) || 0
  const pp = parseFloat(purchasePrice) || 0
  const gainLoss    = cv - pp
  const gainLossPct = pp > 0 ? (gainLoss / pp) * 100 : 0
  const showPreview = cv > 0 && pp > 0

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!name.trim())              e.name = 'Name is required'
    if (!currentValue || cv <= 0) e.currentValue = 'Current value must be greater than 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    setApiError('')
    try {
      const body = {
        name: name.trim(),
        purchasePrice: parseFloat(purchasePrice) || 0,
        currentValue: cv,
        purchaseDate: purchaseDate || undefined,
        notes: notes.trim() || undefined,
      }

      const url = mode === 'add'
        ? `/api/custom-assets/${classId}/entries`
        : `/api/custom-assets/${classId}/entries/${entry!.id}`

      const res  = await fetch(url, {
        method:  mode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setApiError(data.error ?? 'Failed to save'); return }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('AddEditEntryDialog error:', err)
      setApiError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fieldLabel: React.CSSProperties = {
    fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
    fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px',
  }
  const input: React.CSSProperties = {
    width: '100%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
    borderRadius: '7px', padding: '8px 11px', fontSize: '13px', color: 'var(--color-text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const errInput: React.CSSProperties = { ...input, borderColor: '#FECDD3' }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '460px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {mode === 'add' ? `Add entry` : 'Edit entry'}
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Row 1: Name */}
          <div>
            <div style={fieldLabel}>Entry name <span style={{ color: 'var(--color-loss)' }}>*</span></div>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
              placeholder={`e.g. "Apartment — Whitefield"`}
              style={errors.name ? errInput : input}
            />
            {errors.name && <div style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '4px' }}>{errors.name}</div>}
          </div>

          {/* Type display (read-only) */}
          <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '7px', padding: '8px 11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Type</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{className}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Set by asset class</span>
          </div>

          {/* Row 2: Purchase date */}
          <div>
            <div style={fieldLabel}>Purchase date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
            <input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              style={input}
            />
          </div>

          {/* Row 3: Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={fieldLabel}>Purchase price (₹) <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                type="number"
                min={0}
                step="any"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                placeholder="0"
                style={input}
              />
            </div>
            <div>
              <div style={fieldLabel}>Current value (₹) <span style={{ color: 'var(--color-loss)' }}>*</span></div>
              <input
                type="number"
                min={0}
                step="any"
                value={currentValue}
                onChange={e => { setCurrentValue(e.target.value); setErrors(p => ({ ...p, currentValue: '' })) }}
                placeholder="0"
                style={errors.currentValue ? errInput : input}
              />
              {errors.currentValue && <div style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '4px' }}>{errors.currentValue}</div>}
            </div>
          </div>

          {/* Live gain/loss preview */}
          {showPreview && (
            <div style={{
              background: gainLoss > 0 ? '#F0FDF6' : gainLoss < 0 ? '#FFF5F5' : '#F7F6F2',
              border: `0.5px solid ${gainLoss > 0 ? '#BBF7D0' : gainLoss < 0 ? '#FECDD3' : 'var(--color-border)'}`,
              borderRadius: '7px', padding: '8px 12px',
              color: gainLoss > 0 ? '#15803D' : gainLoss < 0 ? '#DC2626' : '#555',
              fontSize: '13px', fontWeight: 500,
            }}>
              Unrealised {gainLoss >= 0 ? 'gain' : 'loss'}:{' '}
              {gainLoss >= 0 ? '+' : '−'}₹{Math.abs(gainLoss).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' · '}
              {gainLossPct >= 0 ? '+' : '−'}{Math.abs(gainLossPct).toFixed(2)}%
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={fieldLabel}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this entry…"
              style={{ ...input, resize: 'vertical', minHeight: '56px' }}
            />
          </div>

          {apiError && (
            <div style={{ background: '#FFF5F5', border: '0.5px solid #FECDD3', borderRadius: '7px', padding: '9px 12px', color: '#DC2626', fontSize: '13px' }}>
              {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '0.5px solid var(--color-border)', display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: saving ? 'var(--color-text-muted)' : 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : mode === 'add' ? 'Add entry' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
