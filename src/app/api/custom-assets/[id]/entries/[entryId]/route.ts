export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string; entryId: string }> }

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { entryId } = await params
    const body = await request.json() as {
      name?: unknown; currentValue?: unknown; purchasePrice?: unknown
      purchaseDate?: unknown; notes?: unknown
    }

    const data: Record<string, unknown> = { lastUpdatedAt: new Date() }

    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()

    if (body.currentValue !== undefined) {
      const v = parseFloat(String(body.currentValue))
      if (!Number.isFinite(v) || v <= 0)
        return NextResponse.json({ error: 'Current value must be greater than 0' }, { status: 400 })
      data.currentValue = v
    }

    if (body.purchasePrice !== undefined) {
      data.purchasePrice = parseFloat(String(body.purchasePrice)) || 0
    }

    if (body.purchaseDate !== undefined) {
      if (typeof body.purchaseDate === 'string' && body.purchaseDate) {
        const d = new Date(body.purchaseDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid purchase date' }, { status: 400 })
        data.purchaseDate = d
      } else {
        data.purchaseDate = null
      }
    }

    if (body.notes !== undefined) {
      data.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    }

    const entry = await prisma.customAssetEntry.update({ where: { id: entryId }, data })
    return NextResponse.json({ entry })
  } catch (error) {
    console.error('[PUT /api/custom-assets/[id]/entries/[entryId]]', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { entryId } = await params
    await prisma.customAssetEntry.delete({ where: { id: entryId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/custom-assets/[id]/entries/[entryId]]', error)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}
