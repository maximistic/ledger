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
  quantity?: string | number
  price?: string | number
  order_execution_time?: string
  [key: string]: unknown
}

function parseDate(raw: string): Date {
  // Zerodha format: DD-MM-YYYY
  const [d, m, y] = raw.trim().split('-')
  return new Date(+y, +m - 1, +d)
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

    // Skip auction trades (series === 'BE' or segment contains 'auction')
    const series  = String(row.series ?? '').trim().toUpperCase()
    const segment = String(row.segment ?? '').trim().toLowerCase()
    if (series === 'BE' || segment.includes('auction')) continue

    const rawQty   = parseFloat(String(row.quantity ?? '0'))
    const rawPrice = parseFloat(String(row.price ?? '0'))
    if (!rawQty || rawQty <= 0) continue
    if (!rawPrice || rawPrice <= 0) continue

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

    // Determine exchange: prefer explicit column, fallback to NSE
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
      price: rawPrice,
      amount,
    })
  }

  return results
}
