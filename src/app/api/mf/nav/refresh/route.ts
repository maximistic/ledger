import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface MFApiData {
  meta: { fund_house: string; scheme_category: string; scheme_code: number; scheme_name: string }
  data: Array<{ date: string; nav: string }>
  status: string
}

interface MFSearchResult {
  schemeCode: number
  schemeName: string
  fundHouse: string
  schemeType: string
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function scoreMatch(fundName: string, candidate: string): number {
  const fn = fundName.toLowerCase()
  const cn = candidate.toLowerCase()
  if (fn === cn) return 100

  let score = 0
  if (fn.includes('direct') && cn.includes('direct')) score += 20
  if (fn.includes('growth') && cn.includes('growth')) score += 15

  const stopWords = new Set(['fund', 'scheme', 'the', 'and', 'for'])
  const fundWords = new Set(fn.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w)))
  const candWords = cn.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w))
  const matched   = candWords.filter(w => fundWords.has(w)).length
  const total     = Math.max(fundWords.size, candWords.length, 1)
  score += (matched / total) * 40

  return score
}

async function findAmfiCode(fundName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(fundName)}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const results = await res.json() as MFSearchResult[]
    if (!Array.isArray(results) || results.length === 0) return null

    let bestCode  = ''
    let bestScore = 0
    for (const r of results) {
      const score = scoreMatch(fundName, r.schemeName)
      if (score > bestScore) { bestScore = score; bestCode = String(r.schemeCode) }
    }
    return bestScore >= 40 ? bestCode : null
  } catch {
    return null
  }
}

async function fetchNavForCode(amfiCode: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as MFApiData
    if (data.status !== 'SUCCESS' || !data.data || data.data.length === 0) return null
    const nav = parseFloat(data.data[0].nav)
    return isFinite(nav) && nav > 0 ? nav : null
  } catch {
    return null
  }
}

export async function POST() {
  try {
    const funds = await prisma.mutualFund.findMany({ orderBy: { name: 'asc' } })

    let updated = 0
    let failed  = 0
    let skipped = 0

    for (let i = 0; i < funds.length; i++) {
      if (i > 0) await sleep(300)

      const fund = funds[i]
      let amfiCode = fund.amfiCode

      // Try to find amfiCode via search if missing
      if (!amfiCode) {
        amfiCode = await findAmfiCode(fund.name)
        if (amfiCode) {
          await prisma.mutualFund.update({ where: { id: fund.id }, data: { amfiCode } })
        }
      }

      if (!amfiCode) {
        failed++
        continue
      }

      const nav = await fetchNavForCode(amfiCode)

      if (nav === null) {
        failed++
        continue
      }

      // Sanity check: skip if NAV deviates > 60% from avgNav
      if (fund.avgNav > 0) {
        const deviation = Math.abs(nav - fund.avgNav) / fund.avgNav
        if (deviation > 0.6) {
          console.warn(`[nav-refresh] ${fund.name}: NAV ${nav} deviates ${(deviation * 100).toFixed(1)}% from avgNav ${fund.avgNav} — skipped`)
          skipped++
          continue
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
    }

    return NextResponse.json({ updated, failed, skipped })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
