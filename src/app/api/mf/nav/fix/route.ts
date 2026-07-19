export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const funds = await prisma.mutualFund.findMany({
      where: { amfiCode: { not: null } },
    })

    const results: Array<{
      name: string; amfiCode: string | null
      oldNav: number; newNav: number; source: string; updated: boolean
    }> = []

    for (const fund of funds) {
      let nav    = 0
      let source = 'none'

      // Try Yahoo Finance first
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${fund.amfiCode}.BO`
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        })
        if (res.ok) {
          const data = await res.json() as {
            chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
          }
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
          if (price && price > 0) {
            nav    = price
            source = 'yahoo'
          }
        }
      } catch { /* ignore */ }

      // Fallback to mfapi.in
      if (!nav) {
        try {
          const res = await fetch(
            `https://api.mfapi.in/mf/${fund.amfiCode}`,
            { signal: AbortSignal.timeout(10000) },
          )
          if (res.ok) {
            const data = await res.json() as { data?: Array<{ nav: string }> }
            nav = parseFloat(data?.data?.[0]?.nav ?? '0') || 0
            if (nav > 0) source = 'mfapi'
          }
        } catch { /* ignore */ }
      }

      results.push({
        name:     fund.name,
        amfiCode: fund.amfiCode,
        oldNav:   fund.currentNav,
        newNav:   nav,
        source,
        updated:  nav > 0,
      })

      if (nav > 0) {
        await prisma.mutualFund.update({
          where: { id: fund.id },
          data: {
            currentNav:       nav,
            currentValue:     fund.units * nav,
            lastNavUpdatedAt: new Date(),
          },
        })
      }

      // Rate limit between funds
      await new Promise(r => setTimeout(r, 500))
    }

    console.log('[NAV fix] results:', JSON.stringify(results))
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[POST /api/mf/nav/fix]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
