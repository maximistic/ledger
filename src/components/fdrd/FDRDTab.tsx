'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Landmark } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import AddFDDialog from './AddFDDialog'
import AddRDDialog from './AddRDDialog'
import FDDetailDialog from './FDDetailDialog'
import RDDetailDialog from './RDDetailDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FDAccount {
  id: string
  name: string
  bankName: string
  platform: string
  principal: number
  interestRate: number
  compoundingType: string
  fdType: string
  startDate: string
  maturityDate: string
  tenureMonths: number
  currentValue: number
  maturityValue: number
  interestEarned: number
  isAutoRenew: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface RDTopUp {
  id: string
  rdId: string
  amount: number
  startDate: string
  isRecurring: boolean
  notes: string | null
  createdAt: string
}

export interface RDAccount {
  id: string
  name: string
  bankName: string
  platform: string
  monthlyAmount: number
  interestRate: number
  startDate: string
  maturityDate: string
  tenureMonths: number
  dayOfMonth: number
  currentValue: number
  totalInvested: number
  maturityValue: number
  interestEarned: number
  isAutoRenew: boolean
  notes: string | null
  lastProcessedDate: string | null
  createdAt: string
  updatedAt: string
  topUps: RDTopUp[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function getDaysToMaturity(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const mat = new Date(dateStr); mat.setHours(0,0,0,0)
  return Math.max(0, Math.ceil((mat.getTime() - today.getTime()) / (24*60*60*1000)))
}

export function getMaturityStatus(dateStr: string): 'MATURED' | 'CRITICAL' | 'WARNING' | 'OK' {
  const today = new Date(); today.setHours(0,0,0,0)
  const mat = new Date(dateStr); mat.setHours(0,0,0,0)
  if (mat < today) return 'MATURED'
  const days = getDaysToMaturity(dateStr)
  if (days <= 30) return 'CRITICAL'
  if (days <= 90) return 'WARNING'
  return 'OK'
}

export function bankInitials(name: string): string {
  return name.trim().slice(0, 4).toUpperCase() || '??'
}

export const COMP_ABBREV: Record<string, string> = {
  SIMPLE: 'S', MONTHLY: 'M', QUARTERLY: 'Q', HALF_YEARLY: 'H', ANNUALLY: 'A',
}

// ─── Button styles ─────────────────────────────────────────────────────────────

export const ghostBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

export const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '6px',
  border: 'none',
  background: 'var(--color-text-primary)',
  color: 'var(--color-surface)',
  fontSize: '12.5px', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
}

export const labelStyle: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase',
  letterSpacing: '0.5px', fontWeight: 600,
  color: 'var(--color-text-muted)', marginBottom: '5px',
}

export const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13.5px',
  color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none',
}

// ─── Shared header cell ────────────────────────────────────────────────────────

const hCell: React.CSSProperties = {
  fontSize: '10.5px', color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600,
}

const GRID = '2fr 1fr 1fr 1fr 1fr 1fr'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 10, borderRadius: 4, background: 'var(--color-surface-raised)', animation: 'pulse 1.4s ease infinite' }} />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: GRID, gap: '8px',
          padding: '14px 20px', borderBottom: i < 3 ? '0.5px solid var(--color-border-subtle)' : 'none', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite', flexShrink: 0 }} />
            <div>
              <div style={{ height: 12, width: 120, borderRadius: 4, background: 'var(--color-bg)', marginBottom: 5, animation: 'pulse 1.4s ease infinite' }} />
              <div style={{ height: 10, width: 70, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} style={{ height: 12, borderRadius: 4, background: 'var(--color-bg)', animation: 'pulse 1.4s ease infinite' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function FDEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
      <Landmark size={36} color="var(--color-text-muted)" strokeWidth={1.5} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No fixed deposits yet</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Add your FDs to track maturity and interest earned
      </div>
      <button onClick={onAdd} style={primaryBtnStyle}><Plus size={13} /> Add FD</button>
    </div>
  )
}

function RDEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
      <Landmark size={36} color="var(--color-text-muted)" strokeWidth={1.5} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No recurring deposits yet</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Add your RDs to track monthly contributions and interest earned
      </div>
      <button onClick={onAdd} style={primaryBtnStyle}><Plus size={13} /> Add RD</button>
    </div>
  )
}

// ─── Maturity badge ───────────────────────────────────────────────────────────

function MaturityCell({ dateStr }: { dateStr: string }) {
  const status = getMaturityStatus(dateStr)
  const days   = getDaysToMaturity(dateStr)
  const color  = status === 'OK' ? 'var(--color-text-muted)'
    : status === 'WARNING' ? '#F59E0B'
    : 'var(--color-loss)'
  const text = status === 'MATURED' ? 'Matured' : `${days}d left`
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{fmtMonthYear(dateStr)}</div>
      <div style={{ fontSize: '10.5px', color, marginTop: '2px' }}>{text}</div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ bankName, size = 36 }: { bankName: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, minWidth: size, borderRadius: '7px',
      background: 'var(--color-surface-raised)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {bankInitials(bankName)}
    </div>
  )
}

// ─── FD table ─────────────────────────────────────────────────────────────────

function FDRow({ fd, isLast, onClick }: { fd: FDAccount; isLast: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: GRID, gap: '8px',
        padding: '12px 20px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
        alignItems: 'center', cursor: 'pointer',
        background: hovered ? 'var(--color-surface-raised)' : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <Avatar bankName={fd.bankName} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fd.name}
          </div>
          <div style={{ display: 'inline-block', marginTop: '3px', fontSize: '9.5px', color: 'var(--color-text-muted)', background: 'var(--color-surface-raised)', padding: '1px 6px', borderRadius: '3px' }}>
            {fd.platform}
          </div>
        </div>
      </div>
      {/* Principal */}
      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatINR(fd.principal)}
      </div>
      {/* Rate */}
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {fd.interestRate.toFixed(2)}%
        </span>
        {' '}
        <span style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', background: 'var(--color-surface-raised)', padding: '1px 5px', borderRadius: '3px' }}>
          {COMP_ABBREV[fd.compoundingType] ?? fd.compoundingType}
        </span>
      </div>
      {/* Current value */}
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatINR(fd.currentValue)}
      </div>
      {/* Maturity */}
      <MaturityCell dateStr={fd.maturityDate} />
      {/* Interest */}
      <div style={{ fontSize: '13px', color: 'var(--color-gain)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        +{formatINR(fd.interestEarned)}
      </div>
    </div>
  )
}

function FDTable({ fds, onRowClick }: { fds: FDAccount[]; onRowClick: (fd: FDAccount) => void }) {
  return (
    <div className="table-scroll-container" style={{ overflowX: 'auto' }}>
      <div className="fd-table-grid" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', minWidth: '600px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
          <div style={hCell}>Name</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Principal</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Rate</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Current Value</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Maturity</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Interest</div>
        </div>
        {fds.map((fd, i) => (
          <FDRow key={fd.id} fd={fd} isLast={i === fds.length - 1} onClick={() => onRowClick(fd)} />
        ))}
      </div>
    </div>
  )
}

// ─── RD table ─────────────────────────────────────────────────────────────────

function RDRow({ rd, isLast, onClick }: { rd: RDAccount; isLast: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: GRID, gap: '8px',
        padding: '12px 20px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
        alignItems: 'center', cursor: 'pointer',
        background: hovered ? 'var(--color-surface-raised)' : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <Avatar bankName={rd.bankName} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rd.name}
          </div>
          <div style={{ display: 'inline-block', marginTop: '3px', fontSize: '9.5px', color: 'var(--color-text-muted)', background: 'var(--color-surface-raised)', padding: '1px 6px', borderRadius: '3px' }}>
            {rd.platform}
          </div>
        </div>
      </div>
      {/* Monthly */}
      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatINR(rd.monthlyAmount)}
      </div>
      {/* Rate */}
      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {rd.interestRate.toFixed(2)}%
      </div>
      {/* Invested */}
      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatINR(rd.totalInvested)}
      </div>
      {/* Maturity */}
      <MaturityCell dateStr={rd.maturityDate} />
      {/* Interest */}
      <div style={{ fontSize: '13px', color: 'var(--color-gain)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        +{formatINR(rd.interestEarned)}
      </div>
    </div>
  )
}

function RDTable({ rds, onRowClick }: { rds: RDAccount[]; onRowClick: (rd: RDAccount) => void }) {
  return (
    <div className="table-scroll-container" style={{ overflowX: 'auto' }}>
      <div className="fd-table-grid" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', minWidth: '600px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '8px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)', padding: '10px 20px' }}>
          <div style={hCell}>Name</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Monthly</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Rate</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Invested</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Maturity</div>
          <div style={{ ...hCell, textAlign: 'right' }}>Interest</div>
        </div>
        {rds.map((rd, i) => (
          <RDRow key={rd.id} rd={rd} isLast={i === rds.length - 1} onClick={() => onRowClick(rd)} />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onTotalsChange?: (t: { count: number; currentValue: number }) => void
}

export default function FDRDTab({ onTotalsChange }: Props) {
  const [fds, setFDs]       = useState<FDAccount[]>([])
  const [rds, setRDs]       = useState<RDAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab]  = useState<'fd' | 'rd'>('fd')

  const [showAddFD, setShowAddFD] = useState(false)
  const [showAddRD, setShowAddRD] = useState(false)
  const [selectedFD, setSelectedFD] = useState<FDAccount | null>(null)
  const [selectedRD, setSelectedRD] = useState<RDAccount | null>(null)
  const [editFD, setEditFD] = useState<FDAccount | null>(null)
  const [editRD, setEditRD] = useState<RDAccount | null>(null)

  const onTotalsRef = useRef(onTotalsChange)
  useEffect(() => { onTotalsRef.current = onTotalsChange }, [onTotalsChange])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [fdRes, rdRes] = await Promise.all([fetch('/api/fd'), fetch('/api/rd')])
      const [fdData, rdData] = await Promise.all([
        fdRes.json() as Promise<{ fds?: FDAccount[]; totals?: { totalCurrentValue?: number } }>,
        rdRes.json() as Promise<{ rds?: RDAccount[]; totals?: { totalCurrentValue?: number } }>,
      ])
      const fdList = fdData.fds ?? []
      const rdList = rdData.rds ?? []
      setFDs(fdList)
      setRDs(rdList)
      onTotalsRef.current?.({
        count: fdList.length + rdList.length,
        currentValue: (fdData.totals?.totalCurrentValue ?? 0) + (rdData.totals?.totalCurrentValue ?? 0),
      })
    } catch {
      // ignore — tables stay empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const totalCurrentValue = fds.reduce((s, f) => s + f.currentValue, 0) + rds.reduce((s, r) => s + r.currentValue, 0)
  const totalPrincipal    = fds.reduce((s, f) => s + f.principal, 0)    + rds.reduce((s, r) => s + r.totalInvested, 0)
  const totalInterest     = fds.reduce((s, f) => s + f.interestEarned, 0) + rds.reduce((s, r) => s + r.interestEarned, 0)
  const hasData = fds.length > 0 || rds.length > 0

  const openAddFD = () => setShowAddFD(true)
  const openAddRD = () => setShowAddRD(true)

  const closeAddFD = () => { setShowAddFD(false); setEditFD(null) }
  const closeAddRD = () => { setShowAddRD(false); setEditRD(null) }

  return (
    <>
      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div className="section-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            FDs & RDs
          </div>
          <div className="section-big-value" style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '—' : formatINR(totalCurrentValue)}
          </div>
          {!loading && hasData && (
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Principal </span>
              <span style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(totalPrincipal)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · Interest earned </span>
              <span style={{ color: 'var(--color-gain)', fontVariantNumeric: 'tabular-nums' }}>+{formatINR(totalInterest)}</span>
            </div>
          )}
        </div>
        <div className="section-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button onClick={openAddFD} style={ghostBtnStyle}><Plus size={13} /> Add FD</button>
          <button onClick={openAddRD} style={primaryBtnStyle}><Plus size={13} /> Add RD</button>
        </div>
      </div>

      {/* ── Sub-tab switcher ────────────────────────────────────────────────── */}
      <div className="fdrd-switcher" style={{
        display: 'inline-flex', gap: '3px', padding: '3px',
        background: 'var(--color-surface-raised)',
        border: '0.5px solid var(--color-border)',
        borderRadius: '9px', marginBottom: '16px',
      }}>
        {(['fd', 'rd'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              padding: '6px 16px', borderRadius: '6px', fontSize: '13px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: subTab === tab ? 'var(--color-text-primary)' : 'transparent',
              color: subTab === tab ? 'var(--color-surface)' : 'var(--color-text-muted)',
              transition: 'all 120ms ease',
            }}
          >
            {tab === 'fd' ? 'Fixed Deposits' : 'Recurring Deposits'}
          </button>
        ))}
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      {subTab === 'fd' && (
        loading ? <SkeletonTable /> :
        fds.length === 0 ? <FDEmptyState onAdd={openAddFD} /> :
        <FDTable fds={fds} onRowClick={setSelectedFD} />
      )}
      {subTab === 'rd' && (
        loading ? <SkeletonTable /> :
        rds.length === 0 ? <RDEmptyState onAdd={openAddRD} /> :
        <RDTable rds={rds} onRowClick={setSelectedRD} />
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {(showAddFD || editFD !== null) && (
        <AddFDDialog
          fd={editFD ?? undefined}
          onClose={closeAddFD}
          onSuccess={() => { fetchData(); closeAddFD() }}
        />
      )}
      {(showAddRD || editRD !== null) && (
        <AddRDDialog
          rd={editRD ?? undefined}
          onClose={closeAddRD}
          onSuccess={() => { fetchData(); closeAddRD() }}
        />
      )}
      {selectedFD && (
        <FDDetailDialog
          fd={selectedFD}
          onClose={() => setSelectedFD(null)}
          onEdit={() => { const fd = selectedFD; setSelectedFD(null); setEditFD(fd) }}
          onDelete={() => { fetchData(); setSelectedFD(null) }}
        />
      )}
      {selectedRD && (
        <RDDetailDialog
          rd={selectedRD}
          onClose={() => setSelectedRD(null)}
          onEdit={() => { const rd = selectedRD; setSelectedRD(null); setEditRD(rd) }}
          onDelete={() => { fetchData(); setSelectedRD(null) }}
          onRefresh={fetchData}
        />
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </>
  )
}
