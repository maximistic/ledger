import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const stock = await prisma.uSStock.findUnique({
      where:   { id },
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

    const existing = await prisma.uSStock.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; ticker?: unknown; exchange?: unknown
      quantity?: unknown; avgPriceUSD?: unknown; currentPriceUSD?: unknown; exchangeRate?: unknown
    }

    const quantity       = typeof body.quantity       === 'number' ? body.quantity       : existing.quantity
    const avgPriceUSD    = typeof body.avgPriceUSD    === 'number' ? body.avgPriceUSD    : existing.avgPriceUSD
    const currentPriceUSD = typeof body.currentPriceUSD === 'number' ? body.currentPriceUSD : existing.currentPriceUSD
    const exchangeRate   = typeof body.exchangeRate   === 'number' ? body.exchangeRate   : existing.exchangeRate

    const investedValueINR = quantity * avgPriceUSD * exchangeRate
    const currentValueINR  = quantity * currentPriceUSD * exchangeRate

    const stock = await prisma.uSStock.update({
      where: { id },
      data: {
        ...(typeof body.name     === 'string' ? { name:     body.name.trim() }                 : {}),
        ...(typeof body.ticker   === 'string' ? { ticker:   body.ticker.trim().toUpperCase() } : {}),
        ...(typeof body.exchange === 'string' ? { exchange: body.exchange.trim() }             : {}),
        quantity,
        avgPriceUSD,
        currentPriceUSD,
        exchangeRate,
        investedValueINR,
        currentValueINR,
      },
    })

    return NextResponse.json({ stock })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return NextResponse.json({ error: 'A stock with this ticker already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const existing = await prisma.uSStock.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    await prisma.uSStock.delete({ where: { id } })
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
