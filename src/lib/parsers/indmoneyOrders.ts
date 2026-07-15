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
  const sheet = workbook.Sheets['ORDER_BOOK']
  if (!sheet) throw new Error('Sheet "ORDER_BOOK" not found in file')

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

  const symbolIdx   = col('symbol')
  const nameIdx     = col('name')
  const execIdx     = col('execution')
  const placedIdx   = col('placed')
  const txnTypeIdx  = col('transaction')
  const qtyIdx      = col('quantity')
  const priceIdx    = col('price')
  const amountIdx   = col('amount')

  if (symbolIdx === -1) throw new Error('Missing "Stock Symbol" column')
  if (qtyIdx === -1)    throw new Error('Missing "Quantity" column')
  if (priceIdx === -1)  throw new Error('Missing "Price" column')

  const results: Array<{
    ticker: string
    stockName: string
    date: Date
    type: 'BUY' | 'SELL'
    quantity: number
    priceUSD: number
    amountUSD: number
  }> = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue

    const ticker = row[symbolIdx]?.toString().trim().toUpperCase()
    if (!ticker) continue

    const stockName = nameIdx !== -1 && row[nameIdx]
      ? String(row[nameIdx]).trim()
      : ticker

    // Resolve type — values from INDmoney are "buy" / "sell" (lowercase)
    const rawType = txnTypeIdx !== -1
      ? row[txnTypeIdx]?.toString().trim().toUpperCase()
      : undefined
    if (rawType !== 'BUY' && rawType !== 'SELL') continue
    const type = rawType as 'BUY' | 'SELL'

    const quantity = parseFloat(String(row[qtyIdx] ?? ''))
    if (isNaN(quantity) || quantity <= 0) continue

    const priceUSD = parseFloat(String(row[priceIdx] ?? ''))
    if (isNaN(priceUSD) || priceUSD <= 0) continue

    let amountUSD = quantity * priceUSD
    if (amountIdx !== -1 && row[amountIdx] !== undefined) {
      const parsed = parseFloat(String(row[amountIdx]))
      if (!isNaN(parsed) && parsed > 0) amountUSD = parsed
    }

    // Date parsing — try "Order Execution Time" first, then "Order Placed Time"
    // Format example: "15 Oct 2025, 10:36 PM" — JS Date() handles this
    let date: Date | null = null
    if (execIdx !== -1 && row[execIdx]) {
      const d = new Date(String(row[execIdx]))
      if (!isNaN(d.getTime())) date = d
    }
    if (!date && placedIdx !== -1 && row[placedIdx]) {
      const d = new Date(String(row[placedIdx]))
      if (!isNaN(d.getTime())) date = d
    }
    if (!date) continue

    results.push({ ticker, stockName, date, type, quantity, priceUSD, amountUSD })
  }

  // Return sorted by date ascending
  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}
