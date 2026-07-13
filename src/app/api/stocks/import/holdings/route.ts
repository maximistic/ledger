import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseZerodhaHoldings } from '@/lib/parsers/zerodhaHoldings'

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
        const mergedQty      = existing.quantity + row.quantity
        const mergedAvg      = (existing.investedValue + row.quantity * row.avgPrice) / mergedQty
        await prisma.stock.update({
          where: { id: existing.id },
          data: {
            quantity:      mergedQty,
            avgPrice:      mergedAvg,
            investedValue: mergedQty * mergedAvg,
            currentValue:  mergedQty * existing.currentPrice,
          },
        })
        updated++
      } else {
        const investedValue = row.quantity * row.avgPrice
        await prisma.stock.create({
          data: {
            name:          row.name,
            ticker:        row.ticker,
            exchange:      row.exchange,
            quantity:      row.quantity,
            avgPrice:      row.avgPrice,
            currentPrice:  row.avgPrice,
            investedValue,
            currentValue:  investedValue,
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
