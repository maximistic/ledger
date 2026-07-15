import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const stocks = await prisma.uSStock.findMany({ orderBy: { ticker: 'asc' } })

    const result = stocks.map(stock => {
      const currentValueINR = stock.quantity * stock.currentPriceUSD * stock.exchangeRate
      const gainLossUSD     = (stock.currentPriceUSD - stock.avgPriceUSD) * stock.quantity
      const gainLossINR     = currentValueINR - stock.investedValueINR
      const gainLossPct     = stock.investedValueINR > 0
        ? (gainLossINR / stock.investedValueINR) * 100 : 0
      return { ...stock, gainLossUSD, gainLossINR, gainLossPct }
    })

    const totalInvestedINR     = result.reduce((s, st) => s + st.investedValueINR, 0)
    const totalCurrentValueINR = result.reduce((s, st) => s + st.currentValueINR, 0)
    const totalGainLossINR     = totalCurrentValueINR - totalInvestedINR
    const count                = result.length

    return NextResponse.json({
      stocks: result,
      totals: { totalInvestedINR, totalCurrentValueINR, totalGainLossINR, count },
    })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown; ticker?: unknown; quantity?: unknown
      avgPriceUSD?: unknown; currentPriceUSD?: unknown; exchangeRate?: unknown
    }

    const { name, ticker, quantity, avgPriceUSD, currentPriceUSD, exchangeRate } = body

    if (!name || typeof name !== 'string' || name.trim() === '')
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!ticker || typeof ticker !== 'string' || ticker.trim() === '')
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
    if (typeof quantity !== 'number' || quantity <= 0)
      return NextResponse.json({ error: 'quantity must be a number > 0' }, { status: 400 })
    if (typeof avgPriceUSD !== 'number' || avgPriceUSD <= 0)
      return NextResponse.json({ error: 'avgPriceUSD must be a number > 0' }, { status: 400 })

    const normalizedTicker = ticker.trim().toUpperCase()
    const rate             = typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : 84
    const cp               = typeof currentPriceUSD === 'number' && currentPriceUSD > 0 ? currentPriceUSD : avgPriceUSD
    const investedValueINR = quantity * avgPriceUSD * rate
    const currentValueINR  = quantity * cp * rate

    const existing = await prisma.uSStock.findUnique({ where: { ticker: normalizedTicker } })

    if (existing) {
      const mergedQty      = existing.quantity + quantity
      const mergedAvgUSD   = (existing.quantity * existing.avgPriceUSD + quantity * avgPriceUSD) / mergedQty
      const mergedInvested = mergedQty * mergedAvgUSD * rate
      const mergedCurrent  = mergedQty * existing.currentPriceUSD * rate
      const newHoldingsQty = existing.holdingsQuantity + quantity

      const stock = await prisma.uSStock.update({
        where: { id: existing.id },
        data: {
          holdingsQuantity: newHoldingsQty,
          quantity:         mergedQty,
          avgPriceUSD:      mergedAvgUSD,
          investedValueINR: mergedInvested,
          currentValueINR:  mergedCurrent,
          exchangeRate:     rate,
        },
      })
      return NextResponse.json({ stock, merged: true })
    }

    const stock = await prisma.uSStock.create({
      data: {
        name:             name.trim(),
        ticker:           normalizedTicker,
        holdingsQuantity: quantity,
        quantity,
        avgPriceUSD,
        currentPriceUSD:  cp,
        exchangeRate:     rate,
        investedValueINR,
        currentValueINR,
      },
    })

    return NextResponse.json({ stock, merged: false }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return NextResponse.json({ error: 'A stock with this ticker already exists' }, { status: 409 })
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
