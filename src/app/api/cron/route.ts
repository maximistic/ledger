import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateMFMetrics } from '@/lib/mfUtils'
import { calculateFDCurrentValue, calculateRDCurrentValue } from '@/lib/fdCalculator'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Vercel cron calls GET; POST is available for manual triggers.
// Add to vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 9 * * *" }] }

async function processSips(): Promise<{ processed: number; errors: string[] }> {
  const today      = new Date()
  const todayDay   = today.getDate()
  const thisMonth  = today.getFullYear() * 100 + (today.getMonth() + 1) // e.g. 202601

  const sips = await prisma.sipConfig.findMany({
    where:   { status: 'ACTIVE' },
    include: { fund: true },
  })

  let processed = 0
  const errors: string[] = []

  for (const sip of sips) {
    try {
      // Due if today >= dayOfMonth AND not yet processed this calendar month
      if (todayDay < sip.dayOfMonth) continue

      if (sip.lastProcessedDate) {
        const lp = new Date(sip.lastProcessedDate)
        const lpMonth = lp.getFullYear() * 100 + (lp.getMonth() + 1)
        if (lpMonth === thisMonth) continue // already processed this month
      }

      const fund      = sip.fund
      const currentNav = fund.currentNav
      const units      = currentNav > 0 ? sip.amount / currentNav : 0

      await prisma.mutualFundTransaction.create({
        data: {
          fundId:      fund.id,
          date:        today,
          type:        'SIP',
          units,
          nav:         currentNav,
          amount:      sip.amount,
          description: 'Auto-created SIP',
          autoCreated: true,
        },
      })

      const allTxns = await prisma.mutualFundTransaction.findMany({ where: { fundId: fund.id } })
      const metrics = calculateMFMetrics(allTxns)

      const safeUnits    = isFinite(metrics.units)         ? metrics.units         : fund.units
      const safeAvgNav   = isFinite(metrics.avgNav)  && metrics.avgNav > 0  ? metrics.avgNav  : fund.avgNav
      const safeIV       = isFinite(metrics.investedValue) ? metrics.investedValue : fund.investedValue
      const safeNavForCV = currentNav > 0 ? currentNav : safeAvgNav
      const currentValue = safeUnits * safeNavForCV

      await prisma.$transaction([
        prisma.mutualFund.update({
          where: { id: fund.id },
          data:  { units: safeUnits, avgNav: safeAvgNav, investedValue: safeIV, currentValue },
        }),
        prisma.sipConfig.update({
          where: { id: sip.id },
          data:  { lastProcessedDate: today },
        }),
      ])

      processed++
    } catch (err) {
      errors.push(`${sip.fund.name}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return { processed, errors }
}

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

    await prisma.ePFTransaction.create({
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

    await prisma.ePFAccount.update({
      where: { id: epfAccount.id },
      data: {
        employeeBalance:  { increment: epfAccount.employeeMonthly },
        employerBalance:  { increment: epfAccount.employerMonthly },
        lastProcessedDate: today,
      },
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
    where:   { maturityDate: { gt: today } },
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

export async function GET() {
  try {
    const [sips, epf, rds, fds] = await Promise.all([
      processSips(),
      processEPFContributions(),
      processRDs(),
      processFDs(),
    ])
    return NextResponse.json({ ok: true, sips, epf, rds, fds })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const [sips, epf, rds, fds] = await Promise.all([
      processSips(),
      processEPFContributions(),
      processRDs(),
      processFDs(),
    ])
    return NextResponse.json({ ok: true, sips, epf, rds, fds })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
