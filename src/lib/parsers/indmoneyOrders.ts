import * as XLSX from 'xlsx'

export function parseINDmoneyOrders(buffer: Buffer): Array<{
  ticker: string
  stockName: string
  date: Date
  type: 'BUY' | 'SELL'
  quantity: number
  priceUSD: number
  amountUSD: number
}> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet)
    throw new Error('Could not find order data in this file. Please upload the Order Report from INDmoney.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  const headerRowIndex = rows.findIndex(row =>
    row.some(cell => String(cell).trim().toLowerCase().includes('stock symbol'))
  )
  if (headerRowIndex === -1)
    throw new Error('Could not find order data in this file. Please upload the Order Report from INDmoney.')

  const headers = rows[headerRowIndex].map(h => String(h ?? '').trim())
  const dataRows = rows.slice(headerRowIndex + 1)
  const col = (keyword: string) =>
    headers.findIndex(h => h.toLowerCase().includes(keyword.toLowerCase()))

  const tickerCol     = col('symbol')
  const nameCol       = col('stock name')
  const txTypeCol     = col('transaction type')
  const quantityCol   = col('quantity')
  const priceCol      = col('price')
  const amountCol     = col('amount')
  const execTimeCol   = col('execution time')
  const placedTimeCol = col('placed time')

  // "Transaction Type" is the column that distinguishes orders file from holdings file
  if (txTypeCol === -1)
    throw new Error('Could not find order data in this file. Please upload the Order Report from INDmoney.')

  if (tickerCol === -1)   throw new Error('Missing "Stock Symbol" column')
  if (quantityCol === -1) throw new Error('Missing "Quantity" column')
  if (priceCol === -1)    throw new Error('Missing "Price" column')

  const results: Array<{
    ticker: string
    stockName: string
    date: Date
    type: 'BUY' | 'SELL'
    quantity: number
    priceUSD: number
    amountUSD: number
  }> = []

  for (const row of dataRows) {
    if (!row || row.length === 0) continue

    const ticker = row[tickerCol]?.toString().trim().toUpperCase()
    if (!ticker) continue

    const stockName = nameCol !== -1 && row[nameCol]
      ? String(row[nameCol]).trim()
      : ticker

    // INDmoney values are "buy" / "sell" (lowercase)
    const rawType = row[txTypeCol]?.toString().trim().toUpperCase()
    if (rawType !== 'BUY' && rawType !== 'SELL') continue
    const type = rawType as 'BUY' | 'SELL'

    const quantity = parseFloat(String(row[quantityCol] ?? ''))
    if (isNaN(quantity) || quantity <= 0) continue

    const priceUSD = parseFloat(String(row[priceCol] ?? ''))
    if (isNaN(priceUSD) || priceUSD <= 0) continue

    let amountUSD = quantity * priceUSD
    if (amountCol !== -1 && row[amountCol] !== undefined) {
      const parsed = parseFloat(String(row[amountCol]))
      if (!isNaN(parsed) && parsed > 0) amountUSD = parsed
    }

    // Try execution time first, then placed time
    let date: Date | null = null
    if (execTimeCol !== -1 && row[execTimeCol]) {
      const d = new Date(String(row[execTimeCol]))
      if (!isNaN(d.getTime())) date = d
    }
    if (!date && placedTimeCol !== -1 && row[placedTimeCol]) {
      const d = new Date(String(row[placedTimeCol]))
      if (!isNaN(d.getTime())) date = d
    }
    if (!date) continue

    results.push({ ticker, stockName, date, type, quantity, priceUSD, amountUSD })
  }

  const sorted = results.sort((a, b) => a.date.getTime() - b.date.getTime())
  console.log('Parsed orders sample:', sorted[0])
  return sorted
}
