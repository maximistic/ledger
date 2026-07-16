'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Download, AlertTriangle, Flag, Plus, Trash2, Camera } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'recurring' | 'export' | 'danger' | 'milestones' | 'snapshots'

interface RecurringRule {
  id: string
  type: 'EPF' | 'RD' | 'SIP'
  name: string
  detail: string
  status: string
  dotColor: string
  epfData?: { employeeMonthly: number; employerMonthly: number; dayOfMonth: number }
  rdData?: { id: string; monthlyAmount: number; dayOfMonth: number }
  sipData?: { fundId: string; amount: number; dayOfMonth: number; status: string }
}

type EditDialogState =
  | { type: 'EPF'; employeeMonthly: number; employerMonthly: number; dayOfMonth: number }
  | { type: 'RD'; id: string; monthlyAmount: number; dayOfMonth: number }
  | { type: 'SIP'; fundId: string; amount: number; dayOfMonth: number; status: string }
  | null

type DangerKey = 'stocks' | 'mf' | 'all' | null

interface Milestone {
  id: string
  title: string
  targetAmount: number
  targetAsset: string | null
  achievedDate: string | null
  isAchieved: boolean
  progressPct: number
  amountAway: number
}

type MilestoneDialog =
  | { mode: 'add' }
  | { mode: 'edit'; milestone: Milestone }
  | null

interface SnapshotRecord {
  id:            string
  date:          string
  totalNetWorth: number
  investedValue: number
  stocksValue:   number
  mfValue:       number
  epfValue:      number
  fdValue:       number
  rdValue:       number
  usStocksValue: number
  source:        string
  createdAt:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinalSuffix(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}

function formatShort(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatDateShort(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row =>
    Object.values(row).map(v => {
      const str = String(v ?? '')
      return str.includes(',') ? `"${str}"` : str
    }).join(',')
  ).join('\n')
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const ASSET_OPTIONS = [
  { label: 'Total portfolio', value: 'total' },
  { label: 'Stocks',          value: 'stocks' },
  { label: 'Mutual Funds',    value: 'mf' },
  { label: 'EPF',             value: 'epf' },
  { label: 'FDs & RDs',       value: 'fd' },
  { label: 'International',   value: 'us' },
  { label: 'Any asset',       value: '' },
]

const dateStr = new Date().toISOString().split('T')[0]

// ── Shared styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  borderRadius: '12px',
  overflow: 'hidden',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '7px',
  border: '0.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '13.5px',
  fontFamily: 'inherit',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-muted)',
  marginBottom: '5px',
  display: 'block',
}

const SK: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '6px',
  animation: 'pulse 1.5s ease-in-out infinite',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()

  const [activeSection, setActiveSection] = useState<Section>('recurring')

  // Recurring
  const [rules, setRules]               = useState<RecurringRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [editState, setEditState]       = useState<EditDialogState>(null)
  const [editLoading, setEditLoading]   = useState(false)
  const [editError, setEditError]       = useState('')

  // Export
  const [csvLoading, setCsvLoading] = useState<string | null>(null)
  const [csvDone,    setCsvDone]    = useState<string | null>(null)

  // Danger
  const [dangerConfirm, setDangerConfirm] = useState<DangerKey>(null)
  const [dangerLoading, setDangerLoading] = useState(false)
  const [dangerSuccess, setDangerSuccess] = useState<Record<string, string>>({})
  const [resetText,     setResetText]     = useState('')

  // Milestones
  const [milestones,        setMilestones]        = useState<Milestone[]>([])
  const [milestonesLoading, setMilestonesLoading] = useState(false)
  const [milestoneDialog,   setMilestoneDialog]   = useState<MilestoneDialog>(null)
  const [mlTitle,           setMlTitle]           = useState('')
  const [mlAmount,          setMlAmount]          = useState('')
  const [mlAsset,           setMlAsset]           = useState('total')
  const [mlSubmitting,      setMlSubmitting]      = useState(false)
  const [mlError,           setMlError]           = useState('')
  const [mlDeleteId,        setMlDeleteId]        = useState<string | null>(null)
  const [mlDeleting,        setMlDeleting]        = useState(false)

  // Snapshots
  const [snapshotList,        setSnapshotList]        = useState<SnapshotRecord[]>([])
  const [snapshotCount,       setSnapshotCount]       = useState(0)
  const [snapshotsLoading,    setSnapshotsLoading]    = useState(false)
  const [takingSnapshot,      setTakingSnapshot]      = useState(false)
  const [snDeleteId,          setSnDeleteId]          = useState<string | null>(null)
  const [snDeleting,          setSnDeleting]          = useState(false)

  // ── Fetch recurring rules ──────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    setRulesLoading(true)
    try {
      const [epfRes, rdRes, mfRes] = await Promise.all([
        fetch('/api/epf'),
        fetch('/api/rd'),
        fetch('/api/mf'),
      ])

      const arr: RecurringRule[] = []

      if (epfRes.ok) {
        const { account } = await epfRes.json() as {
          account: {
            id: string; trackingStatus: string
            employeeMonthly: number; employerMonthly: number
            dayOfMonth: number; employerName?: string
          } | null
        }
        if (account && account.trackingStatus === 'ACTIVE') {
          const total = account.employeeMonthly + account.employerMonthly
          const sfx   = ordinalSuffix(account.dayOfMonth)
          arr.push({
            id: account.id, type: 'EPF', name: 'EPF contribution',
            detail:  `${formatShort(total)} · ${account.dayOfMonth}${sfx} of every month · ${account.employerName ?? 'Your employer'}`,
            status:  account.trackingStatus, dotColor: '#6366F1',
            epfData: { employeeMonthly: account.employeeMonthly, employerMonthly: account.employerMonthly, dayOfMonth: account.dayOfMonth },
          })
        }
      }

      if (rdRes.ok) {
        const { rds } = await rdRes.json() as {
          rds: Array<{ id: string; name: string; monthlyAmount: number; dayOfMonth: number; maturityDate: string }>
        }
        const today = new Date()
        for (const rd of rds) {
          if (new Date(rd.maturityDate) > today) {
            const sfx = ordinalSuffix(rd.dayOfMonth)
            arr.push({
              id: rd.id, type: 'RD', name: rd.name,
              detail:  `${formatShort(rd.monthlyAmount)} · ${rd.dayOfMonth}${sfx} of every month · matures ${formatDateShort(rd.maturityDate)}`,
              status:  'ACTIVE', dotColor: '#D97706',
              rdData:  { id: rd.id, monthlyAmount: rd.monthlyAmount, dayOfMonth: rd.dayOfMonth },
            })
          }
        }
      }

      if (mfRes.ok) {
        const { funds } = await mfRes.json() as {
          funds: Array<{
            id: string; name: string
            sipConfig: { amount: number; dayOfMonth: number; status: string } | null
          }>
        }
        for (const fund of funds) {
          if (fund.sipConfig) {
            const sip = fund.sipConfig
            const sfx = ordinalSuffix(sip.dayOfMonth)
            arr.push({
              id: fund.id, type: 'SIP', name: fund.name,
              detail:  `${formatShort(sip.amount)} · ${sip.dayOfMonth}${sfx} of every month`,
              status:  sip.status, dotColor: '#16A34A',
              sipData: { fundId: fund.id, amount: sip.amount, dayOfMonth: sip.dayOfMonth, status: sip.status },
            })
          }
        }
      }

      setRules(arr)
    } catch (err) {
      console.error('Failed to load recurring rules', err)
    } finally {
      setRulesLoading(false)
    }
  }, [])

  // ── Fetch milestones ───────────────────────────────────────────────────────

  const fetchMilestones = useCallback(async () => {
    setMilestonesLoading(true)
    try {
      const res = await fetch('/api/milestones')
      if (res.ok) {
        const d = await res.json() as { milestones: Milestone[] }
        setMilestones(d.milestones)
      }
    } catch (err) {
      console.error('Failed to load milestones', err)
    } finally {
      setMilestonesLoading(false)
    }
  }, [])

  // ── Fetch snapshot list ────────────────────────────────────────────────────

  const fetchSnapshotList = useCallback(async () => {
    setSnapshotsLoading(true)
    try {
      const res = await fetch('/api/dashboard/snapshot/list')
      if (res.ok) {
        const d = await res.json() as { snapshots: SnapshotRecord[]; count: number }
        setSnapshotList(d.snapshots)
        setSnapshotCount(d.count)
      }
    } catch (err) {
      console.error('Failed to load snapshots', err)
    } finally {
      setSnapshotsLoading(false)
    }
  }, [])

  async function handleTakeSnapshot() {
    setTakingSnapshot(true)
    try {
      const res = await fetch('/api/dashboard/snapshot', { method: 'POST' })
      if (res.ok) await fetchSnapshotList()
    } finally {
      setTakingSnapshot(false)
    }
  }

  async function handleDeleteSnapshot(id: string) {
    setSnDeleting(true)
    try {
      await fetch(`/api/dashboard/snapshot/${id}`, { method: 'DELETE' })
      setSnDeleteId(null)
      await fetchSnapshotList()
    } finally {
      setSnDeleting(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'recurring')  fetchRules()
    if (activeSection === 'milestones') fetchMilestones()
    if (activeSection === 'snapshots')  fetchSnapshotList()
  }, [activeSection, fetchRules, fetchMilestones, fetchSnapshotList])

  // Escape closes dialogs
  useEffect(() => {
    if (!editState && !milestoneDialog) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditState(null)
        setMilestoneDialog(null)
      }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [editState, milestoneDialog])

  // ── Open edit dialog ───────────────────────────────────────────────────────

  function openEdit(rule: RecurringRule) {
    setEditError('')
    if (rule.type === 'EPF' && rule.epfData) {
      setEditState({ type: 'EPF', ...rule.epfData })
    } else if (rule.type === 'RD' && rule.rdData) {
      setEditState({ type: 'RD', ...rule.rdData })
    } else if (rule.type === 'SIP' && rule.sipData) {
      setEditState({ type: 'SIP', fundId: rule.sipData.fundId, amount: rule.sipData.amount, dayOfMonth: rule.sipData.dayOfMonth, status: rule.sipData.status })
    }
  }

  async function handleResume(rule: RecurringRule) {
    if (rule.type !== 'SIP' || !rule.sipData) return
    try {
      await fetch(`/api/mf/${rule.sipData.fundId}/sip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      await fetchRules()
    } catch (err) {
      console.error('Resume failed', err)
    }
  }

  // ── Save recurring edit ────────────────────────────────────────────────────

  async function handleSaveEdit() {
    if (!editState) return
    setEditLoading(true)
    setEditError('')
    try {
      let res: Response
      if (editState.type === 'EPF') {
        res = await fetch('/api/epf', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeMonthly: editState.employeeMonthly, employerMonthly: editState.employerMonthly, dayOfMonth: editState.dayOfMonth }),
        })
      } else if (editState.type === 'RD') {
        res = await fetch(`/api/rd/${editState.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayOfMonth: editState.dayOfMonth }),
        })
      } else {
        res = await fetch(`/api/mf/${editState.fundId}/sip`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: editState.amount, dayOfMonth: editState.dayOfMonth, status: editState.status }),
        })
      }
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setEditError(d.error ?? 'Failed to save')
        return
      }
      setEditState(null)
      await fetchRules()
    } finally {
      setEditLoading(false)
    }
  }

  // ── Milestone dialog helpers ───────────────────────────────────────────────

  function openAddMilestone() {
    setMlTitle('')
    setMlAmount('')
    setMlAsset('total')
    setMlError('')
    setMilestoneDialog({ mode: 'add' })
  }

  function openEditMilestone(m: Milestone) {
    setMlTitle(m.title)
    setMlAmount(String(m.targetAmount))
    setMlAsset(m.targetAsset ?? '')
    setMlError('')
    setMilestoneDialog({ mode: 'edit', milestone: m })
  }

  async function handleSubmitMilestone() {
    if (!milestoneDialog) return
    const trimTitle = mlTitle.trim()
    const amount    = parseFloat(mlAmount)
    if (!trimTitle) { setMlError('Goal title is required'); return }
    if (!mlAmount || isNaN(amount) || amount <= 0) { setMlError('Target amount must be greater than 0'); return }

    setMlSubmitting(true)
    setMlError('')
    try {
      const targetAsset = mlAsset || null
      let res: Response
      if (milestoneDialog.mode === 'add') {
        res = await fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimTitle, targetAmount: amount, targetAsset }),
        })
      } else {
        res = await fetch(`/api/milestones/${milestoneDialog.milestone.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimTitle, targetAmount: amount, targetAsset }),
        })
      }
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setMlError(d.error ?? 'Failed to save')
        return
      }
      setMilestoneDialog(null)
      await fetchMilestones()
    } finally {
      setMlSubmitting(false)
    }
  }

  async function handleDeleteMilestone(id: string) {
    setMlDeleting(true)
    try {
      await fetch(`/api/milestones/${id}`, { method: 'DELETE' })
      setMlDeleteId(null)
      await fetchMilestones()
    } finally {
      setMlDeleting(false)
    }
  }

  // ── CSV exports ────────────────────────────────────────────────────────────

  async function exportStocks() {
    setCsvLoading('stocks')
    try {
      const res = await fetch('/api/stocks')
      if (!res.ok) return
      const { stocks } = await res.json() as { stocks: Array<Record<string, unknown>> }
      const rows = stocks.map(s => ({
        Name: s.name, Ticker: s.ticker, Exchange: s.exchange, Quantity: s.quantity,
        'Avg Price': s.avgPrice, 'Current Price': s.currentPrice,
        'Invested (₹)': s.investedValue, 'Current Value (₹)': s.currentValue,
        'Gain/Loss (₹)': Number(s.currentValue) - Number(s.investedValue),
        'Gain/Loss (%)': Number(s.investedValue) > 0
          ? (((Number(s.currentValue) - Number(s.investedValue)) / Number(s.investedValue)) * 100).toFixed(2)
          : '0.00',
      }))
      downloadCSV(rows, `ledger-stocks-${dateStr}.csv`)
      setCsvDone('stocks'); setTimeout(() => setCsvDone(null), 2000)
    } finally { setCsvLoading(null) }
  }

  async function exportMF() {
    setCsvLoading('mf')
    try {
      const res = await fetch('/api/mf')
      if (!res.ok) return
      const { funds } = await res.json() as { funds: Array<Record<string, unknown>> }
      const rows = funds.map(f => ({
        Name: f.name, ISIN: f.isin ?? '', Platform: f.platform ?? '',
        Units: f.units, 'Avg NAV': f.avgNav, 'Current NAV': f.currentNav,
        'Invested (₹)': f.investedValue, 'Current Value (₹)': f.currentValue,
        'Gain/Loss (₹)': Number(f.currentValue) - Number(f.investedValue),
        'Gain/Loss (%)': Number(f.investedValue) > 0
          ? (((Number(f.currentValue) - Number(f.investedValue)) / Number(f.investedValue)) * 100).toFixed(2)
          : '0.00',
      }))
      downloadCSV(rows, `ledger-mf-${dateStr}.csv`)
      setCsvDone('mf'); setTimeout(() => setCsvDone(null), 2000)
    } finally { setCsvLoading(null) }
  }

  async function exportFDRD() {
    setCsvLoading('fdrd')
    try {
      const [fdRes, rdRes] = await Promise.all([fetch('/api/fd'), fetch('/api/rd')])
      const { fds } = fdRes.ok ? await fdRes.json() as { fds: Array<Record<string, unknown>> } : { fds: [] }
      const { rds } = rdRes.ok ? await rdRes.json() as { rds: Array<Record<string, unknown>> } : { rds: [] }
      downloadCSV([
        ...(fds as Array<Record<string, unknown>>).map(f => ({ Type: 'FD', Name: f.name, Bank: f.bankName, Platform: f.platform, 'Principal (₹)': f.principal, 'Interest Rate': f.interestRate, 'Current Value (₹)': f.currentValue, 'Maturity Value (₹)': f.maturityValue, 'Start Date': f.startDate, 'Maturity Date': f.maturityDate })),
        ...(rds as Array<Record<string, unknown>>).map(r => ({ Type: 'RD', Name: r.name, Bank: r.bankName, Platform: r.platform, 'Principal (₹)': r.totalInvested, 'Interest Rate': r.interestRate, 'Current Value (₹)': r.currentValue, 'Maturity Value (₹)': r.maturityValue, 'Start Date': r.startDate, 'Maturity Date': r.maturityDate })),
      ], `ledger-fdrd-${dateStr}.csv`)
      setCsvDone('fdrd'); setTimeout(() => setCsvDone(null), 2000)
    } finally { setCsvLoading(null) }
  }

  async function exportAll() {
    setCsvLoading('all')
    try {
      const [stocksRes, mfRes, fdRes, rdRes, usRes] = await Promise.all([
        fetch('/api/stocks'), fetch('/api/mf'), fetch('/api/fd'), fetch('/api/rd'), fetch('/api/us-stocks'),
      ])
      const { stocks }           = stocksRes.ok ? await stocksRes.json() as { stocks: Array<Record<string, unknown>> }  : { stocks: [] }
      const { funds }            = mfRes.ok  ? await mfRes.json()  as { funds:  Array<Record<string, unknown>> }        : { funds: [] }
      const { fds }              = fdRes.ok  ? await fdRes.json()  as { fds:    Array<Record<string, unknown>> }        : { fds: [] }
      const { rds }              = rdRes.ok  ? await rdRes.json()  as { rds:    Array<Record<string, unknown>> }        : { rds: [] }
      const { stocks: usStocks } = usRes.ok  ? await usRes.json()  as { stocks: Array<Record<string, unknown>> }        : { stocks: [] }
      const rows: Record<string, unknown>[] = [
        ...(stocks   as Array<Record<string, unknown>>).map(s => ({ 'Asset Type': 'Indian Stock',       Name: s.name, Identifier: s.ticker,   'Invested (₹)': s.investedValue,    'Current Value (₹)': s.currentValue })),
        ...(usStocks as Array<Record<string, unknown>>).map(s => ({ 'Asset Type': 'Intl Stock',         Name: s.name, Identifier: s.ticker,   'Invested (₹)': s.investedValueINR, 'Current Value (₹)': s.currentValueINR })),
        ...(funds    as Array<Record<string, unknown>>).map(f => ({ 'Asset Type': 'Mutual Fund',        Name: f.name, Identifier: f.isin ?? '','Invested (₹)': f.investedValue,    'Current Value (₹)': f.currentValue })),
        ...(fds      as Array<Record<string, unknown>>).map(f => ({ 'Asset Type': 'Fixed Deposit',      Name: f.name, Identifier: f.bankName,  'Invested (₹)': f.principal,        'Current Value (₹)': f.currentValue })),
        ...(rds      as Array<Record<string, unknown>>).map(r => ({ 'Asset Type': 'Recurring Deposit',  Name: r.name, Identifier: r.bankName,  'Invested (₹)': r.totalInvested,    'Current Value (₹)': r.currentValue })),
      ]
      downloadCSV(rows, `ledger-portfolio-${dateStr}.csv`)
      setCsvDone('all'); setTimeout(() => setCsvDone(null), 2000)
    } finally { setCsvLoading(null) }
  }

  // ── Danger zone ────────────────────────────────────────────────────────────

  async function handleDanger(key: 'stocks' | 'mf') {
    setDangerLoading(true)
    try {
      const endpoint = key === 'stocks' ? '/api/stocks/all' : '/api/mf/all'
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        const label = key === 'stocks' ? 'Stocks reset.' : 'Mutual funds reset.'
        setDangerSuccess(prev => ({ ...prev, [key]: label }))
        setTimeout(() => setDangerSuccess(prev => { const n = { ...prev }; delete n[key]; return n }), 3000)
        setDangerConfirm(null)
      }
    } finally { setDangerLoading(false) }
  }

  async function handleResetAll() {
    if (resetText !== 'RESET') return
    setDangerLoading(true)
    try {
      await Promise.all([
        fetch('/api/stocks/all',             { method: 'DELETE' }),
        fetch('/api/mf/all',                 { method: 'DELETE' }),
        fetch('/api/fd/all',                 { method: 'DELETE' }),
        fetch('/api/rd/all',                 { method: 'DELETE' }),
        fetch('/api/epf/all',                { method: 'DELETE' }),
        fetch('/api/us-stocks/all',          { method: 'DELETE' }),
        fetch('/api/dashboard/snapshot/all', { method: 'DELETE' }),
        fetch('/api/milestones/all',         { method: 'DELETE' }),
      ])
      router.push('/assets')
    } finally { setDangerLoading(false) }
  }

  // ── Rail ───────────────────────────────────────────────────────────────────

  const RAIL = [
    { key: 'recurring'  as const, Icon: RefreshCw,    label: 'RECURRING',   sub: `${rules.length} active rules` },
    { key: 'milestones' as const, Icon: Flag,          label: 'MILESTONES',  sub: 'Track your goals' },
    { key: 'snapshots'  as const, Icon: Camera,        label: 'SNAPSHOTS',   sub: `${snapshotCount} snapshot${snapshotCount !== 1 ? 's' : ''}` },
    { key: 'export'     as const, Icon: Download,      label: 'EXPORT DATA', sub: 'CSV downloads' },
    { key: 'danger'     as const, Icon: AlertTriangle, label: 'DANGER ZONE', sub: 'Reset data' },
  ]

  const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
    recurring:  { title: 'Recurring rules', subtitle: 'Auto-tracking schedules across your portfolio' },
    milestones: { title: 'Milestones',      subtitle: 'Track and celebrate your financial goals' },
    snapshots:  { title: 'Snapshots',       subtitle: 'Weekly net worth recordings used for your trend chart' },
    export:     { title: 'Export data',     subtitle: 'Download your portfolio data as CSV' },
    danger:     { title: 'Danger zone',     subtitle: 'These actions are permanent and cannot be undone' },
  }

  const { title, subtitle } = SECTION_META[activeSection]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile tab strip — shown only on mobile (≤768px) */}
      <div className="settings-mobile-tabs hide-scrollbar">
        {RAIL.map(({ key, label }) => {
          const active    = activeSection === key
          const isDanger  = key === 'danger'
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontFamily: 'inherit',
                fontWeight: active ? 600 : 400,
                border: active
                  ? `1.5px solid ${isDanger ? '#DC2626' : 'var(--color-text-primary)'}`
                  : '1px solid var(--color-border)',
                background: active
                  ? (isDanger ? '#DC2626' : 'var(--color-text-primary)')
                  : 'var(--color-surface)',
                color: active
                  ? 'var(--color-surface)'
                  : (isDanger ? '#DC2626' : 'var(--color-text-muted)'),
                cursor: 'pointer',
                transition: 'all 140ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {label.charAt(0) + label.slice(1).toLowerCase()}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* Left rail */}
        <div className="settings-rail" style={{ width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {RAIL.map(({ key, Icon, label, sub }) => {
            const active   = activeSection === key
            const isDanger = key === 'danger'
            const accentColor = isDanger ? '#DC2626' : 'var(--color-text-primary)'
            const labelColor  = isDanger ? '#DC2626' : active ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
            return (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                style={{
                  padding: '12px 14px', borderRadius: '10px', textAlign: 'left',
                  background: 'var(--color-surface)',
                  border: '0.5px solid var(--color-border)',
                  borderRight: `2px solid ${active ? accentColor : 'transparent'}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-right-color 140ms ease',
                }}
              >
                <Icon
                  size={16}
                  color={isDanger ? '#DC2626' : active ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
                  style={{ marginBottom: '6px', display: 'block' }}
                />
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: labelColor }}>
                  {label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{sub}</div>
              </button>
            )
          })}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}>
              {title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{subtitle}</div>
          </div>

          {/* ── RECURRING ── */}
          {activeSection === 'recurring' && (
            <div style={card}>
              <div style={{ padding: '16px 22px', borderBottom: '0.5px solid var(--color-border)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Active rules</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>These run automatically — no action needed</div>
              </div>

              {rulesLoading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ padding: '14px 22px', borderBottom: '0.5px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-surface-raised)', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ ...SK, height: 14, width: '40%' }} />
                        <div style={{ ...SK, height: 12, width: '65%' }} />
                      </div>
                      <div style={{ ...SK, width: 60, height: 22, flexShrink: 0 }} />
                    </div>
                  ))}
                </>
              ) : rules.length === 0 ? (
                <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={32} color="var(--color-text-muted)" />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No recurring rules</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '300px', textAlign: 'center', lineHeight: 1.5 }}>
                    Set up SIPs on the Mutual Funds tab or configure EPF auto-tracking.
                  </div>
                </div>
              ) : (
                rules.map((rule, i) => (
                  <div key={rule.id} style={{ padding: '14px 22px', borderBottom: i < rules.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: rule.dotColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{rule.detail}</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: rule.status === 'ACTIVE' ? '#F0FDF4' : 'var(--color-surface-raised)', color: rule.status === 'ACTIVE' ? '#16A34A' : 'var(--color-text-muted)', flexShrink: 0 }}>
                      {rule.status}
                    </span>
                    <button
                      onClick={() => rule.status === 'PAUSED' ? handleResume(rule) : openEdit(rule)}
                      style={{ padding: '5px 12px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {rule.status === 'PAUSED' ? 'Resume' : 'Edit'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── MILESTONES ── */}
          {activeSection === 'milestones' && (
            <div style={card}>
              <div style={{ padding: '16px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Your goals</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Set targets and track your progress</div>
                </div>
                <button
                  onClick={openAddMilestone}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <Plus size={13} />
                  Add goal
                </button>
              </div>

              {milestonesLoading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ padding: '14px 22px', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
                      <div style={{ ...SK, height: 14, width: '45%', marginBottom: '8px' }} />
                      <div style={{ ...SK, height: 4, borderRadius: '2px' }} />
                    </div>
                  ))}
                </>
              ) : milestones.length === 0 ? (
                <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <Flag size={32} color="var(--color-text-muted)" />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>No milestones yet</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '280px', textAlign: 'center', lineHeight: 1.5 }}>
                    Add your first financial goal to start tracking progress.
                  </div>
                  <button
                    onClick={openAddMilestone}
                    style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    <Plus size={13} />
                    Add goal
                  </button>
                </div>
              ) : (
                milestones.map((m, i) => (
                  <div
                    key={m.id}
                    style={{ padding: '14px 22px', borderBottom: i < milestones.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}
                    className="milestone-row"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => openEditMilestone(m)}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                      >
                        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          Target: {formatShort(m.targetAmount)}
                          {m.targetAsset ? ` in ${ASSET_OPTIONS.find(o => o.value === m.targetAsset)?.label ?? m.targetAsset}` : ''}
                        </div>
                      </button>
                      <div style={{ height: '4px', background: 'var(--color-surface-raised)', borderRadius: '2px', overflow: 'hidden', marginTop: '7px' }}>
                        <div style={{ height: '100%', width: `${m.progressPct}%`, background: m.isAchieved ? '#16A34A' : 'var(--color-text-primary)', borderRadius: '2px', transition: 'width 600ms ease' }} />
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
                      {m.isAchieved ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: '#F0FDF4', color: '#16A34A', display: 'inline-block', marginBottom: '2px' }}>
                          ✓ Achieved
                        </span>
                      ) : (
                        <>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{m.progressPct}%</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatShort(m.amountAway)} away</div>
                        </>
                      )}
                      {m.isAchieved && m.achievedDate && (
                        <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {formatDateShort(m.achievedDate)}
                        </div>
                      )}
                    </div>

                    {/* Delete control */}
                    <div style={{ flexShrink: 0 }}>
                      {mlDeleteId === m.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11.5px', color: '#DC2626', whiteSpace: 'nowrap' }}>Delete?</span>
                          <button onClick={() => setMlDeleteId(null)} style={{ padding: '4px 8px', borderRadius: '5px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>No</button>
                          <button
                            onClick={() => handleDeleteMilestone(m.id)}
                            disabled={mlDeleting}
                            style={{ padding: '4px 8px', borderRadius: '5px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {mlDeleting ? '…' : 'Yes'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setMlDeleteId(m.id)}
                          style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 0, borderRadius: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── SNAPSHOTS ── */}
          {activeSection === 'snapshots' && (
            <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '16px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Net worth history</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Snapshots are taken automatically every week and when you click the Snapshot button
                  </div>
                </div>
                <button
                  onClick={handleTakeSnapshot}
                  disabled={takingSnapshot}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: takingSnapshot ? 'default' : 'pointer', opacity: takingSnapshot ? 0.7 : 1, flexShrink: 0 }}
                >
                  <Camera size={13} />
                  {takingSnapshot ? 'Saving…' : 'Take snapshot'}
                </button>
              </div>

              {snapshotsLoading ? (
                /* Skeleton rows */
                <>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px', padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
                    {['Date', 'Net Worth', 'Invested', 'Source', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 500, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px', padding: '12px 22px', borderBottom: '0.5px solid var(--color-border-subtle)', gap: '8px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ ...SK, height: 13, width: '70%' }} />
                        <div style={{ ...SK, height: 11, width: '40%' }} />
                      </div>
                      <div style={{ ...SK, height: 13, width: '80%' }} />
                      <div style={{ ...SK, height: 13, width: '75%' }} />
                      <div style={{ ...SK, height: 18, width: '50px', borderRadius: '3px' }} />
                      <div style={{ ...SK, height: 20, width: 20, borderRadius: '4px', marginLeft: 'auto' }} />
                    </div>
                  ))}
                </>
              ) : snapshotList.length === 0 ? (
                /* Empty state */
                <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Camera size={32} color="var(--color-text-muted)" />
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px' }}>No snapshots yet</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '300px', textAlign: 'center', lineHeight: 1.5 }}>
                    Take your first snapshot to start tracking your net worth over time
                  </div>
                  <button
                    onClick={handleTakeSnapshot}
                    disabled={takingSnapshot}
                    style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontFamily: 'inherit', cursor: takingSnapshot ? 'default' : 'pointer', opacity: takingSnapshot ? 0.7 : 1 }}
                  >
                    <Camera size={13} />
                    {takingSnapshot ? 'Saving…' : 'Take snapshot'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px', padding: '10px 22px', background: 'var(--color-bg)', borderBottom: '0.5px solid var(--color-border)' }}>
                    {['Date', 'Net Worth', 'Invested', 'Source', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 500, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>

                  {/* Data rows */}
                  {snapshotList.map((sn, i) => {
                    const d         = new Date(sn.date)
                    const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    const timeLabel = new Date(sn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    const isLast    = i === snapshotList.length - 1
                    const isDeleting = snDeleteId === sn.id
                    return (
                      <div
                        key={sn.id}
                        style={{
                          display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px',
                          padding: '12px 22px', alignItems: 'center',
                          borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-subtle)',
                          background: 'var(--color-surface)',
                          transition: 'background 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FAFAF8' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)' }}
                      >
                        {/* Date */}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{dateLabel}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{timeLabel}</div>
                        </div>

                        {/* Net Worth */}
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatINR(sn.totalNetWorth)}
                        </div>

                        {/* Invested */}
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatINR(sn.investedValue)}
                        </div>

                        {/* Source badge */}
                        <div>
                          <span style={{
                            fontSize: '10px', padding: '2px 7px', borderRadius: '3px', fontWeight: 600,
                            background: sn.source === 'AUTO' ? '#F0F4FF' : '#F7F6F2',
                            color:      sn.source === 'AUTO' ? '#4338CA' : '#7A7670',
                          }}>
                            {sn.source === 'AUTO' ? 'Auto' : 'Manual'}
                          </span>
                        </div>

                        {/* Action */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {isDeleting ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '11.5px', color: '#DC2626', whiteSpace: 'nowrap' }}>Delete?</span>
                              <button
                                onClick={() => setSnDeleteId(null)}
                                style={{ padding: '3px 7px', borderRadius: '4px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDeleteSnapshot(sn.id)}
                                disabled={snDeleting}
                                style={{ padding: '3px 7px', borderRadius: '4px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '11px', fontFamily: 'inherit', cursor: snDeleting ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {snDeleting ? '…' : 'Delete'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSnDeleteId(sn.id)}
                              style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', lineHeight: 0, transition: 'color 120ms ease, background 120ms ease' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FFF5F5' }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ── EXPORT ── */}
          {activeSection === 'export' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { key: 'stocks', label: 'Stocks',       desc: 'Holdings and transactions', fn: exportStocks },
                { key: 'mf',    label: 'Mutual Funds',  desc: 'Funds and NAV history',     fn: exportMF    },
                { key: 'fdrd',  label: 'FDs & RDs',     desc: 'All deposit accounts',      fn: exportFDRD  },
                { key: 'all',   label: 'Full portfolio', desc: 'Everything in one file',    fn: exportAll   },
              ].map(({ key, label, desc, fn }) => {
                const isLoading = csvLoading === key
                const isDone    = csvDone    === key
                return (
                  <div
                    key={key}
                    style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '10px', padding: '16px 18px', transition: 'border-color 140ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
                      <Download size={14} color="var(--color-text-muted)" />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>{desc}</div>
                    <button
                      onClick={fn}
                      disabled={!!isLoading}
                      style={{ padding: '0', fontSize: '12.5px', color: isDone ? '#16A34A' : 'var(--color-text-muted)', background: 'none', border: 'none', cursor: isLoading ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {isLoading ? 'Preparing…' : isDone ? '✓ Downloaded!' : '↓ Download CSV'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── DANGER ZONE ── */}
          {activeSection === 'danger' && (
            <div style={{ border: '0.5px solid #FECDD3', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '0.5px solid #FEE2E2', background: '#FFF5F5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={14} color="#DC2626" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>Danger zone</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>These actions are permanent and cannot be undone</div>
                </div>
              </div>
              <DangerRow
                name="Reset all stocks" description="Deletes all stocks and transaction history"
                successMessage={dangerSuccess['stocks']} confirming={dangerConfirm === 'stocks'}
                loading={dangerLoading && dangerConfirm === 'stocks'}
                onTrigger={() => setDangerConfirm('stocks')} onCancel={() => setDangerConfirm(null)} onConfirm={() => handleDanger('stocks')} borderBottom
              />
              <DangerRow
                name="Reset all mutual funds" description="Deletes all funds, transactions and SIP configs"
                successMessage={dangerSuccess['mf']} confirming={dangerConfirm === 'mf'}
                loading={dangerLoading && dangerConfirm === 'mf'}
                onTrigger={() => setDangerConfirm('mf')} onCancel={() => setDangerConfirm(null)} onConfirm={() => handleDanger('mf')} borderBottom
              />
              <div style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Reset everything</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Permanently deletes all assets, transactions and snapshots</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {dangerConfirm === 'all' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        placeholder="Type RESET to confirm"
                        value={resetText}
                        onChange={e => setResetText(e.target.value)}
                        style={{ ...inputStyle, width: '170px', padding: '5px 9px', fontSize: '12px', borderColor: '#FECDD3', boxSizing: 'border-box' }}
                      />
                      <button onClick={() => { setDangerConfirm(null); setResetText('') }} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
                      <button
                        onClick={handleResetAll}
                        disabled={resetText !== 'RESET' || dangerLoading}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid #FCA5A5', background: '#FEE2E2', color: '#DC2626', fontSize: '12px', fontFamily: 'inherit', cursor: resetText === 'RESET' && !dangerLoading ? 'pointer' : 'default', opacity: resetText === 'RESET' && !dangerLoading ? 1 : 0.5, whiteSpace: 'nowrap' }}
                      >
                        {dangerLoading ? 'Resetting…' : 'Confirm'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDangerConfirm('all')} style={{ padding: '6px 14px', borderRadius: '6px', border: '0.5px solid #FCA5A5', background: '#FEE2E2', color: '#DC2626', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Reset everything
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recurring edit dialog ── */}
      {editState !== null && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditState(null) }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {editState.type === 'EPF' ? 'Edit EPF tracking' : editState.type === 'RD' ? 'Edit RD installment' : 'Edit SIP'}
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {editState.type === 'EPF' && (
                <>
                  <div>
                    <label style={labelStyle}>Employee contribution (₹)</label>
                    <input type="number" min={0} style={inputStyle} value={editState.employeeMonthly} onChange={e => setEditState({ ...editState, employeeMonthly: +e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Employer contribution (₹)</label>
                    <input type="number" min={0} style={inputStyle} value={editState.employerMonthly} onChange={e => setEditState({ ...editState, employerMonthly: +e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Day of month (1–28)</label>
                    <input type="number" min={1} max={28} style={inputStyle} value={editState.dayOfMonth} onChange={e => setEditState({ ...editState, dayOfMonth: Math.min(28, Math.max(1, +e.target.value)) })} />
                  </div>
                  <div style={{ background: '#F0FDF4', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#16A34A', fontWeight: 500 }}>
                    Total: {formatShort(editState.employeeMonthly + editState.employerMonthly)} per month
                  </div>
                </>
              )}
              {editState.type === 'RD' && (
                <>
                  <div>
                    <label style={labelStyle}>Monthly amount (₹)</label>
                    <input type="number" style={{ ...inputStyle, background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }} value={editState.monthlyAmount} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>Day of month (1–28)</label>
                    <input type="number" min={1} max={28} style={inputStyle} value={editState.dayOfMonth} onChange={e => setEditState({ ...editState, dayOfMonth: Math.min(28, Math.max(1, +e.target.value)) })} />
                  </div>
                </>
              )}
              {editState.type === 'SIP' && (
                <>
                  <div>
                    <label style={labelStyle}>SIP amount (₹)</label>
                    <input type="number" min={1} style={inputStyle} value={editState.amount} onChange={e => setEditState({ ...editState, amount: +e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Day of month (1–28)</label>
                    <input type="number" min={1} max={28} style={inputStyle} value={editState.dayOfMonth} onChange={e => setEditState({ ...editState, dayOfMonth: Math.min(28, Math.max(1, +e.target.value)) })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['ACTIVE', 'PAUSED'] as const).map(s => (
                        <button key={s} onClick={() => setEditState({ ...editState, status: s })} style={{ flex: 1, padding: '7px', borderRadius: '7px', border: `0.5px solid ${editState.status === s ? 'var(--color-text-primary)' : 'var(--color-border)'}`, background: editState.status === s ? 'var(--color-text-primary)' : 'transparent', color: editState.status === s ? 'var(--color-surface)' : 'var(--color-text-secondary)', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 140ms ease' }}>
                          {s === 'ACTIVE' ? 'Active' : 'Paused'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {editError && <div style={{ fontSize: '12px', color: 'var(--color-loss)', padding: '8px 10px', background: 'var(--color-loss-subtle)', borderRadius: '6px' }}>{editError}</div>}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditState(null)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={editLoading} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: editLoading ? 'default' : 'pointer', opacity: editLoading ? 0.7 : 1 }}>
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Milestone add/edit dialog ── */}
      {milestoneDialog !== null && (
        <div onClick={e => { if (e.target === e.currentTarget) setMilestoneDialog(null) }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {milestoneDialog.mode === 'add' ? 'Add milestone' : 'Edit milestone'}
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Goal title</label>
                <input
                  type="text" placeholder="e.g. ₹5L total portfolio" style={inputStyle}
                  value={mlTitle} onChange={e => setMlTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Target amount (₹)</label>
                <input
                  type="number" min={1} placeholder="500000" style={inputStyle}
                  value={mlAmount} onChange={e => setMlAmount(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Track against</label>
                <select
                  value={mlAsset}
                  onChange={e => setMlAsset(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}
                >
                  {ASSET_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {mlError && <div style={{ fontSize: '12px', color: 'var(--color-loss)', padding: '8px 10px', background: 'var(--color-loss-subtle)', borderRadius: '6px' }}>{mlError}</div>}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', gap: '8px' }}>
              <button onClick={() => setMilestoneDialog(null)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmitMilestone} disabled={mlSubmitting} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: mlSubmitting ? 'default' : 'pointer', opacity: mlSubmitting ? 0.7 : 1 }}>
                {mlSubmitting ? 'Saving…' : milestoneDialog.mode === 'add' ? 'Add goal' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── DangerRow sub-component ────────────────────────────────────────────────────

function DangerRow({
  name, description, successMessage, confirming, loading,
  onTrigger, onCancel, onConfirm, borderBottom,
}: {
  name: string; description: string; successMessage?: string
  confirming: boolean; loading: boolean
  onTrigger: () => void; onCancel: () => void; onConfirm: () => void
  borderBottom?: boolean
}) {
  return (
    <div style={{ padding: '16px 22px', borderBottom: borderBottom ? '0.5px solid #FEF2F2' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{name}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{description}</div>
        {successMessage && <div style={{ fontSize: '12px', color: '#16A34A', marginTop: '4px', fontWeight: 500 }}>{successMessage}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {confirming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#DC2626', whiteSpace: 'nowrap' }}>Are you sure?</span>
            <button onClick={onCancel} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
            <button onClick={onConfirm} disabled={loading} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '12px', fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {loading ? 'Deleting…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <button onClick={onTrigger} style={{ padding: '6px 14px', borderRadius: '6px', border: '0.5px solid #FECDD3', background: '#FFF5F5', color: '#DC2626', fontSize: '12.5px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{name}</button>
        )}
      </div>
    </div>
  )
}
