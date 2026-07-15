import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateFDCurrentValue, calculateFDMaturityValue } from '@/lib/fdCalculator'

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
    const fds = await prisma.fDAccount.findMany({ orderBy: { maturityDate: 'asc' } })

    const enriched = fds.map(fd => {
      const { currentValue, interestEarned } = calculateFDCurrentValue({
        principal: fd.principal,
        annualRate: fd.interestRate,
        startDate: fd.startDate,
        compoundingType: fd.compoundingType,
      })
      return { ...fd, currentValue, interestEarned }
    })

    const totals = {
      totalPrincipal:      Math.round(enriched.reduce((s, f) => s + f.principal, 0) * 100) / 100,
      totalCurrentValue:   Math.round(enriched.reduce((s, f) => s + f.currentValue, 0) * 100) / 100,
      totalInterestEarned: Math.round(enriched.reduce((s, f) => s + f.interestEarned, 0) * 100) / 100,
      count: enriched.length,
    }

    return NextResponse.json({ fds: enriched, totals })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown; bankName?: unknown; platform?: unknown; principal?: unknown
      interestRate?: unknown; compoundingType?: unknown; fdType?: unknown
      startDate?: unknown; maturityDate?: unknown; isAutoRenew?: unknown; notes?: unknown
    }

    const { name, bankName, platform, principal, interestRate, compoundingType, fdType, startDate, maturityDate, isAutoRenew, notes } = body

    if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (typeof bankName !== 'string' || !bankName.trim()) return NextResponse.json({ error: 'bankName is required' }, { status: 400 })
    if (typeof platform !== 'string' || !platform.trim()) return NextResponse.json({ error: 'platform is required' }, { status: 400 })
    if (typeof compoundingType !== 'string' || !compoundingType.trim()) return NextResponse.json({ error: 'compoundingType is required' }, { status: 400 })
    if (typeof fdType !== 'string' || !fdType.trim()) return NextResponse.json({ error: 'fdType is required' }, { status: 400 })
    if (typeof startDate !== 'string' || !startDate) return NextResponse.json({ error: 'startDate is required' }, { status: 400 })
    if (typeof maturityDate !== 'string' || !maturityDate) return NextResponse.json({ error: 'maturityDate is required' }, { status: 400 })
    if (typeof principal !== 'number' || principal <= 0) return NextResponse.json({ error: 'principal must be a positive number' }, { status: 400 })
    if (typeof interestRate !== 'number' || interestRate <= 0) return NextResponse.json({ error: 'interestRate must be a positive number' }, { status: 400 })

    const start = new Date(startDate)
    const maturity = new Date(maturityDate)
    if (isNaN(start.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
    if (isNaN(maturity.getTime())) return NextResponse.json({ error: 'Invalid maturityDate' }, { status: 400 })
    if (maturity <= start) return NextResponse.json({ error: 'maturityDate must be after startDate' }, { status: 400 })

    const tenureMonths = tenureMonthsBetween(start, maturity)
    const { currentValue, interestEarned } = calculateFDCurrentValue({
      principal, annualRate: interestRate, startDate: start, compoundingType,
    })
    const maturityValue = calculateFDMaturityValue({
      principal, annualRate: interestRate, startDate: start, compoundingType, maturityDate: maturity,
    })

    const fd = await prisma.fDAccount.create({
      data: {
        name: name.trim(),
        bankName: bankName.trim(),
        platform: platform.trim(),
        principal,
        interestRate,
        compoundingType,
        fdType,
        startDate: start,
        maturityDate: maturity,
        tenureMonths,
        currentValue,
        maturityValue,
        interestEarned,
        isAutoRenew: typeof isAutoRenew === 'boolean' ? isAutoRenew : false,
        notes: typeof notes === 'string' ? notes : null,
      },
    })

    return NextResponse.json({ fd }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
