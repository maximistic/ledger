import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateRDCurrentValue, calculateRDMaturityValue, calculateFrozenCorpusValue } from '@/lib/fdCalculator'

type Ctx = { params: Promise<{ id: string }> }

function tenureMonthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

function apiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const rd = await prisma.rDAccount.findUnique({
      where:   { id },
      include: { topUps: true },
    })
    if (!rd) return NextResponse.json({ error: 'RD not found' }, { status: 404 })

    let currentValue: number, totalInvested: number, interestEarned: number
    if (rd.status === 'PAUSED' && rd.frozenCorpus != null && rd.pausedAt != null) {
      currentValue   = Math.round(calculateFrozenCorpusValue(rd.frozenCorpus, rd.interestRate, rd.pausedAt) * 100) / 100
      totalInvested  = rd.totalInvested   // raw principal, frozen at pause
      interestEarned = Math.round((currentValue - rd.totalInvested) * 100) / 100
    } else {
      ;({ currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
        monthlyAmount: rd.monthlyAmount,
        annualRate:    rd.interestRate,
        startDate:     rd.startDate,
        dayOfMonth:    rd.dayOfMonth,
        topUps:        rd.topUps,
      }))
    }

    return NextResponse.json({ rd: { ...rd, currentValue, totalInvested, interestEarned } })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.rDAccount.findUnique({
      where:   { id },
      include: { topUps: true },
    })
    if (!existing) return NextResponse.json({ error: 'RD not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; bankName?: unknown; platform?: unknown; monthlyAmount?: unknown
      interestRate?: unknown; startDate?: unknown; maturityDate?: unknown
      dayOfMonth?: unknown; isAutoRenew?: unknown; notes?: unknown; status?: unknown
    }

    // ── Pause transition ──────────────────────────────────────────────────────
    if (body.status === 'PAUSED' && existing.status !== 'PAUSED') {
      const pausedAt = new Date()
      const snapshot = calculateRDCurrentValue({
        monthlyAmount: existing.monthlyAmount,
        annualRate:    existing.interestRate,
        startDate:     existing.startDate,
        dayOfMonth:    existing.dayOfMonth,
        topUps:        existing.topUps,
        asOf:          pausedAt,
      })
      // frozenCorpus = full corpus at pause time (principal + all pre-pause interest)
      // so post-pause compounding starts from the correct base
      const frozenCorpus    = snapshot.currentValue
      const frozenInvested  = snapshot.totalInvested
      const currentValue    = frozenCorpus  // at t=0 since pause, corpus hasn't grown yet
      const interestEarned  = Math.round((currentValue - frozenInvested) * 100) / 100
      const rd = await prisma.rDAccount.update({
        where: { id },
        data:  { status: 'PAUSED', pausedAt, frozenCorpus, currentValue, totalInvested: frozenInvested, interestEarned },
        include: { topUps: true },
      })
      return NextResponse.json({ rd })
    }

    // ── Regular edit ──────────────────────────────────────────────────────────
    const ma      = typeof body.monthlyAmount === 'number' ? body.monthlyAmount : existing.monthlyAmount
    const r       = typeof body.interestRate  === 'number' ? body.interestRate  : existing.interestRate
    const dom     = typeof body.dayOfMonth    === 'number' ? body.dayOfMonth    : existing.dayOfMonth
    const start   = typeof body.startDate     === 'string' ? new Date(body.startDate)   : existing.startDate
    const maturity = typeof body.maturityDate === 'string' ? new Date(body.maturityDate) : existing.maturityDate

    const { currentValue, totalInvested, interestEarned } = calculateRDCurrentValue({
      monthlyAmount: ma, annualRate: r, startDate: start, dayOfMonth: dom, topUps: existing.topUps,
    })
    const maturityValue = calculateRDMaturityValue({
      monthlyAmount: ma, annualRate: r, startDate: start, dayOfMonth: dom, topUps: existing.topUps, maturityDate: maturity,
    })

    const rd = await prisma.rDAccount.update({
      where: { id },
      data: {
        ...(typeof body.name          === 'string'  ? { name:          body.name.trim() }          : {}),
        ...(typeof body.bankName      === 'string'  ? { bankName:      body.bankName.trim() }      : {}),
        ...(typeof body.platform      === 'string'  ? { platform:      body.platform.trim() }      : {}),
        ...(typeof body.monthlyAmount === 'number'  ? { monthlyAmount: body.monthlyAmount }         : {}),
        ...(typeof body.interestRate  === 'number'  ? { interestRate:  body.interestRate }          : {}),
        ...(typeof body.dayOfMonth    === 'number'  ? { dayOfMonth:    body.dayOfMonth }            : {}),
        ...(typeof body.startDate     === 'string'  ? { startDate:     start }                      : {}),
        ...(typeof body.maturityDate  === 'string'  ? { maturityDate:  maturity }                   : {}),
        ...(typeof body.isAutoRenew   === 'boolean' ? { isAutoRenew:   body.isAutoRenew }           : {}),
        ...(body.notes !== undefined                ? { notes:         body.notes as string | null } : {}),
        tenureMonths: tenureMonthsBetween(start, maturity),
        currentValue,
        totalInvested,
        maturityValue,
        interestEarned,
      },
      include: { topUps: true },
    })

    return NextResponse.json({ rd })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.rDAccount.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'RD not found' }, { status: 404 })

    await prisma.rDAccount.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
