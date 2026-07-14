export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const transactions = await prisma.ePFTransaction.findMany({
      orderBy: { transactionDate: 'desc' },
    })
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[GET /api/epf/transactions]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      wageMonth?: unknown
      transactionDate?: unknown
      type?: unknown
      employeeAmount?: unknown
      employerAmount?: unknown
      pensionAmount?: unknown
      wages?: unknown
      particulars?: unknown
    }

    const wageMonth       = String(body.wageMonth       ?? '').trim()
    const type            = String(body.type            ?? '').trim()
    const employeeAmount  = parseFloat(String(body.employeeAmount  ?? 0))
    const employerAmount  = parseFloat(String(body.employerAmount  ?? 0))
    const pensionAmount   = parseFloat(String(body.pensionAmount   ?? 0))
    const wages           = body.wages !== undefined ? parseFloat(String(body.wages)) : null
    const particulars     = body.particulars ? String(body.particulars).trim() : null

    if (!wageMonth)            return NextResponse.json({ error: 'wageMonth is required' },       { status: 400 })
    if (!type)                 return NextResponse.json({ error: 'type is required' },            { status: 400 })
    if (!body.transactionDate) return NextResponse.json({ error: 'transactionDate is required' }, { status: 400 })
    if (!Number.isFinite(employeeAmount) || employeeAmount < 0)
      return NextResponse.json({ error: 'employeeAmount must be >= 0' }, { status: 400 })
    if (!Number.isFinite(employerAmount) || employerAmount < 0)
      return NextResponse.json({ error: 'employerAmount must be >= 0' }, { status: 400 })

    const account = await prisma.ePFAccount.findFirst()
    if (!account) return NextResponse.json({ error: 'No EPF account found' }, { status: 404 })

    const duplicate = await prisma.ePFTransaction.findFirst({
      where: { accountId: account.id, wageMonth, type, employeeAmount },
    })
    if (duplicate) return NextResponse.json({ error: 'Duplicate transaction' }, { status: 409 })

    const transaction = await prisma.ePFTransaction.create({
      data: {
        accountId:       account.id,
        wageMonth,
        transactionDate: new Date(String(body.transactionDate)),
        type,
        particulars,
        wages:           wages !== null && Number.isFinite(wages) ? wages : null,
        employeeAmount,
        employerAmount,
        pensionAmount:   Number.isFinite(pensionAmount) ? pensionAmount : 0,
        autoCreated:     false,
      },
    })

    let updatedAccount
    if (type === 'CR' || type === 'INTEREST') {
      updatedAccount = await prisma.ePFAccount.update({
        where: { id: account.id },
        data: {
          employeeBalance: { increment: employeeAmount },
          employerBalance: { increment: employerAmount },
          pensionBalance:  { increment: Number.isFinite(pensionAmount) ? pensionAmount : 0 },
        },
      })
    } else if (type === 'DR') {
      updatedAccount = await prisma.ePFAccount.update({
        where: { id: account.id },
        data: {
          employeeBalance: { decrement: employeeAmount },
          employerBalance: { decrement: employerAmount },
        },
      })
    } else {
      updatedAccount = account
    }

    return NextResponse.json({ transaction, account: updatedAccount }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/epf/transactions]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
