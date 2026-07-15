import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateRDCurrentValue, calculateRDMaturityValue } from '@/lib/fdCalculator'

type Ctx = { params: Promise<{ id: string; topUpId: string }> }

function apiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id, topUpId } = await params

    const rd = await prisma.rDAccount.findUnique({
      where:   { id },
      include: { topUps: true },
    })
    if (!rd) return NextResponse.json({ error: 'RD not found' }, { status: 404 })

    const topUp = rd.topUps.find(t => t.id === topUpId)
    if (!topUp) return NextResponse.json({ error: 'Top-up not found' }, { status: 404 })

    await prisma.rDTopUp.delete({ where: { id: topUpId } })

    const remainingTopUps = rd.topUps.filter(t => t.id !== topUpId)
    const { currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
      monthlyAmount: rd.monthlyAmount,
      annualRate:    rd.interestRate,
      startDate:     rd.startDate,
      dayOfMonth:    rd.dayOfMonth,
      topUps:        remainingTopUps,
    })
    const maturityValue = calculateRDMaturityValue({
      monthlyAmount: rd.monthlyAmount,
      annualRate:    rd.interestRate,
      startDate:     rd.startDate,
      dayOfMonth:    rd.dayOfMonth,
      topUps:        remainingTopUps,
      maturityDate:  rd.maturityDate,
    })

    const updatedRd = await prisma.rDAccount.update({
      where:   { id },
      data:    { currentValue, totalInvested, maturityValue, interestEarned },
      include: { topUps: true },
    })

    return NextResponse.json({ success: true, rd: updatedRd })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
