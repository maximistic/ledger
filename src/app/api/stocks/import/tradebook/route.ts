import { NextRequest, NextResponse } from 'next/server'
import { processTradeBookBuffer } from '@/lib/importTradeBook'

// Tradebook only enriches existing stocks with transaction history.
// Tickers not found in the DB are skipped — never created.
// Stock quantity/position is NOT overwritten; holdings owns that.

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
  return processTradeBookBuffer(buffer)
}
