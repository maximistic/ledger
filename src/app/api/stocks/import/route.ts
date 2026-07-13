import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseZerodhaHoldings } from '@/lib/parsers/zerodhaHoldings'
import { parseZerodhaTradeBook } from '@/lib/parsers/zerodhaTradeBook'

// POST /api/stocks/import?type=holdings  — XLSX
// POST /api/stocks/import?type=tradebook — CSV
export async function POST(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')

  if (type !== 'holdings' && type !== 'tradebook') {
    return NextResponse.json(
      { error: 'query param "type" must be "holdings" or "tradebook"' },
      { status: 400 }
    )
  }

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

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (type === 'holdings') {
    return importHoldings(buffer)
  } else {
    return importTradeBook(buffer)
  }
}

// ─── Holdings import ──────────────────────────────────────────────────────────
// Holdings is the source of truth for current position.
// An existing stock is REPLACED (upserted), not additively merged.
// Importing the same file twice is idempotent.

async function importHoldings(buffer: Buffer): Promise<NextResponse> {
  let rows: Awaited<ReturnType<typeof parseZerodhaHoldings>>
  try {
    rows = parseZerodhaHoldings(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parse error'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in file' }, { status: 422 })
  }

  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const investedValue = row.quantity * row.avgPrice
      const currentValue  = row.quantity * row.currentPrice
      const existing = await prisma.stock.findUnique({ where: { ticker: row.ticker } })

      if (existing) {
        // Replace position with file values — idempotent
        await prisma.stock.update({
          where: { id: existing.id },
          data: {
            sector:        row.sector !== '' ? row.sector : (existing.sector ?? ''),
            quantity:      row.quantity,
            avgPrice:      row.avgPrice,
            currentPrice:  row.currentPrice,
            investedValue,
            currentValue,
          },
        })
        updated++
      } else {
        await prisma.stock.create({
          data: {
            name:          row.name,
            ticker:        row.ticker,
            exchange:      row.exchange,
            sector:        row.sector,
            quantity:      row.quantity,
            avgPrice:      row.avgPrice,
            currentPrice:  row.currentPrice,
            investedValue,
            currentValue,
          },
        })
        created++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DB error'
      errors.push(`${row.ticker}: ${message}`)
    }
  }

  return NextResponse.json({ created, updated, skipped: 0, errors }, { status: 200 })
}

// ─── Tradebook import ─────────────────────────────────────────────────────────
// Tradebook only enriches existing stocks with transaction history.
// Tickers not in the DB are skipped — never created.
// Stock quantity/position is NOT updated; holdings owns that.

async function importTradeBook(buffer: Buffer): Promise<NextResponse> {
  let rows: Awaited<ReturnType<typeof parseZerodhaTradeBook>>
  try {
    rows = parseZerodhaTradeBook(buffer.toString('utf-8'))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parse error'
    return NextResponse.json({ error: message }, { status: 422 })
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

  let processed     = 0
  let created       = 0
  let skipped       = 0
  const stocksAffected  = new Set<string>()
  const skippedTickers: string[] = []
  const errors: string[] = []

  for (const [ticker, trades] of byTicker) {
    try {
      const stock = await prisma.stock.findUnique({ where: { ticker } })

      if (!stock) {
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

      // Negative quantity guard — only warn, don't block
      if (stock.quantity < 0) {
        await prisma.stock.update({
          where: { id: stockId },
          data: { quantity: 0, investedValue: 0, currentValue: 0 },
        })
        errors.push(`${ticker}: quantity went negative after tradebook import. Reset to 0. Check if your tradebook date range covers your full history.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DB error'
      errors.push(`${ticker}: ${message}`)
    }
  }

  return NextResponse.json({
    processed,
    created,
    skipped,
    stocks: stocksAffected.size,
    skippedTickers,
    errors,
  }, { status: 200 })
}
