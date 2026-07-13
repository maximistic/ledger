import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateStockMetrics } from '@/lib/stockUtils'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.stock.findUnique({ where: { id } })
    if (!stock) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const transactions = await prisma.stockTransaction.findMany({
      where:   { stockId: id },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.stock.findUnique({ where: { id } })
    if (!stock) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json() as {
      date?: unknown
      type?: unknown
      quantity?: unknown
      price?: unknown
    }

    const { date, type, quantity, price } = body

    if (!date || typeof date !== 'string') {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }
    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json({ error: 'type must be BUY or SELL' }, { status: 400 })
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be a number > 0' }, { status: 400 })
    }
    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json({ error: 'price must be a number > 0' }, { status: 400 })
    }

    const amount      = quantity * price
    const parsedDate  = new Date(date)

    const transaction = await prisma.stockTransaction.create({
      data: {
        stockId: id,
        date:    parsedDate,
        type,
        quantity,
        price,
        amount,
      },
    })

    // Recalculate stock metrics from all transactions
    const allTransactions = await prisma.stockTransaction.findMany({
      where: { stockId: id },
    })

    const metrics      = calculateStockMetrics(allTransactions)
    const currentValue = metrics.quantity * stock.currentPrice

    const updatedStock = await prisma.stock.update({
      where: { id },
      data: {
        quantity:     metrics.quantity,
        avgPrice:     metrics.avgPrice,
        investedValue: metrics.investedValue,
        currentValue,
      },
    })

    return NextResponse.json({ transaction, stock: updatedStock }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
