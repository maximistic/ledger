export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { MFAPI_BASE } from '@/lib/yahoo'

const cache = new Map<string, { results: unknown[]; ts: number }>()
const TTL   = 5 * 60 * 1000

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 1) return NextResponse.json({ results: [] })

    const key    = q.toLowerCase()
    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < TTL)
      return NextResponse.json({ results: cached.results })

    const res = await fetch(
      `${MFAPI_BASE}/search?q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return NextResponse.json({ results: [] })

    const data = await res.json() as unknown[]
    if (!Array.isArray(data)) return NextResponse.json({ results: [] })

    const results = data.slice(0, 8).map((r: unknown) => {
      const row = r as { schemeCode: number; schemeName: string; fundHouse?: string }
      return { amfiCode: String(row.schemeCode), schemeName: row.schemeName, fundHouse: row.fundHouse ?? '' }
    })

    cache.set(key, { results, ts: Date.now() })
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[GET /api/mf/search]', err)
    return NextResponse.json({ results: [] })
  }
}
