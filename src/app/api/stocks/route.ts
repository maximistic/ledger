import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const includeZero = request.nextUrl.searchParams.get('includeZero') === 'true'
    const stocks = await prisma.stock.findMany({
      where: includeZero ? undefined : { quantity: { gt: 0 } },
      orderBy: { name: 'asc' },
      include: { _count: { select: { transactions: true } } },
    })

    const result = stocks.map(({ _count, ...stock }) => ({
      ...stock,
      gainLoss:    stock.currentValue - stock.investedValue,
      gainLossPct: stock.investedValue > 0
        ? ((stock.currentValue - stock.investedValue) / stock.investedValue) * 100
        : 0,
      transactionCount: _count.transactions,
    }))

    return NextResponse.json({ stocks: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown
      ticker?: unknown
      exchange?: unknown
      sector?: unknown
      quantity?: unknown
      avgPrice?: unknown
      currentPrice?: unknown
    }

    const { name, ticker, exchange, sector, quantity, avgPrice, currentPrice } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be a number > 0' }, { status: 400 })
    }
    if (typeof avgPrice !== 'number' || avgPrice <= 0) {
      return NextResponse.json({ error: 'avgPrice must be a number > 0' }, { status: 400 })
    }

    const normalizedTicker = ticker.trim().toUpperCase()
    const cp              = typeof currentPrice === 'number' ? currentPrice : avgPrice
    const investedValue   = quantity * avgPrice
    const currentValue    = quantity * cp

    const existing = await prisma.stock.findUnique({
      where: { ticker: normalizedTicker },
    })

    if (existing) {
      const mergedQty          = existing.quantity + quantity
      const mergedAvgPrice     = (existing.investedValue + investedValue) / mergedQty
      const mergedInvestedValue = mergedQty * mergedAvgPrice
      const mergedCurrentValue  = mergedQty * existing.currentPrice

      const stock = await prisma.stock.update({
        where: { id: existing.id },
        data: {
          quantity:      mergedQty,
          avgPrice:      mergedAvgPrice,
          investedValue: mergedInvestedValue,
          currentValue:  mergedCurrentValue,
          ...(typeof sector === 'string' && sector.trim() ? { sector: sector.trim() } : {}),
        },
      })

      return NextResponse.json({ stock, merged: true })
    }

    const stock = await prisma.stock.create({
      data: {
        name:         name.trim(),
        ticker:       normalizedTicker,
        exchange:     typeof exchange === 'string' ? exchange.trim() : 'NSE',
        sector:       typeof sector === 'string' && sector.trim() ? sector.trim() : null,
        quantity,
        avgPrice,
        currentPrice: cp,
        investedValue,
        currentValue,
      },
    })

    return NextResponse.json({ stock, merged: false }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
