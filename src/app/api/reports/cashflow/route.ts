import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function apiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fullMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function shortMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function monthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

// startSnap: latest snapshot with date <= firstDay of month
// endSnap:   earliest snapshot with date >= lastDay of month (23:59:59)
function monthlyGainFromSnapshots(
  snapshots: { date: Date; totalNetWorth: number }[],
  monthStart: Date,
  monthEnd: Date,
): number | null {
  const startSnap = [...snapshots].reverse().find(s => s.date <= monthStart)
  const endSnap   = snapshots.find(s => s.date >= monthEnd)
  if (!startSnap || !endSnap) return null
  return endSnap.totalNetWorth - startSnap.totalNetWorth
}

const CANONICAL_CLASS_ORDER = ['Stocks', 'Mutual Funds', 'EPF', 'FD', 'RD', 'International']

// ── Summary mode ──────────────────────────────────────────────────────────────

async function handleSummaryMode(monthCount: number) {
  const now = new Date()

  // Build month boundaries oldest→newest
  const monthData: {
    year: number; month: number
    monthStart: Date; monthEnd: Date
    label: string; monthValue: string
    isCurrentMonth: boolean
  }[] = []

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() + 1
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999)
    monthData.push({
      year, month, monthStart, monthEnd,
      label: shortMonthLabel(d),
      monthValue: monthStr(year, month),
      isCurrentMonth: year === now.getFullYear() && month === now.getMonth() + 1,
    })
  }

  const rangeStart = monthData[0].monthStart
  const rangeEnd   = monthData[monthData.length - 1].monthEnd

  // Fetch snapshots from 1 month before range start to cover every month's startSnap
  const snapLookback = new Date(rangeStart.getFullYear(), rangeStart.getMonth() - 1, 1)

  const [
    stockTxns, initialStocks,
    mfTxns, initialMFs,
    epfTxns, fds, rds, usTxns, customEntries,
    snapshots,
  ] = await Promise.all([
    prisma.stockTransaction.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd }, type: 'BUY' },
    }),
    prisma.stock.findMany({
      where: { createdAt: { gte: rangeStart, lte: rangeEnd }, transactions: { none: {} } },
    }),
    prisma.mutualFundTransaction.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd }, type: { in: ['SIP', 'LUMPSUM'] } },
    }),
    prisma.mutualFund.findMany({
      where: { createdAt: { gte: rangeStart, lte: rangeEnd }, transactions: { none: {} } },
    }),
    prisma.ePFTransaction.findMany({
      where: { transactionDate: { gte: rangeStart, lte: rangeEnd }, type: 'CR' },
    }),
    prisma.fDAccount.findMany({
      where: { startDate: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.rDAccount.findMany({
      where: { startDate: { lte: rangeEnd }, maturityDate: { gte: rangeStart } },
    }),
    prisma.uSStockTransaction.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd }, type: 'BUY' },
    }),
    prisma.customAssetEntry.findMany({
      where: { purchaseDate: { not: null, gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.snapshot.findMany({
      where: { date: { gte: snapLookback } },
      orderBy: { date: 'asc' },
      select: { date: true, totalNetWorth: true },
    }),
  ])

  const months = monthData.map(({ year, month, monthStart, monthEnd, label, monthValue, isCurrentMonth }) => {
    const invested =
      stockTxns.filter(t => t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + t.quantity * t.price, 0)
      + initialStocks.filter(s => s.createdAt >= monthStart && s.createdAt <= monthEnd).reduce((s, st) => s + st.avgPrice * st.quantity, 0)
      + mfTxns.filter(t => t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + t.amount, 0)
      + initialMFs.filter(f => f.createdAt >= monthStart && f.createdAt <= monthEnd).reduce((s, f) => s + f.investedValue, 0)
      + epfTxns.filter(t => t.transactionDate >= monthStart && t.transactionDate <= monthEnd).reduce((s, t) => s + t.employeeAmount + t.employerAmount, 0)
      + fds.filter(fd => fd.startDate >= monthStart && fd.startDate <= monthEnd).reduce((s, fd) => s + fd.principal, 0)
      + rds.filter(rd => rd.startDate <= monthEnd && rd.maturityDate >= monthStart).reduce((s, rd) => {
          const installDate = new Date(year, month - 1, rd.dayOfMonth)
          return installDate >= monthStart && installDate <= monthEnd ? s + rd.monthlyAmount : s
        }, 0)
      + usTxns.filter(t => t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + t.amountINR, 0)
      + customEntries.filter(e => e.purchaseDate && e.purchaseDate >= monthStart && e.purchaseDate <= monthEnd).reduce((s, e) => s + e.purchasePrice, 0)

    const gain = monthlyGainFromSnapshots(snapshots, monthStart, monthEnd)
    return { label, month: monthValue, invested, monthlyGain: gain, isCurrentMonth }
  })

  const totalInvested = months.reduce((s, m) => s + m.invested, 0)

  // sixMonthGain: startSnap before window, endSnap <= today
  const windowStartSnap = [...snapshots].reverse().find(s => s.date < rangeStart)
  const windowEndSnap   = [...snapshots].reverse().find(s => s.date <= now)
  const sixMonthGain = windowStartSnap && windowEndSnap && windowStartSnap !== windowEndSnap
    ? windowEndSnap.totalNetWorth - windowStartSnap.totalNetWorth
    : null

  return NextResponse.json({ months, totalInvested, sixMonthGain })
}

// ── Detail mode ───────────────────────────────────────────────────────────────

async function handleDetailMode(param: string | null) {
  const now = new Date()
  let year: number, month: number
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const parts = param.split('-').map(Number)
    year  = parts[0]
    month = parts[1]
  } else {
    year  = now.getFullYear()
    month = now.getMonth() + 1
  }

  const monthStart  = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const monthEnd    = new Date(year, month, 0, 23, 59, 59, 999)
  const monthValue  = monthStr(year, month)
  const label       = fullMonthLabel(year, month)

  const [
    stockBuyTxns, stockSellTxns, initialStocks,
    mfBuyTxns, mfSellTxns, initialMFs,
    epfCrTxns, epfDrTxns,
    fdAccounts, rdAccounts,
    usBuyTxns, usSellTxns,
    customEntries,
    startSnap, endSnap,
    minStock, minMF, minEPF, minFD, minRD, minUS, minCustom,
  ] = await Promise.all([
    prisma.stockTransaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, type: 'BUY' },
      include: { stock: { select: { name: true, ticker: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.stockTransaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, type: 'SELL' },
      include: { stock: { select: { name: true, ticker: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.stock.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, transactions: { none: {} } },
    }),
    prisma.mutualFundTransaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, type: { in: ['SIP', 'LUMPSUM'] } },
      include: { fund: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.mutualFundTransaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, type: { in: ['SELL', 'REDEEM'] } },
      include: { fund: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.mutualFund.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, transactions: { none: {} } },
    }),
    prisma.ePFTransaction.findMany({
      where: { transactionDate: { gte: monthStart, lte: monthEnd }, type: 'CR' },
      orderBy: { transactionDate: 'asc' },
    }),
    prisma.ePFTransaction.findMany({
      where: { transactionDate: { gte: monthStart, lte: monthEnd }, type: 'DR' },
      orderBy: { transactionDate: 'asc' },
    }),
    prisma.fDAccount.findMany({
      where: { startDate: { gte: monthStart, lte: monthEnd } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.rDAccount.findMany({
      where: { startDate: { lte: monthEnd }, maturityDate: { gte: monthStart } },
    }),
    prisma.uSStockTransaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, type: 'BUY' },
      include: { stock: { select: { name: true, ticker: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.uSStockTransaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, type: 'SELL' },
      include: { stock: { select: { name: true, ticker: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.customAssetEntry.findMany({
      where: { purchaseDate: { not: null, gte: monthStart, lte: monthEnd } },
      include: { class: { select: { name: true } } },
      orderBy: { purchaseDate: 'asc' },
    }),
    // Snapshots for monthlyGain
    prisma.snapshot.findFirst({
      where: { date: { lte: monthStart } },
      orderBy: { date: 'desc' },
      select: { totalNetWorth: true },
    }),
    prisma.snapshot.findFirst({
      where: { date: { gte: monthEnd } },
      orderBy: { date: 'asc' },
      select: { totalNetWorth: true },
    }),
    // availableMonths floor — merged into single round-trip
    prisma.stockTransaction.findFirst({ where: { type: 'BUY' }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.mutualFundTransaction.findFirst({ where: { type: { in: ['SIP', 'LUMPSUM'] } }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.ePFTransaction.findFirst({ where: { type: 'CR' }, orderBy: { transactionDate: 'asc' }, select: { transactionDate: true } }),
    prisma.fDAccount.findFirst({ orderBy: { startDate: 'asc' }, select: { startDate: true } }),
    prisma.rDAccount.findFirst({ orderBy: { startDate: 'asc' }, select: { startDate: true } }),
    prisma.uSStockTransaction.findFirst({ where: { type: 'BUY' }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.customAssetEntry.findFirst({ where: { purchaseDate: { not: null } }, orderBy: { purchaseDate: 'asc' }, select: { purchaseDate: true } }),
  ])

  type TxnEntry = {
    id: string; date: Date; assetClass: string; name: string; amount: number; direction: 'in' | 'out'
  }

  // Build per-class buckets in canonical order, custom classes collected separately
  const buckets: Record<string, TxnEntry[]> = {}
  for (const cls of CANONICAL_CLASS_ORDER) buckets[cls] = []
  const customBuckets: Record<string, TxnEntry[]> = {}

  function push(entry: TxnEntry) {
    if (CANONICAL_CLASS_ORDER.includes(entry.assetClass)) {
      buckets[entry.assetClass].push(entry)
    } else {
      if (!customBuckets[entry.assetClass]) customBuckets[entry.assetClass] = []
      customBuckets[entry.assetClass].push(entry)
    }
  }

  for (const t of stockBuyTxns)   push({ id: t.id, date: t.date, assetClass: 'Stocks', name: `${t.stock.name} (${t.stock.ticker})`, amount: t.quantity * t.price, direction: 'out' })
  for (const t of stockSellTxns)  push({ id: t.id, date: t.date, assetClass: 'Stocks', name: `${t.stock.name} (${t.stock.ticker})`, amount: t.quantity * t.price, direction: 'in' })
  for (const s of initialStocks)  push({ id: `init-stock-${s.id}`, date: s.createdAt, assetClass: 'Stocks', name: `${s.name} (${s.ticker})`, amount: s.avgPrice * s.quantity, direction: 'out' })
  for (const t of mfBuyTxns)      push({ id: t.id, date: t.date, assetClass: 'Mutual Funds', name: t.fund.name, amount: t.amount, direction: 'out' })
  for (const t of mfSellTxns)     push({ id: t.id, date: t.date, assetClass: 'Mutual Funds', name: t.fund.name, amount: t.amount, direction: 'in' })
  for (const f of initialMFs)     push({ id: `init-mf-${f.id}`, date: f.createdAt, assetClass: 'Mutual Funds', name: f.name, amount: f.investedValue, direction: 'out' })
  for (const t of epfCrTxns)      push({ id: t.id, date: t.transactionDate, assetClass: 'EPF', name: 'EPF Contribution', amount: t.employeeAmount + t.employerAmount, direction: 'out' })
  for (const t of epfDrTxns)      push({ id: t.id, date: t.transactionDate, assetClass: 'EPF', name: 'EPF Withdrawal', amount: t.employeeAmount + t.employerAmount, direction: 'in' })
  for (const fd of fdAccounts)    push({ id: `fd-${fd.id}`, date: fd.startDate, assetClass: 'FD', name: `${fd.name} · ${fd.bankName}`, amount: fd.principal, direction: 'out' })
  for (const t of usBuyTxns)      push({ id: t.id, date: t.date, assetClass: 'International', name: t.stock.ticker, amount: t.amountINR, direction: 'out' })
  for (const t of usSellTxns)     push({ id: t.id, date: t.date, assetClass: 'International', name: t.stock.ticker, amount: t.amountINR, direction: 'in' })

  for (const rd of rdAccounts) {
    const installDate = new Date(year, month - 1, rd.dayOfMonth)
    if (installDate >= monthStart && installDate <= monthEnd) {
      push({ id: `rd-${rd.id}-${monthValue}`, date: installDate, assetClass: 'RD', name: rd.name, amount: rd.monthlyAmount, direction: 'out' })
    }
  }

  for (const e of customEntries) {
    if (!e.purchaseDate) continue
    push({ id: e.id, date: e.purchaseDate, assetClass: e.class.name, name: `${e.name} · ${e.class.name}`, amount: e.purchasePrice, direction: 'out' })
  }

  // Flatten in canonical order: known classes, then custom classes alphabetically; each class date-sorted
  const transactions: TxnEntry[] = []
  for (const cls of CANONICAL_CLASS_ORDER) {
    transactions.push(...buckets[cls].sort((a, b) => a.date.getTime() - b.date.getTime()))
  }
  for (const cls of Object.keys(customBuckets).sort()) {
    transactions.push(...customBuckets[cls].sort((a, b) => a.date.getTime() - b.date.getTime()))
  }

  const monthlyGain = startSnap && endSnap
    ? endSnap.totalNetWorth - startSnap.totalNetWorth
    : null

  // Build availableMonths
  const candidates = [
    minStock?.date, minMF?.date, minEPF?.transactionDate,
    minFD?.startDate, minRD?.startDate, minUS?.date, minCustom?.purchaseDate,
  ].filter((d): d is Date => d != null)

  const earliest = candidates.length > 0
    ? new Date(Math.min(...candidates.map(d => d.getTime())))
    : now

  const availableMonths: Array<{ value: string; label: string }> = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  const floor  = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  while (cursor >= floor) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth() + 1
    availableMonths.push({ value: monthStr(y, m), label: fullMonthLabel(y, m) })
    cursor.setMonth(cursor.getMonth() - 1)
  }

  return NextResponse.json({
    month: monthValue,
    monthLabel: label,
    transactions: transactions.map(t => ({ ...t, date: t.date.toISOString() })),
    monthlyGain,
    availableMonths,
  })
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const monthsParam = request.nextUrl.searchParams.get('months')
    if (monthsParam !== null) {
      const n = Math.max(1, parseInt(monthsParam) || 6)
      return await handleSummaryMode(n)
    }
    return await handleDetailMode(request.nextUrl.searchParams.get('month'))
  } catch (error) {
    console.error('[GET /api/reports/cashflow]', error)
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
