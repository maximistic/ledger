import * as XLSX from 'xlsx'

export function parseINDmoneyHoldings(buffer: Buffer): Array<{
  ticker: string
  quantity: number
  avgPriceUSD: number
  currentValueUSD: number
}> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet)
    throw new Error('Could not find stock data in this file. Please upload the Holdings Report from INDmoney.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  const headerRowIndex = rows.findIndex(row =>
    row.some(cell => String(cell).trim().toLowerCase().includes('stock symbol'))
  )
  if (headerRowIndex === -1)
    throw new Error('Could not find stock data in this file. Please upload the Holdings Report from INDmoney.')

  const headers = rows[headerRowIndex].map(h => String(h ?? '').trim())
  const dataRows = rows.slice(headerRowIndex + 1)
  const col = (keyword: string) =>
    headers.findIndex(h => h.toLowerCase().includes(keyword.toLowerCase()))

  const tickerCol     = col('symbol')
  const quantityCol   = col('quantity')
  const avgPriceCol   = col('avg')
  const totalValueCol = col('total')

  if (tickerCol === -1)   throw new Error('Missing "Stock Symbol" column')
  if (quantityCol === -1) throw new Error('Missing "Quantity" column')
  if (avgPriceCol === -1) throw new Error('Missing "Avg. Price" column')

  const results: Array<{
    ticker: string
    quantity: number
    avgPriceUSD: number
    currentValueUSD: number
  }> = []

  for (const row of dataRows) {
    if (!row || row.length === 0) continue

    const ticker = row[tickerCol]?.toString().trim().toUpperCase()
    if (!ticker) continue

    const quantity = parseFloat(String(row[quantityCol] ?? ''))
    if (isNaN(quantity) || quantity <= 0) continue

    const avgPriceUSD = parseFloat(String(row[avgPriceCol] ?? ''))
    if (isNaN(avgPriceUSD) || avgPriceUSD <= 0) continue

    let currentValueUSD = quantity * avgPriceUSD
    if (totalValueCol !== -1 && row[totalValueCol] !== undefined) {
      const parsed = parseFloat(String(row[totalValueCol]))
      if (!isNaN(parsed) && parsed > 0) currentValueUSD = parsed
    }

    results.push({ ticker, quantity, avgPriceUSD, currentValueUSD })
  }

  return results
}
