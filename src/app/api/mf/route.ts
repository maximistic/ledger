export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BUY_TYPES  = new Set(['SIP', 'LUMPSUM', 'SWITCH_IN', 'DIVIDEND'])
const SELL_TYPES = new Set(['REDEMPTION', 'SWITCH_OUT'])

export async function GET() {
  try {
    const funds = await prisma.mutualFund.findMany({
      orderBy: { name: 'asc' },
      include: {
        sipConfig:    true,
        transactions: { select: { type: true } },
      },
    })

    const result = funds.map(({ transactions, ...fund }) => {
      const gainLoss    = fund.currentValue - fund.investedValue
      const gainLossPct = fund.investedValue > 0 ? (gainLoss / fund.investedValue) * 100 : 0
      const hasSIPTx     = transactions.some(t => t.type === 'SIP')
      const hasLumpsumTx = transactions.some(t => t.type === 'LUMPSUM')
      return { ...fund, gainLoss, gainLossPct, hasSIPTx, hasLumpsumTx }
    })

    const totalCurrentValue = result.reduce((s, f) => s + f.currentValue, 0)
    const totalInvested     = result.reduce((s, f) => s + f.investedValue, 0)
    const totalGainLoss     = totalCurrentValue - totalInvested
    const totalGainLossPct  = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

    return NextResponse.json({
      funds: result,
      totals: { totalCurrentValue, totalInvested, totalGainLoss, totalGainLossPct, count: result.length },
    })
  } catch (error) {
    console.error('[GET /api/mf]', error)
    return NextResponse.json({ error: 'Failed to load funds' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown; amfiCode?: unknown; isin?: unknown; folioNumber?: unknown
      platform?: unknown; fundHouse?: unknown; fundCategory?: unknown
      units?: unknown; avgNav?: unknown; investedValue?: unknown
      firstInvestmentDate?: unknown; source?: unknown
    }

    console.log('[POST /api/mf] body:', JSON.stringify(body))

    const name          = typeof body.name === 'string' ? body.name.trim() : ''
    const units         = parseFloat(String(body.units ?? ''))
    const avgNav        = parseFloat(String(body.avgNav ?? ''))
    const investedValue = parseFloat(String(body.investedValue ?? ''))

    if (!name)
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    if (!Number.isFinite(units) || units <= 0)
      return NextResponse.json({ error: 'Units must be positive' }, { status: 400 })
    if (!Number.isFinite(avgNav) || avgNav <= 0)
      return NextResponse.json({ error: 'Avg NAV must be positive' }, { status: 400 })
    if (!Number.isFinite(investedValue) || investedValue <= 0)
      return NextResponse.json({ error: 'Invested value must be positive' }, { status: 400 })

    let firstDate: Date | null = null
    if (typeof body.firstInvestmentDate === 'string' && body.firstInvestmentDate) {
      const d = new Date(body.firstInvestmentDate)
      if (!isNaN(d.getTime())) firstDate = d
    }

    const str = (v: unknown) =>
      typeof v === 'string' && v.trim() ? v.trim() : null

    const fund = await prisma.mutualFund.create({
      data: {
        name,
        amfiCode:           str(body.amfiCode),
        isin:               str(body.isin)?.toUpperCase() ?? null,
        folioNumber:        str(body.folioNumber),
        platform:           str(body.platform),
        fundHouse:          str(body.fundHouse),
        fundCategory:       str(body.fundCategory),
        units,
        avgNav,
        currentNav:         avgNav,
        investedValue,
        currentValue:       units * avgNav,
        firstInvestmentDate: firstDate,
        source:             str(body.source) ?? 'MANUAL',
      },
    })

    console.log('[POST /api/mf] created fund:', fund.id)

    if (fund.amfiCode) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${appUrl}/api/mf/${fund.id}/refresh-meta`).catch(() => {})
    }

    return NextResponse.json({ fund }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/mf]', error)
    return NextResponse.json({ error: 'Failed to create fund' }, { status: 500 })
  }
}

export { BUY_TYPES, SELL_TYPES }
