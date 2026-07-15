import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateUSStockMetrics } from '@/lib/usStockUtils'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.uSStock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const transactions = await prisma.uSStockTransaction.findMany({
      where:   { stockId: id },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.uSStock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const body = await request.json() as {
      date?: unknown; type?: unknown; quantity?: unknown
      priceUSD?: unknown; exchangeRate?: unknown
    }

    const { date, type, quantity, priceUSD, exchangeRate } = body

    if (!date || typeof date !== 'string')
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    if (type !== 'BUY' && type !== 'SELL')
      return NextResponse.json({ error: 'type must be BUY or SELL' }, { status: 400 })
    if (typeof quantity !== 'number' || quantity <= 0)
      return NextResponse.json({ error: 'quantity must be a number > 0' }, { status: 400 })
    if (typeof priceUSD !== 'number' || priceUSD <= 0)
      return NextResponse.json({ error: 'priceUSD must be a number > 0' }, { status: 400 })

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime()))
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    const rate      = typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : stock.exchangeRate
    const amountUSD = quantity * priceUSD
    const amountINR = amountUSD * rate

    // Duplicate check: stockId + date + type + quantity + priceUSD
    const existingTxns = await prisma.uSStockTransaction.findMany({ where: { stockId: id } })
    const txKey = (t: { date: Date; type: string; quantity: number; priceUSD: number }) =>
      `${new Date(t.date).toISOString().slice(0, 10)}|${t.type}|${t.quantity}|${t.priceUSD}`
    const newKey = `${parsedDate.toISOString().slice(0, 10)}|${type}|${quantity}|${priceUSD}`
    if (existingTxns.some(t => txKey(t) === newKey)) {
      return NextResponse.json({ error: 'This transaction already exists.' }, { status: 400 })
    }

    const transaction = await prisma.uSStockTransaction.create({
      data: { stockId: id, date: parsedDate, type, quantity, priceUSD, amountUSD, amountINR, exchangeRate: rate },
    })

    const allTransactions = await prisma.uSStockTransaction.findMany({ where: { stockId: id } })
    const metrics = calculateUSStockMetrics(allTransactions, stock.holdingsQuantity, stock.avgPriceUSD)

    if (metrics.quantity < 0) {
      await prisma.uSStockTransaction.delete({ where: { id: transaction.id } })
      return NextResponse.json({ error: 'Insufficient shares' }, { status: 400 })
    }

    const safeQty        = isFinite(metrics.quantity)     ? metrics.quantity     : 0
    const safeAvgUSD     = isFinite(metrics.avgPriceUSD) && metrics.avgPriceUSD > 0
      ? metrics.avgPriceUSD : stock.avgPriceUSD
    const safeCurrentPx  = stock.currentPriceUSD > 0 ? stock.currentPriceUSD : safeAvgUSD
    const investedValueINR = safeQty > 0 ? safeQty * safeAvgUSD * rate : 0
    const currentValueINR  = safeQty * safeCurrentPx * rate

    const updatedStock = await prisma.uSStock.update({
      where: { id },
      data:  { quantity: safeQty, avgPriceUSD: safeAvgUSD, investedValueINR, currentValueINR, exchangeRate: rate },
    })

    return NextResponse.json({ transaction, stock: updatedStock }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025')
        return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

function apiError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return 'Stock not found'
    return 'Database error. Please try again.'
  }
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}
