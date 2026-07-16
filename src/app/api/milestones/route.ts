import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const getCurrentValue = async (targetAsset: string | null): Promise<number> => {
  if (!targetAsset || targetAsset === 'total') {
    const [stocks, mfs, epf, fds, rds, usStocks] = await Promise.all([
      prisma.stock.findMany({ where: { quantity: { gt: 0 } } }),
      prisma.mutualFund.findMany(),
      prisma.ePFAccount.findFirst(),
      prisma.fDAccount.findMany(),
      prisma.rDAccount.findMany(),
      prisma.uSStock.findMany({ where: { quantity: { gt: 0 } } }),
    ])
    const stocksVal = stocks.reduce((s, x) => s + x.currentValue, 0)
    const mfVal     = mfs.reduce((s, x) => s + x.currentValue, 0)
    const epfVal    = epf ? epf.employeeBalance + epf.employerBalance + epf.pensionBalance : 0
    const fdVal     = fds.reduce((s, x) => s + x.currentValue, 0)
    const rdVal     = rds.reduce((s, x) => s + x.currentValue, 0)
    const usVal     = usStocks.reduce((s, x) => s + x.currentValueINR, 0)
    return stocksVal + mfVal + epfVal + fdVal + rdVal + usVal
  }

  if (targetAsset === 'stocks') {
    const stocks = await prisma.stock.findMany({ where: { quantity: { gt: 0 } } })
    return stocks.reduce((s, x) => s + x.currentValue, 0)
  }

  if (targetAsset === 'mf') {
    const mfs = await prisma.mutualFund.findMany()
    return mfs.reduce((s, x) => s + x.currentValue, 0)
  }

  if (targetAsset === 'epf') {
    const epf = await prisma.ePFAccount.findFirst()
    return epf ? epf.employeeBalance + epf.employerBalance + epf.pensionBalance : 0
  }

  if (targetAsset === 'fd') {
    const fds = await prisma.fDAccount.findMany()
    const rds = await prisma.rDAccount.findMany()
    return (
      fds.reduce((s, x) => s + x.currentValue, 0) +
      rds.reduce((s, x) => s + x.currentValue, 0)
    )
  }

  if (targetAsset === 'us') {
    const usStocks = await prisma.uSStock.findMany({ where: { quantity: { gt: 0 } } })
    return usStocks.reduce((s, x) => s + x.currentValueINR, 0)
  }

  return 0
}

export async function GET() {
  try {
    const raw = await prisma.milestone.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const milestones = await Promise.all(
      raw.map(async milestone => {
        const currentValue = await getCurrentValue(milestone.targetAsset)
        const progress     = milestone.targetAmount > 0 ? currentValue / milestone.targetAmount : 0
        const progressPct  = Math.min(Math.round(progress * 100), 100)
        const amountAway   = Math.max(milestone.targetAmount - currentValue, 0)

        let { isAchieved, achievedDate } = milestone

        // Auto-achieve only — never auto-unachieve
        if (!isAchieved && currentValue >= milestone.targetAmount) {
          const today = new Date()
          await prisma.milestone.update({
            where: { id: milestone.id },
            data:  { isAchieved: true, achievedDate: today },
          })
          isAchieved   = true
          achievedDate = today
        }

        return { ...milestone, isAchieved, achievedDate, currentValue, progressPct, amountAway }
      })
    )

    return NextResponse.json({ milestones })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { title?: string; targetAmount?: number; targetAsset?: string }
    const { title, targetAmount, targetAsset } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!targetAmount || typeof targetAmount !== 'number' || targetAmount <= 0) {
      return NextResponse.json({ error: 'targetAmount must be > 0' }, { status: 400 })
    }

    const milestone = await prisma.milestone.create({
      data: {
        title:       title.trim(),
        targetAmount,
        targetAsset: targetAsset ?? null,
      },
    })

    return NextResponse.json({ milestone }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
