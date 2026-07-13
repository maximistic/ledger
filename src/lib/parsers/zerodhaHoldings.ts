import * as XLSX from 'xlsx'

export interface HoldingRow {
  ticker: string
  name: string
  exchange: string
  quantity: number
  avgPrice: number
}

export function parseZerodhaHoldings(buffer: Buffer): HoldingRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  // Find the header row by looking for 'Symbol' as first non-empty cell
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const first = row.find(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    if (first && String(first).trim().toLowerCase() === 'symbol') {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) throw new Error('Could not find header row with "Symbol" column')

  const headers = (rows[headerIdx] as unknown[]).map(h => String(h ?? '').trim().toLowerCase())

  const col = (name: string) => headers.indexOf(name)
  const symbolIdx    = col('symbol')
  const isinIdx      = col('isin')
  const quantityIdx  = col('quantity')
  const avgPriceIdx  = col('average cost')
  const exchangeIdx  = col('exchange')

  if (symbolIdx === -1) throw new Error('Missing "Symbol" column')
  if (quantityIdx === -1) throw new Error('Missing "Quantity" column')
  if (avgPriceIdx === -1) throw new Error('Missing "Average Cost" column')

  const results: HoldingRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const rawTicker = String(row[symbolIdx] ?? '').trim()
    if (!rawTicker) continue

    const quantity = parseFloat(String(row[quantityIdx] ?? '0'))
    if (!quantity || quantity <= 0) continue

    const avgPrice = parseFloat(String(row[avgPriceIdx] ?? '0'))
    if (!avgPrice || avgPrice <= 0) continue

    // Strip "-E" suffix from ETF tickers (e.g. GOLDBEES-E → GOLDBEES)
    const ticker = rawTicker.replace(/-E$/, '')

    // Derive exchange from ISIN: INE = NSE, otherwise check exchange column
    let exchange = 'NSE'
    if (exchangeIdx !== -1 && row[exchangeIdx]) {
      const raw = String(row[exchangeIdx]).trim().toUpperCase()
      if (raw === 'BSE' || raw === 'NSE') exchange = raw
    } else if (isinIdx !== -1 && row[isinIdx]) {
      const isin = String(row[isinIdx]).trim()
      if (isin.startsWith('INF')) exchange = 'NSE' // MF/ETF
    }

    // Use ticker as name fallback; holdings file rarely has a separate name column
    const nameIdx = col('instrument')
    const name = nameIdx !== -1 && row[nameIdx]
      ? String(row[nameIdx]).trim()
      : ticker

    results.push({ ticker, name, exchange, quantity, avgPrice })
  }

  return results
}
