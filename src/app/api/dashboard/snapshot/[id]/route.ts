import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const existing = await prisma.snapshot.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    await prisma.snapshot.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
