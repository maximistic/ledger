'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { calculateRDCurrentValue, calculateRDMaturityValue } from '@/lib/fdCalculator'
import { RDAccount, labelStyle, inputStyle } from './FDRDTab'

const PLATFORMS = [
  'Stable Money','Groww','Kuvera','HDFC Bank','SBI','ICICI Bank',
  'Axis Bank','Kotak Bank','IDFC First Bank','Bajaj Finance',
  'Shriram Finance','Suryoday Bank','Unity Bank','Other',
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--color-text-primary)' : 'var(--color-border)', position: 'relative', cursor: 'pointer', transition: 'background 200ms ease', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

interface TopUpDraft {
  id: string
  amount: string
  startDate: string
  isRecurring: boolean
}

interface Props {
  rd?: RDAccount
  onClose: () => void
  onSuccess: () => void
}

export default function AddRDDialog({ rd, onClose, onSuccess }: Props) {
  const isEdit = !!rd

  const [name,         setName]        = useState(rd?.name ?? '')
  const [bankName,     setBankName]    = useState(rd?.bankName ?? '')
  const [platform,     setPlatform]    = useState(rd?.platform ?? PLATFORMS[0])
  const [monthlyAmt,   setMonthlyAmt]  = useState(rd ? String(rd.monthlyAmount) : '')
  const [interestRate, setInterestRate] = useState(rd ? String(rd.interestRate) : '')
  const [startDate,    setStartDate]   = useState(rd ? rd.startDate.slice(0, 10) : '')
  const [maturityDate, setMaturityDate] = useState(rd ? rd.maturityDate.slice(0, 10) : '')
  const [dayOfMonth,   setDayOfMonth]  = useState(rd ? String(rd.dayOfMonth) : '1')
  const [isAutoRenew,  setIsAutoRenew] = useState(rd?.isAutoRenew ?? false)
  const [notes,        setNotes]       = useState(rd?.notes ?? '')
  const [topUps,       setTopUps]      = useState<TopUpDraft[]>([])

  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [showTopUpForm, setShowTopUpForm] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const firstRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Live preview ─────────────────────────────────────────────────────────────
  const maNum  = parseFloat(monthlyAmt) || 0
  const rateNum = parseFloat(interestRate) || 0
  const domNum  = parseInt(dayOfMonth) || 1
  const canPreview = maNum > 0 && rateNum > 0 && startDate !== '' && maturityDate !== '' && new Date(maturityDate) > new Date(startDate)

  let preview: { totalInvested: number; currentValue: number; maturityValue: number; interestEarned: number } | null = null
  if (canPreview) {
    const sd = new Date(startDate)
    const md = new Date(maturityDate)
    const parsedTopUps = topUps
      .filter(t => parseFloat(t.amount) > 0 && t.startDate)
      .map(t => ({ amount: parseFloat(t.amount), startDate: new Date(t.startDate), isRecurring: t.isRecurring }))
    const { currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
      monthlyAmount: maNum, annualRate: rateNum, startDate: sd, dayOfMonth: domNum, topUps: parsedTopUps,
    })
    const maturityValue = calculateRDMaturityValue({
      monthlyAmount: maNum, annualRate: rateNum, startDate: sd, dayOfMonth: domNum, topUps: parsedTopUps, maturityDate: md,
    })
    preview = { totalInvested, currentValue, maturityValue, interestEarned }
  }

  const tenureMonths = startDate && maturityDate
    ? (new Date(maturityDate).getFullYear() - new Date(startDate).getFullYear()) * 12 +
      (new Date(maturityDate).getMonth() - new Date(startDate).getMonth())
    : 0

  // ── Top-up helpers ────────────────────────────────────────────────────────────
  function addTopUp() {
    setTopUps(prev => [...prev, { id: `draft-${Date.now()}`, amount: '', startDate: '', isRecurring: false }])
    setShowTopUpForm(false)
  }

  function removeTopUp(id: string) {
    setTopUps(prev => prev.filter(t => t.id !== id))
  }

  function updateTopUp(id: string, key: keyof TopUpDraft, value: string | boolean) {
    setTopUps(prev => prev.map(t => t.id === id ? { ...t, [key]: value } : t))
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim())      errs.name        = 'Name is required'
    if (!bankName.trim())  errs.bankName    = 'Bank name is required'
    if (maNum <= 0)        errs.monthlyAmt  = 'Must be > 0'
    if (rateNum <= 0)      errs.interestRate = 'Must be > 0'
    if (!startDate)        errs.startDate   = 'Required'
    if (!maturityDate)     errs.maturityDate = 'Required'
    else if (maturityDate <= startDate) errs.maturityDate = 'Must be after start date'
    if (domNum < 1 || domNum > 28) errs.dayOfMonth = 'Must be 1–28'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true); setSubmitError('')
    try {
      const tenureM = (new Date(maturityDate).getFullYear() - new Date(startDate).getFullYear()) * 12 +
        (new Date(maturityDate).getMonth() - new Date(startDate).getMonth())

      const validTopUps = topUps
        .filter(t => parseFloat(t.amount) > 0 && t.startDate)
        .map(t => ({ amount: parseFloat(t.amount), startDate: t.startDate, isRecurring: t.isRecurring }))

      const payload = {
        name: name.trim(), bankName: bankName.trim(), platform,
        monthlyAmount: maNum, interestRate: rateNum,
        startDate, maturityDate, tenureMonths: tenureM,
        dayOfMonth: domNum, isAutoRenew,
        notes: notes.trim() || null,
        topUps: isEdit ? undefined : validTopUps,
      }

      const url    = isEdit ? `/api/rd/${rd!.id}` : '/api/rd'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setSubmitError(data.error ?? 'Something went wrong.')
        return
      }
      onSuccess(); onClose()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const errText: React.CSSProperties = { fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px' }
  const focusH = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--color-text-primary)'
  }
  const blurH = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--color-border)'
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
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {isEdit ? 'Edit RD' : 'Add Recurring Deposit'}
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Section 1 */}
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Account details</div>

          <div>
            <div style={labelStyle}>RD Name</div>
            <input ref={firstRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SBI RD – 2025" style={inputStyle} onFocus={focusH} onBlur={blurH} />
            {errors.name && <div style={errText}>{errors.name}</div>}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Bank Name</div>
              <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. SBI" style={inputStyle} onFocus={focusH} onBlur={blurH} />
              {errors.bankName && <div style={errText}>{errors.bankName}</div>}
            </div>
            <div style={{ width: '160px', flexShrink: 0 }}>
              <div style={labelStyle}>Platform</div>
              <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} onFocus={focusH} onBlur={blurH}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid var(--color-border)', margin: '2px 0' }} />

          {/* Section 2 */}
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>RD details</div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Monthly Amount (₹)</div>
              <input type="number" min="0" step="any" value={monthlyAmt} onChange={e => setMonthlyAmt(e.target.value)} placeholder="0" style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} onFocus={focusH} onBlur={blurH} />
              {errors.monthlyAmt && <div style={errText}>{errors.monthlyAmt}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Interest Rate (%)</div>
              <input type="number" min="0" step="any" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0.00" style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} onFocus={focusH} onBlur={blurH} />
              {errors.interestRate && <div style={errText}>{errors.interestRate}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Start Date</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light dark' }} onFocus={focusH} onBlur={blurH} />
              {errors.startDate && <div style={errText}>{errors.startDate}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Maturity Date</div>
              <input type="date" value={maturityDate} onChange={e => setMaturityDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light dark' }} onFocus={focusH} onBlur={blurH} />
              {errors.maturityDate && <div style={errText}>{errors.maturityDate}</div>}
              {tenureMonths > 0 && !errors.maturityDate && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{tenureMonths} months tenure</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ width: '100px' }}>
              <div style={labelStyle}>Day of Month</div>
              <input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} onFocus={focusH} onBlur={blurH} />
              {errors.dayOfMonth && <div style={errText}>{errors.dayOfMonth}</div>}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', paddingBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Auto-renew</span>
              <Toggle on={isAutoRenew} onChange={setIsAutoRenew} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional notes…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={focusH as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
              onBlur={blurH as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
            />
          </div>

          {/* Top-ups (only in add mode) */}
          {!isEdit && (
            <>
              <div style={{ borderTop: '0.5px solid var(--color-border)', margin: '2px 0' }} />
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '10px' }}>Top-ups</div>

                {topUps.map((tu, idx) => (
                  <div key={tu.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      {idx === 0 && <div style={{ ...labelStyle, marginBottom: '4px' }}>Amount (₹)</div>}
                      <input type="number" min="0" step="any" value={tu.amount} onChange={e => updateTopUp(tu.id, 'amount', e.target.value)} placeholder="0" style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums', fontSize: '13px' }} onFocus={focusH} onBlur={blurH} />
                    </div>
                    <div style={{ flex: 1 }}>
                      {idx === 0 && <div style={{ ...labelStyle, marginBottom: '4px' }}>Start Date</div>}
                      <input type="date" value={tu.startDate} onChange={e => updateTopUp(tu.id, 'startDate', e.target.value)} style={{ ...inputStyle, colorScheme: 'light dark', fontSize: '13px' }} onFocus={focusH} onBlur={blurH} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingBottom: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>Recurring</span>
                      <Toggle on={tu.isRecurring} onChange={v => updateTopUp(tu.id, 'isRecurring', v)} />
                      <button onClick={() => removeTopUp(tu.id)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', borderRadius: '4px', lineHeight: 0, marginLeft: '2px' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addTopUp}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
                >
                  <Plus size={13} /> Add top-up
                </button>
              </div>
            </>
          )}

          {/* Live preview */}
          {canPreview && preview && (
            <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Preview</div>
              {([
                { label: 'Total invested so far', value: formatINR(preview.totalInvested) },
                { label: 'Current value',         value: formatINR(preview.currentValue) },
                { label: 'Maturity value',         value: formatINR(preview.maturityValue) },
                { label: 'Interest earned',        value: `+${formatINR(preview.interestEarned)}`, color: 'var(--color-gain)' },
              ] as { label: string; value: string; color?: string }[]).map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12.5px', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                  <span style={{ color: row.color ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          {submitError && <span style={{ fontSize: '12px', color: 'var(--color-loss)', flex: 1 }}>{submitError}</span>}
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: submitting ? 'var(--color-text-muted)' : 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontFamily: 'inherit', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {submitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add RD'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
