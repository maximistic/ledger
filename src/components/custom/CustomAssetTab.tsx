'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { formatINR, formatShort, formatShortSigned, formatPctSigned, formatDate } from '@/lib/utils'
import AddEditEntryDialog, { type EntryItem } from './AddEditEntryDialog'

interface ClassDetail {
  id: string
  name: string
  entries: EntryItem[]
  totalCurrentValue: number
  totalPurchasePrice: number
  totalGainLoss: number
  totalGainLossPct: number
  entryCount: number
}

interface Props {
  classId:           string
  className:         string
  onSummaryRefresh:  () => void
  onDelete:          () => void
}

const gridCols = '2fr 1fr 1fr 1fr 1fr 80px'

const headerCell: React.CSSProperties = {
  fontSize: '10.5px', color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600,
}

function getTypeBadge(typeName: string): { bg: string; color: string } {
  const lower = typeName.toLowerCase()
  if (lower.includes('real estate') || lower.includes('property')) return { bg: '#FEF3C7', color: '#92400E' }
  if (lower.includes('gold') || lower.includes('silver'))           return { bg: '#FFFBEB', color: '#D97706' }
  if (lower.includes('ppf') || lower.includes('nps') || lower.includes('bond')) return { bg: '#EEF2FF', color: '#4338CA' }
  if (lower.includes('crypto'))                                     return { bg: '#F5F3FF', color: '#7C3AED' }
  return { bg: '#F2F1ED', color: '#555' }
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '8px', padding: '14px 20px', alignItems: 'center', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ height: 13, width: 160, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
        <div style={{ height: 11, width: 100, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
      </div>
      {Array.from({ length: cols - 1 }).map((_, j) => (
        <div key={j} style={{ height: 13, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
      ))}
    </div>
  )
}

export default function CustomAssetTab({ classId, className, onSummaryRefresh, onDelete }: Props) {
  const [detail,        setDetail]        = useState<ClassDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [showAdd,       setShowAdd]       = useState(false)
  const [editingEntry,  setEditingEntry]  = useState<EntryItem | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletingClass, setDeletingClass] = useState(false)
  const [hoveredId,     setHoveredId]     = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/custom-assets/${classId}`)
      const data = await res.json() as { class?: ClassDetail; error?: string }
      if (res.ok && data.class) setDetail(data.class)
      else console.error('[CustomAssetTab] fetch error:', data.error)
    } catch (err) {
      console.error('[CustomAssetTab] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  async function handleDeleteEntry(entryId: string) {
    setDeletingEntry(entryId)
    try {
      await fetch(`/api/custom-assets/${classId}/entries/${entryId}`, { method: 'DELETE' })
      await fetchDetail()
      onSummaryRefresh()
    } catch (err) {
      console.error('[CustomAssetTab] delete entry error:', err)
    } finally {
      setDeletingEntry(null)
    }
  }

  async function handleDeleteClass() {
    setDeletingClass(true)
    try {
      const res = await fetch(`/api/custom-assets/${classId}`, { method: 'DELETE' })
      if (res.ok) {
        onSummaryRefresh()
        onDelete()
      }
    } catch (err) {
      console.error('[CustomAssetTab] delete class error:', err)
    } finally {
      setDeletingClass(false)
    }
  }

  const gainColor = (v: number) => v > 0 ? 'var(--color-gain)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)'

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ height: 11, width: 80, borderRadius: 4, background: 'var(--color-surface-raised)', animation: 'pulse 1.4s ease infinite', marginBottom: 8 }} />
          <div style={{ height: 32, width: 180, borderRadius: 6, background: 'var(--color-surface-raised)', animation: 'pulse 1.4s ease infinite', marginBottom: 6 }} />
          <div style={{ height: 13, width: 260, borderRadius: 4, background: 'var(--color-surface-raised)', animation: 'pulse 1.4s ease infinite' }} />
        </div>
        <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
            {['Name', 'Type', 'Purchase', 'Current', 'Gain/Loss', ''].map(h => (
              <div key={h} style={headerCell}>{h}</div>
            ))}
          </div>
          {[1, 2, 3].map(i => <SkeletonRow key={i} cols={6} />)}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    )
  }

  const d = detail
  const gainLossColor = gainColor(d?.totalGainLoss ?? 0)

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px', fontWeight: 600 }}>
            {className}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {formatShort(d?.totalCurrentValue ?? 0)}
          </div>
          {(d?.entryCount ?? 0) > 0 && (
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Purchase price </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{formatShort(d?.totalPurchasePrice ?? 0)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: gainLossColor }}>{formatShortSigned(d?.totalGainLoss ?? 0)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · </span>
              <span style={{ color: gainLossColor }}>{formatPctSigned(d?.totalGainLossPct ?? 0)}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '12.5px', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
        >
          <Plus size={13} /> Add entry
        </button>
      </div>

      {/* Table or empty state */}
      {(d?.entries.length ?? 0) === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '10px', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{className} has no entries yet</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Add your first entry to start tracking</div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ marginTop: '4px', padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            + Add entry
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', minWidth: '700px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
              <div style={headerCell}>Name</div>
              <div style={headerCell}>Type</div>
              <div style={{ ...headerCell, textAlign: 'right' }}>Purchase</div>
              <div style={{ ...headerCell, textAlign: 'right' }}>Current</div>
              <div style={{ ...headerCell, textAlign: 'right' }}>Gain/Loss</div>
              <div />
            </div>

            {d?.entries.map((entry, i) => {
              const isLast    = i === (d.entries.length - 1)
              const gl        = entry.currentValue - entry.purchasePrice
              const glPct     = entry.purchasePrice > 0 ? (gl / entry.purchasePrice) * 100 : 0
              const glColor   = gainColor(gl)
              const badge     = getTypeBadge(entry.type)
              const isHovered = hoveredId === entry.id

              return (
                <div
                  key={entry.id}
                  onMouseEnter={() => setHoveredId(entry.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'grid', gridTemplateColumns: gridCols, gap: '8px',
                    padding: '12px 20px', alignItems: 'center',
                    borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
                    background: isHovered ? 'var(--color-surface-raised)' : 'transparent',
                    transition: 'background 120ms ease',
                  }}
                >
                  {/* Name */}
                  <div>
                    <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{entry.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                      Added {formatDate(entry.createdAt)} · Updated {formatDate(entry.lastUpdatedAt)}
                    </div>
                  </div>

                  {/* Type badge */}
                  <div>
                    <span style={{ display: 'inline-block', background: badge.bg, color: badge.color, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}>
                      {entry.type}
                    </span>
                  </div>

                  {/* Purchase */}
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatINR(entry.purchasePrice)}
                  </div>

                  {/* Current */}
                  <div style={{
                    fontSize: '13px', fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    color: entry.currentValue > entry.purchasePrice
                      ? 'var(--color-gain)'
                      : entry.currentValue < entry.purchasePrice
                        ? 'var(--color-loss)'
                        : 'var(--color-text-primary)',
                  }}>
                    {formatINR(entry.currentValue)}
                  </div>

                  {/* Gain/Loss */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: glColor, fontVariantNumeric: 'tabular-nums' }}>
                      {gl >= 0 ? '+' : '−'}{formatINR(Math.abs(gl))}
                    </div>
                    <div style={{ fontSize: '10.5px', color: glColor, marginTop: '1px' }}>
                      {glPct >= 0 ? '+' : '−'}{Math.abs(glPct).toFixed(2)}%
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <button
                      onClick={() => setEditingEntry(entry)}
                      title="Edit"
                      style={{
                        width: '26px', height: '26px', borderRadius: '5px',
                        border: '0.5px solid var(--color-border)', background: 'var(--color-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-muted)', cursor: 'pointer',
                        opacity: isHovered ? 1 : 0, transition: 'opacity 120ms ease',
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      disabled={deletingEntry === entry.id}
                      title="Delete"
                      style={{
                        width: '26px', height: '26px', borderRadius: '5px',
                        border: '0.5px solid #FECDD3', background: '#FFF5F5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#DC2626', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit',
                        opacity: isHovered ? 1 : 0, transition: 'opacity 120ms ease',
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delete class */}
      <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '0.5px solid var(--color-border)' }}>
        {deleteConfirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#DC2626' }}>
              This will delete {d?.entryCount ?? 0} {(d?.entryCount ?? 0) === 1 ? 'entry' : 'entries'}. Are you sure?
            </span>
            <button onClick={() => setDeleteConfirm(false)} style={{ padding: '5px 12px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleDeleteClass}
              disabled={deletingClass}
              style={{ padding: '5px 12px', borderRadius: '6px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {deletingClass ? 'Deleting…' : 'Delete class'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            Delete this asset class
          </button>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {showAdd && (
        <AddEditEntryDialog
          classId={classId} className={className}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { fetchDetail(); onSummaryRefresh() }}
        />
      )}

      {editingEntry && (
        <AddEditEntryDialog
          classId={classId} className={className}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSuccess={() => { fetchDetail(); onSummaryRefresh() }}
        />
      )}
    </div>
  )
}
