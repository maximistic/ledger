import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseZerodhaHoldings } from '@/lib/parsers/zerodhaHoldings'

// Holdings is the source of truth for current position.
// holdingsQuantity is set to the file value on every import.
// On update, existing transactions are preserved and quantity is recalculated
// as: holdingsQuantity + (BUY txns - SELL txns).

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

  const buffer = Buffer.from(await file.arrayBuffer())

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
        // Preserve existing transactions; recalculate quantity on top of new holdings base
        const txns = await prisma.stockTransaction.findMany({ where: { stockId: existing.id } })
        const txnNet = txns.reduce((sum, t) => t.type === 'BUY' ? sum + t.quantity : sum - t.quantity, 0)
        const newQty = row.quantity + txnNet

        await prisma.stock.update({
          where: { id: existing.id },
          data: {
            sector:          row.sector !== '' ? row.sector : (existing.sector ?? ''),
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
            name:            row.name,
            ticker:          row.ticker,
            exchange:        row.exchange,
            sector:          row.sector,
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
