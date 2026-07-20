export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const cls = await prisma.customAssetClass.findUnique({
      where: { id },
      include: { entries: { orderBy: { createdAt: 'desc' } } },
    })
    if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const totalCurrentValue  = cls.entries.reduce((s, e) => s + e.currentValue, 0)
    const totalPurchasePrice = cls.entries.reduce((s, e) => s + e.purchasePrice, 0)
    const totalGainLoss      = totalCurrentValue - totalPurchasePrice
    const totalGainLossPct   = totalPurchasePrice > 0 ? (totalGainLoss / totalPurchasePrice) * 100 : 0

    return NextResponse.json({
      class: { ...cls, totalCurrentValue, totalPurchasePrice, totalGainLoss, totalGainLossPct, entryCount: cls.entries.length },
    })
  } catch (error) {
    console.error('[GET /api/custom-assets/[id]]', error)
    return NextResponse.json({ error: 'Failed to load asset class' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await request.json() as { name?: unknown; description?: unknown; sortOrder?: unknown }
    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body.description === 'string') data.description = body.description.trim() || null
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder

    const cls = await prisma.customAssetClass.update({ where: { id }, data })
    return NextResponse.json({ class: cls })
  } catch (error) {
    console.error('[PUT /api/custom-assets/[id]]', error)
    return NextResponse.json({ error: 'Failed to update asset class' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    await prisma.customAssetClass.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/custom-assets/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete asset class' }, { status: 500 })
  }
}
