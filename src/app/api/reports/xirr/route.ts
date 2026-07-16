import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function xirr(cashFlows: number[], dates: Date[]): number | null {
  if (cashFlows.length < 2) return null
  if (!cashFlows.some(c => c < 0) || !cashFlows.some(c => c > 0)) return null

  const t0 = dates[0].getTime()
  const years = dates.map(d => (d.getTime() - t0) / (365.25 * 24 * 60 * 60 * 1000))

  let r = 0.1
  for (let i = 0; i < 100; i++) {
    if (!isFinite(r) || r <= -1) return null
    let f = 0
    let df = 0
    for (let j = 0; j < cashFlows.length; j++) {
      const base = Math.pow(1 + r, years[j])
      if (!isFinite(base)) return null
      f  += cashFlows[j] / base
      df -= cashFlows[j] * years[j] / (base * (1 + r))
    }
    if (Math.abs(df) < 1e-10) return null
    const delta = f / df
    r -= delta
    if (Math.abs(delta) < 1e-6) return isFinite(r) ? r : null
  }
  return null
}

function sortedByDate(flows: number[], dates: Date[]): { flows: number[]; dates: Date[] } {
  const pairs = flows.map((f, i) => ({ f, d: dates[i] }))
  pairs.sort((a, b) => a.d.getTime() - b.d.getTime())
  return { flows: pairs.map(p => p.f), dates: pairs.map(p => p.d) }
}

function toXirrPct(r: number | null): number | null {
  if (r === null) return null
  return parseFloat((r * 100).toFixed(2))
}

export async function GET() {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
      stockBuys, stocks,
      mfBuys, mfFunds,
      epfCRs, epfAccounts,
      fds, rds,
      usBuys, usStocks,
    ] = await Promise.all([
      prisma.stockTransaction.findMany({
        where: { type: 'BUY' },
        orderBy: { date: 'asc' },
        select: { date: true, quantity: true, price: true },
      }),
      prisma.stock.findMany({
        where: { holdingsQuantity: { gt: 0 } },
        select: { currentValue: true },
      }),
      prisma.mutualFundTransaction.findMany({
        where: { type: { in: ['SIP', 'LUMPSUM'] } },
        orderBy: { date: 'asc' },
        select: { date: true, amount: true },
      }),
      prisma.mutualFund.findMany({
        where: { units: { gt: 0 } },
        select: { currentValue: true },
      }),
      prisma.ePFTransaction.findMany({
        where: { type: 'CR' },
        orderBy: { transactionDate: 'asc' },
        select: { transactionDate: true, employeeAmount: true, employerAmount: true },
      }),
      prisma.ePFAccount.findMany({
        select: { employeeBalance: true, employerBalance: true, pensionBalance: true },
      }),
      prisma.fDAccount.findMany({
        orderBy: { startDate: 'asc' },
        select: { startDate: true, principal: true, currentValue: true },
      }),
      prisma.rDAccount.findMany({
        orderBy: { startDate: 'asc' },
        select: { startDate: true, totalInvested: true, currentValue: true },
      }),
      prisma.uSStockTransaction.findMany({
        where: { type: 'BUY' },
        orderBy: { date: 'asc' },
        select: { date: true, amountINR: true },
      }),
      prisma.uSStock.findMany({
        where: { holdingsQuantity: { gt: 0 } },
        select: { currentValueINR: true },
      }),
    ])

    // ── STOCKS ──────────────────────────────────────────────────────────────────

    const sFlows: number[] = []
    const sDates: Date[]   = []
    for (const t of stockBuys) {
      sFlows.push(-(t.quantity * t.price))
      sDates.push(t.date)
    }
    const stockCV = stocks.reduce((s, st) => s + st.currentValue, 0)
    if (sFlows.length > 0 && stockCV > 0) {
      sFlows.push(stockCV)
      sDates.push(today)
    }
    const stockSorted = sortedByDate(sFlows, sDates)
    const stocksXIRR  = xirr(stockSorted.flows, stockSorted.dates)

    // ── MUTUAL FUNDS ─────────────────────────────────────────────────────────────

    const mFlows: number[] = []
    const mDates: Date[]   = []
    for (const t of mfBuys) {
      mFlows.push(-t.amount)
      mDates.push(t.date)
    }
    const mfCV = mfFunds.reduce((s, f) => s + f.currentValue, 0)
    if (mFlows.length > 0 && mfCV > 0) {
      mFlows.push(mfCV)
      mDates.push(today)
    }
    const mfSorted = sortedByDate(mFlows, mDates)
    const mfXIRR   = xirr(mfSorted.flows, mfSorted.dates)

    // ── EPF ──────────────────────────────────────────────────────────────────────

    const eFlows: number[] = []
    const eDates: Date[]   = []
    for (const t of epfCRs) {
      eFlows.push(-(t.employeeAmount + t.employerAmount))
      eDates.push(t.transactionDate)
    }
    const epfCorpus = epfAccounts.reduce(
      (s, a) => s + a.employeeBalance + a.employerBalance + a.pensionBalance, 0,
    )
    if (eFlows.length > 0 && epfCorpus > 0) {
      eFlows.push(epfCorpus)
      eDates.push(today)
    }
    const epfSorted = sortedByDate(eFlows, eDates)
    const epfXIRR   = xirr(epfSorted.flows, epfSorted.dates)

    // ── FIXED DEPOSITS ───────────────────────────────────────────────────────────

    const fFlows: number[] = []
    const fDates: Date[]   = []
    for (const fd of fds) {
      fFlows.push(-fd.principal)
      fDates.push(fd.startDate)
    }
    const fdCV = fds.reduce((s, f) => s + f.currentValue, 0)
    if (fFlows.length > 0 && fdCV > 0) {
      fFlows.push(fdCV)
      fDates.push(today)
    }
    const fdSorted = sortedByDate(fFlows, fDates)
    const fdXIRR   = xirr(fdSorted.flows, fdSorted.dates)

    // ── RECURRING DEPOSITS ───────────────────────────────────────────────────────

    const rFlows: number[] = []
    const rDates: Date[]   = []
    for (const rd of rds) {
      if (rd.totalInvested > 0) {
        rFlows.push(-rd.totalInvested)
        rDates.push(rd.startDate)
      }
    }
    const rdCV = rds.reduce((s, r) => s + r.currentValue, 0)
    if (rFlows.length > 0 && rdCV > 0) {
      rFlows.push(rdCV)
      rDates.push(today)
    }
    const rdSorted = sortedByDate(rFlows, rDates)
    const rdXIRR   = xirr(rdSorted.flows, rdSorted.dates)

    // ── INTERNATIONAL (US STOCKS) ─────────────────────────────────────────────

    const uFlows: number[] = []
    const uDates: Date[]   = []
    for (const t of usBuys) {
      uFlows.push(-t.amountINR)
      uDates.push(t.date)
    }
    const usCV = usStocks.reduce((s, st) => s + st.currentValueINR, 0)
    if (uFlows.length > 0 && usCV > 0) {
      uFlows.push(usCV)
      uDates.push(today)
    }
    const usSorted = sortedByDate(uFlows, uDates)
    const usXIRR   = xirr(usSorted.flows, usSorted.dates)

    // ── OVERALL ───────────────────────────────────────────────────────────────

    const oFlows: number[] = []
    const oDates: Date[]   = []

    for (const t of stockBuys) { oFlows.push(-(t.quantity * t.price)); oDates.push(t.date) }
    for (const t of mfBuys)    { oFlows.push(-t.amount);               oDates.push(t.date) }
    for (const t of epfCRs)    { oFlows.push(-(t.employeeAmount + t.employerAmount)); oDates.push(t.transactionDate) }
    for (const fd of fds)       { oFlows.push(-fd.principal);           oDates.push(fd.startDate) }
    for (const rd of rds)       { if (rd.totalInvested > 0) { oFlows.push(-rd.totalInvested); oDates.push(rd.startDate) } }
    for (const t of usBuys)    { oFlows.push(-t.amountINR);            oDates.push(t.date) }

    const totalCV = stockCV + mfCV + epfCorpus + fdCV + rdCV + usCV
    if (oFlows.length > 0 && totalCV > 0) {
      oFlows.push(totalCV)
      oDates.push(today)
    }
    const oSorted     = sortedByDate(oFlows, oDates)
    const overallXIRR = xirr(oSorted.flows, oSorted.dates)

    return NextResponse.json({
      overall: toXirrPct(overallXIRR),
      stocks:  toXirrPct(stocksXIRR),
      mf:      toXirrPct(mfXIRR),
      epf:     toXirrPct(epfXIRR),
      fd:      toXirrPct(fdXIRR),
      rd:      toXirrPct(rdXIRR),
      us:      toXirrPct(usXIRR),
    })
  } catch (error) {
    console.error('[GET /api/reports/xirr]', error)
    return NextResponse.json({ error: 'Failed to compute XIRR' }, { status: 500 })
  }
}
