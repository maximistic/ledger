import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeNetWorthFromData } from '@/lib/netWorth'

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
    const period = searchParams.get('period') ?? '1Y'
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
      investedValue: s.investedValue,
    }))

    return NextResponse.json({ period, changeAmt, changePct, chartData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const today   = new Date()
    const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const [stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses] = await Promise.all([
      prisma.stock.findMany(),
      prisma.mutualFund.findMany(),
      prisma.ePFAccount.findMany(),
      prisma.fDAccount.findMany(),
      prisma.rDAccount.findMany(),
      prisma.uSStock.findMany(),
      prisma.customAssetClass.findMany({ include: { entries: true } }),
    ])

    const nw = computeNetWorthFromData(stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses)

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
