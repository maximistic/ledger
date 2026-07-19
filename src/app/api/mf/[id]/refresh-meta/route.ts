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

    let latestNav    = 0
    let fundHouse    = fund.fundHouse
    let fundCategory = fund.fundCategory

    // Step 1: Fetch NAV from Yahoo Finance (primary)
    try {
      const yahooTicker = `${fund.amfiCode}.BO`
      const yahooUrl    = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`
      const yahooRes    = await fetch(yahooUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      })
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json() as {
          chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
        }
        const price = yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (price && price > 0) {
          latestNav = price
          console.log(`[refresh-meta] Yahoo NAV for ${fund.name}: ${latestNav}`)
        }
      }
    } catch (err) {
      console.log('[refresh-meta] Yahoo Finance fetch failed:', err)
    }

    // Step 2: If Yahoo failed, try mfapi.in as fallback (also grabs metadata)
    if (latestNav <= 0) {
      try {
        const mfRes = await fetch(
          `https://api.mfapi.in/mf/${fund.amfiCode}`,
          { signal: AbortSignal.timeout(10000) },
        )
        if (mfRes.ok) {
          const mfData = await mfRes.json() as {
            meta?: { fund_house?: string; scheme_category?: string }
            data?: Array<{ nav: string }>
          }
          const nav = parseFloat(mfData?.data?.[0]?.nav ?? '0')
          if (nav > 0) {
            latestNav = nav
            console.log(`[refresh-meta] mfapi fallback NAV for ${fund.name}: ${latestNav}`)
          }
          if (mfData?.meta?.fund_house)    fundHouse    = mfData.meta.fund_house
          if (mfData?.meta?.scheme_category) fundCategory = mfData.meta.scheme_category
        }
      } catch (err) {
        console.log('[refresh-meta] mfapi fallback also failed:', err)
      }
    }

    // Step 3: Fetch metadata from mfapi.in separately if still missing
    if (!fundHouse || !fundCategory) {
      try {
        const metaRes = await fetch(
          `https://api.mfapi.in/mf/${fund.amfiCode}`,
          { signal: AbortSignal.timeout(10000) },
        )
        if (metaRes.ok) {
          const metaData = await metaRes.json() as {
            meta?: { fund_house?: string; scheme_category?: string }
          }
          fundHouse    = fundHouse    || metaData?.meta?.fund_house        || null
          fundCategory = fundCategory || metaData?.meta?.scheme_category   || null
        }
      } catch {
        // ignore
      }
    }

    // Step 4: Log sanity warning but save anyway (user can edit NAV manually)
    if (latestNav > 0 && fund.avgNav > 0) {
      const deviation = Math.abs(latestNav - fund.avgNav) / fund.avgNav
      if (deviation > 0.5) {
        console.warn(
          `[refresh-meta] NAV deviation warning for ${fund.name}: ` +
          `fetched=${latestNav}, avg=${fund.avgNav}, deviation=${(deviation * 100).toFixed(1)}%`,
        )
      }
    }

    // Step 5: Update fund
    const updateData: Record<string, unknown> = { fundHouse, fundCategory }
    if (latestNav > 0) {
      updateData.currentNav      = latestNav
      updateData.currentValue    = fund.units * latestNav
      updateData.lastNavUpdatedAt = new Date()
    }

    await prisma.mutualFund.update({ where: { id: fund.id }, data: updateData })

    console.log(`[refresh-meta] updated ${fund.name} — NAV ${latestNav}, source: ${latestNav > 0 ? 'yahoo' : 'none'}`)
    return NextResponse.json({
      ok: true,
      nav: latestNav,
      source: latestNav > 0 ? 'yahoo' : 'none',
      fundHouse,
      fundCategory,
    })
  } catch (err) {
    console.error('[refresh-meta]', err)
    return NextResponse.json({ ok: false })
  }
}
