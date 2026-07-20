export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const entries = await prisma.customAssetEntry.findMany({
      where: { classId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('[GET /api/custom-assets/[id]/entries]', error)
    return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const cls = await prisma.customAssetClass.findUnique({ where: { id } })
    if (!cls) return NextResponse.json({ error: 'Asset class not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; purchasePrice?: unknown; currentValue?: unknown
      purchaseDate?: unknown; notes?: unknown
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const currentValue = parseFloat(String(body.currentValue ?? ''))
    if (!Number.isFinite(currentValue) || currentValue <= 0)
      return NextResponse.json({ error: 'Current value must be greater than 0' }, { status: 400 })

    const purchasePrice = parseFloat(String(body.purchasePrice ?? '0')) || 0

    let purchaseDate: Date | null = null
    if (typeof body.purchaseDate === 'string' && body.purchaseDate) {
      const d = new Date(body.purchaseDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid purchase date' }, { status: 400 })
      purchaseDate = d
    }

    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

    const entry = await prisma.customAssetEntry.create({
      data: { classId: id, name, type: cls.name, purchasePrice, currentValue, purchaseDate, notes },
    })

    console.log('[POST /api/custom-assets/[id]/entries] created:', entry.id)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/custom-assets/[id]/entries]', error)
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
  }
}
