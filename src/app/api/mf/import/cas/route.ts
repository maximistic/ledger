import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapCasType, mfApiError } from '@/lib/mfUtils'

interface CasTransaction {
  date: string
  description: string
  amount: number
  units: number
  nav: number
  type?: string
}

interface CasFund {
  schemeName: string
  isin?: string | null
  folioNumber?: string | null
  units: number
  investedValue: number
  currentValue: number
  currentNav: number
  transactions: CasTransaction[]
}

interface CasParserResponse {
  funds: CasFund[]
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file     = formData.get('file')
  const password = formData.get('password')

  if (!(file instanceof File))
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })

  const parserUrl = process.env.CASPARSER_URL ?? 'http://localhost:8000/parse'

  // Forward to Python CAS parser
  let parserData: CasParserResponse
  try {
    const fwd = new FormData()
    fwd.append('file', file)
    if (typeof password === 'string' && password) fwd.append('password', password)

    const res = await fetch(parserUrl, { method: 'POST', body: fwd })
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`)
      return NextResponse.json({ error: `Parser error: ${text}` }, { status: 502 })
    }
    parserData = await res.json() as CasParserResponse
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach CAS parser at ${parserUrl}: ${err instanceof Error ? err.message : 'Fetch error'}` },
      { status: 502 }
    )
  }

  if (!Array.isArray(parserData.funds)) {
    return NextResponse.json({ error: 'Parser returned unexpected response format' }, { status: 502 })
  }

  let imported  = 0
  let updated   = 0
  let txCreated = 0
  let txSkipped = 0
  const errors: string[] = []

  for (const cf of parserData.funds) {
    try {
      const normalizedIsin = cf.isin ? cf.isin.trim().toUpperCase() : null

      // Find existing fund by ISIN first, then by name + folioNumber
      let fund = normalizedIsin
        ? await prisma.mutualFund.findUnique({ where: { isin: normalizedIsin } })
        : null

      if (!fund && cf.schemeName) {
        fund = await prisma.mutualFund.findFirst({
          where: {
            name:        { equals: cf.schemeName.trim(), mode: 'insensitive' },
            folioNumber: cf.folioNumber ? cf.folioNumber.trim() : null,
          },
        })
      }

      if (fund) {
        await prisma.mutualFund.update({
          where: { id: fund.id },
          data: {
            units:           cf.units,
            investedValue:   cf.investedValue,
            currentValue:    cf.currentValue,
            currentNav:      cf.currentNav,
            lastNavUpdatedAt: new Date(),
          },
        })
        updated++
      } else {
        fund = await prisma.mutualFund.create({
          data: {
            name:          cf.schemeName.trim(),
            isin:          normalizedIsin,
            folioNumber:   cf.folioNumber ? cf.folioNumber.trim() : null,
            units:         cf.units,
            investedValue: cf.investedValue,
            currentValue:  cf.currentValue,
            currentNav:    cf.currentNav,
            avgNav:        cf.units > 0 ? cf.investedValue / cf.units : 0,
            lastNavUpdatedAt: new Date(),
            source:        'CAS_IMPORT',
          },
        })
        imported++
      }

      const fundId = fund.id

      // Import transactions — deduplicate by fundId + date + amount + units
      const existingTxns = await prisma.mutualFundTransaction.findMany({ where: { fundId } })
      const txKey = (t: { date: Date | string; amount: number; units: number }) =>
        `${new Date(t.date).toISOString().slice(0, 10)}|${t.amount}|${t.units}`
      const existingKeys = new Set(existingTxns.map(txKey))

      for (const ct of cf.transactions) {
        try {
          const parsedDate = new Date(ct.date)
          if (isNaN(parsedDate.getTime())) continue

          const key = `${parsedDate.toISOString().slice(0, 10)}|${ct.amount}|${ct.units}`
          if (existingKeys.has(key)) {
            txSkipped++
            continue
          }

          const txType = ct.type && ct.type !== '' ? ct.type : mapCasType(ct.description ?? '')

          await prisma.mutualFundTransaction.create({
            data: {
              fundId,
              date:        parsedDate,
              type:        txType,
              units:       Math.abs(ct.units),
              nav:         ct.nav > 0 ? ct.nav : 0,
              amount:      Math.abs(ct.amount),
              description: ct.description ? ct.description.trim() : null,
              autoCreated: true,
            },
          })
          existingKeys.add(key)
          txCreated++
        } catch (txErr) {
          errors.push(`${cf.schemeName} txn ${ct.date}: ${txErr instanceof Error ? txErr.message : 'error'}`)
        }
      }
    } catch (err) {
      errors.push(`${cf.schemeName}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return NextResponse.json({
    imported,
    updated,
    transactions: { created: txCreated, skipped: txSkipped },
    errors,
  })
}
