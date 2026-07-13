import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const includeZero = request.nextUrl.searchParams.get('includeZero') === 'true'

    const [stocks, totalIncludingZero] = await Promise.all([
      prisma.stock.findMany({
        where:   includeZero ? undefined : { quantity: { gt: 0 } },
        orderBy: { name: 'asc' },
        include: { _count: { select: { transactions: true } } },
      }),
      prisma.stock.count(),
    ])

    const result = stocks.map(({ _count, ...stock }) => {
      const priceStale    = stock.currentPrice === 0
      const displayValue  = priceStale ? stock.investedValue : stock.currentValue
      const gainLoss      = priceStale ? 0 : stock.currentValue - stock.investedValue
      const gainLossPct   = !priceStale && stock.investedValue > 0
        ? (gainLoss / stock.investedValue) * 100
        : 0

      return {
        ...stock,
        gainLoss,
        gainLossPct,
        displayCurrentValue: displayValue,
        priceStale,
        transactionCount: _count.transactions,
      }
    })

    return NextResponse.json({ stocks: result, totalIncludingZero })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown; ticker?: unknown; exchange?: unknown; sector?: unknown
      quantity?: unknown; avgPrice?: unknown; currentPrice?: unknown
    }

    const { name, ticker, exchange, sector, quantity, avgPrice, currentPrice } = body

    if (!name || typeof name !== 'string' || name.trim() === '')
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!ticker || typeof ticker !== 'string' || ticker.trim() === '')
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
    if (typeof quantity !== 'number' || quantity <= 0)
      return NextResponse.json({ error: 'quantity must be a number > 0' }, { status: 400 })
    if (typeof avgPrice !== 'number' || avgPrice <= 0)
      return NextResponse.json({ error: 'avgPrice must be a number > 0' }, { status: 400 })

    const normalizedTicker = ticker.trim().toUpperCase()
    const cp               = typeof currentPrice === 'number' ? currentPrice : avgPrice
    const investedValue    = quantity * avgPrice
    const currentValue     = quantity * cp

    const existing = await prisma.stock.findUnique({ where: { ticker: normalizedTicker } })

    if (existing) {
      // Merge: add to existing position, update holdingsQuantity as new base
      const mergedQty           = existing.quantity + quantity
      const mergedAvgPrice      = (existing.investedValue + investedValue) / mergedQty
      const mergedInvestedValue = mergedQty * mergedAvgPrice
      const mergedCurrentValue  = mergedQty * existing.currentPrice
      // holdingsQuantity grows by newQty — transactions are already captured in existing.quantity
      const newHoldingsQty      = existing.holdingsQuantity + quantity

      const stock = await prisma.stock.update({
        where: { id: existing.id },
        data: {
          holdingsQuantity: newHoldingsQty,
          quantity:         mergedQty,
          avgPrice:         mergedAvgPrice,
          investedValue:    mergedInvestedValue,
          currentValue:     mergedCurrentValue,
          ...(typeof sector === 'string' && sector.trim() ? { sector: sector.trim() } : {}),
        },
      })
      return NextResponse.json({ stock, merged: true })
    }

    const stock = await prisma.stock.create({
      data: {
        name:            name.trim(),
        ticker:          normalizedTicker,
        exchange:        typeof exchange === 'string' ? exchange.trim() : 'NSE',
        sector:          typeof sector === 'string' && sector.trim() ? sector.trim() : null,
        holdingsQuantity: quantity,
        quantity,
        avgPrice,
        currentPrice:    cp,
        investedValue,
        currentValue,
      },
    })

    return NextResponse.json({ stock, merged: false }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'A stock with this ticker already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

function apiError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 'A stock with this ticker already exists'
    if (error.code === 'P2025') return 'Stock not found'
    return 'Database error. Please try again.'
  }
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}
