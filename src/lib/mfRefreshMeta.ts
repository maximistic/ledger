import { prisma } from '@/lib/prisma'
import { yahooChartUrl, YAHOO_HEADERS, mfapiUrl } from '@/lib/yahoo'

export async function refreshFundMeta(fundId: string): Promise<void> {
  try {
    const fund = await prisma.mutualFund.findUnique({ where: { id: fundId } })
    if (!fund?.amfiCode) return

    let latestNav    = 0
    let fundHouse    = fund.fundHouse
    let fundCategory = fund.fundCategory

    // Step 1: Fetch NAV from Yahoo Finance (primary)
    try {
      const yahooTicker = `${fund.amfiCode}.BO`
      const yahooRes    = await fetch(
        yahooChartUrl(yahooTicker),
        { signal: AbortSignal.timeout(8000), headers: YAHOO_HEADERS },
      )
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json() as {
          chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
        }
        const price = yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (price && price > 0) {
          latestNav = price
          console.log(`[refreshFundMeta] Yahoo NAV for ${fund.name}: ${latestNav}`)
        }
      }
    } catch (err) {
      console.log('[refreshFundMeta] Yahoo Finance fetch failed:', err)
    }

    // Step 2: Fallback to mfapi.in
    if (latestNav <= 0) {
      try {
        const mfRes = await fetch(mfapiUrl(fund.amfiCode!), { signal: AbortSignal.timeout(10000) })
        if (mfRes.ok) {
          const mfData = await mfRes.json() as {
            meta?: { fund_house?: string; scheme_category?: string }
            data?: Array<{ nav: string }>
          }
          const nav = parseFloat(mfData?.data?.[0]?.nav ?? '0')
          if (nav > 0) {
            latestNav = nav
            console.log(`[refreshFundMeta] mfapi fallback NAV for ${fund.name}: ${latestNav}`)
          }
          if (mfData?.meta?.fund_house)      fundHouse    = mfData.meta.fund_house
          if (mfData?.meta?.scheme_category) fundCategory = mfData.meta.scheme_category
        }
      } catch (err) {
        console.log('[refreshFundMeta] mfapi fallback failed:', err)
      }
    }

    // Step 3: Fetch metadata separately if still missing
    if (!fundHouse || !fundCategory) {
      try {
        const metaRes = await fetch(mfapiUrl(fund.amfiCode!), { signal: AbortSignal.timeout(10000) })
        if (metaRes.ok) {
          const metaData = await metaRes.json() as {
            meta?: { fund_house?: string; scheme_category?: string }
          }
          fundHouse    = fundHouse    || metaData?.meta?.fund_house      || null
          fundCategory = fundCategory || metaData?.meta?.scheme_category || null
        }
      } catch { /* ignore */ }
    }

    const updateData: Record<string, unknown> = { fundHouse, fundCategory }
    if (latestNav > 0) {
      updateData.currentNav       = latestNav
      updateData.currentValue     = fund.units * latestNav
      updateData.lastNavUpdatedAt = new Date()
    }

    await prisma.mutualFund.update({ where: { id: fund.id }, data: updateData })
    console.log(`[refreshFundMeta] updated ${fund.name} — NAV ${latestNav}`)
  } catch (err) {
    console.error('[refreshFundMeta] error:', err)
  }
}
