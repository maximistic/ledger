import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseZerodhaHoldings } from '@/lib/parsers/zerodhaHoldings'

// Shared holdings import logic used by both /api/stocks/import and /api/stocks/import/holdings.
// holdingsQuantity = file value; quantity = holdingsQuantity + existing txnNet.
// Importing the same file twice is idempotent.

export async function processHoldingsBuffer(buffer: Buffer): Promise<NextResponse> {
  let rows: ReturnType<typeof parseZerodhaHoldings>
  try {
    rows = parseZerodhaHoldings(buffer)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Parse error' }, { status: 422 })
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
        const txns = await prisma.stockTransaction.findMany({ where: { stockId: existing.id } })
        const txnNet = txns.reduce((sum, t) => t.type === 'BUY' ? sum + t.quantity : sum - t.quantity, 0)
        const newQty = row.quantity + txnNet

        await prisma.stock.update({
          where: { id: existing.id },
          data: {
            sector:           row.sector !== '' ? row.sector : (existing.sector ?? ''),
            holdingsQuantity: row.quantity,
            quantity:         newQty,
            avgPrice:         row.avgPrice,
            currentPrice:     row.currentPrice,
            investedValue:    newQty * row.avgPrice,
            currentValue:     newQty * row.currentPrice,
          },
        })
        updated++
      } else {
        await prisma.stock.create({
          data: {
            name:             row.name,
            ticker:           row.ticker,
            exchange:         row.exchange,
            sector:           row.sector,
            holdingsQuantity: row.quantity,
            quantity:         row.quantity,
            avgPrice:         row.avgPrice,
            currentPrice:     row.currentPrice,
            investedValue:    row.quantity * row.avgPrice,
            currentValue:     row.quantity * row.currentPrice,
          },
        })
        created++
      }
    } catch (err) {
      errors.push(`${row.ticker}: ${err instanceof Error ? err.message : 'DB error'}`)
    }
  }

  return NextResponse.json({ created, updated, skipped: 0, errors })
}
