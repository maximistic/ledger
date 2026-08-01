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

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export async function GET(request: NextRequest) {
  try {
    const param = request.nextUrl.searchParams.get('month')
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

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd   = new Date(year, month, 0, 23, 59, 59)
    const monthValue = `${year}-${String(month).padStart(2, '0')}`
    const label      = monthLabel(year, month)

    const [stockBuyTxns, stockSellTxns, mfTxns, epfTxns, rds, fds, usTxns, customEntries] = await Promise.all([
      prisma.stockTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, type: 'BUY' },
        include: { stock: { select: { name: true, ticker: true, exchange: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.stockTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, type: 'SELL' },
        include: { stock: { select: { name: true, ticker: true, exchange: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.mutualFundTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, type: { in: ['SIP', 'LUMPSUM'] } },
        include: { fund: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.ePFTransaction.findMany({
        where: { transactionDate: { gte: monthStart, lte: monthEnd }, type: 'CR' },
        include: { account: { select: { employerName: true } } },
        orderBy: { transactionDate: 'asc' },
      }),
      prisma.rDAccount.findMany({
        where: { startDate: { lte: monthEnd }, maturityDate: { gte: monthStart } },
      }),
      prisma.fDAccount.findMany({
        where: { startDate: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.uSStockTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, type: 'BUY' },
        include: { stock: { select: { name: true, ticker: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.customAssetEntry.findMany({
        where: { purchaseDate: { not: null, gte: monthStart, lte: monthEnd } },
        include: { class: { select: { name: true } } },
        orderBy: { purchaseDate: 'asc' },
      }),
    ])

    type TxnEntry = {
      date: Date
      name: string
      subtitle: string
      type: string
      badge: string
      amount: number
    }

    const transactions: TxnEntry[] = []

    for (const t of stockBuyTxns) {
      transactions.push({
        date: t.date,
        name: t.stock.name,
        subtitle: `${t.stock.ticker} · ${t.stock.exchange}`,
        type: 'Stock',
        badge: 'STOCK',
        amount: t.quantity * t.price,
      })
    }

    for (const t of stockSellTxns) {
      transactions.push({
        date: t.date,
        name: t.stock.name,
        subtitle: `${t.stock.ticker} · ${t.stock.exchange} · sale`,
        type: 'Stock Sale',
        badge: 'SELL',
        amount: t.quantity * t.price,
      })
    }

    for (const t of mfTxns) {
      transactions.push({
        date: t.date,
        name: t.fund.name,
        subtitle: `${t.type} · ${t.units.toFixed(3)} units @ ₹${t.nav}`,
        type: t.type,
        badge: t.type,
        amount: t.amount,
      })
    }

    for (const t of epfTxns) {
      transactions.push({
        date: t.transactionDate,
        name: 'EPF contribution',
        subtitle: `${t.account.employerName ?? 'Employer'} · ${t.autoCreated ? 'auto-tracked' : 'manual'}`,
        type: 'EPF',
        badge: 'EPF',
        amount: t.employeeAmount + t.employerAmount,
      })
    }

    for (const rd of rds) {
      const installDate = new Date(year, month - 1, rd.dayOfMonth)
      if (installDate >= monthStart && installDate <= monthEnd) {
        transactions.push({
          date: installDate,
          name: rd.name,
          subtitle: 'Monthly installment',
          type: 'RD',
          badge: 'RD',
          amount: rd.monthlyAmount,
        })
      }
    }

    for (const fd of fds) {
      transactions.push({
        date: fd.startDate,
        name: fd.name,
        subtitle: `Fixed deposit · ${fd.bankName}`,
        type: 'FD',
        badge: 'FD',
        amount: fd.principal,
      })
    }

    for (const t of usTxns) {
      transactions.push({
        date: t.date,
        name: t.stock.name,
        subtitle: `${t.stock.ticker} · ${t.amountUSD.toFixed(2)} USD`,
        type: 'International',
        badge: 'INTL',
        amount: t.amountINR,
      })
    }

    for (const e of customEntries) {
      if (!e.purchaseDate) continue
      transactions.push({
        date: e.purchaseDate,
        name: e.name,
        subtitle: `${e.class.name} · purchase`,
        type: 'Custom',
        badge: 'CUSTOM',
        amount: e.purchasePrice,
      })
    }

    transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

    const rdInstalled  = rds.reduce((s, rd) => {
      const d = new Date(year, month - 1, rd.dayOfMonth)
      return d >= monthStart && d <= monthEnd ? s + rd.monthlyAmount : s
    }, 0)
    const customTotal  = customEntries.reduce((s, e) => s + e.purchasePrice, 0)

    const summary = {
      total:  stockBuyTxns.reduce((s, t) => s + t.quantity * t.price, 0)
             + mfTxns.reduce((s, t) => s + t.amount, 0)
             + epfTxns.reduce((s, t) => s + t.employeeAmount + t.employerAmount, 0)
             + rdInstalled
             + fds.reduce((s, f) => s + f.principal, 0)
             + usTxns.reduce((s, t) => s + t.amountINR, 0)
             + customTotal,
      stocks: stockBuyTxns.reduce((s, t) => s + t.quantity * t.price, 0),
      stockSales: stockSellTxns.reduce((s, t) => s + t.quantity * t.price, 0),
      mf:     mfTxns.reduce((s, t) => s + t.amount, 0),
      epf:    epfTxns.reduce((s, t) => s + t.employeeAmount + t.employerAmount, 0),
      rd:     rdInstalled,
      fd:     fds.reduce((s, f) => s + f.principal, 0),
      us:     usTxns.reduce((s, t) => s + t.amountINR, 0),
      custom: customTotal,
    }

    const [minStock, minMF, minEPF, minFD, minRD, minUS, minCustom] = await Promise.all([
      prisma.stockTransaction.findFirst({ where: { type: 'BUY' }, orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.mutualFundTransaction.findFirst({ where: { type: { in: ['SIP', 'LUMPSUM'] } }, orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.ePFTransaction.findFirst({ where: { type: 'CR' }, orderBy: { transactionDate: 'asc' }, select: { transactionDate: true } }),
      prisma.fDAccount.findFirst({ orderBy: { startDate: 'asc' }, select: { startDate: true } }),
      prisma.rDAccount.findFirst({ orderBy: { startDate: 'asc' }, select: { startDate: true } }),
      prisma.uSStockTransaction.findFirst({ where: { type: 'BUY' }, orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.customAssetEntry.findFirst({ where: { purchaseDate: { not: null } }, orderBy: { purchaseDate: 'asc' }, select: { purchaseDate: true } }),
    ])

    const candidates = [
      minStock?.date,
      minMF?.date,
      minEPF?.transactionDate,
      minFD?.startDate,
      minRD?.startDate,
      minUS?.date,
      minCustom?.purchaseDate,
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
      availableMonths.push({
        value: `${y}-${String(m).padStart(2, '0')}`,
        label: monthLabel(y, m),
      })
      cursor.setMonth(cursor.getMonth() - 1)
    }

    return NextResponse.json({
      month: monthValue,
      monthLabel: label,
      transactions: transactions.map(t => ({ ...t, date: t.date.toISOString() })),
      summary,
      availableMonths,
    })
  } catch (error) {
    console.error('[GET /api/reports/cashflow]', error)
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
