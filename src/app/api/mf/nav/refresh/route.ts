export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BATCH_SIZE = 3

async function fetchNavFromYahoo(amfiCode: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${amfiCode}.BO`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!res.ok) return 0
    const data = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
    }
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return price && price > 0 ? price : 0
  } catch {
    return 0
  }
}

async function fetchNavFromMfapi(amfiCode: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.mfapi.in/mf/${amfiCode}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return 0
    const data = await res.json() as { data?: Array<{ nav: string }> }
    return parseFloat(data?.data?.[0]?.nav ?? '0') || 0
  } catch {
    return 0
  }
}

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
          let nav = await fetchNavFromYahoo(fund.amfiCode!)

          if (!nav || nav <= 0) {
            nav = await fetchNavFromMfapi(fund.amfiCode!)
            if (nav > 0) {
              console.log(`[NAV refresh] mfapi fallback for ${fund.name}: ${nav}`)
            }
          } else {
            console.log(`[NAV refresh] Yahoo NAV for ${fund.name}: ${nav}`)
          }

          if (!nav || nav <= 0) {
            console.log(`[NAV refresh] No NAV found for ${fund.name}`)
            failed++
            return
          }

          // Sanity check: skip if deviation > 60% from avgNav
          if (fund.avgNav > 0) {
            const deviation = Math.abs(nav - fund.avgNav) / fund.avgNav
            if (deviation > 0.6) {
              console.warn(`[NAV refresh] Skipped ${fund.name} — deviation ${(deviation * 100).toFixed(1)}%`)
              skipped++
              return
            }
          }

          await prisma.mutualFund.update({
            where: { id: fund.id },
            data: {
              currentNav:       nav,
              currentValue:     fund.units * nav,
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
