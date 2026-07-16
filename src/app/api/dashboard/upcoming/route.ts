import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface UpcomingEvent {
  id:       string
  type:     'FD_MATURITY' | 'RD_MATURITY' | 'EPF_CONTRIBUTION' | 'RD_INSTALLMENT'
  label:    string
  date:     string
  amount:   number
  daysLeft: number
  urgency:  'HIGH' | 'MEDIUM' | 'LOW'
}

function daysFromNow(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

function toUrgency(days: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (days <= 7)  return 'HIGH'
  if (days <= 30) return 'MEDIUM'
  return 'LOW'
}

function nextOccurrence(dayOfMonth: number): Date {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const day   = now.getDate()

  // If the day-of-month is still ahead this month, use it; otherwise next month
  return dayOfMonth > day
    ? new Date(year, month, dayOfMonth)
    : new Date(year, month + 1, dayOfMonth)
}

export async function GET() {
  try {
    const now    = new Date()
    const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    const [fds, rdsMaturingSoon, epfAccount, activeRDs] = await Promise.all([
      prisma.fDAccount.findMany({ where: { maturityDate: { gte: now, lte: cutoff } } }),
      prisma.rDAccount.findMany({ where: { maturityDate: { gte: now, lte: cutoff } } }),
      prisma.ePFAccount.findFirst({ where: { trackingStatus: 'ACTIVE' } }),
      // RDs still active beyond 90-day window — track upcoming installments
      prisma.rDAccount.findMany({ where: { maturityDate: { gt: cutoff } } }),
    ])

    const events: UpcomingEvent[] = []

    for (const fd of fds) {
      const dl = daysFromNow(fd.maturityDate)
      if (dl < 0) continue
      events.push({
        id:       fd.id,
        type:     'FD_MATURITY',
        label:    `${fd.name} matures`,
        date:     fd.maturityDate.toISOString().split('T')[0],
        amount:   fd.maturityValue || fd.currentValue,
        daysLeft: dl,
        urgency:  toUrgency(dl),
      })
    }

    for (const rd of rdsMaturingSoon) {
      const dl = daysFromNow(rd.maturityDate)
      if (dl < 0) continue
      events.push({
        id:       rd.id,
        type:     'RD_MATURITY',
        label:    `${rd.name} matures`,
        date:     rd.maturityDate.toISOString().split('T')[0],
        amount:   rd.maturityValue || rd.currentValue,
        daysLeft: dl,
        urgency:  toUrgency(dl),
      })
    }

    if (epfAccount) {
      const nextDate = nextOccurrence(epfAccount.dayOfMonth)
      const dl       = daysFromNow(nextDate)
      if (dl >= 0 && dl <= 90) {
        events.push({
          id:       epfAccount.id,
          type:     'EPF_CONTRIBUTION',
          label:    'EPF contribution due',
          date:     nextDate.toISOString().split('T')[0],
          amount:   epfAccount.employeeMonthly + epfAccount.employerMonthly,
          daysLeft: dl,
          urgency:  toUrgency(dl),
        })
      }
    }

    for (const rd of activeRDs) {
      const nextDate = nextOccurrence(rd.dayOfMonth)
      const dl       = daysFromNow(nextDate)
      if (dl >= 0 && dl <= 90) {
        events.push({
          id:       rd.id + '_installment',
          type:     'RD_INSTALLMENT',
          label:    `${rd.name} installment`,
          date:     nextDate.toISOString().split('T')[0],
          amount:   rd.monthlyAmount,
          daysLeft: dl,
          urgency:  toUrgency(dl),
        })
      }
    }

    events.sort((a, b) => a.daysLeft - b.daysLeft)

    return NextResponse.json({ events: events.slice(0, 6) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
