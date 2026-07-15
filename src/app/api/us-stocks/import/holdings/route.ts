import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseINDmoneyHoldings } from '@/lib/parsers/indmoneyHoldings'

// Holdings is the source of truth for current position (upsert, not additive).
// holdingsQuantity is updated to the file value on every import.
// Existing transactions are preserved; quantity = holdingsQuantity + txnNet.

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

  let rows: ReturnType<typeof parseINDmoneyHoldings>
  try {
    rows = parseINDmoneyHoldings(buffer)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse error' },
      { status: 422 }
    )
  }

  if (rows.length === 0)
    return NextResponse.json({ error: 'No valid rows found in file' }, { status: 422 })

  // Use a default exchange rate of 84 if not set on existing stock
  const DEFAULT_RATE = 84

  let imported = 0
  let updated  = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const existing = await prisma.uSStock.findUnique({ where: { ticker: row.ticker } })

      if (existing) {
        const txns   = await prisma.uSStockTransaction.findMany({ where: { stockId: existing.id } })
        const txnNet = txns.reduce(
          (sum, t) => (t.type === 'BUY' ? sum + t.quantity : sum - t.quantity),
          0
        )
        const newQty       = row.quantity + txnNet
        const rate         = existing.exchangeRate > 0 ? existing.exchangeRate : DEFAULT_RATE
        const currentPerSh = row.currentValueUSD / row.quantity  // derived current price per share

        await prisma.uSStock.update({
          where: { id: existing.id },
          data: {
            holdingsQuantity: row.quantity,
            quantity:         newQty,
            avgPriceUSD:      row.avgPriceUSD,
            currentPriceUSD:  currentPerSh,
            investedValueINR: newQty * row.avgPriceUSD * rate,
            currentValueINR:  newQty * currentPerSh * rate,
          },
        })
        updated++
      } else {
        const rate            = DEFAULT_RATE
        const currentPriceUSD = row.currentValueUSD / row.quantity

        await prisma.uSStock.create({
          data: {
            name:             row.ticker,  // user can rename later
            ticker:           row.ticker,
            exchange:         'NASDAQ',
            holdingsQuantity: row.quantity,
            quantity:         row.quantity,
            avgPriceUSD:      row.avgPriceUSD,
            currentPriceUSD,
            exchangeRate:     rate,
            investedValueINR: row.quantity * row.avgPriceUSD * rate,
            currentValueINR:  row.currentValueUSD * rate,
          },
        })
        imported++
      }
    } catch (err) {
      errors.push(`${row.ticker}: ${err instanceof Error ? err.message : 'DB error'}`)
    }
  }

  return NextResponse.json({ imported, updated, errors })
}
