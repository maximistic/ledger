export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { refreshFundMeta } from '@/lib/mfRefreshMeta'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await refreshFundMeta(id)
  return NextResponse.json({ ok: true })
}
