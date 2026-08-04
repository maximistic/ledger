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
    const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999)
    const monthValue = `${year}-${String(month).padStart(2, '0')}`
    const label      = monthLabel(year, month)

    const [
      stockBuyTxns, stockSellTxns,
      initialStocks,
      mfBuyTxns, mfSellTxns,
      initialMFs,
      epfCrTxns, epfDrTxns,
      fdAccounts,
      rdAccounts,
      usBuyTxns, usSellTxns,
      customEntries,
      startSnap, endSnap,
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
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
          transactions: { none: {} },
        },
      }),
      prisma.mutualFundTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, type: { in: ['BUY', 'SIP', 'LUMPSUM'] } },
        include: { fund: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.mutualFundTransaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, type: { in: ['SELL', 'REDEEM'] } },
        include: { fund: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.mutualFund.findMany({
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
          transactions: { none: {} },
        },
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
    ])

    type TxnEntry = {
      id: string
      date: Date
      assetClass: string
      name: string
      amount: number
      direction: 'in' | 'out'
    }

    const transactions: TxnEntry[] = []

    for (const t of stockBuyTxns) {
      transactions.push({
        id: t.id,
        date: t.date,
        assetClass: 'Stocks',
        name: `${t.stock.name} (${t.stock.ticker})`,
        amount: t.quantity * t.price,
        direction: 'out',
      })
    }

    for (const t of stockSellTxns) {
      transactions.push({
        id: t.id,
        date: t.date,
        assetClass: 'Stocks',
        name: `${t.stock.name} (${t.stock.ticker})`,
        amount: t.quantity * t.price,
        direction: 'in',
      })
    }

    for (const s of initialStocks) {
      transactions.push({
        id: `init-stock-${s.id}`,
        date: s.createdAt,
        assetClass: 'Stocks',
        name: `${s.name} (${s.ticker})`,
        amount: s.avgPrice * s.quantity,
        direction: 'out',
      })
    }

    for (const t of mfBuyTxns) {
      transactions.push({
        id: t.id,
        date: t.date,
        assetClass: 'Mutual Funds',
        name: t.fund.name,
        amount: t.amount,
        direction: 'out',
      })
    }

    for (const t of mfSellTxns) {
      transactions.push({
        id: t.id,
        date: t.date,
        assetClass: 'Mutual Funds',
        name: t.fund.name,
        amount: t.amount,
        direction: 'in',
      })
    }

    for (const f of initialMFs) {
      transactions.push({
        id: `init-mf-${f.id}`,
        date: f.createdAt,
        assetClass: 'Mutual Funds',
        name: f.name,
        amount: f.investedValue,
        direction: 'out',
      })
    }

    for (const t of epfCrTxns) {
      transactions.push({
        id: t.id,
        date: t.transactionDate,
        assetClass: 'EPF',
        name: 'EPF Contribution',
        amount: t.employeeAmount + t.employerAmount,
        direction: 'out',
      })
    }

    for (const t of epfDrTxns) {
      transactions.push({
        id: t.id,
        date: t.transactionDate,
        assetClass: 'EPF',
        name: 'EPF Withdrawal',
        amount: t.employeeAmount + t.employerAmount,
        direction: 'in',
      })
    }

    for (const fd of fdAccounts) {
      transactions.push({
        id: `fd-${fd.id}`,
        date: fd.startDate,
        assetClass: 'FD',
        name: `${fd.name} · ${fd.bankName}`,
        amount: fd.principal,
        direction: 'out',
      })
    }

    for (const rd of rdAccounts) {
      const installDate = new Date(year, month - 1, rd.dayOfMonth)
      if (installDate >= monthStart && installDate <= monthEnd) {
        transactions.push({
          id: `rd-${rd.id}-${monthValue}`,
          date: installDate,
          assetClass: 'RD',
          name: rd.name,
          amount: rd.monthlyAmount,
          direction: 'out',
        })
      }
    }

    for (const t of usBuyTxns) {
      transactions.push({
        id: t.id,
        date: t.date,
        assetClass: 'International',
        name: t.stock.ticker,
        amount: t.amountINR,
        direction: 'out',
      })
    }

    for (const t of usSellTxns) {
      transactions.push({
        id: t.id,
        date: t.date,
        assetClass: 'International',
        name: t.stock.ticker,
        amount: t.amountINR,
        direction: 'in',
      })
    }

    for (const e of customEntries) {
      if (!e.purchaseDate) continue
      transactions.push({
        id: e.id,
        date: e.purchaseDate,
        assetClass: e.class.name,
        name: `${e.name} · ${e.class.name}`,
        amount: e.purchasePrice,
        direction: 'out',
      })
    }

    transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

    const monthlyGain = startSnap && endSnap
      ? endSnap.totalNetWorth - startSnap.totalNetWorth
      : null

    // Build available months list
    const [minStock, minMF, minEPF, minFD, minRD, minUS, minCustom] = await Promise.all([
      prisma.stockTransaction.findFirst({ where: { type: 'BUY' }, orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.mutualFundTransaction.findFirst({ where: { type: { in: ['BUY', 'SIP', 'LUMPSUM'] } }, orderBy: { date: 'asc' }, select: { date: true } }),
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
      monthlyGain,
      availableMonths,
    })
  } catch (error) {
    console.error('[GET /api/reports/cashflow]', error)
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
