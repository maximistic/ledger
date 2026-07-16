'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { calculateFDCurrentValue, calculateFDMaturityValue } from '@/lib/fdCalculator'
import { FDAccount, labelStyle, inputStyle } from './FDRDTab'

const PLATFORMS = [
  'Stable Money','Groww','Kuvera','HDFC Bank','SBI','ICICI Bank',
  'Axis Bank','Kotak Bank','IDFC First Bank','Bajaj Finance',
  'Shriram Finance','Suryoday Bank','Unity Bank','Other',
]

const COMPOUNDING_OPTIONS = [
  { value: 'SIMPLE',      label: 'Simple Interest' },
  { value: 'MONTHLY',     label: 'Monthly' },
  { value: 'QUARTERLY',   label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-yearly' },
  { value: 'ANNUALLY',    label: 'Annually' },
]

const FD_TYPE_OPTIONS = [
  { value: 'CUMULATIVE',     label: 'Cumulative' },
  { value: 'NON_CUMULATIVE', label: 'Non-Cumulative' },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--color-text-primary)' : 'var(--color-border)', position: 'relative', cursor: 'pointer', transition: 'background 200ms ease', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

interface Props {
  fd?: FDAccount
  onClose: () => void
  onSuccess: () => void
}

export default function AddFDDialog({ fd, onClose, onSuccess }: Props) {
  const isEdit = !!fd

  const [name,            setName]           = useState(fd?.name ?? '')
  const [bankName,        setBankName]        = useState(fd?.bankName ?? '')
  const [platform,        setPlatform]        = useState(fd?.platform ?? PLATFORMS[0])
  const [principal,       setPrincipal]       = useState(fd ? String(fd.principal) : '')
  const [interestRate,    setInterestRate]    = useState(fd ? String(fd.interestRate) : '')
  const [compoundingType, setCompoundingType] = useState(fd?.compoundingType ?? 'QUARTERLY')
  const [fdType,          setFdType]          = useState(fd?.fdType ?? 'CUMULATIVE')
  const [startDate,       setStartDate]       = useState(fd ? fd.startDate.slice(0, 10) : '')
  const [maturityDate,    setMaturityDate]    = useState(fd ? fd.maturityDate.slice(0, 10) : '')
  const [isAutoRenew,     setIsAutoRenew]     = useState(fd?.isAutoRenew ?? false)
  const [notes,           setNotes]           = useState(fd?.notes ?? '')

  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  const overlayRef  = useRef<HTMLDivElement>(null)
  const firstRef    = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Live preview ─────────────────────────────────────────────────────────────
  const principalNum = parseFloat(principal) || 0
  const rateNum      = parseFloat(interestRate) || 0
  const canPreview   = principalNum > 0 && rateNum > 0 && startDate !== '' && maturityDate !== '' && new Date(maturityDate) > new Date(startDate)

  let preview: { currentValue: number; maturityValue: number; interestEarned: number; daysLeft: number } | null = null
  if (canPreview) {
    const sd = new Date(startDate)
    const md = new Date(maturityDate)
    const { currentValue, interestEarned } = calculateFDCurrentValue({ principal: principalNum, annualRate: rateNum, startDate: sd, compoundingType })
    const maturityValue = calculateFDMaturityValue({ principal: principalNum, annualRate: rateNum, startDate: sd, compoundingType, maturityDate: md })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const mat   = new Date(maturityDate); mat.setHours(0, 0, 0, 0)
    const daysLeft = Math.max(0, Math.ceil((mat.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
    preview = { currentValue, maturityValue, interestEarned, daysLeft }
  }

  const tenureMonths = startDate && maturityDate
    ? (new Date(maturityDate).getFullYear() - new Date(startDate).getFullYear()) * 12 +
      (new Date(maturityDate).getMonth() - new Date(startDate).getMonth())
    : 0

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim())        errs.name        = 'Name is required'
    if (!bankName.trim())    errs.bankName    = 'Bank name is required'
    if (principalNum <= 0)   errs.principal   = 'Must be > 0'
    if (rateNum <= 0)        errs.interestRate = 'Must be > 0'
    if (!startDate)          errs.startDate   = 'Required'
    if (!maturityDate)       errs.maturityDate = 'Required'
    else if (maturityDate <= startDate) errs.maturityDate = 'Must be after start date'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const tenureM = (new Date(maturityDate).getFullYear() - new Date(startDate).getFullYear()) * 12 +
        (new Date(maturityDate).getMonth() - new Date(startDate).getMonth())

      const payload = {
        name: name.trim(), bankName: bankName.trim(), platform,
        principal: principalNum, interestRate: rateNum,
        compoundingType, fdType,
        startDate, maturityDate,
        tenureMonths: tenureM,
        isAutoRenew, notes: notes.trim() || null,
      }

      const url    = isEdit ? `/api/fd/${fd!.id}` : '/api/fd'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setSubmitError(data.error ?? 'Something went wrong.')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const errText: React.CSSProperties = { fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px' }
  const focusHandlers = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--color-text-primary)'
  }
  const blurHandlers = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--color-border)'
  }

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
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {isEdit ? 'Edit FD' : 'Add Fixed Deposit'}
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Section 1: Account details */}
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Account details
          </div>

          {/* FD Name */}
          <div>
            <div style={labelStyle}>FD Name</div>
            <input ref={firstRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HDFC FD – Jan 2025" style={inputStyle} onFocus={focusHandlers} onBlur={blurHandlers} />
            {errors.name && <div style={errText}>{errors.name}</div>}
          </div>

          {/* Bank + Platform */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Bank Name</div>
              <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" style={inputStyle} onFocus={focusHandlers} onBlur={blurHandlers} />
              {errors.bankName && <div style={errText}>{errors.bankName}</div>}
            </div>
            <div style={{ width: '160px', flexShrink: 0 }}>
              <div style={labelStyle}>Platform</div>
              <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} onFocus={focusHandlers} onBlur={blurHandlers}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', margin: '2px 0' }} />

          {/* Section 2: FD details */}
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            FD details
          </div>

          {/* Principal + Rate */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Principal (₹)</div>
              <input type="number" min="0" step="any" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="0" style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} onFocus={focusHandlers} onBlur={blurHandlers} />
              {errors.principal && <div style={errText}>{errors.principal}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Interest Rate (%)</div>
              <input type="number" min="0" step="any" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0.00" style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} onFocus={focusHandlers} onBlur={blurHandlers} />
              {errors.interestRate && <div style={errText}>{errors.interestRate}</div>}
            </div>
          </div>

          {/* Compounding + FD Type */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Compounding</div>
              <select value={compoundingType} onChange={e => setCompoundingType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} onFocus={focusHandlers} onBlur={blurHandlers}>
                {COMPOUNDING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>FD Type</div>
              <select value={fdType} onChange={e => setFdType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} onFocus={focusHandlers} onBlur={blurHandlers}>
                {FD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Start Date + Maturity Date */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Start Date</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light dark' }} onFocus={focusHandlers} onBlur={blurHandlers} />
              {errors.startDate && <div style={errText}>{errors.startDate}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Maturity Date</div>
              <input type="date" value={maturityDate} onChange={e => setMaturityDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light dark' }} onFocus={focusHandlers} onBlur={blurHandlers} />
              {errors.maturityDate && <div style={errText}>{errors.maturityDate}</div>}
              {tenureMonths > 0 && !errors.maturityDate && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{tenureMonths} months tenure</div>
              )}
            </div>
          </div>

          {/* Auto-renew */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Auto-renew</span>
            <Toggle on={isAutoRenew} onChange={setIsAutoRenew} />
          </div>

          {/* Notes */}
          <div>
            <div style={labelStyle}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes…"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={focusHandlers as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
              onBlur={blurHandlers as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
            />
          </div>

          {/* Live preview */}
          {canPreview && preview && (
            <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Preview</div>
              {([
                { label: 'Current value',          value: formatINR(preview.currentValue) },
                { label: 'Maturity value',          value: formatINR(preview.maturityValue) },
                { label: 'Interest earned (so far)', value: `+${formatINR(preview.interestEarned)}`, color: 'var(--color-gain)' },
                { label: 'Days to maturity',        value: `${preview.daysLeft} days` },
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
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add FD'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
