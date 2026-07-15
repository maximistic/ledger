import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseINDmoneyOrders } from '@/lib/parsers/indmoneyOrders'
import { calculateUSStockMetrics } from '@/lib/usStockUtils'

// Orders only enrich existing holdings with transaction history.
// Tickers not found in the DB are skipped — never created.

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File))
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let rows: ReturnType<typeof parseINDmoneyOrders>
  try {
    rows = parseINDmoneyOrders(buffer)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse error' },
      { status: 422 }
    )
  }

  if (rows.length === 0)
    return NextResponse.json({ error: 'No valid rows found in file' }, { status: 422 })

  // Group orders by ticker
  const byTicker = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byTicker.get(row.ticker) ?? []
    list.push(row)
    byTicker.set(row.ticker, list)
  }

  let processed         = 0
  let created           = 0
  let skipped           = 0
  const skippedTickers: string[] = []
  const errors: string[] = []

  for (const [ticker, orders] of byTicker) {
    try {
      const stock = await prisma.uSStock.findUnique({ where: { ticker } })

      if (!stock) {
        skippedTickers.push(ticker)
        skipped += orders.length
        continue
      }

      const stockId  = stock.id
      const existing = await prisma.uSStockTransaction.findMany({ where: { stockId } })
      const txKey    = (t: { date: Date; type: string; quantity: number; priceUSD: number }) =>
        `${new Date(t.date).toISOString().slice(0, 10)}|${t.type}|${t.quantity}|${t.priceUSD}`
      const existingKeys = new Set(existing.map(txKey))

      const toInsert = orders.filter(o => !existingKeys.has(txKey({ date: o.date, type: o.type, quantity: o.quantity, priceUSD: o.priceUSD })))

      processed += orders.length
      skipped   += orders.length - toInsert.length

      if (toInsert.length > 0) {
        await prisma.uSStockTransaction.createMany({
          data: toInsert.map(o => ({
            stockId,
            date:        o.date,
            type:        o.type,
            quantity:    o.quantity,
            priceUSD:    o.priceUSD,
            amountUSD:   o.amountUSD,
            amountINR:   o.amountUSD * stock.exchangeRate,
            exchangeRate: stock.exchangeRate,
          })),
        })
        created += toInsert.length

        // Recalculate stock metrics after inserting new transactions
        const allTxns = await prisma.uSStockTransaction.findMany({ where: { stockId } })
        const { quantity, avgPriceUSD } = calculateUSStockMetrics(
          allTxns, stock.holdingsQuantity, stock.avgPriceUSD
        )

        if (quantity >= 0) {
          const safeAvg  = avgPriceUSD > 0 ? avgPriceUSD : stock.avgPriceUSD
          const safeRate = stock.exchangeRate
          const safeCurrentPx = stock.currentPriceUSD > 0 ? stock.currentPriceUSD : safeAvg

          await prisma.uSStock.update({
            where: { id: stockId },
            data: {
              quantity,
              avgPriceUSD:      safeAvg,
              investedValueINR: quantity * safeAvg * safeRate,
              currentValueINR:  quantity * safeCurrentPx * safeRate,
            },
          })
        }
      }
    } catch (err) {
      errors.push(`${ticker}: ${err instanceof Error ? err.message : 'DB error'}`)
    }
  }

  return NextResponse.json({ processed, created, skipped, skippedTickers, errors })
}
