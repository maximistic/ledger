import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_CONFIG = {
  enabled:       true,
  dayOfWeek:     0,
  hour:          22,
  refreshPrices: true,
}

export async function GET() {
  try {
    const configs = await prisma.snapshotConfig.findMany({ take: 1 })
    const config = configs[0] ?? await prisma.snapshotConfig.create({ data: DEFAULT_CONFIG })
    return NextResponse.json({ config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { enabled, dayOfWeek, hour, refreshPrices } = body

    const configs = await prisma.snapshotConfig.findMany({ take: 1 })
    const existing = configs[0]

    const config = existing
      ? await prisma.snapshotConfig.update({
          where: { id: existing.id },
          data: {
            ...(enabled       !== undefined && { enabled }),
            ...(dayOfWeek     !== undefined && { dayOfWeek }),
            ...(hour          !== undefined && { hour }),
            ...(refreshPrices !== undefined && { refreshPrices }),
          },
        })
      : await prisma.snapshotConfig.create({
          data: {
            ...DEFAULT_CONFIG,
            ...(enabled       !== undefined && { enabled }),
            ...(dayOfWeek     !== undefined && { dayOfWeek }),
            ...(hour          !== undefined && { hour }),
            ...(refreshPrices !== undefined && { refreshPrices }),
          },
        })

    return NextResponse.json({ config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
