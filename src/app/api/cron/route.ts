import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateFDCurrentValue, calculateRDCurrentValue } from '@/lib/fdCalculator'
import { yahooChartUrl, YAHOO_HEADERS, mfapiUrl } from '@/lib/yahoo'
import { computeNetWorthFromData } from '@/lib/netWorth'

interface YahooChartResult {
  chart: {
    result: Array<{ meta: { regularMarketPrice: number } }> | null
    error: unknown
  }
}

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(yahooChartUrl(symbol), { headers: YAHOO_HEADERS })
    if (!res.ok) return null
    const data = await res.json() as YahooChartResult
    if (!data.chart.result || data.chart.result.length === 0) return null
    const price = data.chart.result[0].meta.regularMarketPrice
    return typeof price === 'number' && price > 0 && isFinite(price) ? price : null
  } catch {
    return null
  }
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Vercel cron calls GET; POST is available for manual triggers.
// Add to vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 9 * * *" }] }

async function processEPFContributions(): Promise<{ processed: boolean; skipped: boolean; error?: string }> {
  try {
    const epfAccount = await prisma.ePFAccount.findFirst({
      where: { trackingStatus: 'ACTIVE' },
    })

    if (!epfAccount || !epfAccount.trackingStartDate) return { processed: false, skipped: true }

    const today        = new Date()
    const dayOfMonth   = epfAccount.dayOfMonth
    const lastProcessed = epfAccount.lastProcessedDate

    const isContributionDay = today.getDate() >= dayOfMonth
    const alreadyProcessedThisMonth =
      lastProcessed !== null &&
      lastProcessed.getMonth()     === today.getMonth() &&
      lastProcessed.getFullYear()  === today.getFullYear()

    if (!isContributionDay || alreadyProcessedThisMonth) return { processed: false, skipped: true }

    const wageMonth = `${MONTH_NAMES[today.getMonth()]}-${today.getFullYear()}`

    await prisma.$transaction(async (tx) => {
      await tx.ePFTransaction.create({
        data: {
          accountId:       epfAccount.id,
          wageMonth,
          transactionDate: today,
          type:            'CR',
          particulars:     `Auto-tracked contribution for ${wageMonth}`,
          employeeAmount:  epfAccount.employeeMonthly,
          employerAmount:  epfAccount.employerMonthly,
          pensionAmount:   0,
          autoCreated:     true,
        },
      })

      await tx.ePFAccount.update({
        where: { id: epfAccount.id },
        data: {
          employeeBalance:  { increment: epfAccount.employeeMonthly },
          employerBalance:  { increment: epfAccount.employerMonthly },
          lastProcessedDate: today,
        },
      })
    })

    return { processed: true, skipped: false }
  } catch (err) {
    return { processed: false, skipped: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function processRDs(): Promise<{ processed: number; errors: string[] }> {
  const today = new Date()
  let processed = 0
  const errors: string[] = []

  const rds = await prisma.rDAccount.findMany({
    where:   { maturityDate: { gt: today }, status: { not: 'PAUSED' } },
    include: { topUps: true },
  })

  for (const rd of rds) {
    try {
      const alreadyProcessed =
        rd.lastProcessedDate !== null &&
        rd.lastProcessedDate.getMonth()    === today.getMonth() &&
        rd.lastProcessedDate.getFullYear() === today.getFullYear()

      if (!alreadyProcessed && today.getDate() >= rd.dayOfMonth) {
        const { currentValue, totalInvested } = calculateRDCurrentValue({
          monthlyAmount: rd.monthlyAmount,
          annualRate:    rd.interestRate,
          startDate:     rd.startDate,
          dayOfMonth:    rd.dayOfMonth,
          topUps:        rd.topUps,
        })

        await prisma.rDAccount.update({
          where: { id: rd.id },
          data: {
            currentValue,
            totalInvested,
            interestEarned:    currentValue - totalInvested,
            lastProcessedDate: today,
          },
        })
        processed++
      }
    } catch (err) {
      errors.push(`${rd.name}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return { processed, errors }
}

async function processFDs(): Promise<{ processed: number; errors: string[] }> {
  let processed = 0
  const errors: string[] = []

  const fds = await prisma.fDAccount.findMany()

  for (const fd of fds) {
    try {
      const { currentValue, interestEarned } = calculateFDCurrentValue({
        principal:       fd.principal,
        annualRate:      fd.interestRate,
        startDate:       fd.startDate,
        compoundingType: fd.compoundingType,
      })

      await prisma.fDAccount.update({
        where: { id: fd.id },
        data:  { currentValue, interestEarned },
      })
      processed++
    } catch (err) {
      errors.push(`${fd.name}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return { processed, errors }
}

async function processSnapshot(): Promise<{ created: boolean; skipped: boolean; error?: string }> {
  try {
    const today = new Date()

    const config = await prisma.snapshotConfig.findFirst()
    if (config && !config.enabled) return { created: false, skipped: true }

    const scheduledDay  = config?.dayOfWeek ?? 0
    const scheduledHour = config?.hour      ?? 22
    const todayDay      = today.getDay()
    const todayHour     = today.getHours()

    const lastSnapshot = await prisma.snapshot.findFirst({ orderBy: { date: 'desc' } })

    let shouldCreate = !lastSnapshot
    if (lastSnapshot) {
      const daysSinceLast = Math.floor(
        (today.getTime() - lastSnapshot.date.getTime()) / (1000 * 60 * 60 * 24)
      )
      const isScheduledSlot = todayDay === scheduledDay && todayHour >= scheduledHour
      shouldCreate = isScheduledSlot || daysSinceLast >= 7
    }

    if (!shouldCreate) return { created: false, skipped: true }

    if (config) {
      await prisma.snapshotConfig.update({ where: { id: config.id }, data: { lastRunAt: today } })
    }

    const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Never overwrite a MANUAL snapshot taken today — user's explicit action takes precedence
    const existing = await prisma.snapshot.findUnique({ where: { date: dateKey } })
    if (existing?.source === 'MANUAL') return { created: false, skipped: true }

    const [stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses] = await Promise.all([
      prisma.stock.findMany(),
      prisma.mutualFund.findMany(),
      prisma.ePFAccount.findMany(),
      prisma.fDAccount.findMany(),
      prisma.rDAccount.findMany(),
      prisma.uSStock.findMany(),
      prisma.customAssetClass.findMany({ include: { entries: true } }),
    ])

    const nw = computeNetWorthFromData(stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses)
    const snapshotData = {
      totalNetWorth: nw.totalNetWorth,
      stocksValue:   nw.stocksValue,
      mfValue:       nw.mfValue,
      epfValue:      nw.epfValue,
      fdValue:       nw.fdValue,
      rdValue:       nw.rdValue,
      usStocksValue: nw.usStocksValue,
      customValue:   nw.customValue,
      investedValue: nw.investedValue,
    }

    await prisma.snapshot.upsert({
      where:  { date: dateKey },
      update: { ...snapshotData, source: 'AUTO' },
      create: { date: dateKey, ...snapshotData, source: 'AUTO' },
    })

    return { created: true, skipped: false }
  } catch (err) {
    return { created: false, skipped: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── SIP processing ───────────────────────────────────────────────────────────

const SIP_BUY_TYPES  = new Set(['SIP', 'LUMPSUM', 'SWITCH_IN', 'DIVIDEND', 'CORRECTION'])
const SIP_SELL_TYPES = new Set(['REDEMPTION', 'SWITCH_OUT'])

async function fetchLatestMFNav(amfiCode: string): Promise<number> {
  try {
    const res = await fetch(yahooChartUrl(`${amfiCode}.BO`), { signal: AbortSignal.timeout(8000), headers: YAHOO_HEADERS })
    if (res.ok) {
      const data = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } }
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price && price > 0) return price
    }
  } catch { /* fall through to mfapi */ }

  try {
    const res = await fetch(mfapiUrl(amfiCode), { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ nav: string }> }
      const nav = parseFloat(data?.data?.[0]?.nav ?? '0')
      if (nav > 0) return nav
    }
  } catch { /* ignore */ }

  return 0
}

async function processSIPs(): Promise<{ processed: number; failed: number; skipped: number; errors: string[] }> {
  const today = new Date()
  let processed = 0
  let failed    = 0
  let skipped   = 0
  const errors: string[] = []

  const activeSips = await prisma.sipConfig.findMany({
    where:   { status: 'ACTIVE' },
    include: { fund: true },
  })

  for (const sip of activeSips) {
    try {
      // SIP start date hasn't arrived yet
      if (sip.startDate > today) { skipped++; continue }

      // Already processed this month
      const alreadyProcessed =
        sip.lastProcessedDate !== null &&
        sip.lastProcessedDate.getMonth()    === today.getMonth() &&
        sip.lastProcessedDate.getFullYear() === today.getFullYear()
      if (alreadyProcessed) { skipped++; continue }

      // SIP debit date not yet reached this month
      if (today.getDate() < sip.dayOfMonth) { skipped++; continue }

      const fund = sip.fund

      // Refresh NAV if stale (older than 1 day) or unknown
      let nav = fund.currentNav
      if (fund.amfiCode) {
        const stale = !fund.lastNavUpdatedAt ||
          (today.getTime() - fund.lastNavUpdatedAt.getTime()) > 24 * 60 * 60 * 1000
        if (stale || nav <= 0) {
          const fresh = await fetchLatestMFNav(fund.amfiCode)
          if (fresh > 0) nav = fresh
        }
      }

      if (nav <= 0) {
        errors.push(`${fund.name}: no valid NAV — skipping`)
        failed++
        continue
      }

      // Units = floor to 3 decimal places (standard MF allocation precision)
      const units = Math.floor((sip.amount / nav) * 1000) / 1000
      if (units <= 0) {
        errors.push(`${fund.name}: computed 0 units (NAV ₹${nav}, amount ₹${sip.amount}) — skipping`)
        failed++
        continue
      }

      const sipDate = new Date(today.getFullYear(), today.getMonth(), sip.dayOfMonth)

      await prisma.$transaction(async (tx) => {
        await tx.mutualFundTransaction.create({
          data: {
            fundId:      fund.id,
            date:        sipDate,
            type:        'SIP',
            units,
            nav,
            amount:      sip.amount,
            autoCreated: true,
          },
        })

        // Recalculate fund metrics from all transactions
        const allTxns = await tx.mutualFundTransaction.findMany({
          where:  { fundId: fund.id },
          select: { type: true, units: true, nav: true, amount: true },
        })
        const buys  = allTxns.filter(t => SIP_BUY_TYPES.has(t.type))
        const sells = allTxns.filter(t => SIP_SELL_TYPES.has(t.type))
        const totalBuyUnits  = buys.reduce((s, t) => s + t.units, 0)
        const totalSellUnits = sells.reduce((s, t) => s + t.units, 0)
        const totalBuyAmt    = buys.reduce((s, t) => s + t.amount, 0)
        const totalSellAmt   = sells.reduce((s, t) => s + t.amount, 0)
        const weightedNav    = buys.reduce((s, t) => s + t.units * t.nav, 0)
        const newUnits       = Math.max(0, totalBuyUnits - totalSellUnits)
        const newAvgNav      = totalBuyUnits > 0 ? weightedNav / totalBuyUnits : 0
        const newInvested    = Math.max(0, totalBuyAmt - totalSellAmt)

        await tx.mutualFund.update({
          where: { id: fund.id },
          data: {
            units:           newUnits,
            avgNav:          newAvgNav,
            investedValue:   newInvested,
            currentNav:      nav,
            currentValue:    newUnits * nav,
            lastNavUpdatedAt: today,
          },
        })

        await tx.sipConfig.update({
          where: { id: sip.id },
          data:  { lastProcessedDate: today },
        })
      })

      processed++
    } catch (err) {
      console.error(`[cron] SIP processing failed for ${sip.fund.name}:`, err)
      errors.push(`${sip.fund.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      failed++
    }
  }

  return { processed, failed, skipped, errors }
}

// ─── US stock price refresh ────────────────────────────────────────────────────

async function processUSStocks(): Promise<{ updated: number; failed: number; skipped: number; exchangeRate: number | null; error?: string }> {
  let updated  = 0
  let failed   = 0
  let skipped  = 0
  let currentExchangeRate: number | null = null

  try {
    const fxPrice = await fetchYahooPrice('USDINR=X')
    if (fxPrice && fxPrice > 0) currentExchangeRate = fxPrice

    const stocks = await prisma.uSStock.findMany({ orderBy: { ticker: 'asc' } })

    for (let i = 0; i < stocks.length; i++) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, 300))

      const stock = stocks[i]
      const price = await fetchYahooPrice(stock.ticker)

      if (price === null) { failed++; continue }

      const deviation = Math.abs(price - stock.avgPriceUSD) / stock.avgPriceUSD
      if (deviation > 0.6) { skipped++; continue }

      const rate = currentExchangeRate ?? stock.exchangeRate
      await prisma.uSStock.update({
        where: { id: stock.id },
        data: {
          currentPriceUSD:    price,
          currentValueINR:    stock.quantity * price * rate,
          exchangeRate:       rate,
          lastPriceUpdatedAt: new Date(),
        },
      })
      updated++
    }
  } catch (err) {
    console.error('[cron] processUSStocks error:', err)
    return { updated, failed, skipped, exchangeRate: currentExchangeRate, error: err instanceof Error ? err.message : 'Unknown error' }
  }

  return { updated, failed, skipped, exchangeRate: currentExchangeRate }
}

async function runCron() {
  // SIPs must run before the snapshot so the snapshot reflects updated MF values
  const sips = await processSIPs()

  const [epf, rds, fds, usStocks] = await Promise.all([
    processEPFContributions(),
    processRDs(),
    processFDs(),
    processUSStocks(),
  ])
  const snapshot = await processSnapshot()
  return { ok: true, sips, epf, rds, fds, usStocks, snapshot }
}

export async function GET() {
  try {
    return NextResponse.json(await runCron())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    return NextResponse.json(await runCron())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
