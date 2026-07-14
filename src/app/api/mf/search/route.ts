import { NextRequest, NextResponse } from 'next/server'

interface MFSearchResult {
  schemeCode: number
  schemeName: string
  fundHouse: string
  schemeType: string
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''

  if (!q.trim()) return NextResponse.json({ results: [] })

  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q.trim())}`)
    if (!res.ok) return NextResponse.json({ results: [] })

    const data = await res.json() as MFSearchResult[]
    if (!Array.isArray(data)) return NextResponse.json({ results: [] })

    const results = data.slice(0, 6).map(r => ({
      amfiCode:   String(r.schemeCode),
      schemeName: r.schemeName,
      fundHouse:  r.fundHouse,
    }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
