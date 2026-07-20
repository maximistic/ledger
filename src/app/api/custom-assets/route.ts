export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const classes = await prisma.customAssetClass.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { entries: { orderBy: { createdAt: 'desc' } } },
    })

    const result = classes.map(cls => {
      const totalCurrentValue  = cls.entries.reduce((s, e) => s + e.currentValue, 0)
      const totalPurchasePrice = cls.entries.reduce((s, e) => s + e.purchasePrice, 0)
      const totalGainLoss      = totalCurrentValue - totalPurchasePrice
      const totalGainLossPct   = totalPurchasePrice > 0 ? (totalGainLoss / totalPurchasePrice) * 100 : 0
      return { ...cls, totalCurrentValue, totalPurchasePrice, totalGainLoss, totalGainLossPct, entryCount: cls.entries.length }
    })

    return NextResponse.json({ classes: result })
  } catch (error) {
    console.error('[GET /api/custom-assets]', error)
    return NextResponse.json({ error: 'Failed to load custom assets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; description?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const existing = await prisma.customAssetClass.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ error: 'Asset class already exists' }, { status: 400 })

    const description = typeof body.description === 'string' && body.description.trim()
      ? body.description.trim() : null

    const cls = await prisma.customAssetClass.create({
      data: { name, description },
      include: { entries: true },
    })

    console.log('[POST /api/custom-assets] created:', cls.id)
    return NextResponse.json({
      class: { ...cls, totalCurrentValue: 0, totalPurchasePrice: 0, totalGainLoss: 0, totalGainLossPct: 0, entryCount: 0 },
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/custom-assets]', error)
    return NextResponse.json({ error: 'Failed to create asset class' }, { status: 500 })
  }
}
