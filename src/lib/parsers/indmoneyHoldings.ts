import * as XLSX from 'xlsx'

export function parseINDmoneyHoldings(buffer: Buffer): Array<{
  ticker: string
  quantity: number
  avgPriceUSD: number
  totalValueUSD: number
}> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  // Find header row — look for row containing 'Stock Symbol'
  const headerRowIndex = rows.findIndex(row =>
    (row as unknown[]).some(cell =>
      String(cell).toLowerCase().includes('stock symbol')
    )
  )

  if (headerRowIndex === -1) {
    throw new Error(
      'Could not find Stock Symbol column. ' +
      'Please upload the Holdings Report from INDmoney, not the Order Report.'
    )
  }

  const headers = (rows[headerRowIndex] as unknown[]).map(h =>
    String(h ?? '').trim().toLowerCase()
  )

  const tickerCol = headers.findIndex(h => h.includes('stock symbol') || h.includes('symbol'))
  const qtyCol    = headers.findIndex(h => h.includes('quantity'))
  const avgCol    = headers.findIndex(h => h.includes('avg'))
  const totalCol  = headers.findIndex(h => h.includes('total'))

  if (tickerCol === -1 || qtyCol === -1) {
    throw new Error('Missing required columns in Holdings file.')
  }

  const results: Array<{
    ticker: string
    quantity: number
    avgPriceUSD: number
    totalValueUSD: number
  }> = []

  const dataRows = rows.slice(headerRowIndex + 1)

  for (const row of dataRows as unknown[][]) {
    const ticker = String(row[tickerCol] ?? '').trim().toUpperCase()
    const quantity = parseFloat(String(row[qtyCol] ?? '0'))
    const avgPriceUSD = avgCol !== -1 ? parseFloat(String(row[avgCol] ?? '0')) : 0
    const totalValueUSD = totalCol !== -1 ? parseFloat(String(row[totalCol] ?? '0')) : 0

    // Skip empty rows, header re-occurrences, disclaimer rows
    if (!ticker || ticker === 'STOCK SYMBOL' || isNaN(quantity) || quantity <= 0) continue
    // Skip non-ticker rows (US tickers are 1-5 uppercase letters)
    if (!/^[A-Z]{1,5}$/.test(ticker)) continue

    results.push({ ticker, quantity, avgPriceUSD, totalValueUSD })
  }

  if (results.length === 0) {
    throw new Error('No holdings found in file. Check that this is the Holdings Report.')
  }

  return results
}
