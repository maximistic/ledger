import { NextRequest, NextResponse } from 'next/server'
import { processHoldingsBuffer } from '@/lib/importHoldings'
import { processTradeBookBuffer } from '@/lib/importTradeBook'

// POST /api/stocks/import?type=holdings  — XLSX
// POST /api/stocks/import?type=tradebook — CSV
export async function POST(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')

  if (type !== 'holdings' && type !== 'tradebook') {
    return NextResponse.json(
      { error: 'query param "type" must be "holdings" or "tradebook"' },
      { status: 400 }
    )
  }

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

  if (type === 'holdings') {
    return processHoldingsBuffer(buffer)
  } else {
    return processTradeBookBuffer(buffer)
  }
}
