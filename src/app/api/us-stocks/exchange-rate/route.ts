export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { yahooChartUrl, YAHOO_HEADERS } from '@/lib/yahoo'

export async function GET() {
  try {
    const res = await fetch(
      yahooChartUrl('USDINR=X'),
      { signal: AbortSignal.timeout(5000), headers: YAHOO_HEADERS },
    )
    if (!res.ok) throw new Error('Yahoo Finance returned non-OK')
    const data = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
    }
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return NextResponse.json({
      rate:   rate && rate > 0 ? rate : 84,
      source: rate && rate > 0 ? 'live' : 'fallback',
    })
  } catch (err) {
    console.error('[GET /api/us-stocks/exchange-rate]', err)
    return NextResponse.json({ rate: 84, source: 'fallback' })
  }
}
