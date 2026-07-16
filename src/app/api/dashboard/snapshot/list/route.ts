import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const snapshots = await prisma.snapshot.findMany({
      orderBy: { date: 'desc' },
      select: {
        id:            true,
        date:          true,
        totalNetWorth: true,
        investedValue: true,
        stocksValue:   true,
        mfValue:       true,
        epfValue:      true,
        fdValue:       true,
        rdValue:       true,
        usStocksValue: true,
        source:        true,
        createdAt:     true,
      },
    })

    return NextResponse.json({ snapshots, count: snapshots.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
