import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateStockMetrics } from '@/lib/stockUtils'
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
      const existing = await prisma.stock.findUnique({ where: { ticker: row.ticker } })

      if (existing) {
        // Merge: recalculate weighted avg from existing + incoming
        const mergedQty      = existing.quantity + row.quantity
        const mergedAvg      = (existing.investedValue + row.quantity * row.avgPrice) / mergedQty
        const mergedInvested = mergedQty * mergedAvg
        const mergedCurrent  = mergedQty * existing.currentPrice

        await prisma.stock.update({
          where: { id: existing.id },
          data: {
            quantity:     mergedQty,
            avgPrice:     mergedAvg,
            investedValue: mergedInvested,
            currentValue:  mergedCurrent,
          },
        })
        updated++
      } else {
        const investedValue = row.quantity * row.avgPrice
        await prisma.stock.create({
          data: {
            name:         row.name,
            ticker:       row.ticker,
            exchange:     row.exchange,
            quantity:     row.quantity,
            avgPrice:     row.avgPrice,
            currentPrice: row.avgPrice,
            investedValue,
            currentValue: investedValue,
          },
        })
        created++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DB error'
      errors.push(`${row.ticker}: ${message}`)
    }
  }

  return NextResponse.json({ created, updated, errors }, { status: 200 })
}

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

  // Group trades by ticker
  const byTicker = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byTicker.get(row.ticker) ?? []
    list.push(row)
    byTicker.set(row.ticker, list)
  }

  let inserted = 0
  let skipped  = 0
  const errors: string[] = []

  for (const [ticker, trades] of byTicker) {
    try {
      // Ensure the stock record exists
      let stock = await prisma.stock.findUnique({ where: { ticker } })
      if (!stock) {
        const exchange = trades[0].exchange
        stock = await prisma.stock.create({
          data: {
            name:         ticker,
            ticker,
            exchange,
            quantity:     0,
            avgPrice:     0,
            currentPrice: 0,
            investedValue: 0,
            currentValue: 0,
          },
        })
      }

      const stockId = stock.id

      // Fetch existing transactions to deduplicate
      const existing = await prisma.stockTransaction.findMany({ where: { stockId } })
      const dedupKey = (t: { date: Date; type: string; quantity: number; price: number }) =>
        `${new Date(t.date).toISOString().slice(0, 10)}|${t.type}|${t.quantity}|${t.price}`

      const existingKeys = new Set(existing.map(dedupKey))

      const toInsert = trades.filter(t => !existingKeys.has(dedupKey(t)))

      if (toInsert.length === 0) {
        skipped += trades.length
        continue
      }

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

      inserted += toInsert.length
      skipped  += trades.length - toInsert.length

      // Recalculate stock metrics from all transactions
      const allTransactions = await prisma.stockTransaction.findMany({ where: { stockId } })
      const metrics = calculateStockMetrics(allTransactions)
      const currentValue = metrics.quantity * stock.currentPrice

      await prisma.stock.update({
        where: { id: stockId },
        data: {
          quantity:     metrics.quantity,
          avgPrice:     metrics.avgPrice,
          investedValue: metrics.investedValue,
          currentValue,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DB error'
      errors.push(`${ticker}: ${message}`)
    }
  }

  return NextResponse.json({ inserted, skipped, errors }, { status: 200 })
}
