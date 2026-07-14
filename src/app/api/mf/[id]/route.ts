import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mfApiError } from '@/lib/mfUtils'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({
      where:   { id },
      include: { transactions: { orderBy: { date: 'desc' } }, sipConfig: true },
    })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })
    return NextResponse.json({ fund })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const existing = await prisma.mutualFund.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const body = await request.json() as {
      name?: unknown; isin?: unknown; folioNumber?: unknown; platform?: unknown
      fundHouse?: unknown; fundCategory?: unknown; expenseRatio?: unknown; exitLoad?: unknown
      units?: unknown; avgNav?: unknown; currentNav?: unknown; investedValue?: unknown
      hasActiveSip?: unknown; amfiCode?: unknown
    }

    const units      = typeof body.units      === 'number' ? body.units      : existing.units
    const currentNav = typeof body.currentNav === 'number' ? body.currentNav : existing.currentNav
    const currentValue = isFinite(units * currentNav) ? units * currentNav : 0

    const fund = await prisma.mutualFund.update({
      where: { id },
      data: {
        ...(typeof body.name          === 'string'  ? { name:         body.name.trim() }                          : {}),
        ...(typeof body.isin          === 'string'  ? { isin:         body.isin.trim().toUpperCase() || null }     : {}),
        ...(typeof body.folioNumber   === 'string'  ? { folioNumber:  body.folioNumber.trim() || null }           : {}),
        ...(typeof body.platform      === 'string'  ? { platform:     body.platform.trim() || null }              : {}),
        ...(typeof body.fundHouse     === 'string'  ? { fundHouse:    body.fundHouse.trim() || null }             : {}),
        ...(typeof body.fundCategory  === 'string'  ? { fundCategory: body.fundCategory.trim() || null }          : {}),
        ...(typeof body.expenseRatio  === 'number'  ? { expenseRatio: body.expenseRatio }                         : {}),
        ...(typeof body.exitLoad      === 'string'  ? { exitLoad:     body.exitLoad.trim() || null }              : {}),
        ...(typeof body.avgNav        === 'number'  ? { avgNav:       body.avgNav }                               : {}),
        ...(typeof body.investedValue === 'number'  ? { investedValue: body.investedValue }                       : {}),
        ...(typeof body.hasActiveSip  === 'boolean' ? { hasActiveSip: body.hasActiveSip }                         : {}),
        ...(typeof body.amfiCode      === 'string'  ? { amfiCode:     body.amfiCode.trim() || null }              : {}),
        units,
        currentNav,
        currentValue,
      },
    })

    return NextResponse.json({ fund })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
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
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}
