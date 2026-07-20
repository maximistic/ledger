import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { yahooChartUrl, YAHOO_HEADERS } from '@/lib/yahoo'

interface YahooResult {
  chart: {
    result: Array<{ meta: { regularMarketPrice: number } }> | null
    error: unknown
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = yahooChartUrl(symbol)
    const res = await fetch(url, { headers: YAHOO_HEADERS })
    if (!res.ok) return null

    const data = await res.json() as YahooResult
    if (!data.chart.result || data.chart.result.length === 0) return null

    const price = data.chart.result[0].meta.regularMarketPrice
    return typeof price === 'number' && price > 0 && isFinite(price) ? price : null
  } catch {
    return null
  }
}

export async function POST() {
  try {
    // Fetch current USD/INR exchange rate first
    let currentExchangeRate: number | null = null
    const fxPrice = await fetchYahooPrice('USDINR=X')
    if (fxPrice && fxPrice > 0) currentExchangeRate = fxPrice

    const stocks = await prisma.uSStock.findMany({ orderBy: { ticker: 'asc' } })

    let updated  = 0
    let failed   = 0
    let skipped  = 0

    const results: Array<{
      ticker: string
      status: 'updated' | 'failed' | 'skipped'
      price?: number
      reason?: string
    }> = []

    for (let i = 0; i < stocks.length; i++) {
      if (i > 0) await sleep(300)

      const stock = stocks[i]
      const price = await fetchYahooPrice(stock.ticker)  // no .NS suffix for US stocks

      if (price === null) {
        failed++
        results.push({ ticker: stock.ticker, status: 'failed', reason: 'No price returned' })
        continue
      }

      // Sanity check: skip if price deviates > 60% from avgPriceUSD
      const deviation = Math.abs(price - stock.avgPriceUSD) / stock.avgPriceUSD
      if (deviation > 0.6) {
        skipped++
        results.push({
          ticker: stock.ticker,
          status: 'skipped',
          price,
          reason: `${(deviation * 100).toFixed(1)}% deviation from avg`,
        })
        continue
      }

      const rate            = currentExchangeRate ?? stock.exchangeRate
      const currentValueINR = stock.quantity * price * rate

      await prisma.uSStock.update({
        where: { id: stock.id },
        data: {
          currentPriceUSD:    price,
          currentValueINR,
          exchangeRate:       rate,
          lastPriceUpdatedAt: new Date(),
        },
      })

      updated++
      results.push({ ticker: stock.ticker, status: 'updated', price })
    }

    return NextResponse.json({
      updated,
      failed,
      skipped,
      exchangeRate: currentExchangeRate,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
