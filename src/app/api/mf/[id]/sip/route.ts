export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const sip = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    return NextResponse.json({ sip })
  } catch (error) {
    console.error('[GET /api/mf/[id]/sip]', error)
    return NextResponse.json({ error: 'Failed to load SIP' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const existing = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    if (existing) return NextResponse.json({ error: 'SIP already exists' }, { status: 400 })

    const body = await request.json() as { amount?: unknown; dayOfMonth?: unknown; startDate?: unknown }
    const amount = parseFloat(String(body.amount ?? ''))
    const day    = parseInt(String(body.dayOfMonth ?? '1'))
    const start  = typeof body.startDate === 'string' ? new Date(body.startDate) : null

    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })
    if (isNaN(day) || day < 1 || day > 28)
      return NextResponse.json({ error: 'Day must be 1–28' }, { status: 400 })
    if (!start || isNaN(start.getTime()))
      return NextResponse.json({ error: 'Valid start date required' }, { status: 400 })

    const [sip] = await prisma.$transaction([
      prisma.sipConfig.create({
        data: { fundId: id, amount, dayOfMonth: day, startDate: start, status: 'ACTIVE' },
      }),
      prisma.mutualFund.update({ where: { id }, data: { hasActiveSip: true } }),
    ])

    return NextResponse.json({ sip }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/mf/[id]/sip]', error)
    return NextResponse.json({ error: 'Failed to create SIP' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    if (!existing) return NextResponse.json({ error: 'SIP not found' }, { status: 404 })

    const body = await request.json() as { amount?: unknown; dayOfMonth?: unknown; status?: unknown }

    const sip = await prisma.sipConfig.update({
      where: { fundId: id },
      data: {
        ...(typeof body.amount === 'number' ? { amount: body.amount } : {}),
        ...(typeof body.dayOfMonth === 'number' ? { dayOfMonth: body.dayOfMonth } : {}),
        ...(typeof body.status === 'string' ? { status: body.status } : {}),
      },
    })

    if (typeof body.status === 'string') {
      await prisma.mutualFund.update({
        where: { id },
        data: { hasActiveSip: body.status === 'ACTIVE' },
      })
    }

    return NextResponse.json({ sip })
  } catch (error) {
    console.error('[PUT /api/mf/[id]/sip]', error)
    return NextResponse.json({ error: 'Failed to update SIP' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    if (!existing) return NextResponse.json({ error: 'SIP not found' }, { status: 404 })

    await prisma.$transaction([
      prisma.sipConfig.delete({ where: { fundId: id } }),
      prisma.mutualFund.update({ where: { id }, data: { hasActiveSip: false } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/mf/[id]/sip]', error)
    return NextResponse.json({ error: 'Failed to delete SIP' }, { status: 500 })
  }
}
