import { NextRequest, NextResponse } from 'next/server'

interface YahooQuote {
  symbol:    string
  longname?: string
  shortname?: string
  exchange?: string
}

interface YahooSearchResult {
  quotes?: YahooQuote[]
}

// Exchange codes Yahoo Finance returns for US markets
const VALID_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'AMEX', 'NYQ', 'NMS', 'NGM', 'NCM', 'NAS', 'PCX'])

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')
    if (!q || q.trim() === '') return NextResponse.json([])

    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q.trim())}&lang=en&region=US&quotesCount=6&newsCount=0`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ledger-app/1.0)',
        'Accept':     'application/json',
      },
    })

    if (!res.ok) return NextResponse.json([])

    const data = await res.json() as YahooSearchResult
    const quotes = data.quotes ?? []

    const result = quotes
      .filter(q => q.exchange && VALID_EXCHANGES.has(q.exchange.toUpperCase()))
      .slice(0, 6)
      .map(q => ({
        ticker:   q.symbol,
        name:     q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchange ?? 'NASDAQ',
      }))

    return NextResponse.json(result)
  } catch {
    return NextResponse.json([])
  }
}
