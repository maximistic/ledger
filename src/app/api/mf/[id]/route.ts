export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { date: 'desc' } },
        sipConfig: true,
      },
    })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })
    return NextResponse.json({ fund })
  } catch (error) {
    console.error('[GET /api/mf/[id]]', error)
    return NextResponse.json({ error: 'Failed to load fund' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.mutualFund.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; isin?: unknown; folioNumber?: unknown; platform?: unknown
      fundHouse?: unknown; fundCategory?: unknown; amfiCode?: unknown
      units?: unknown; avgNav?: unknown; investedValue?: unknown
      currentNav?: unknown; firstInvestmentDate?: unknown
    }

    const str = (v: unknown) =>
      typeof v === 'string' && v.trim() ? v.trim() : null

    const newCurrentNav = typeof body.currentNav === 'number'
      ? body.currentNav
      : typeof body.currentNav === 'string'
        ? parseFloat(body.currentNav)
        : null

    const units = typeof body.units === 'number' ? body.units : existing.units

    let firstDate: Date | null | undefined = undefined
    if (typeof body.firstInvestmentDate === 'string') {
      const d = new Date(body.firstInvestmentDate)
      firstDate = isNaN(d.getTime()) ? null : d
    }

    const fund = await prisma.mutualFund.update({
      where: { id },
      data: {
        ...(str(body.name)         !== null ? { name:         str(body.name)! }              : {}),
        ...(str(body.isin)         !== null ? { isin:         str(body.isin)!.toUpperCase() } : {}),
        ...(str(body.folioNumber)  !== null ? { folioNumber:  str(body.folioNumber) }        : {}),
        ...(str(body.platform)     !== null ? { platform:     str(body.platform) }            : {}),
        ...(str(body.fundHouse)    !== null ? { fundHouse:    str(body.fundHouse) }           : {}),
        ...(str(body.fundCategory) !== null ? { fundCategory: str(body.fundCategory) }        : {}),
        ...(str(body.amfiCode)     !== null ? { amfiCode:     str(body.amfiCode) }            : {}),
        ...(typeof body.units === 'number'         ? { units:         body.units }           : {}),
        ...(typeof body.avgNav === 'number'        ? { avgNav:        body.avgNav }           : {}),
        ...(typeof body.investedValue === 'number' ? { investedValue: body.investedValue }    : {}),
        ...(firstDate !== undefined ? { firstInvestmentDate: firstDate } : {}),
        ...(newCurrentNav !== null && Number.isFinite(newCurrentNav) && newCurrentNav > 0 ? {
          currentNav:      newCurrentNav,
          currentValue:    units * newCurrentNav,
          lastNavUpdatedAt: new Date(),
        } : {}),
      },
    })

    return NextResponse.json({ fund })
  } catch (error) {
    console.error('[PUT /api/mf/[id]]', error)
    return NextResponse.json({ error: 'Failed to update fund' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.mutualFund.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })
    await prisma.mutualFund.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/mf/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete fund' }, { status: 500 })
  }
}
