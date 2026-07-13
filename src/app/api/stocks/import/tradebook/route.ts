import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseZerodhaTradeBook } from '@/lib/parsers/zerodhaTradeBook'

// Tradebook only enriches existing stocks with transaction history.
// Tickers not found in the DB are skipped — never created.
// Stock quantity/position is NOT overwritten; holdings owns that.

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }

  const text = Buffer.from(await file.arrayBuffer()).toString('utf-8')

  let rows: ReturnType<typeof parseZerodhaTradeBook>
  try {
    rows = parseZerodhaTradeBook(text)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Parse error' }, { status: 422 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in file' }, { status: 422 })
  }

  const byTicker = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byTicker.get(row.ticker) ?? []
    list.push(row)
    byTicker.set(row.ticker, list)
  }

  let processed         = 0
  let created           = 0
  let skipped           = 0
  const stocksAffected  = new Set<string>()
  const skippedTickers: string[] = []
  const errors: string[] = []

  for (const [ticker, trades] of byTicker) {
    try {
      const stock = await prisma.stock.findUnique({ where: { ticker } })

      if (!stock) {
        // Not in holdings — skip entirely, never create ghost records
        skippedTickers.push(ticker)
        skipped += trades.length
        continue
      }

      const stockId = stock.id
      const existing = await prisma.stockTransaction.findMany({ where: { stockId } })
      const key = (t: { date: Date; type: string; quantity: number; price: number }) =>
        `${new Date(t.date).toISOString().slice(0, 10)}|${t.type}|${t.quantity}|${t.price}`
      const existingKeys = new Set(existing.map(key))
      const toInsert = trades.filter(t => !existingKeys.has(key(t)))

      processed += trades.length
      skipped   += trades.length - toInsert.length

      if (toInsert.length > 0) {
        await prisma.stockTransaction.createMany({
          data: toInsert.map(t => ({
            stockId,
            date:     t.date,
            type:     t.type,
            quantity: t.quantity,
            price:    t.price,
            amount:   t.amount,
          })),
        })
        created += toInsert.length
        stocksAffected.add(ticker)
      }

      // Negative quantity guard — warn only, reset to 0
      if (stock.quantity < 0) {
        await prisma.stock.update({
          where: { id: stockId },
          data: { quantity: 0, investedValue: 0, currentValue: 0 },
        })
        errors.push(`${ticker}: quantity went negative after tradebook import. Reset to 0. Check if your tradebook date range covers your full history.`)
      }
    } catch (err) {
      errors.push(`${ticker}: ${err instanceof Error ? err.message : 'DB error'}`)
    }
  }

  return NextResponse.json({
    processed,
    created,
    skipped,
    stocks: stocksAffected.size,
    skippedTickers,
    errors,
  })
}
