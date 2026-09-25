import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateFDCurrentValue, calculateRDCurrentValue } from '@/lib/fdCalculator'
import { yahooChartUrl, YAHOO_HEADERS } from '@/lib/yahoo'
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

    await prisma.snapshot.upsert({
      where:  { date: dateKey },
      update: { ...nw, source: 'AUTO' },
      create: { date: dateKey, ...nw, source: 'AUTO' },
    })

    return { created: true, skipped: false }
  } catch (err) {
    return { created: false, skipped: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

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

export async function GET() {
  try {
    const [epf, rds, fds, usStocks] = await Promise.all([
      processEPFContributions(),
      processRDs(),
      processFDs(),
      processUSStocks(),
    ])
    const snapshot = await processSnapshot()
    return NextResponse.json({ ok: true, epf, rds, fds, usStocks, snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const [epf, rds, fds, usStocks] = await Promise.all([
      processEPFContributions(),
      processRDs(),
      processFDs(),
      processUSStocks(),
    ])
    const snapshot = await processSnapshot()
    return NextResponse.json({ ok: true, epf, rds, fds, usStocks, snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
