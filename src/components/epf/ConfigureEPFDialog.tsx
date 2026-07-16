'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'

interface EPFAccount {
  id: string
  uan: string | null
  memberId: string | null
  employerName: string | null
  dateOfBirth: string | null
  employeeBalance: number
  employerBalance: number
  pensionBalance: number
  interestRate: number
  employeeMonthly: number
  employerMonthly: number
  dayOfMonth: number
  trackingStartDate: string | null
}

interface Props {
  account: EPFAccount | null
  onClose: () => void
  onSuccess: () => void
}

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

function isoToDateInput(iso: string): string {
  return iso.split('T')[0]
}

const lbl: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px',
}
const inp: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13.5px', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
const errTxt: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px',
}
const hint: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px', lineHeight: 1.5,
}
const sectionLabel: React.CSSProperties = {
  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.7px',
  fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px',
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

export default function ConfigureEPFDialog({ account, onClose, onSuccess }: Props) {
  const [uan, setUan] = useState(account?.uan ?? '')
  const [memberId, setMemberId] = useState(account?.memberId ?? '')
  const [employerName, setEmployerName] = useState(account?.employerName ?? '')
  const [dob, setDob] = useState(account?.dateOfBirth ? isoToDateInput(account.dateOfBirth) : '')

  const [employeeMonthly, setEmployeeMonthly] = useState(account?.employeeMonthly ? String(account.employeeMonthly) : '')
  const [employerMonthly, setEmployerMonthly] = useState(account?.employerMonthly ? String(account.employerMonthly) : '')
  const [dayOfMonth, setDayOfMonth] = useState(account ? String(account.dayOfMonth) : '1')
  const [startDate, setStartDate] = useState(account?.trackingStartDate ? isoToDateInput(account.trackingStartDate) : '')

  const [employeeBalance, setEmployeeBalance] = useState(account?.employeeBalance ? String(account.employeeBalance) : '')
  const [employerBalance, setEmployerBalance] = useState(account?.employerBalance ? String(account.employerBalance) : '')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showDanger, setShowDanger] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const empMonthly = parseFloat(employeeMonthly) || 0
  const emplrMonthly = parseFloat(employerMonthly) || 0
  const totalMonthly = empMonthly + emplrMonthly

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!employeeMonthly.trim() || empMonthly <= 0) errs.employeeMonthly = 'Must be > 0'
    if (!employerMonthly.trim() || emplrMonthly <= 0) errs.employerMonthly = 'Must be > 0'
    const eb = parseFloat(employeeBalance) || 0
    const eplrb = parseFloat(employerBalance) || 0
    if (employeeBalance && eb < 0) errs.employeeBalance = 'Must be >= 0'
    if (employerBalance && eplrb < 0) errs.employerBalance = 'Must be >= 0'
    const dom = parseInt(dayOfMonth) || 0
    if (!dayOfMonth || dom < 1 || dom > 28) errs.dayOfMonth = 'Must be between 1 and 28'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const payload: Record<string, unknown> = {
        uan: uan.trim() || null,
        memberId: memberId.trim() || null,
        employerName: employerName.trim() || null,
        dateOfBirth: dob || null,
        employeeMonthly: empMonthly,
        employerMonthly: emplrMonthly,
        dayOfMonth: parseInt(dayOfMonth) || 1,
        trackingStartDate: startDate || null,
        employeeBalance: parseFloat(employeeBalance) || 0,
        employerBalance: parseFloat(employerBalance) || 0,
      }

      const method = account ? 'PUT' : 'POST'
      const res = await fetch('/api/epf', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setSubmitError(cleanError(data.error))
        return
      }

      onSuccess()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/epf', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setSubmitError(cleanError(data.error))
        setDeleteConfirm(false)
        return
      }
      onSuccess()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
      setDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

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
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 16px',
          borderBottom: '0.5px solid var(--color-border)',
          position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1,
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {account ? 'Edit EPF account' : 'Configure EPF account'}
          </div>
          <button
            onClick={onClose}
            style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* ── Section 1: Account details ──────────────────────────────── */}
          <div style={sectionLabel}>Account details</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div>
              <div style={lbl}>UAN <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={uan}
                onChange={e => setUan(e.target.value)}
                placeholder="Universal Account Number"
                style={inp}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Member ID <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
                <input
                  value={memberId}
                  onChange={e => setMemberId(e.target.value)}
                  placeholder="e.g. MHBAN123456"
                  style={inp}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Date of birth <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ ...inp, colorScheme: 'light dark' }}
                />
              </div>
            </div>

            <div>
              <div style={lbl}>Employer name <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <input
                value={employerName}
                onChange={e => setEmployerName(e.target.value)}
                placeholder="Your company name"
                style={inp}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', marginBottom: '20px' }} />

          {/* ── Section 2: Monthly contributions ───────────────────────── */}
          <div style={sectionLabel}>Monthly contributions</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Employee amount (₹)</div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={employeeMonthly}
                  onChange={e => { setEmployeeMonthly(e.target.value); setErrors(p => ({ ...p, employeeMonthly: '' })) }}
                  placeholder="e.g. 1800"
                  style={{ ...inp, fontVariantNumeric: 'tabular-nums' }}
                />
                {errors.employeeMonthly
                  ? <div style={errTxt}>{errors.employeeMonthly}</div>
                  : <div style={hint}>12% of basic</div>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Employer amount (₹)</div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={employerMonthly}
                  onChange={e => { setEmployerMonthly(e.target.value); setErrors(p => ({ ...p, employerMonthly: '' })) }}
                  placeholder="e.g. 1800"
                  style={{ ...inp, fontVariantNumeric: 'tabular-nums' }}
                />
                {errors.employerMonthly
                  ? <div style={errTxt}>{errors.employerMonthly}</div>
                  : <div style={hint}>3.67% EPF + 8.33% EPS</div>
                }
              </div>
            </div>

            {/* Live total */}
            {totalMonthly > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRadius: '7px',
                padding: '8px 14px',
                fontSize: '12.5px', color: 'var(--color-text-secondary)',
              }}>
                Total monthly contribution:&nbsp;
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {formatINR(totalMonthly)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Day of month</div>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={dayOfMonth}
                  onChange={e => { setDayOfMonth(e.target.value); setErrors(p => ({ ...p, dayOfMonth: '' })) }}
                  placeholder="1"
                  style={{ ...inp, fontVariantNumeric: 'tabular-nums' }}
                />
                {errors.dayOfMonth && <div style={errTxt}>{errors.dayOfMonth}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Started from <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ ...inp, colorScheme: 'light dark' }}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', marginBottom: '20px' }} />

          {/* ── Section 3: Current corpus ────────────────────────────────── */}
          <div style={sectionLabel}>Current corpus</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Employee balance (₹)</div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={employeeBalance}
                  onChange={e => { setEmployeeBalance(e.target.value); setErrors(p => ({ ...p, employeeBalance: '' })) }}
                  placeholder="0"
                  style={{ ...inp, fontVariantNumeric: 'tabular-nums' }}
                />
                {errors.employeeBalance && <div style={errTxt}>{errors.employeeBalance}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Employer balance (₹)</div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={employerBalance}
                  onChange={e => { setEmployerBalance(e.target.value); setErrors(p => ({ ...p, employerBalance: '' })) }}
                  placeholder="0"
                  style={{ ...inp, fontVariantNumeric: 'tabular-nums' }}
                />
                {errors.employerBalance && <div style={errTxt}>{errors.employerBalance}</div>}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Or upload your UAN passbook to auto-fill these values
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', marginTop: '20px', marginBottom: '16px' }} />

          {/* ── Danger zone ─────────────────────────────────────────────── */}
          <button
            onClick={() => { setShowDanger(prev => !prev); setDeleteConfirm(false) }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
          >
            <span style={{ fontSize: '12px', color: '#DC2626' }}>
              {showDanger ? '▾' : '▸'} Remove EPF account
            </span>
          </button>

          {showDanger && (
            <div style={{
              marginTop: '10px',
              border: '0.5px solid #FECDD3',
              borderRadius: '8px',
              padding: '14px',
              background: '#FFF5F5',
            }}>
              <div style={{ fontSize: '12.5px', color: '#DC2626', lineHeight: 1.6, marginBottom: '12px' }}>
                This will delete your EPF account and all transaction history. This cannot be undone.
              </div>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  style={{
                    background: '#FFF5F5',
                    border: '0.5px solid #FECDD3',
                    color: '#DC2626',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Delete EPF account
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: '#DC2626', fontWeight: 600 }}>Are you sure?</span>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px',
                      border: '0.5px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      padding: '5px 12px', borderRadius: '6px',
                      border: 'none', background: '#DC2626',
                      color: '#fff', fontSize: '12px', fontFamily: 'inherit',
                      cursor: deleting ? 'not-allowed' : 'pointer',
                      opacity: deleting ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    {deleting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '0.5px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          position: 'sticky', bottom: 0, background: 'var(--color-bg)',
        }}>
          {submitError && (
            <span style={{ fontSize: '12px', color: 'var(--color-loss)', flex: 1 }}>{submitError}</span>
          )}
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...primaryBtn, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Saving…' : account ? 'Save changes' : 'Configure'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
