import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mfApiError } from '@/lib/mfUtils'

interface MFApiMeta {
  meta: {
    fund_house: string
    scheme_category: string
    scheme_code: number
    scheme_name: string
  }
  data: Array<{ date: string; nav: string }>
  status: string
}

async function fetchMFApiMeta(amfiCode: string): Promise<{ fundHouse?: string; fundCategory?: string } | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as MFApiMeta
    if (data.status !== 'SUCCESS') return null
    return {
      fundHouse:    data.meta.fund_house || undefined,
      fundCategory: data.meta.scheme_category || undefined,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type')

    const where =
      type === 'SIP'       ? { hasActiveSip: true }
      : type === 'LUMPSUM' ? { hasActiveSip: false }
      : undefined

    const funds = await prisma.mutualFund.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count:    { select: { transactions: true } },
        sipConfig: true,
      },
    })

    const result = funds.map(({ _count, ...fund }) => {
      const gainLoss    = fund.currentValue - fund.investedValue
      const gainLossPct = fund.investedValue > 0
        ? (gainLoss / fund.investedValue) * 100
        : 0
      return { ...fund, gainLoss, gainLossPct, transactionCount: _count.transactions }
    })

    const totalInvested     = result.reduce((s, f) => s + f.investedValue, 0)
    const totalCurrentValue = result.reduce((s, f) => s + f.currentValue, 0)
    const totalGainLoss     = totalCurrentValue - totalInvested
    const totalGainLossPct  = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

    return NextResponse.json({
      funds: result,
      totals: { totalInvested, totalCurrentValue, totalGainLoss, totalGainLossPct, count: result.length },
    })
  } catch (error) {
    console.error('[GET /api/mf]', error)
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: unknown; isin?: unknown; folioNumber?: unknown; platform?: unknown
      units?: unknown; avgNav?: unknown; currentNav?: unknown; investedValue?: unknown
      source?: unknown; amfiCode?: unknown; fundHouse?: unknown; fundCategory?: unknown
    }

    console.log('[POST /api/mf] body:', JSON.stringify(body))

    const { name, isin, folioNumber, platform, units, avgNav, currentNav, investedValue, source, amfiCode, fundHouse, fundCategory } = body

    // Coerce to number defensively — form data can arrive as strings
    const unitsNum         = typeof units         === 'number' ? units         : parseFloat(String(units ?? ''))
    const avgNavNum        = typeof avgNav         === 'number' ? avgNav        : parseFloat(String(avgNav ?? ''))
    const investedValueNum = typeof investedValue  === 'number' ? investedValue : parseFloat(String(investedValue ?? ''))
    const currentNavNum    = typeof currentNav     === 'number' ? currentNav    : parseFloat(String(currentNav ?? ''))

    if (!name || typeof name !== 'string' || !name.trim())
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!Number.isFinite(unitsNum) || unitsNum <= 0)
      return NextResponse.json({ error: 'units must be a positive number' }, { status: 400 })
    if (!Number.isFinite(avgNavNum) || avgNavNum <= 0)
      return NextResponse.json({ error: 'avgNav must be a positive number' }, { status: 400 })
    if (!Number.isFinite(investedValueNum) || investedValueNum <= 0)
      return NextResponse.json({ error: 'investedValue must be a positive number' }, { status: 400 })

    const normalizedIsin = typeof isin === 'string' && isin.trim()
      ? isin.trim().toUpperCase()
      : null

    if (normalizedIsin) {
      const existing = await prisma.mutualFund.findUnique({ where: { isin: normalizedIsin } })
      if (existing) return NextResponse.json({ error: 'Fund with this ISIN already exists' }, { status: 400 })
    }

    const cn = Number.isFinite(currentNavNum) && currentNavNum > 0 ? currentNavNum : avgNavNum
    const cv = unitsNum * cn

    const normalizedAmfiCode = typeof amfiCode === 'string' && amfiCode.trim()
      ? amfiCode.trim()
      : null

    let meta: { fundHouse?: string; fundCategory?: string } = {}
    if (normalizedAmfiCode) {
      const fetched = await fetchMFApiMeta(normalizedAmfiCode)
      if (fetched) meta = fetched
    }

    const fund = await prisma.mutualFund.create({
      data: {
        name:         (name as string).trim(),
        isin:         normalizedIsin,
        folioNumber:  typeof folioNumber === 'string' ? folioNumber.trim() || null : null,
        platform:     typeof platform    === 'string' ? platform.trim() || null    : null,
        amfiCode:     normalizedAmfiCode,
        fundHouse:    typeof fundHouse    === 'string' && fundHouse.trim()
          ? fundHouse.trim() : (meta.fundHouse ?? null),
        fundCategory: typeof fundCategory === 'string' && fundCategory.trim()
          ? fundCategory.trim() : (meta.fundCategory ?? null),
        units:         unitsNum,
        avgNav:        avgNavNum,
        currentNav:    cn,
        investedValue: investedValueNum,
        currentValue:  cv,
        source:        typeof source === 'string' && source.trim() ? source.trim() : 'MANUAL',
      },
    })

    return NextResponse.json({ fund }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/mf] error:', error)
    console.error('[POST /api/mf] details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return NextResponse.json({ error: mfApiError(error) }, { status: 500 })
  }
}
