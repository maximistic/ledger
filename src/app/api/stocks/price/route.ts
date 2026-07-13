import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface YahooResult {
  chart: {
    result: Array<{ meta: { regularMarketPrice: number } }> | null
    error: unknown
  }
}

function getYahooSymbol(ticker: string, exchange: string): string {
  if (exchange === 'NSE') return `${ticker}.NS`
  if (exchange === 'BSE') return `${ticker}.BO`
  return ticker
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST() {
  try {
    const stocks = await prisma.stock.findMany({ orderBy: { ticker: 'asc' } })

    let updated = 0
    let failed  = 0
    let skipped = 0

    const results: Array<{
      ticker: string
      status: 'updated' | 'failed' | 'skipped'
      price?: number
      reason?: string
    }> = []

    for (let i = 0; i < stocks.length; i++) {
      if (i > 0) await sleep(300)

      const stock  = stocks[i]
      const symbol = getYahooSymbol(stock.ticker, stock.exchange)
      const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ledger-app/1.0)',
            'Accept':     'application/json',
          },
        })

        if (!res.ok) {
          failed++
          results.push({ ticker: stock.ticker, status: 'failed', reason: `HTTP ${res.status}` })
          continue
        }

        const data = await res.json() as YahooResult

        if (!data.chart.result || data.chart.result.length === 0) {
          failed++
          results.push({ ticker: stock.ticker, status: 'failed', reason: 'No result in response' })
          continue
        }

        const price = data.chart.result[0].meta.regularMarketPrice

        if (typeof price !== 'number' || price <= 0 || !isFinite(price)) {
          failed++
          results.push({ ticker: stock.ticker, status: 'failed', reason: 'Invalid price value' })
          continue
        }

        // Skip if price deviates > 60% from avgPrice
        const deviation = Math.abs(price - stock.avgPrice) / stock.avgPrice
        if (deviation > 0.6) {
          console.warn(`[price-refresh] ${stock.ticker}: price ${price} deviates ${(deviation * 100).toFixed(1)}% from avgPrice ${stock.avgPrice} — skipped`)
          skipped++
          results.push({ ticker: stock.ticker, status: 'skipped', price, reason: `${(deviation * 100).toFixed(1)}% deviation` })
          continue
        }

        await prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice:       price,
            currentValue:       stock.quantity * price,
            lastPriceUpdatedAt: new Date(),
          },
        })

        updated++
        results.push({ ticker: stock.ticker, status: 'updated', price })
      } catch (fetchError) {
        const reason = fetchError instanceof Error ? fetchError.message : 'Fetch error'
        failed++
        results.push({ ticker: stock.ticker, status: 'failed', reason })
      }
    }

    return NextResponse.json({ updated, failed, skipped, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
