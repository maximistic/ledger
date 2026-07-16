import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [stocks, mfs, epfAccounts, fds, rds, usStocks] = await Promise.all([
      prisma.stock.findMany(),
      prisma.mutualFund.findMany(),
      prisma.ePFAccount.findMany(),
      prisma.fDAccount.findMany(),
      prisma.rDAccount.findMany(),
      prisma.uSStock.findMany(),
    ])

    const stocksValue    = stocks.reduce((s, x) => s + x.currentValue, 0)
    const stocksInvested = stocks.reduce((s, x) => s + x.investedValue, 0)

    const mfValue    = mfs.reduce((s, x) => s + x.currentValue, 0)
    const mfInvested = mfs.reduce((s, x) => s + x.investedValue, 0)

    const epfValue = epfAccounts.reduce(
      (s, x) => s + x.employeeBalance + x.employerBalance + x.pensionBalance, 0
    )

    const fdValue    = fds.reduce((s, x) => s + x.currentValue, 0)
    const fdInvested = fds.reduce((s, x) => s + x.principal, 0)

    const rdValue    = rds.reduce((s, x) => s + x.currentValue, 0)
    const rdInvested = rds.reduce((s, x) => s + x.totalInvested, 0)

    const usStocksValue    = usStocks.reduce((s, x) => s + x.currentValueINR, 0)
    const usStocksInvested = usStocks.reduce((s, x) => s + x.investedValueINR, 0)

    const totalNetWorth = stocksValue + mfValue + epfValue + fdValue + rdValue + usStocksValue
    const totalInvested = stocksInvested + mfInvested + epfValue + fdInvested + rdInvested + usStocksInvested
    const gainLoss      = totalNetWorth - totalInvested
    const gainLossPct   = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0

    const equityValue = stocksValue + mfValue + usStocksValue
    const safeValue   = epfValue + fdValue + rdValue
    const riskProfile = equityValue + safeValue > 0
      ? Math.round((equityValue / (equityValue + safeValue)) * 100)
      : 0

    const allocation = {
      stocks:   totalNetWorth > 0 ? (stocksValue / totalNetWorth) * 100 : 0,
      mf:       totalNetWorth > 0 ? (mfValue / totalNetWorth) * 100 : 0,
      epf:      totalNetWorth > 0 ? (epfValue / totalNetWorth) * 100 : 0,
      fd:       totalNetWorth > 0 ? (fdValue / totalNetWorth) * 100 : 0,
      rd:       totalNetWorth > 0 ? (rdValue / totalNetWorth) * 100 : 0,
      usStocks: totalNetWorth > 0 ? (usStocksValue / totalNetWorth) * 100 : 0,
    }

    return NextResponse.json({
      totalNetWorth,
      totalInvested,
      gainLoss,
      gainLossPct,
      riskProfile,
      allocation,
      breakdown: {
        stocks:   { value: stocksValue,    invested: stocksInvested },
        mf:       { value: mfValue,        invested: mfInvested },
        epf:      { value: epfValue,       invested: epfValue },
        fd:       { value: fdValue,        invested: fdInvested },
        rd:       { value: rdValue,        invested: rdInvested },
        usStocks: { value: usStocksValue,  invested: usStocksInvested },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
