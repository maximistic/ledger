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

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  // Find header row — look for 'Transaction Type' column (unique to orders file)
  const headerRowIndex = rows.findIndex(row =>
    (row as unknown[]).some(cell =>
      String(cell).toLowerCase().includes('transaction type')
    )
  )

  if (headerRowIndex === -1) {
    throw new Error(
      'Could not find Transaction Type column. ' +
      'Please upload the Order Report from INDmoney, not the Holdings Report.'
    )
  }

  const headers = (rows[headerRowIndex] as unknown[]).map(h =>
    String(h ?? '').trim().toLowerCase()
  )

  const nameCol         = headers.findIndex(h => h.includes('stock name') || (h.includes('stock') && h.includes('name')))
  const tickerCol       = headers.findIndex(h => h.includes('stock symbol') || h.includes('symbol'))
  const executionTimeCol = headers.findIndex(h => h.includes('execution time'))
  const placedTimeCol   = headers.findIndex(h => h.includes('placed time'))
  const txTypeCol       = headers.findIndex(h => h.includes('transaction type'))
  const qtyCol          = headers.findIndex(h => h.includes('quantity'))
  const priceCol        = headers.findIndex(h => h.includes('price') && !h.includes('amount'))
  const amountCol       = headers.findIndex(h => h.includes('order amount') || (h.includes('amount') && !h.includes('brokerage')))

  if (tickerCol === -1 || txTypeCol === -1 || qtyCol === -1) {
    throw new Error('Missing required columns in Orders file.')
  }

  // Handles "10 Jul 2024, 08:04 PM" — native Date() parses this fine
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    const d = new Date(dateStr.trim())
    return isNaN(d.getTime()) ? null : d
  }

  const results: Array<{
    ticker: string
    stockName: string
    date: Date
    type: 'BUY' | 'SELL'
    quantity: number
    priceUSD: number
    amountUSD: number
  }> = []

  const dataRows = rows.slice(headerRowIndex + 1)

  for (const row of dataRows as unknown[][]) {
    const ticker = String(row[tickerCol] ?? '').trim().toUpperCase()
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) continue

    const rawName   = nameCol !== -1 ? String(row[nameCol] ?? '').trim() : ''
    const stockName = rawName.length > 60 ? rawName.slice(0, 60).trim() : rawName || ticker

    const rawType = String(row[txTypeCol] ?? '').trim().toLowerCase()
    const type = rawType === 'buy' ? 'BUY' : rawType === 'sell' ? 'SELL' : null
    if (!type) continue

    const quantity = parseFloat(String(row[qtyCol] ?? '0'))
    if (isNaN(quantity) || quantity <= 0) continue

    const priceUSD = priceCol !== -1 ? parseFloat(String(row[priceCol] ?? '0')) : 0
    if (isNaN(priceUSD) || priceUSD <= 0) continue

    const rawAmount = amountCol !== -1 ? parseFloat(String(row[amountCol] ?? '0')) : 0
    const amountUSD = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : quantity * priceUSD

    const dateStr = executionTimeCol !== -1
      ? String(row[executionTimeCol] ?? '')
      : placedTimeCol !== -1
        ? String(row[placedTimeCol] ?? '')
        : ''
    const date = parseDate(dateStr)
    if (!date) continue

    results.push({ ticker, stockName, date, type, quantity, priceUSD, amountUSD })
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime())
  console.log('Parsed orders sample:', results[0])
  return results
}
