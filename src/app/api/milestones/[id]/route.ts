import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json() as {
      title?: string
      targetAmount?: number
      targetAsset?: string | null
      isAchieved?: boolean
      achievedDate?: string | null
    }

    const data: Record<string, unknown> = {}
    if (body.title       !== undefined) data.title        = body.title
    if (body.targetAmount !== undefined) data.targetAmount = body.targetAmount
    if (body.targetAsset  !== undefined) data.targetAsset  = body.targetAsset
    if (body.isAchieved   !== undefined) data.isAchieved   = body.isAchieved
    if (body.achievedDate !== undefined) {
      data.achievedDate = body.achievedDate ? new Date(body.achievedDate) : null
    }

    const milestone = await prisma.milestone.update({ where: { id }, data })
    return NextResponse.json({ milestone })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    await prisma.milestone.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
