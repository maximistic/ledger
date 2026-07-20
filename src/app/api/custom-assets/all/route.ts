export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  try {
    await prisma.customAssetClass.deleteMany()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/custom-assets/all]', error)
    return NextResponse.json({ error: 'Failed to reset custom assets' }, { status: 500 })
  }
}
