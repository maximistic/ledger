'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'

interface ClassItem {
  id: string
  name: string
  description: string | null
  sortOrder: number
  entryCount: number
  totalCurrentValue: number
  totalPurchasePrice: number
  totalGainLoss: number
  totalGainLossPct: number
}

interface Props {
  onClose: () => void
  onSuccess: (newClass: ClassItem) => void
}

export default function AddAssetClassDialog({ onClose, onSuccess }: Props) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res  = await fetch('/api/custom-assets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: trimmed, description: description.trim() || undefined }),
      })
      const data = await res.json() as { class?: ClassItem; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to create'); return }
      onSuccess(data.class!)
    } catch (err) {
      console.error('AddAssetClassDialog error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>New asset class</div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Name */}
          <div>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
              Name <span style={{ color: 'var(--color-loss)' }}>*</span>
            </div>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="e.g. Real Estate, Gold, PPF, Crypto"
              style={{ width: '100%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '7px', padding: '8px 11px', fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '5px', lineHeight: 1.5 }}>
              All entries added to this class will be tagged with this name as their type.
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
              Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="Short description (optional)"
              style={{ width: '100%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '7px', padding: '8px 11px', fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FFF5F5', border: '0.5px solid #FECDD3', borderRadius: '7px', padding: '9px 12px', color: '#DC2626', fontSize: '13px' }}>
              {error}
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
            disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: !name.trim() || saving ? 'var(--color-text-muted)' : 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: !name.trim() || saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Creating…' : 'Create class'}
          </button>
        </div>
      </div>
    </div>
  )
}
