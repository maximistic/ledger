export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseEPFPassbook } from '@/lib/parsers/epfPassbook'

function parseDMY(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split('-')
  return new Date(`${yyyy}-${mm}-${dd}`)
}

// "2025-2026" >= "2024-2025" — lexicographic comparison works for "YYYY-YYYY" strings
function fyIsNewerOrSame(incoming: string, stored: string): boolean {
  return incoming >= stored
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string')
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const parsed = await parseEPFPassbook(buffer)

    const dateOfBirth = parsed.dateOfBirth ? parseDMY(parsed.dateOfBirth) : null

    const crTxns = parsed.transactions
      .filter(t => t.type === 'CR')
      .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())

    const detectedEmployeeMonthly = crTxns.length > 0 ? crTxns[0].employeeAmount : 0
    const detectedEmployerMonthly = crTxns.length > 0 ? crTxns[0].employerAmount : 0

    const pdfFY = parsed.financialYear  // e.g. "2025-2026" or null

    const existing = await prisma.ePFAccount.findFirst()

    // Only overwrite balances when this PDF is as recent as (or newer than) what we have.
    // Guards against: uploading FY24-25 after FY25-26 was already imported.
    const shouldUpdateBalance =
      !existing ||                                          // first import
      !existing.latestFinancialYear ||                      // no FY stored yet
      !pdfFY ||                                             // PDF has no FY label (be safe)
      fyIsNewerOrSame(pdfFY, existing.latestFinancialYear) // incoming >= stored

    // latestFinancialYear: keep whichever is newer between stored and incoming
    const newLatestFY =
      pdfFY && existing?.latestFinancialYear
        ? (pdfFY > existing.latestFinancialYear ? pdfFY : existing.latestFinancialYear)
        : (pdfFY ?? existing?.latestFinancialYear ?? null)

    // Earliest transaction date → auto-fill trackingStartDate on first import
    const sortedByDate = [...parsed.transactions].sort(
      (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
    )
    const firstTxDate = sortedByDate[0]?.transactionDate ?? null

    // Fields always written regardless of FY
    const alwaysUpdate = {
      uan:                 parsed.uan          || undefined,
      memberId:            parsed.memberId     || undefined,
      employerName:        parsed.employerName || undefined,
      dateOfBirth:         dateOfBirth         || undefined,
      latestFinancialYear: newLatestFY         || undefined,
      // Preserve existing start date; auto-fill from first transaction if not yet set
      trackingStartDate:   (existing?.trackingStartDate ?? firstTxDate) ?? undefined,
    }

    // Balance fields — only written when this PDF is the latest (or first)
    const balanceUpdate = shouldUpdateBalance ? {
      employeeBalance: parsed.closingEmployee,
      employerBalance: parsed.closingEmployer,
      pensionBalance:  parsed.closingPension,
    } : {}

    const account = existing
      ? await prisma.ePFAccount.update({
          where: { id: existing.id },
          data: {
            ...alwaysUpdate,
            ...balanceUpdate,
            ...(existing.employeeMonthly === 0 && detectedEmployeeMonthly > 0
              ? { employeeMonthly: detectedEmployeeMonthly }
              : {}),
            ...(existing.employerMonthly === 0 && detectedEmployerMonthly > 0
              ? { employerMonthly: detectedEmployerMonthly }
              : {}),
          },
        })
      : await prisma.ePFAccount.create({
          data: {
            ...alwaysUpdate,
            ...balanceUpdate,
            employeeMonthly: detectedEmployeeMonthly,
            employerMonthly: detectedEmployerMonthly,
          },
        })

    let created = 0
    let skipped = 0

    for (const txn of parsed.transactions) {
      const duplicate = await prisma.ePFTransaction.findFirst({
        where: {
          accountId:      account.id,
          wageMonth:      txn.wageMonth,
          type:           txn.type,
          employeeAmount: txn.employeeAmount,
        },
      })

      if (duplicate) { skipped++; continue }

      await prisma.ePFTransaction.create({
        data: {
          accountId:       account.id,
          wageMonth:       txn.wageMonth,
          transactionDate: txn.transactionDate,
          type:            txn.type,
          particulars:     txn.particulars,
          wages:           txn.wages,
          employeeAmount:  txn.employeeAmount,
          employerAmount:  txn.employerAmount,
          pensionAmount:   txn.pensionAmount,
          autoCreated:     false,
        },
      })
      created++
    }

    return NextResponse.json({
      account,
      transactions:   { created, skipped },
      autoDetected:   { employeeMonthly: detectedEmployeeMonthly, employerMonthly: detectedEmployerMonthly },
      financialYear:  pdfFY,
      balanceUpdated: shouldUpdateBalance,
    })
  } catch (error) {
    console.error('[POST /api/epf/import]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
