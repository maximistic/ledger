'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Plus, Pencil, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

interface SipConfig {
  id: string; fundId: string; amount: number; dayOfMonth: number
  startDate: string; lastProcessedDate: string | null; status: string
}

interface MFTransaction {
  id: string; fundId: string; date: string; type: string
  units: number; nav: number; amount: number
  description: string | null; autoCreated: boolean
}

interface MFItem {
  id: string; name: string; isin: string | null; folioNumber: string | null
  amfiCode: string | null; platform: string | null; fundHouse: string | null
  fundCategory: string | null; expenseRatio: number | null; exitLoad: string | null
  units: number; avgNav: number; currentNav: number
  investedValue: number; currentValue: number
  gainLoss: number; gainLossPct: number
  hasActiveSip: boolean; lastNavUpdatedAt: string | null
  sipConfig: SipConfig | null; transactionCount: number
}

interface Props {
  fund: MFItem
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

// ─── Badge colors per transaction type ───────────────────────────────────────

const TX_BADGE: Record<string, { bg: string; color: string }> = {
  SIP:        { bg: '#F0FDF4', color: '#16A34A' },
  LUMPSUM:    { bg: '#EFF6FF', color: '#2563EB' },
  REDEMPTION: { bg: '#FFF5F5', color: '#DC2626' },
  SWITCH_IN:  { bg: '#F5F3FF', color: '#7C3AED' },
  SWITCH_OUT: { bg: '#FFF5F5', color: '#DC2626' },
  DIVIDEND:   { bg: '#FFFBEB', color: '#D97706' },
}

// ─── Style constants ──────────────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px',
}
const fieldInput: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13.5px', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none',
}
const errText: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px',
}
const ghostBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '7px 18px', borderRadius: '6px', border: 'none',
  background: 'var(--color-text-primary)', color: 'var(--color-surface)',
  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
}
const dangerBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: '6px', border: 'none',
  background: 'var(--color-loss)', color: '#fff',
  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
}

const TX_TYPES = ['SIP', 'LUMPSUM', 'REDEMPTION', 'SWITCH_IN', 'SWITCH_OUT', 'DIVIDEND']

function formatNav(n: number): string {
  if (!isFinite(n) || n === 0) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

// ─── SIP strip ────────────────────────────────────────────────────────────────

function SipStrip({
  fund,
  sip,
  onSaved,
}: {
  fund: MFItem
  sip: SipConfig | null
  onSaved: () => void
}) {
  const [mode, setMode] = useState<'view' | 'setup' | 'edit'>('view')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [err, setErr] = useState('')

  function startEdit(s: SipConfig) {
    setAmount(String(s.amount))
    setDayOfMonth(String(s.dayOfMonth))
    setStartDate(s.startDate.slice(0, 10))
    setMode('edit')
    setErr('')
  }

  async function handleSave() {
    const a = parseFloat(amount)
    const d = parseInt(dayOfMonth)
    if (isNaN(a) || a <= 0) { setErr('Amount must be > 0'); return }
    if (isNaN(d) || d < 1 || d > 28) { setErr('Day must be 1–28'); return }
    if (!startDate) { setErr('Start date required'); return }
    setSaving(true); setErr('')
    try {
      const url    = sip ? `/api/mf/${fund.id}/sip` : `/api/mf/${fund.id}/sip`
      const method = sip ? 'PUT' : 'POST'
      const body: Record<string, unknown> = { amount: a, dayOfMonth: d }
      if (!sip) body.startDate = startDate
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d2 = await res.json() as { error?: string }
        setErr(cleanError(d2.error)); return
      }
      setMode('view'); onSaved()
    } catch { setErr('Something went wrong.') }
    finally { setSaving(false) }
  }

  async function togglePause() {
    if (!sip) return
    setPausing(true); setErr('')
    try {
      const newStatus = sip.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
      const res = await fetch(`/api/mf/${fund.id}/sip`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const d2 = await res.json() as { error?: string }
        setErr(cleanError(d2.error)); return
      }
      onSaved()
    } catch { setErr('Something went wrong.') }
    finally { setPausing(false) }
  }

  async function deleteSip() {
    if (!sip) return
    setPausing(true); setErr('')
    try {
      const res = await fetch(`/api/mf/${fund.id}/sip`, { method: 'DELETE' })
      if (!res.ok) {
        const d2 = await res.json() as { error?: string }
        setErr(cleanError(d2.error)); return
      }
      setMode('view'); onSaved()
    } catch { setErr('Something went wrong.') }
    finally { setPausing(false) }
  }

  if (mode === 'setup' || mode === 'edit') {
    return (
      <div style={{
        background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
        borderRadius: '8px', padding: '14px 16px', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
          {mode === 'setup' ? 'Set up SIP' : 'Edit SIP'}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>Amount (₹)</div>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" style={fieldInput} />
          </div>
          <div style={{ width: '80px' }}>
            <div style={fieldLabel}>Day</div>
            <input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} placeholder="1" style={fieldInput} />
          </div>
          {!sip && (
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Start date</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...fieldInput, colorScheme: 'light dark' }} />
            </div>
          )}
        </div>
        {err && <div style={errText}>{err}</div>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button onClick={() => setMode('view')} style={ghostBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, background: saving ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
            {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  if (!sip) {
    return (
      <div style={{
        background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
        borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>No SIP configured</span>
        <button
          onClick={() => { setAmount(''); setDayOfMonth('1'); setStartDate(''); setMode('setup') }}
          style={{ ...ghostBtn, padding: '5px 12px', fontSize: '12px' }}
        >
          Set up SIP
        </button>
      </div>
    )
  }

  const statusColor = sip.status === 'ACTIVE' ? 'var(--color-gain)' : 'var(--color-text-muted)'
  return (
    <div style={{
      background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
      borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {formatINR(sip.amount)} / month
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '20px', background: sip.status === 'ACTIVE' ? '#F0FDF4' : 'var(--color-surface-raised)',
            color: statusColor, letterSpacing: '0.3px',
          }}>
            {sip.status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => startEdit(sip)}
            style={{ ...ghostBtn, padding: '4px 10px', fontSize: '12px', gap: '4px', display: 'flex', alignItems: 'center' }}
          >
            <Pencil size={11} /> Edit
          </button>
          <button
            onClick={togglePause}
            disabled={pausing}
            style={{ ...ghostBtn, padding: '4px 10px', fontSize: '12px' }}
          >
            {pausing ? '…' : sip.status === 'ACTIVE' ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={deleteSip}
            disabled={pausing}
            style={{ ...ghostBtn, padding: '4px 8px', fontSize: '12px', color: 'var(--color-loss)' }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
        Day {sip.dayOfMonth} of each month
        {sip.lastProcessedDate && ` · Last: ${formatDate(sip.lastProcessedDate)}`}
      </div>
      {err && <div style={{ ...errText, marginTop: '6px' }}>{err}</div>}
    </div>
  )
}

// ─── Add transaction form ─────────────────────────────────────────────────────

function AddTxForm({
  fundId,
  onSuccess,
  onCancel,
}: {
  fundId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [txType, setTxType] = useState('SIP')
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10))
  const [txUnits, setTxUnits] = useState('')
  const [txNav, setTxNav] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [amtManual, setAmtManual] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    if (amtManual) return
    const u = parseFloat(txUnits) || 0
    const n = parseFloat(txNav) || 0
    if (u > 0 && n > 0) setTxAmount(String(parseFloat((u * n).toFixed(2))))
    else setTxAmount('')
  }, [txUnits, txNav, amtManual])

  async function submit() {
    const errs: Record<string, string> = {}
    if (!txDate) errs.date = 'Required'
    const u = parseFloat(txUnits)
    if (isNaN(u) || u <= 0) errs.units = 'Must be > 0'
    const n = parseFloat(txNav)
    if (isNaN(n) || n <= 0) errs.nav = 'Must be > 0'
    const a = parseFloat(txAmount)
    if (isNaN(a) || a <= 0) errs.amount = 'Must be > 0'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true); setSaveErr('')
    try {
      const res = await fetch(`/api/mf/${fundId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: txDate, type: txType, units: u, nav: n, amount: a }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setSaveErr(cleanError(d.error)); return
      }
      onSuccess()
    } catch { setSaveErr('Something went wrong.') }
    finally { setSaving(false) }
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
      borderRadius: '8px', padding: '14px 16px', marginTop: '12px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
        Add transaction
      </div>

      {/* Type + Date */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={fieldLabel}>Type</div>
          <select value={txType} onChange={e => setTxType(e.target.value)} style={{ ...fieldInput, cursor: 'pointer' }}>
            {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={fieldLabel}>Date</div>
          <input
            type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            style={{ ...fieldInput, colorScheme: 'light dark' }}
          />
          {errors.date && <div style={errText}>{errors.date}</div>}
        </div>
      </div>

      {/* Units + NAV + Amount */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={fieldLabel}>Units</div>
          <input
            type="number" min="0" step="any" value={txUnits}
            onChange={e => { setTxUnits(e.target.value); setErrors(p => ({ ...p, units: '' })) }}
            placeholder="0"
            style={{ ...fieldInput, fontVariantNumeric: 'tabular-nums' }}
          />
          {errors.units && <div style={errText}>{errors.units}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={fieldLabel}>NAV (₹)</div>
          <input
            type="number" min="0" step="any" value={txNav}
            onChange={e => { setTxNav(e.target.value); setErrors(p => ({ ...p, nav: '' })) }}
            placeholder="0.00"
            style={{ ...fieldInput, fontVariantNumeric: 'tabular-nums' }}
          />
          {errors.nav && <div style={errText}>{errors.nav}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={fieldLabel}>Amount (₹)</div>
          <input
            type="number" min="0" step="any" value={txAmount}
            onChange={e => { setTxAmount(e.target.value); setAmtManual(true); setErrors(p => ({ ...p, amount: '' })) }}
            placeholder="0.00"
            style={{ ...fieldInput, fontVariantNumeric: 'tabular-nums' }}
          />
          {errors.amount && <div style={errText}>{errors.amount}</div>}
        </div>
      </div>

      {saveErr && <div style={errText}>{saveErr}</div>}

      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ ...primaryBtn, background: saving ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
          {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export default function FundDetailDialog({ fund, onClose, onEdit, onDelete, onRefresh }: Props) {
  const [transactions, setTransactions] = useState<MFTransaction[]>([])
  const [txLoading, setTxLoading] = useState(true)
  const [showAddTx, setShowAddTx] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)

  const avatarText = fund.name.split(' ')[0].slice(0, 6).toUpperCase()
  const gainColor  = fund.gainLoss >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  const navStale   = fund.currentNav === 0

  async function fetchTransactions() {
    setTxLoading(true)
    try {
      const res = await fetch(`/api/mf/${fund.id}/transactions`)
      const data = await res.json() as { transactions?: MFTransaction[] }
      setTransactions(data.transactions ?? [])
    } catch { /* silent */ }
    finally { setTxLoading(false) }
  }

  useEffect(() => { fetchTransactions() }, [fund.id])

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  async function handleDelete() {
    setDeleting(true); setDeleteErr('')
    try {
      const res = await fetch(`/api/mf/${fund.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setDeleteErr(cleanError(d.error)); setDeleting(false); return
      }
      onDelete(); onClose()
    } catch { setDeleteErr('Something went wrong.'); setDeleting(false) }
  }

  function handleTxAdded() {
    setShowAddTx(false)
    fetchTransactions()
    onRefresh()
  }

  function handleSipSaved() {
    onRefresh()
  }

  const sipData = fund.sipConfig ?? null

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: '12px',
          width: '100%', maxWidth: '580px',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '18px 22px 0', borderBottom: '0.5px solid var(--color-border)' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px', height: '38px', minWidth: '38px', borderRadius: '8px',
                background: 'var(--color-surface-raised)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: '#555',
              }}>
                {avatarText}
              </div>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                  {fund.name}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {[fund.fundHouse, fund.fundCategory].filter(Boolean).join(' · ') || 'Mutual Fund'}
                  {fund.hasActiveSip && (
                    <span style={{
                      marginLeft: '6px', fontSize: '9.5px', fontWeight: 700,
                      padding: '1px 5px', borderRadius: '3px',
                      background: '#F0FDF4', color: '#16A34A',
                    }}>SIP</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', paddingBottom: '16px' }}>
            {[
              { label: 'Invested', value: formatINR(fund.investedValue) },
              { label: 'Current value', value: navStale ? '—' : formatINR(fund.currentValue) },
              { label: 'P&L', value: navStale ? '—' : formatINR(Math.abs(fund.gainLoss)), color: navStale ? undefined : gainColor },
              { label: 'Units', value: fund.units.toLocaleString('en-IN', { maximumFractionDigits: 4 }) },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRadius: '8px', padding: '10px 12px',
              }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  {stat.label}
                </div>
                <div style={{
                  fontSize: '14px', fontWeight: 600,
                  color: stat.color ?? 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* Fund info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: '16px' }}>
            {[
              { label: 'Avg NAV', value: formatNav(fund.avgNav) },
              { label: 'Current NAV', value: navStale ? '— (not updated)' : formatNav(fund.currentNav) },
              { label: 'Platform', value: fund.platform ?? '—' },
              { label: 'ISIN', value: fund.isin ?? '—' },
              { label: 'Folio', value: fund.folioNumber ?? '—' },
              { label: 'NAV updated', value: fund.lastNavUpdatedAt ? formatDate(fund.lastNavUpdatedAt) : '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                  {f.label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* SIP strip */}
          <SipStrip fund={fund} sip={sipData} onSaved={handleSipSaved} />

          {/* Transactions section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Transactions ({transactions.length})
            </div>
            {!showAddTx && (
              <button
                onClick={() => setShowAddTx(true)}
                style={{ ...ghostBtn, padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>

          {showAddTx && (
            <AddTxForm
              fundId={fund.id}
              onSuccess={handleTxAdded}
              onCancel={() => setShowAddTx(false)}
            />
          )}

          {txLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  height: '52px', background: 'var(--color-surface)',
                  border: '0.5px solid var(--color-border)',
                  borderRadius: i === 0 ? '8px 8px 0 0' : i === 2 ? '0 0 8px 8px' : '0',
                  animation: 'pulse 1.4s ease infinite',
                }} />
              ))}
            </div>
          ) : transactions.length === 0 && !showAddTx ? (
            <div style={{
              padding: '24px', textAlign: 'center',
              fontSize: '13px', color: 'var(--color-text-muted)',
              background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '8px',
            }}>
              No transactions yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {transactions.map((tx, i) => {
                const badge = TX_BADGE[tx.type] ?? { bg: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }
                const isLast = i === transactions.length - 1
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--color-surface)',
                    border: '0.5px solid var(--color-border)',
                    borderRadius: i === 0 ? '8px 8px 0 0' : isLast ? '0 0 8px 8px' : '0',
                    padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 7px',
                        borderRadius: '4px', background: badge.bg, color: badge.color,
                        letterSpacing: '0.3px', whiteSpace: 'nowrap',
                      }}>
                        {tx.type.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {formatDate(tx.date)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(tx.amount)}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        {tx.units.toLocaleString('en-IN', { maximumFractionDigits: 4 })} units · {formatNav(tx.nav)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          borderTop: '0.5px solid var(--color-border)',
          padding: '14px 22px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {confirmDelete ? (
            <>
              <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                Delete <strong>{fund.name}</strong>? This cannot be undone.
              </span>
              {deleteErr && <span style={{ fontSize: '11px', color: 'var(--color-loss)' }}>{deleteErr}</span>}
              <button onClick={() => setConfirmDelete(false)} style={ghostBtn}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={dangerBtn}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ ...ghostBtn, color: 'var(--color-loss)', borderColor: 'var(--color-loss)', marginRight: 'auto' }}
              >
                <Trash2 size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Delete
              </button>
              <button
                onClick={onEdit}
                style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Pencil size={13} /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
