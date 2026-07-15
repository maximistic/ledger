import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateRDCurrentValue, calculateRDMaturityValue } from '@/lib/fdCalculator'

type Ctx = { params: Promise<{ id: string }> }

function tenureMonthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

function apiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const rd = await prisma.rDAccount.findUnique({
      where:   { id },
      include: { topUps: true },
    })
    if (!rd) return NextResponse.json({ error: 'RD not found' }, { status: 404 })

    const body = await request.json() as {
      amount?: unknown; startDate?: unknown; isRecurring?: unknown; notes?: unknown
    }

    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    if (typeof body.startDate !== 'string' || !body.startDate) {
      return NextResponse.json({ error: 'startDate is required' }, { status: 400 })
    }

    const topUpStart = new Date(body.startDate)
    if (isNaN(topUpStart.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })

    const topUp = await prisma.rDTopUp.create({
      data: {
        rdId:        id,
        amount:      body.amount,
        startDate:   topUpStart,
        isRecurring: typeof body.isRecurring === 'boolean' ? body.isRecurring : false,
        notes:       typeof body.notes === 'string' ? body.notes : null,
      },
    })

    // Recalculate with all topUps including the new one
    const allTopUps = [...rd.topUps, topUp]
    const { currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
      monthlyAmount: rd.monthlyAmount,
      annualRate:    rd.interestRate,
      startDate:     rd.startDate,
      dayOfMonth:    rd.dayOfMonth,
      topUps:        allTopUps,
    })
    const maturityValue = calculateRDMaturityValue({
      monthlyAmount: rd.monthlyAmount,
      annualRate:    rd.interestRate,
      startDate:     rd.startDate,
      dayOfMonth:    rd.dayOfMonth,
      topUps:        allTopUps,
      maturityDate:  rd.maturityDate,
    })

    const updatedRd = await prisma.rDAccount.update({
      where:   { id },
      data:    { currentValue, totalInvested, maturityValue, interestEarned },
      include: { topUps: true },
    })

    return NextResponse.json({ topUp, rd: updatedRd }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
