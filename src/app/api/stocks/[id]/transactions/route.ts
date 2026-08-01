import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateStockMetrics } from '@/lib/stockUtils'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.stock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const transactions = await prisma.stockTransaction.findMany({
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

    const stock = await prisma.stock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const body = await request.json() as {
      date?: unknown; type?: unknown; quantity?: unknown; price?: unknown
    }

    const { date, type, quantity, price } = body

    if (!date || typeof date !== 'string')
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    if (type !== 'BUY' && type !== 'SELL')
      return NextResponse.json({ error: 'type must be BUY or SELL' }, { status: 400 })
    if (typeof quantity !== 'number' || quantity <= 0)
      return NextResponse.json({ error: 'quantity must be a number > 0' }, { status: 400 })
    if (typeof price !== 'number' || price <= 0)
      return NextResponse.json({ error: 'price must be a number > 0' }, { status: 400 })

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime()))
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    // Duplicate detection
    const existingTxns = await prisma.stockTransaction.findMany({ where: { stockId: id } })
    const txKey = (t: { date: Date | string; type: string; quantity: number; price: number }) =>
      `${new Date(t.date).toISOString().slice(0, 10)}|${t.type}|${t.quantity}|${t.price}`
    const newKey = `${parsedDate.toISOString().slice(0, 10)}|${type}|${quantity}|${price}`
    if (existingTxns.some(t => txKey(t) === newKey)) {
      return NextResponse.json({ error: 'This transaction already exists.' }, { status: 400 })
    }

    // SELL: check sufficient shares
    if (type === 'SELL' && quantity > stock.quantity) {
      return NextResponse.json({
        error: `Insufficient shares. You hold ${stock.quantity} shares but tried to sell ${quantity}.`,
      }, { status: 400 })
    }

    const transaction = await prisma.stockTransaction.create({
      data: { stockId: id, date: parsedDate, type, quantity, price, amount: quantity * price },
    })

    const allTransactions = await prisma.stockTransaction.findMany({ where: { stockId: id } })
    const metrics = calculateStockMetrics(allTransactions, stock.holdingsQuantity, stock.avgPrice)

    if (metrics.quantity < 0) {
      await prisma.stockTransaction.delete({ where: { id: transaction.id } })
      return NextResponse.json(
        { error: 'Transaction would result in negative quantity. Check your buy/sell amounts.' },
        { status: 400 }
      )
    }

    // NaN/Infinity guards
    const safeQty       = isFinite(metrics.quantity)  ? metrics.quantity  : 0
    const safeAvgPrice  = isFinite(metrics.avgPrice) && metrics.avgPrice > 0 ? metrics.avgPrice : stock.avgPrice
    const safeCurrentPx = stock.currentPrice > 0 ? stock.currentPrice : safeAvgPrice
    const investedValue = safeQty > 0 ? safeQty * safeAvgPrice : 0
    const currentValue  = safeQty * safeCurrentPx

    const updatedStock = await prisma.stock.update({
      where: { id },
      data:  { quantity: safeQty, avgPrice: safeAvgPrice, investedValue, currentValue },
    })

    return NextResponse.json({ transaction, stock: updatedStock }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const transactionId = url.searchParams.get('transactionId')
    if (!transactionId) return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })

    const stock = await prisma.stock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const txn = await prisma.stockTransaction.findUnique({ where: { id: transactionId } })
    if (!txn || txn.stockId !== id) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const body = await request.json() as { date?: unknown; type?: unknown; quantity?: unknown; price?: unknown }
    const { date, type, quantity, price } = body

    if (!date || typeof date !== 'string') return NextResponse.json({ error: 'date is required' }, { status: 400 })
    if (type !== 'BUY' && type !== 'SELL') return NextResponse.json({ error: 'type must be BUY or SELL' }, { status: 400 })
    if (typeof quantity !== 'number' || quantity <= 0) return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 })
    if (typeof price !== 'number' || price <= 0) return NextResponse.json({ error: 'price must be > 0' }, { status: 400 })

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    await prisma.stockTransaction.update({
      where: { id: transactionId },
      data:  { date: parsedDate, type, quantity, price, amount: quantity * price },
    })

    const allTransactions = await prisma.stockTransaction.findMany({ where: { stockId: id } })
    const metrics = calculateStockMetrics(allTransactions, stock.holdingsQuantity, stock.avgPrice)

    if (metrics.quantity < 0) {
      // Rollback to original values
      await prisma.stockTransaction.update({
        where: { id: transactionId },
        data:  { date: txn.date, type: txn.type, quantity: txn.quantity, price: txn.price, amount: txn.amount },
      })
      return NextResponse.json({ error: 'Edit would result in negative quantity.' }, { status: 400 })
    }

    const safeQty       = isFinite(metrics.quantity)  ? metrics.quantity  : 0
    const safeAvgPrice  = isFinite(metrics.avgPrice) && metrics.avgPrice > 0 ? metrics.avgPrice : stock.avgPrice
    const safeCurrentPx = stock.currentPrice > 0 ? stock.currentPrice : safeAvgPrice
    const investedValue = safeQty > 0 ? safeQty * safeAvgPrice : 0
    const currentValue  = safeQty * safeCurrentPx

    const updatedStock = await prisma.stock.update({
      where: { id },
      data:  { quantity: safeQty, avgPrice: safeAvgPrice, investedValue, currentValue },
    })

    const updatedTxn = await prisma.stockTransaction.findUnique({ where: { id: transactionId } })

    return NextResponse.json({ transaction: updatedTxn, stock: updatedStock })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const transactionId = url.searchParams.get('transactionId')
    if (!transactionId) return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })

    const stock = await prisma.stock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const txn = await prisma.stockTransaction.findUnique({ where: { id: transactionId } })
    if (!txn || txn.stockId !== id) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    await prisma.stockTransaction.delete({ where: { id: transactionId } })

    const allTransactions = await prisma.stockTransaction.findMany({ where: { stockId: id } })
    const metrics = calculateStockMetrics(allTransactions, stock.holdingsQuantity, stock.avgPrice)

    const safeQty       = isFinite(metrics.quantity)  ? metrics.quantity  : 0
    const safeAvgPrice  = isFinite(metrics.avgPrice) && metrics.avgPrice > 0 ? metrics.avgPrice : stock.avgPrice
    const safeCurrentPx = stock.currentPrice > 0 ? stock.currentPrice : safeAvgPrice
    const investedValue = safeQty > 0 ? safeQty * safeAvgPrice : 0
    const currentValue  = safeQty * safeCurrentPx

    const updatedStock = await prisma.stock.update({
      where: { id },
      data:  { quantity: safeQty, avgPrice: safeAvgPrice, investedValue, currentValue },
    })

    return NextResponse.json({ success: true, stock: updatedStock })
  } catch (error) {
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
  // Don't leak Prisma internals
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}
