export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const fund = await prisma.mutualFund.findUnique({ where: { id } })
    if (!fund?.amfiCode) return NextResponse.json({ ok: false, reason: 'no amfiCode' })

    const res = await fetch(
      `https://api.mfapi.in/mf/${fund.amfiCode}`,
      { signal: AbortSignal.timeout(15000) },
    )
    if (!res.ok) {
      console.error(`[refresh-meta] mfapi.in ${res.status} for ${fund.name}`)
      return NextResponse.json({ ok: false })
    }

    const data = await res.json() as {
      meta?: { fund_house?: string; scheme_category?: string }
      data?: Array<{ nav: string }>
    }

    const nav         = parseFloat(data?.data?.[0]?.nav ?? '0')
    const fundHouse   = data?.meta?.fund_house   ?? fund.fundHouse   ?? null
    const fundCategory = data?.meta?.scheme_category ?? fund.fundCategory ?? null

    await prisma.mutualFund.update({
      where: { id: fund.id },
      data: {
        fundHouse,
        fundCategory,
        currentNav:      nav > 0 ? nav         : fund.avgNav,
        currentValue:    nav > 0 ? fund.units * nav : fund.currentValue,
        lastNavUpdatedAt: nav > 0 ? new Date()  : undefined,
      },
    })

    console.log(`[refresh-meta] updated ${fund.name} — NAV ${nav}`)
    return NextResponse.json({ ok: true, nav, fundHouse, fundCategory })
  } catch (err) {
    console.error('[refresh-meta]', err)
    return NextResponse.json({ ok: false })
  }
}
