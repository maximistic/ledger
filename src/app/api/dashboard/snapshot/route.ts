import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getPeriodStart(period: string): Date {
  const now = new Date()
  switch (period) {
    case '6M': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    case '5Y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
    case '1M':
    default:   return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') ?? '1M'
    const from   = getPeriodStart(period)

    const snapshots = await prisma.snapshot.findMany({
      where:   { date: { gte: from } },
      orderBy: { date: 'asc' },
    })

    const first     = snapshots[0]?.totalNetWorth ?? 0
    const last      = snapshots[snapshots.length - 1]?.totalNetWorth ?? 0
    const changeAmt = last - first
    const changePct = first > 0 ? (changeAmt / first) * 100 : 0

    const chartData = snapshots.map(s => ({
      date:          s.date.toISOString().split('T')[0],
      totalNetWorth: s.totalNetWorth,
    }))

    return NextResponse.json({ period, changeAmt, changePct, chartData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function computeNetWorth() {
  const [stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses] = await Promise.all([
    prisma.stock.findMany(),
    prisma.mutualFund.findMany(),
    prisma.ePFAccount.findMany(),
    prisma.fDAccount.findMany(),
    prisma.rDAccount.findMany(),
    prisma.uSStock.findMany(),
    prisma.customAssetClass.findMany({ include: { entries: true } }),
  ])

  const stocksValue   = stocks.reduce((s, x) => s + x.currentValue, 0)
  const mfValue       = mfs.reduce((s, x) => s + x.currentValue, 0)
  const epfValue      = epfAccounts.reduce((s, x) => s + x.employeeBalance + x.employerBalance + x.pensionBalance, 0)
  const fdValue       = fds.reduce((s, x) => s + x.currentValue, 0)
  const rdValue       = rds.reduce((s, x) => s + x.currentValue, 0)
  const usStocksValue = usStocks.reduce((s, x) => s + x.currentValueINR, 0)
  const customValue   = customClasses.reduce((s, cls) => s + cls.entries.reduce((es, e) => es + e.currentValue, 0), 0)

  const stocksInvested   = stocks.reduce((s, x) => s + x.investedValue, 0)
  const mfInvested       = mfs.reduce((s, x) => s + x.investedValue, 0)
  const fdInvested       = fds.reduce((s, x) => s + x.principal, 0)
  const rdInvested       = rds.reduce((s, x) => s + x.totalInvested, 0)
  const usStocksInvested = usStocks.reduce((s, x) => s + x.investedValueINR, 0)
  const customInvested   = customClasses.reduce((s, cls) => s + cls.entries.reduce((es, e) => es + e.purchasePrice, 0), 0)

  return {
    totalNetWorth: stocksValue + mfValue + epfValue + fdValue + rdValue + usStocksValue + customValue,
    stocksValue,
    mfValue,
    epfValue,
    fdValue,
    rdValue,
    usStocksValue,
    investedValue: stocksInvested + mfInvested + epfValue + fdInvested + rdInvested + usStocksInvested + customInvested,
  }
}

export async function POST() {
  try {
    const today   = new Date()
    const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const nw = await computeNetWorth()

    const snapshot = await prisma.snapshot.upsert({
      where:  { date: dateKey },
      update: { ...nw, source: 'MANUAL' },
      create: { date: dateKey, ...nw, source: 'MANUAL' },
    })

    return NextResponse.json({ ok: true, snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
