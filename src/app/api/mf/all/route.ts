export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  try {
    await prisma.mutualFundTransaction.deleteMany()
    await prisma.sipConfig.deleteMany()
    await prisma.mutualFund.deleteMany()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/mf/all]', error)
    return NextResponse.json({ error: 'Failed to delete all funds' }, { status: 500 })
  }
}
