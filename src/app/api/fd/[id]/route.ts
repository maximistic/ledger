import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateFDCurrentValue, calculateFDMaturityValue } from '@/lib/fdCalculator'

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
    const fd = await prisma.fDAccount.findUnique({ where: { id } })
    if (!fd) return NextResponse.json({ error: 'FD not found' }, { status: 404 })

    const { currentValue, interestEarned } = calculateFDCurrentValue({
      principal: fd.principal,
      annualRate: fd.interestRate,
      startDate: fd.startDate,
      compoundingType: fd.compoundingType,
    })

    return NextResponse.json({ fd: { ...fd, currentValue, interestEarned } })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.fDAccount.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'FD not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; bankName?: unknown; platform?: unknown; principal?: unknown
      interestRate?: unknown; compoundingType?: unknown; fdType?: unknown
      startDate?: unknown; maturityDate?: unknown; isAutoRenew?: unknown; notes?: unknown
    }

    const p  = typeof body.principal    === 'number' ? body.principal    : existing.principal
    const r  = typeof body.interestRate === 'number' ? body.interestRate : existing.interestRate
    const ct = typeof body.compoundingType === 'string' ? body.compoundingType : existing.compoundingType
    const start   = typeof body.startDate   === 'string' ? new Date(body.startDate)   : existing.startDate
    const maturity = typeof body.maturityDate === 'string' ? new Date(body.maturityDate) : existing.maturityDate

    const { currentValue, interestEarned } = calculateFDCurrentValue({
      principal: p, annualRate: r, startDate: start, compoundingType: ct,
    })
    const maturityValue = calculateFDMaturityValue({
      principal: p, annualRate: r, startDate: start, compoundingType: ct, maturityDate: maturity,
    })

    const fd = await prisma.fDAccount.update({
      where: { id },
      data: {
        ...(typeof body.name            === 'string'  ? { name:            body.name.trim() }            : {}),
        ...(typeof body.bankName        === 'string'  ? { bankName:        body.bankName.trim() }        : {}),
        ...(typeof body.platform        === 'string'  ? { platform:        body.platform.trim() }        : {}),
        ...(typeof body.principal       === 'number'  ? { principal:       body.principal }              : {}),
        ...(typeof body.interestRate    === 'number'  ? { interestRate:    body.interestRate }           : {}),
        ...(typeof body.compoundingType === 'string'  ? { compoundingType: body.compoundingType }        : {}),
        ...(typeof body.fdType          === 'string'  ? { fdType:          body.fdType }                 : {}),
        ...(typeof body.startDate       === 'string'  ? { startDate:       start }                       : {}),
        ...(typeof body.maturityDate    === 'string'  ? { maturityDate:    maturity }                    : {}),
        ...(typeof body.isAutoRenew     === 'boolean' ? { isAutoRenew:     body.isAutoRenew }            : {}),
        ...(body.notes !== undefined                  ? { notes:           body.notes as string | null } : {}),
        tenureMonths: tenureMonthsBetween(start, maturity),
        currentValue,
        maturityValue,
        interestEarned,
      },
    })

    return NextResponse.json({ fd })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.fDAccount.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'FD not found' }, { status: 404 })

    await prisma.fDAccount.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 })
  }
}
