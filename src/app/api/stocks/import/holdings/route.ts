import { NextRequest, NextResponse } from 'next/server'
import { processHoldingsBuffer } from '@/lib/importHoldings'

// Holdings is the source of truth for current position.
// holdingsQuantity is set to the file value on every import.
// On update, existing transactions are preserved and quantity is recalculated
// as: holdingsQuantity + (BUY txns - SELL txns).

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  return processHoldingsBuffer(buffer)
}
