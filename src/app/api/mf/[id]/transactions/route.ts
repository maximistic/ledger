export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

const BUY_TYPES  = new Set(['SIP', 'LUMPSUM', 'SWITCH_IN', 'DIVIDEND'])
const SELL_TYPES = new Set(['REDEMPTION', 'SWITCH_OUT'])
const VALID_TYPES = new Set([...BUY_TYPES, ...SELL_TYPES])

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

  return { units, avgNav, investedValue, totalBuyUnits, totalSellUnits }
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const transactions = await prisma.mutualFundTransaction.findMany({
      where: { fundId: id },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[GET /api/mf/[id]/transactions]', error)
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params

    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })

    const body = await request.json() as {
      date?: unknown; type?: unknown; units?: unknown; nav?: unknown
      amount?: unknown; description?: unknown; autoCreated?: unknown
    }

    const txDate = typeof body.date === 'string' ? new Date(body.date) : null
    if (!txDate || isNaN(txDate.getTime()))
      return NextResponse.json({ error: 'Valid date required' }, { status: 400 })

    const txType = typeof body.type === 'string' ? body.type.toUpperCase() : ''
    if (!VALID_TYPES.has(txType))
      return NextResponse.json({ error: `Type must be one of: ${[...VALID_TYPES].join(', ')}` }, { status: 400 })

    const txUnits  = parseFloat(String(body.units ?? ''))
    const txNav    = parseFloat(String(body.nav ?? ''))
    const txAmount = parseFloat(String(body.amount ?? ''))

    if (!Number.isFinite(txUnits) || txUnits <= 0)
      return NextResponse.json({ error: 'Units must be > 0' }, { status: 400 })
    if (!Number.isFinite(txNav) || txNav <= 0)
      return NextResponse.json({ error: 'NAV must be > 0' }, { status: 400 })
    if (!Number.isFinite(txAmount) || txAmount <= 0)
      return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })

    // Duplicate check
    const dupe = await prisma.mutualFundTransaction.findFirst({
      where: { fundId: id, date: txDate, type: txType, units: txUnits, nav: txNav },
    })
    if (dupe) return NextResponse.json({ error: 'Duplicate transaction' }, { status: 400 })

    const transaction = await prisma.mutualFundTransaction.create({
      data: {
        fundId:      id,
        date:        txDate,
        type:        txType,
        units:       txUnits,
        nav:         txNav,
        amount:      txAmount,
        description: typeof body.description === 'string' ? body.description : null,
        autoCreated: typeof body.autoCreated === 'boolean' ? body.autoCreated : false,
      },
    })

    // Recalculate fund metrics from all transactions
    const allTxns = await prisma.mutualFundTransaction.findMany({
      where: { fundId: id },
      select: { type: true, units: true, nav: true, amount: true },
    })

    const metrics = recalcFund(allTxns)

    if (metrics.units < -0.0001)
      return NextResponse.json({ error: 'Transaction results in negative units' }, { status: 400 })

    const safeUnits = Math.max(0, metrics.units)
    const currentValue = safeUnits * (fund.currentNav > 0 ? fund.currentNav : metrics.avgNav)

    const updatedFund = await prisma.mutualFund.update({
      where: { id },
      data: {
        units:        safeUnits,
        avgNav:       metrics.avgNav > 0 ? metrics.avgNav : fund.avgNav,
        investedValue: Math.max(0, metrics.investedValue),
        currentValue,
      },
    })

    return NextResponse.json({ transaction, fund: updatedFund }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/mf/[id]/transactions]', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
