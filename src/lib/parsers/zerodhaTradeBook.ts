import Papa from 'papaparse'

export interface TradeRow {
  ticker: string
  exchange: string
  date: Date
  type: 'BUY' | 'SELL'
  quantity: number
  price: number
  amount: number
}

interface RawTradeRow {
  symbol?: string
  isin?: string
  trade_date?: string
  exchange?: string
  segment?: string
  series?: string
  trade_type?: string
  auction?: string | boolean
  quantity?: string | number
  price?: string | number
  trade_id?: string
  order_id?: string
  order_execution_time?: string
  [key: string]: unknown
}

function parseDate(raw: string): Date {
  // Zerodha format is DD-MM-YYYY — split explicitly, never use new Date(raw)
  const parts = raw.trim().split('-')
  return new Date(+parts[2], +parts[1] - 1, +parts[0])
}

export function parseZerodhaTradeBook(csvText: string): TradeRow[] {
  const { data, errors } = Papa.parse<RawTradeRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (errors.length > 0) {
    const fatal = errors.find(e => e.type === 'Delimiter' || e.type === 'Quotes')
    if (fatal) throw new Error(`CSV parse error: ${fatal.message}`)
  }

  const results: TradeRow[] = []

  for (const row of data) {
    const rawTicker = String(row.symbol ?? '').trim()
    if (!rawTicker) continue

    // Skip auction trades — auction column can be boolean true or string "true"/"1"/"yes"
    const auctionVal = row.auction
    if (auctionVal === true || String(auctionVal ?? '').toLowerCase() === 'true' || String(auctionVal ?? '') === '1') continue

    // Skip BE series (exchange-settled, auction-type)
    const series  = String(row.series ?? '').trim().toUpperCase()
    const segment = String(row.segment ?? '').trim().toLowerCase()
    if (series === 'BE' || segment.includes('auction')) continue

    const rawQty   = parseFloat(String(row.quantity ?? '0'))
    const rawPrice = parseFloat(String(row.price ?? '0'))
    if (!rawQty || rawQty <= 0) continue
    if (!rawPrice || rawPrice <= 0) continue

    // trade_type from Zerodha is lowercase 'buy'/'sell' — uppercase it
    const rawType = String(row.trade_type ?? '').trim().toUpperCase()
    if (rawType !== 'BUY' && rawType !== 'SELL') continue

    const rawDate = String(row.trade_date ?? '').trim()
    if (!rawDate) continue

    let date: Date
    try {
      date = parseDate(rawDate)
      if (isNaN(date.getTime())) continue
    } catch {
      continue
    }

    // Exchange: prefer explicit column, default NSE
    let exchange = 'NSE'
    const rawExchange = String(row.exchange ?? '').trim().toUpperCase()
    if (rawExchange === 'BSE' || rawExchange === 'NSE') exchange = rawExchange

    const ticker = rawTicker.replace(/-E$/, '')
    const amount = rawQty * rawPrice

    results.push({
      ticker,
      exchange,
      date,
      type: rawType as 'BUY' | 'SELL',
      quantity: rawQty,
      price:    rawPrice,
      amount,
    })
  }

  // Sort chronologically so running balance calculations are correct
  results.sort((a, b) => a.date.getTime() - b.date.getTime())

  return results
}
