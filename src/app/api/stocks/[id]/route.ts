import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.stock.findUnique({
      where: { id },
      include: { transactions: { orderBy: { date: 'desc' } } },
    })

    if (!stock) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ stock })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const existing = await prisma.stock.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json() as {
      name?: unknown
      ticker?: unknown
      exchange?: unknown
      quantity?: unknown
      avgPrice?: unknown
      currentPrice?: unknown
    }

    const quantity     = typeof body.quantity     === 'number' ? body.quantity     : existing.quantity
    const avgPrice     = typeof body.avgPrice     === 'number' ? body.avgPrice     : existing.avgPrice
    const currentPrice = typeof body.currentPrice === 'number' ? body.currentPrice : existing.currentPrice

    const stock = await prisma.stock.update({
      where: { id },
      data: {
        ...(typeof body.name     === 'string' ? { name:     body.name.trim() }             : {}),
        ...(typeof body.ticker   === 'string' ? { ticker:   body.ticker.trim().toUpperCase() } : {}),
        ...(typeof body.exchange === 'string' ? { exchange: body.exchange.trim() }          : {}),
        quantity,
        avgPrice,
        currentPrice,
        investedValue: quantity * avgPrice,
        currentValue:  quantity * currentPrice,
      },
    })

    return NextResponse.json({ stock })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const existing = await prisma.stock.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.stock.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
