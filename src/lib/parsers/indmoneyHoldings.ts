import * as XLSX from 'xlsx'

export function parseINDmoneyHoldings(buffer: Buffer): Array<{
  ticker: string
  quantity: number
  avgPriceUSD: number
  currentValueUSD: number
}> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets['HOLDINGS_BOOK']
  if (!sheet) throw new Error('Sheet "HOLDINGS_BOOK" not found in file')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  // Find header row by scanning for "Stock Symbol"
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (row.some(cell => String(cell ?? '').trim() === 'Stock Symbol')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) throw new Error('Could not find header row with "Stock Symbol" column')

  const headers = (rows[headerIdx] as unknown[]).map(h => String(h ?? '').trim())
  const col = (name: string) =>
    headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))

  const symbolIdx = col('symbol')
  const qtyIdx    = col('quantity')
  const avgIdx    = col('avg')
  const totalIdx  = col('total')

  if (symbolIdx === -1) throw new Error('Missing "Stock Symbol" column')
  if (qtyIdx === -1)    throw new Error('Missing "Quantity" column')
  if (avgIdx === -1)    throw new Error('Missing "Avg. Price" column')

  const results: Array<{
    ticker: string
    quantity: number
    avgPriceUSD: number
    currentValueUSD: number
  }> = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue

    const ticker = row[symbolIdx]?.toString().trim().toUpperCase()
    if (!ticker) continue

    const quantity = parseFloat(String(row[qtyIdx] ?? ''))
    if (isNaN(quantity) || quantity <= 0) continue

    const avgPriceUSD = parseFloat(String(row[avgIdx] ?? ''))
    if (isNaN(avgPriceUSD) || avgPriceUSD <= 0) continue

    let currentValueUSD = quantity * avgPriceUSD
    if (totalIdx !== -1 && row[totalIdx] !== undefined) {
      const parsed = parseFloat(String(row[totalIdx]))
      if (!isNaN(parsed) && parsed > 0) currentValueUSD = parsed
    }

    results.push({ ticker, quantity, avgPriceUSD, currentValueUSD })
  }

  return results
}
