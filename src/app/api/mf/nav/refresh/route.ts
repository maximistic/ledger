export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BATCH_SIZE = 3

export async function POST() {
  try {
    const funds = await prisma.mutualFund.findMany({
      where: { amfiCode: { not: null } },
      orderBy: { name: 'asc' },
    })

    let updated = 0
    let failed  = 0
    let skipped = 0

    for (let i = 0; i < funds.length; i += BATCH_SIZE) {
      const batch = funds.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async fund => {
        try {
          const res = await fetch(
            `https://api.mfapi.in/mf/${fund.amfiCode}`,
            { signal: AbortSignal.timeout(10000) },
          )
          if (!res.ok) { failed++; return }

          const data = await res.json() as { data?: Array<{ nav: string }> }
          const nav = parseFloat(data?.data?.[0]?.nav ?? '0')

          if (!nav || nav <= 0) { failed++; return }

          // Sanity check: skip if deviation > 60% from avgNav
          if (fund.avgNav > 0) {
            const deviation = Math.abs(nav - fund.avgNav) / fund.avgNav
            if (deviation > 0.6) { skipped++; return }
          }

          await prisma.mutualFund.update({
            where: { id: fund.id },
            data: {
              currentNav:      nav,
              currentValue:    fund.units * nav,
              lastNavUpdatedAt: new Date(),
            },
          })
          updated++
        } catch (err) {
          console.error(`[NAV refresh] failed for ${fund.name}:`, err)
          failed++
        }
      }))

      if (i + BATCH_SIZE < funds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return NextResponse.json({ updated, failed, skipped })
  } catch (error) {
    console.error('[POST /api/mf/nav/refresh]', error)
    return NextResponse.json({ error: 'NAV refresh failed' }, { status: 500 })
  }
}
