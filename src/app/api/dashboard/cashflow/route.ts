import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const monthCount = Math.max(1, parseInt(searchParams.get('months') ?? '6'))

    // Build month boundaries
    const now = new Date()
    const monthData: {
      monthStart: Date
      monthEnd:   Date
      label:      string
      isCurrentMonth: boolean
    }[] = []

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(1)
      date.setMonth(date.getMonth() - i)

      const monthStart = new Date(date)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const monthEnd = new Date(date)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0)
      monthEnd.setHours(23, 59, 59, 999)

      const label = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      const isCurrentMonth =
        monthStart.getMonth() === now.getMonth() &&
        monthStart.getFullYear() === now.getFullYear()

      monthData.push({ monthStart, monthEnd, label, isCurrentMonth })
    }

    const rangeStart = monthData[0].monthStart
    const rangeEnd   = monthData[monthData.length - 1].monthEnd

    // Fetch all transactions in the full range in one batch
    const [stockTxns, mfTxns, epfTxns, fds, rds, usTxns] = await Promise.all([
      prisma.stockTransaction.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd }, type: 'BUY' },
      }),
      prisma.mutualFundTransaction.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd }, type: { in: ['SIP', 'LUMPSUM'] } },
      }),
      prisma.ePFTransaction.findMany({
        where: { transactionDate: { gte: rangeStart, lte: rangeEnd }, type: 'CR' },
      }),
      prisma.fDAccount.findMany({
        where: { startDate: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.rDAccount.findMany({
        where: { startDate: { lte: rangeEnd }, maturityDate: { gte: rangeStart } },
      }),
      prisma.uSStockTransaction.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd }, type: 'BUY' },
      }),
    ])

    // Aggregate per month in JS
    const months = monthData.map(({ monthStart, monthEnd, label, isCurrentMonth }) => {
      const stockInvested = stockTxns
        .filter(t => t.date >= monthStart && t.date <= monthEnd)
        .reduce((s, t) => s + t.quantity * t.price, 0)

      const mfInvested = mfTxns
        .filter(t => t.date >= monthStart && t.date <= monthEnd)
        .reduce((s, t) => s + t.amount, 0)

      const epfInvested = epfTxns
        .filter(t => t.transactionDate >= monthStart && t.transactionDate <= monthEnd)
        .reduce((s, t) => s + t.employeeAmount + t.employerAmount, 0)

      const fdInvested = fds
        .filter(fd => fd.startDate >= monthStart && fd.startDate <= monthEnd)
        .reduce((s, fd) => s + fd.principal, 0)

      // RD: one installment per month the account is active, if dayOfMonth is valid
      const lastDay    = monthEnd.getDate()
      const rdInvested = rds
        .filter(rd => rd.startDate <= monthEnd && rd.maturityDate >= monthStart)
        .reduce((s, rd) => s + (rd.dayOfMonth <= lastDay ? rd.monthlyAmount : 0), 0)

      const usInvested = usTxns
        .filter(t => t.date >= monthStart && t.date <= monthEnd)
        .reduce((s, t) => s + t.amountINR, 0)

      const invested = stockInvested + mfInvested + epfInvested + fdInvested + rdInvested + usInvested

      return { label, invested, returns: 0, isCurrentMonth }
    })

    const totalInvested         = months.reduce((s, m) => s + m.invested, 0)
    const currentMonthInvested  = months.find(m => m.isCurrentMonth)?.invested ?? 0

    return NextResponse.json({ months, totalInvested, currentMonthInvested })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
