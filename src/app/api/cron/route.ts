import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateMFMetrics } from '@/lib/mfUtils'

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

export async function GET() {
  try {
    const result = await processSips()
    return NextResponse.json({ ok: true, sips: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await processSips()
    return NextResponse.json({ ok: true, sips: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
