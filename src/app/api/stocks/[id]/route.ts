import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.stock.findUnique({
      where: { id },
      include: { transactions: { orderBy: { date: 'desc' } } },
    })

    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    return NextResponse.json({ stock })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const existing = await prisma.stock.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; ticker?: unknown; exchange?: unknown; sector?: unknown
      quantity?: unknown; avgPrice?: unknown; currentPrice?: unknown
    }

    const quantity     = typeof body.quantity     === 'number' ? body.quantity     : existing.quantity
    const avgPrice     = typeof body.avgPrice     === 'number' ? body.avgPrice     : existing.avgPrice
    const currentPrice = typeof body.currentPrice === 'number' ? body.currentPrice : existing.currentPrice

    const stock = await prisma.stock.update({
      where: { id },
      data: {
        ...(typeof body.name     === 'string' ? { name:     body.name.trim() }                 : {}),
        ...(typeof body.ticker   === 'string' ? { ticker:   body.ticker.trim().toUpperCase() } : {}),
        ...(typeof body.exchange === 'string' ? { exchange: body.exchange.trim() }             : {}),
        ...(typeof body.sector   === 'string' ? { sector:   body.sector.trim() || null }       : {}),
        quantity,
        avgPrice,
        currentPrice,
        investedValue: quantity * avgPrice,
        currentValue:  quantity * currentPrice,
      },
    })

    return NextResponse.json({ stock })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'A stock with this ticker already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const existing = await prisma.stock.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    await prisma.stock.delete({ where: { id } })
    return NextResponse.json({ success: true })
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
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}
