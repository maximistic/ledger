import { NextRequest, NextResponse } from 'next/server'

interface YahooQuote {
  symbol: string
  shortname?: string
  longname?: string
  exchDisp?: string
  exchange?: string
  sector?: string
  quoteType?: string
}

interface YahooSearchResponse {
  quotes: YahooQuote[]
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-IN&region=IN&quotesCount=8&newsCount=0&enableFuzzyQuery=false&enableNavLinks=false`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ledger-app/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ results: [] })
    }

    const data = await res.json() as YahooSearchResponse
    const quotes: YahooQuote[] = data?.quotes ?? []

    const results = quotes
      .filter(q => {
        const exch = (q.exchDisp ?? q.exchange ?? '').toUpperCase()
        return exch === 'NSE' || exch === 'BSE'
      })
      .map(q => {
        const rawTicker = q.symbol ?? ''
        // Strip .NS or .BO suffix for display
        const ticker = rawTicker.replace(/\.(NS|BO)$/, '')
        const exch = (q.exchDisp ?? q.exchange ?? '').toUpperCase()
        const exchange = exch === 'BSE' ? 'BSE' : 'NSE'
        return {
          ticker,
          name:     q.longname ?? q.shortname ?? ticker,
          exchange,
          sector:   q.sector ?? '',
        }
      })

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
