import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Performer {
  name:         string
  ticker:       string
  assetClass:   string
  gainLossPct:  number
  currentValue: number
}

export async function GET() {
  try {
    const [stocks, usStocks, mfs] = await Promise.all([
      prisma.stock.findMany({ where: { quantity: { gt: 0 } } }),
      prisma.uSStock.findMany({ where: { quantity: { gt: 0 } } }),
      prisma.mutualFund.findMany({ where: { units: { gt: 0 } } }),
    ])

    const performers: Performer[] = []

    for (const s of stocks) {
      if (s.avgPrice <= 0) continue
      performers.push({
        name:         s.name,
        ticker:       s.ticker,
        assetClass:   'IN Stock',
        gainLossPct:  ((s.currentPrice - s.avgPrice) / s.avgPrice) * 100,
        currentValue: s.currentValue,
      })
    }

    for (const s of usStocks) {
      if (s.avgPriceUSD <= 0) continue
      performers.push({
        name:         s.name,
        ticker:       s.ticker,
        assetClass:   'Intl Stock',
        gainLossPct:  ((s.currentPriceUSD - s.avgPriceUSD) / s.avgPriceUSD) * 100,
        currentValue: s.currentValueINR,
      })
    }

    for (const f of mfs) {
      if (f.avgNav <= 0) continue
      performers.push({
        name:         f.name,
        ticker:       f.isin ?? f.amfiCode ?? 'MF',
        assetClass:   'Mutual Fund',
        gainLossPct:  ((f.currentNav - f.avgNav) / f.avgNav) * 100,
        currentValue: f.currentValue,
      })
    }

    performers.sort((a, b) => b.gainLossPct - a.gainLossPct)

    const gainers = performers.filter(p => p.gainLossPct >= 0).slice(0, 3)
    const losers  = performers.filter(p => p.gainLossPct < 0).slice(-3).reverse()

    return NextResponse.json({ gainers, losers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
