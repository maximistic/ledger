export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

const BUY_TYPES  = new Set(['SIP', 'LUMPSUM', 'SWITCH_IN', 'DIVIDEND', 'CORRECTION'])
const SELL_TYPES = new Set(['REDEMPTION', 'SWITCH_OUT'])

function recalcFund(txns: Array<{ type: string; units: number; nav: number; amount: number }>) {
  const buys  = txns.filter(t => BUY_TYPES.has(t.type))
  const sells = txns.filter(t => SELL_TYPES.has(t.type))

  const totalBuyUnits  = buys.reduce((s, t) => s + t.units, 0)
  const totalSellUnits = sells.reduce((s, t) => s + t.units, 0)
  const totalBuyAmt    = buys.reduce((s, t) => s + t.amount, 0)
  const totalSellAmt   = sells.reduce((s, t) => s + t.amount, 0)
  const weightedNav    = buys.reduce((s, t) => s + t.units * t.nav, 0)

  const units         = totalBuyUnits - totalSellUnits
  const avgNav        = totalBuyUnits > 0 ? weightedNav / totalBuyUnits : 0
  const investedValue = totalBuyAmt - totalSellAmt

  return { units, avgNav, investedValue }
}

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

    let firstDate: Date | null | undefined = undefined
    if (typeof body.firstInvestmentDate === 'string') {
      const d = new Date(body.firstInvestmentDate)
      firstDate = isNaN(d.getTime()) ? null : d
    }

    // Metadata fields that are always applied unconditionally
    const metaData = {
      ...(str(body.name)         !== null ? { name:         str(body.name)! }               : {}),
      ...(str(body.isin)         !== null ? { isin:         str(body.isin)!.toUpperCase() }  : {}),
      ...(str(body.folioNumber)  !== null ? { folioNumber:  str(body.folioNumber) }         : {}),
      ...(str(body.platform)     !== null ? { platform:     str(body.platform) }             : {}),
      ...(str(body.fundHouse)    !== null ? { fundHouse:    str(body.fundHouse) }            : {}),
      ...(str(body.fundCategory) !== null ? { fundCategory: str(body.fundCategory) }         : {}),
      ...(str(body.amfiCode)     !== null ? { amfiCode:     str(body.amfiCode) }             : {}),
      ...(firstDate !== undefined ? { firstInvestmentDate: firstDate } : {}),
    }

    const isMetricEdit =
      typeof body.units === 'number' ||
      typeof body.avgNav === 'number' ||
      typeof body.investedValue === 'number'

    let fund

    if (isMetricEdit) {
      // Submitted target values (fall back to existing when not provided)
      const submittedUnits         = typeof body.units === 'number'         ? body.units         : existing.units
      const submittedAvgNav        = typeof body.avgNav === 'number'        ? body.avgNav        : existing.avgNav
      const submittedInvestedValue = typeof body.investedValue === 'number' ? body.investedValue : existing.investedValue

      // Step 1: remove any existing CORRECTION so it doesn't affect the organic baseline
      await prisma.mutualFundTransaction.deleteMany({ where: { fundId: id, type: 'CORRECTION' } })

      // Step 2: compute organic totals from all real transactions
      const organicTxns = await prisma.mutualFundTransaction.findMany({
        where:  { fundId: id },
        select: { type: true, units: true, nav: true, amount: true },
      })
      const organic = recalcFund(organicTxns)

      // Step 3: delta between what the user wants and what transactions alone produce
      const deltaUnits         = submittedUnits         - organic.units
      const deltaInvestedValue = submittedInvestedValue - organic.investedValue

      // Step 4: create a CORRECTION transaction if either dimension differs
      if (Math.abs(deltaInvestedValue) > 0.001 || Math.abs(deltaUnits) > 0.0001) {
        await prisma.mutualFundTransaction.create({
          data: {
            fundId:      id,
            date:        new Date(),
            type:        'CORRECTION',
            units:       deltaUnits,
            nav:         submittedAvgNav > 0 ? submittedAvgNav : 1,
            amount:      deltaInvestedValue,
            autoCreated: true,
          },
        })
      }

      // Step 5: recompute from ALL transactions (organic + CORRECTION if created)
      const allTxns = await prisma.mutualFundTransaction.findMany({
        where:  { fundId: id },
        select: { type: true, units: true, nav: true, amount: true },
      })
      const metrics  = recalcFund(allTxns)
      const safeUnits = Math.max(0, metrics.units)
      const currentValue = safeUnits * (existing.currentNav > 0 ? existing.currentNav : (metrics.avgNav > 0 ? metrics.avgNav : submittedAvgNav))

      fund = await prisma.mutualFund.update({
        where: { id },
        data: {
          ...metaData,
          units:         safeUnits,
          avgNav:        metrics.avgNav > 0 ? metrics.avgNav : (submittedAvgNav > 0 ? submittedAvgNav : existing.avgNav),
          investedValue: Math.max(0, metrics.investedValue),
          currentValue,
        },
      })
    } else {
      // NAV-only or metadata-only edit — apply directly, no transaction involvement
      const currentUnits = existing.units
      fund = await prisma.mutualFund.update({
        where: { id },
        data: {
          ...metaData,
          ...(newCurrentNav !== null && Number.isFinite(newCurrentNav) && newCurrentNav > 0 ? {
            currentNav:       newCurrentNav,
            currentValue:     currentUnits * newCurrentNav,
            lastNavUpdatedAt: new Date(),
          } : {}),
        },
      })
    }

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
