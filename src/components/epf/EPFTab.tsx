'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Shield, Settings, Upload } from 'lucide-react'
import { formatINR, formatShort } from '@/lib/utils'
import { calculateProjectedCorpus, formatEPFMonth } from '@/lib/epfUtils'
import ConfigureEPFDialog from './ConfigureEPFDialog'
import UploadPassbookDialog from './UploadPassbookDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  lastProcessedDate: string | null
  trackingStatus: string
}

interface EPFTransaction {
  id: string
  accountId: string
  wageMonth: string
  transactionDate: string
  type: string
  particulars: string | null
  wages: number | null
  employeeAmount: number
  employerAmount: number
  pensionAmount: number
  autoCreated: boolean
  createdAt: string
}

interface Derived {
  totalCorpus: number
  totalContributed: number
  totalEmployer: number
  interestEarned: number
}

interface Props {
  onCorpusChange?: (corpus: number, hasAccount: boolean) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function ageFromISO(iso: string): number {
  const birth = new Date(iso)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function formatTxnDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}-${mm}-${yyyy}`
}

// ─── Shared button styles ─────────────────────────────────────────────────────

const ghostBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: 'none',
  background: 'var(--color-text-primary)',
  color: 'var(--color-surface)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: '8px',
          padding: '10px 0', borderBottom: '0.5px solid var(--color-border-subtle)', alignItems: 'center',
        }}>
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} style={{ height: 12, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
          ))}
        </div>
      ))}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EPFTab({ onCorpusChange }: Props) {
  const [account, setAccount] = useState<EPFAccount | null | undefined>(undefined)
  const [transactions, setTransactions] = useState<EPFTransaction[]>([])
  const [derived, setDerived] = useState<Derived | null>(null)

  const [showConfigure, setShowConfigure] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [retireAge, setRetireAge] = useState(60)

  const onCorpusChangeRef = useRef(onCorpusChange)
  useEffect(() => { onCorpusChangeRef.current = onCorpusChange }, [onCorpusChange])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/epf')
      const data = await res.json() as {
        account: EPFAccount | null
        transactions?: EPFTransaction[]
        derived?: Derived
      }
      setAccount(data.account)
      setTransactions(data.transactions ?? [])
      setDerived(data.derived ?? null)
      const corpus = data.account
        ? data.account.employeeBalance + data.account.employerBalance + data.account.pensionBalance
        : 0
      onCorpusChangeRef.current?.(corpus, !!data.account)
    } catch {
      setAccount(null)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Loading state: account is undefined (not yet fetched)
  if (account === undefined) {
    return (
      <>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ height: 11, width: 30, borderRadius: 4, background: 'var(--color-bg)', marginBottom: 8, animation: 'pulse 1.4s ease infinite' }} />
          <div style={{ height: 28, width: 180, borderRadius: 6, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ height: 10, width: 80, borderRadius: 4, background: 'var(--color-bg)', marginBottom: 8, animation: 'pulse 1.4s ease infinite' }} />
              <div style={{ height: 20, width: 100, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </>
    )
  }

  // ── State A: No account ───────────────────────────────────────────────────────

  if (account === null) {
    return (
      <>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 20px', gap: '12px',
        }}>
          <Shield size={48} color="#CCC8BE" strokeWidth={1.5} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            EPF not configured
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6, maxWidth: '340px' }}>
            Set up your EPF account to track your provident fund contributions automatically.
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={() => setShowUpload(true)} style={ghostBtnStyle}>
              <Upload size={13} /> Upload passbook
            </button>
            <button onClick={() => setShowConfigure(true)} style={primaryBtnStyle}>
              <Settings size={13} /> Configure manually
            </button>
          </div>
        </div>

        {showConfigure && (
          <ConfigureEPFDialog
            account={null}
            onClose={() => setShowConfigure(false)}
            onSuccess={() => { fetchData(); setShowConfigure(false) }}
          />
        )}
        {showUpload && (
          <UploadPassbookDialog
            onClose={() => setShowUpload(false)}
            onSuccess={() => { fetchData(); setShowUpload(false) }}
          />
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    )
  }

  // ── State B: Account exists ───────────────────────────────────────────────────

  const totalCorpus = account.employeeBalance + account.employerBalance + account.pensionBalance
  const monthlyContrib = account.employeeMonthly + account.employerMonthly
  const currentAge = account.dateOfBirth ? ageFromISO(account.dateOfBirth) : null
  const yearsToRetirement = currentAge !== null ? Math.max(0, retireAge - currentAge) : 0

  const projectedCorpus = calculateProjectedCorpus({
    currentCorpus: totalCorpus,
    monthlyContribution: monthlyContrib,
    annualInterestRate: account.interestRate,
    yearsToRetirement,
  })

  const displayTxns = transactions.slice().reverse()

  return (
    <>
      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            EPF
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {formatINR(totalCorpus)}
          </div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Employee </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{formatShort(account.employeeBalance)}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> · Employer </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{formatShort(account.employerBalance)}</span>
            {derived && derived.interestEarned > 0 && (
              <>
                <span style={{ color: 'var(--color-text-muted)' }}> · Interest </span>
                <span style={{ color: 'var(--color-gain)' }}>{formatShort(derived.interestEarned)}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowUpload(true)} style={ghostBtnStyle}>
            <Upload size={13} /> Upload passbook
          </button>
          <button onClick={() => setShowConfigure(true)} style={ghostBtnStyle}>
            <Settings size={13} /> Configure
          </button>
        </div>
      </div>

      {/* ── Account strip ───────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: '10px',
        padding: '14px 20px',
        marginBottom: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {account.employerName ?? 'EPF Account'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
            {account.uan ? `UAN: ${account.uan}` : 'UAN not set'}
            {account.memberId ? ` · Member ID: ${account.memberId}` : ''}
          </div>
        </div>

        {account.trackingStatus === 'ACTIVE' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'var(--color-gain)', display: 'inline-block',
                  animation: 'epfPulse 2s ease infinite',
                }} />
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {formatINR(monthlyContrib)} auto-tracking
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textAlign: 'right' }}>
                {ordinal(account.dayOfMonth)} of every month
              </div>
            </div>
            <button
              onClick={() => setShowConfigure(true)}
              style={{ ...ghostBtnStyle, padding: '5px 10px', fontSize: '12px' }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
        {([
          { label: 'Current corpus',    value: formatINR(totalCorpus) },
          { label: 'Employee balance',  value: formatINR(account.employeeBalance) },
          { label: 'Employer balance',  value: formatINR(account.employerBalance) },
          { label: 'Interest rate',     value: `${account.interestRate}% p.a.` },
        ] as const).map(card => (
          <div key={card.label} style={{
            background: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRadius: '10px',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>

        {/* Left: Contribution history */}
        <div style={{
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: '10px',
          padding: '16px 20px',
          minWidth: 0,
        }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
            Contribution history
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: '8px',
            background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)',
            padding: '8px 0',
          }}>
            {(['Month', 'Date', 'Employee', 'Employer', 'Wages'] as const).map((h, i) => (
              <div key={h} style={{
                fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
                textAlign: i >= 2 ? 'right' : 'left',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {transactions.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Upload your UAN passbook to see contribution history
              </div>
            ) : displayTxns.map((txn, i) => (
              <div key={txn.id} style={{
                display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: '8px',
                padding: '10px 0',
                borderBottom: i < displayTxns.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                    {formatEPFMonth(txn.wageMonth)}
                  </span>
                  {txn.autoCreated && (
                    <span style={{
                      fontSize: '9px', background: '#F0EEE8', color: '#7A7670',
                      borderRadius: '3px', padding: '1px 4px', fontWeight: 600, flexShrink: 0,
                    }}>auto</span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTxnDate(txn.transactionDate)}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(txn.employeeAmount)}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(txn.employerAmount)}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {txn.wages !== null ? formatINR(txn.wages) : '—'}
                </div>
              </div>
            ))}

            {/* Skeleton rows shown during a re-fetch would go here — the undefined state covers initial load */}
          </div>
        </div>

        {/* Right: Retirement projection */}
        <div style={{
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: '10px',
          padding: '16px 20px',
        }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
            Retirement projection
          </div>

          {/* Current age */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Current age</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {currentAge !== null
                ? `${currentAge} years`
                : <span style={{ color: 'var(--color-text-muted)' }}>— <span style={{ fontSize: '11px' }}>Add in Configure</span></span>
              }
            </span>
          </div>

          {/* Monthly contribution */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Monthly contribution</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(monthlyContrib)}</span>
          </div>

          {/* Years to retirement */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Years to retirement</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {currentAge !== null ? `${yearsToRetirement} years` : '—'}
            </span>
          </div>

          {/* Interest rate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Interest rate</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{account.interestRate}% p.a. (assumed)</span>
          </div>

          {/* Retire-at slider */}
          <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Retire at</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {retireAge} years
              </span>
            </div>
            <input
              type="range"
              min={45}
              max={70}
              value={retireAge}
              onChange={e => setRetireAge(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-text-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              <span>45</span><span>70</span>
            </div>
          </div>

          {/* Projected corpus result */}
          <div style={{
            background: 'var(--color-surface-raised)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginTop: '12px',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Projected corpus at age {retireAge}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatINR(projectedCorpus)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px', lineHeight: 1.5 }}>
              Based on {formatINR(monthlyContrib)}/month · {account.interestRate}% rate · not accounting for salary hikes
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {showConfigure && (
        <ConfigureEPFDialog
          account={account}
          onClose={() => setShowConfigure(false)}
          onSuccess={() => { fetchData(); setShowConfigure(false) }}
        />
      )}
      {showUpload && (
        <UploadPassbookDialog
          onClose={() => setShowUpload(false)}
          onSuccess={() => { fetchData(); setShowUpload(false) }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes epfPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </>
  )
}
