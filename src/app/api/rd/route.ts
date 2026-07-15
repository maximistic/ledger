import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateRDCurrentValue, calculateRDMaturityValue } from '@/lib/fdCalculator'

function tenureMonthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

function apiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}

export async function GET() {
  try {
    const rds = await prisma.rDAccount.findMany({
      orderBy: { maturityDate: 'asc' },
      include: { topUps: true },
    })

    const enriched = rds.map(rd => {
      const { currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
        monthlyAmount: rd.monthlyAmount,
        annualRate:    rd.interestRate,
        startDate:     rd.startDate,
        dayOfMonth:    rd.dayOfMonth,
        topUps:        rd.topUps,
      })
      return { ...rd, currentValue, totalInvested, interestEarned }
    })

    const totals = {
      totalInvested:       Math.round(enriched.reduce((s, r) => s + r.totalInvested, 0) * 100) / 100,
      totalCurrentValue:   Math.round(enriched.reduce((s, r) => s + r.currentValue, 0) * 100) / 100,
      totalInterestEarned: Math.round(enriched.reduce((s, r) => s + r.interestEarned, 0) * 100) / 100,
      count: enriched.length,
    }

    return NextResponse.json({ rds: enriched, totals })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown; bankName?: unknown; platform?: unknown; monthlyAmount?: unknown
      interestRate?: unknown; startDate?: unknown; maturityDate?: unknown
      dayOfMonth?: unknown; isAutoRenew?: unknown; notes?: unknown
      topUps?: unknown
    }

    const { name, bankName, platform, monthlyAmount, interestRate, startDate, maturityDate, dayOfMonth, isAutoRenew, notes, topUps } = body

    if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (typeof bankName !== 'string' || !bankName.trim()) return NextResponse.json({ error: 'bankName is required' }, { status: 400 })
    if (typeof platform !== 'string' || !platform.trim()) return NextResponse.json({ error: 'platform is required' }, { status: 400 })
    if (typeof startDate !== 'string' || !startDate) return NextResponse.json({ error: 'startDate is required' }, { status: 400 })
    if (typeof maturityDate !== 'string' || !maturityDate) return NextResponse.json({ error: 'maturityDate is required' }, { status: 400 })
    if (typeof monthlyAmount !== 'number' || monthlyAmount <= 0) return NextResponse.json({ error: 'monthlyAmount must be a positive number' }, { status: 400 })
    if (typeof interestRate !== 'number' || interestRate <= 0) return NextResponse.json({ error: 'interestRate must be a positive number' }, { status: 400 })

    const start   = new Date(startDate)
    const maturity = new Date(maturityDate)
    if (isNaN(start.getTime()))   return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
    if (isNaN(maturity.getTime())) return NextResponse.json({ error: 'Invalid maturityDate' }, { status: 400 })
    if (maturity <= start) return NextResponse.json({ error: 'maturityDate must be after startDate' }, { status: 400 })

    const dom = typeof dayOfMonth === 'number' ? dayOfMonth : 1

    type TopUpInput = { amount: number; startDate: string; isRecurring: boolean; notes?: string }
    const topUpList: TopUpInput[] = Array.isArray(topUps) ? topUps as TopUpInput[] : []

    for (const t of topUpList) {
      if (typeof t.amount !== 'number' || t.amount <= 0) {
        return NextResponse.json({ error: 'Each topUp.amount must be a positive number' }, { status: 400 })
      }
    }

    const parsedTopUps = topUpList.map(t => ({
      amount:      t.amount,
      startDate:   new Date(t.startDate),
      isRecurring: Boolean(t.isRecurring),
    }))

    const tenureMonths = tenureMonthsBetween(start, maturity)
    const { currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
      monthlyAmount, annualRate: interestRate, startDate: start, dayOfMonth: dom, topUps: parsedTopUps,
    })
    const maturityValue = calculateRDMaturityValue({
      monthlyAmount, annualRate: interestRate, startDate: start, dayOfMonth: dom, topUps: parsedTopUps, maturityDate: maturity,
    })

    const rd = await prisma.rDAccount.create({
      data: {
        name: name.trim(),
        bankName: bankName.trim(),
        platform: platform.trim(),
        monthlyAmount,
        interestRate,
        startDate: start,
        maturityDate: maturity,
        tenureMonths,
        dayOfMonth: dom,
        currentValue,
        totalInvested,
        maturityValue,
        interestEarned,
        isAutoRenew: typeof isAutoRenew === 'boolean' ? isAutoRenew : false,
        notes: typeof notes === 'string' ? notes : null,
        topUps: topUpList.length > 0 ? {
          create: topUpList.map(t => ({
            amount:      t.amount,
            startDate:   new Date(t.startDate),
            isRecurring: Boolean(t.isRecurring),
            notes:       typeof t.notes === 'string' ? t.notes : null,
          })),
        } : undefined,
      },
      include: { topUps: true },
    })

    return NextResponse.json({ rd }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
