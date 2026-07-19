export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function POST() {
  // CAS parsing requires a separate parser service.
  // Return a clear error so the UI shows the right message.
  return NextResponse.json(
    { error: 'CAS import is not configured in this environment. Please add funds manually for now.' },
    { status: 503 },
  )
}
