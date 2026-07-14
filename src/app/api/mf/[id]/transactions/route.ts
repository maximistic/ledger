import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateMFMetrics, mfApiError, MF_VALID_TYPES } from '@/lib/mfUtils'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const transactions = await prisma.mutualFundTransaction.findMany({
      where:   { fundId: id },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({ transactions })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const body = await request.json() as {
      date?: unknown; type?: unknown; units?: unknown
      nav?: unknown; amount?: unknown; description?: unknown
    }

    const { date, type, units, nav, amount, description } = body

    if (!date || typeof date !== 'string')
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    if (!type || typeof type !== 'string' || !MF_VALID_TYPES.has(type))
      return NextResponse.json({ error: `type must be one of: ${[...MF_VALID_TYPES].join(', ')}` }, { status: 400 })
    if (typeof units !== 'number' || units <= 0)
      return NextResponse.json({ error: 'units must be > 0' }, { status: 400 })
    if (typeof nav !== 'number' || nav <= 0)
      return NextResponse.json({ error: 'nav must be > 0' }, { status: 400 })
    if (typeof amount !== 'number' || amount <= 0)
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime()))
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    // Duplicate check: same fundId + date + type + units + nav
    const existingTxns = await prisma.mutualFundTransaction.findMany({ where: { fundId: id } })
    const txKey = (t: { date: Date | string; type: string; units: number; nav: number }) =>
      `${new Date(t.date).toISOString().slice(0, 10)}|${t.type}|${t.units}|${t.nav}`
    const newKey = `${parsedDate.toISOString().slice(0, 10)}|${type}|${units}|${nav}`
    if (existingTxns.some(t => txKey(t) === newKey))
      return NextResponse.json({ error: 'Transaction already exists' }, { status: 400 })

    const transaction = await prisma.mutualFundTransaction.create({
      data: {
        fundId:      id,
        date:        parsedDate,
        type,
        units:       units as number,
        nav:         nav   as number,
        amount:      amount as number,
        description: typeof description === 'string' ? description.trim() || null : null,
      },
    })

    const allTxns = await prisma.mutualFundTransaction.findMany({ where: { fundId: id } })
    const metrics = calculateMFMetrics(allTxns)

    if (metrics.units < 0) {
      await prisma.mutualFundTransaction.delete({ where: { id: transaction.id } })
      return NextResponse.json({ error: 'Transaction would result in negative units' }, { status: 400 })
    }

    const safeUnits    = isFinite(metrics.units)         ? metrics.units         : 0
    const safeAvgNav   = isFinite(metrics.avgNav)  && metrics.avgNav > 0  ? metrics.avgNav  : fund.avgNav
    const safeIV       = isFinite(metrics.investedValue) ? metrics.investedValue : 0
    const safeNavForCV = fund.currentNav > 0 ? fund.currentNav : safeAvgNav
    const currentValue = safeUnits * safeNavForCV

    const updatedFund = await prisma.mutualFund.update({
      where: { id },
      data:  { units: safeUnits, avgNav: safeAvgNav, investedValue: safeIV, currentValue },
    })

    return NextResponse.json({ transaction, fund: updatedFund }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}
