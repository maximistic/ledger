import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getCurrentValueForAsset(targetAsset: string | null): Promise<number> {
  switch (targetAsset) {
    case 'stocks': {
      const stocks = await prisma.stock.findMany({ select: { currentValue: true } })
      return stocks.reduce((s, x) => s + x.currentValue, 0)
    }
    case 'mf': {
      const mfs = await prisma.mutualFund.findMany({ select: { currentValue: true } })
      return mfs.reduce((s, x) => s + x.currentValue, 0)
    }
    case 'epf': {
      const epfs = await prisma.ePFAccount.findMany({ select: { employeeBalance: true, employerBalance: true, pensionBalance: true } })
      return epfs.reduce((s, x) => s + x.employeeBalance + x.employerBalance + x.pensionBalance, 0)
    }
    case 'fd': {
      const fds = await prisma.fDAccount.findMany({ select: { currentValue: true } })
      return fds.reduce((s, x) => s + x.currentValue, 0)
    }
    case 'rd': {
      const rds = await prisma.rDAccount.findMany({ select: { currentValue: true } })
      return rds.reduce((s, x) => s + x.currentValue, 0)
    }
    case 'us': {
      const us = await prisma.uSStock.findMany({ select: { currentValueINR: true } })
      return us.reduce((s, x) => s + x.currentValueINR, 0)
    }
    default: {
      // 'total' or null → sum everything
      const [stocks, mfs, epfs, fds, rds, us] = await Promise.all([
        prisma.stock.findMany({ select: { currentValue: true } }),
        prisma.mutualFund.findMany({ select: { currentValue: true } }),
        prisma.ePFAccount.findMany({ select: { employeeBalance: true, employerBalance: true, pensionBalance: true } }),
        prisma.fDAccount.findMany({ select: { currentValue: true } }),
        prisma.rDAccount.findMany({ select: { currentValue: true } }),
        prisma.uSStock.findMany({ select: { currentValueINR: true } }),
      ])
      return (
        stocks.reduce((s, x) => s + x.currentValue, 0) +
        mfs.reduce((s, x) => s + x.currentValue, 0) +
        epfs.reduce((s, x) => s + x.employeeBalance + x.employerBalance + x.pensionBalance, 0) +
        fds.reduce((s, x) => s + x.currentValue, 0) +
        rds.reduce((s, x) => s + x.currentValue, 0) +
        us.reduce((s, x) => s + x.currentValueINR, 0)
      )
    }
  }
}

export async function GET() {
  try {
    const raw = await prisma.milestone.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const milestones = await Promise.all(
      raw.map(async m => {
        const currentValue  = await getCurrentValueForAsset(m.targetAsset)
        const progress      = Math.min(currentValue / m.targetAmount, 1)
        const progressPct   = Math.round(progress * 100)
        const amountAway    = Math.max(m.targetAmount - currentValue, 0)

        let { isAchieved, achievedDate } = m

        if (!isAchieved && progressPct >= 100) {
          const today = new Date()
          await prisma.milestone.update({
            where: { id: m.id },
            data: { isAchieved: true, achievedDate: today },
          })
          isAchieved   = true
          achievedDate = today
        }

        return { ...m, isAchieved, achievedDate, currentValue, progress, progressPct, amountAway }
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
        title:        title.trim(),
        targetAmount,
        targetAsset:  targetAsset ?? null,
      },
    })

    return NextResponse.json({ milestone }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
