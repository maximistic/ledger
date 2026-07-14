import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mfApiError } from '@/lib/mfUtils'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const sip = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    return NextResponse.json({ sip })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const body = await request.json() as { amount?: unknown; dayOfMonth?: unknown; startDate?: unknown }
    const { amount, dayOfMonth, startDate } = body

    if (typeof amount !== 'number' || amount <= 0)
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
    if (typeof dayOfMonth !== 'number' || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28)
      return NextResponse.json({ error: 'dayOfMonth must be an integer between 1 and 28' }, { status: 400 })
    if (!startDate || typeof startDate !== 'string')
      return NextResponse.json({ error: 'startDate is required' }, { status: 400 })

    const parsedStart = new Date(startDate)
    if (isNaN(parsedStart.getTime()))
      return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })

    const existing = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    if (existing)
      return NextResponse.json({ error: 'SIP already configured. Use PUT to update.' }, { status: 400 })

    const [sip] = await prisma.$transaction([
      prisma.sipConfig.create({
        data: { fundId: id, amount, dayOfMonth, startDate: parsedStart, status: 'ACTIVE' },
      }),
      prisma.mutualFund.update({
        where: { id },
        data:  { hasActiveSip: true },
      }),
    ])

    return NextResponse.json({ sip }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const existing = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    if (!existing) return NextResponse.json({ error: 'No SIP configured for this fund' }, { status: 404 })

    const body = await request.json() as { amount?: unknown; dayOfMonth?: unknown; status?: unknown }
    const { amount, dayOfMonth, status } = body

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0))
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
    if (dayOfMonth !== undefined && (typeof dayOfMonth !== 'number' || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28))
      return NextResponse.json({ error: 'dayOfMonth must be an integer between 1 and 28' }, { status: 400 })
    if (status !== undefined && status !== 'ACTIVE' && status !== 'PAUSED')
      return NextResponse.json({ error: 'status must be ACTIVE or PAUSED' }, { status: 400 })

    const newStatus = typeof status === 'string' ? status : existing.status
    const hasActiveSip = newStatus === 'ACTIVE'

    const [sip] = await prisma.$transaction([
      prisma.sipConfig.update({
        where: { fundId: id },
        data: {
          ...(typeof amount     === 'number'  ? { amount }     : {}),
          ...(typeof dayOfMonth === 'number'  ? { dayOfMonth } : {}),
          ...(typeof status     === 'string'  ? { status }     : {}),
        },
      }),
      prisma.mutualFund.update({
        where: { id },
        data:  { hasActiveSip },
      }),
    ])

    return NextResponse.json({ sip })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const existing = await prisma.sipConfig.findUnique({ where: { fundId: id } })
    if (!existing) return NextResponse.json({ error: 'No SIP configured for this fund' }, { status: 404 })

    await prisma.$transaction([
      prisma.sipConfig.delete({ where: { fundId: id } }),
      prisma.mutualFund.update({ where: { id }, data: { hasActiveSip: false } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}
