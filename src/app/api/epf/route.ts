export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const account = await prisma.ePFAccount.findFirst({
      include: { transactions: { orderBy: { transactionDate: 'asc' } } },
    })

    if (!account) return NextResponse.json({ account: null })

    const { transactions, ...accountData } = account

    const crTxns = transactions.filter(t => t.type === 'CR')
    const totalContributed = crTxns.reduce((s, t) => s + t.employeeAmount, 0)
    const totalEmployer    = crTxns.reduce((s, t) => s + t.employerAmount, 0)
    const totalCorpus      = account.employeeBalance + account.employerBalance + account.pensionBalance
    const interestEarned   = Math.max(0, totalCorpus - totalContributed - totalEmployer)

    return NextResponse.json({
      account: accountData,
      transactions,
      derived: { totalCorpus, totalContributed, totalEmployer, interestEarned },
    })
  } catch (error) {
    console.error('[GET /api/epf]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      uan?: string
      memberId?: string
      employerName?: string
      dateOfBirth?: string
      employeeBalance?: unknown
      employerBalance?: unknown
      pensionBalance?: unknown
      employeeMonthly?: unknown
      employerMonthly?: unknown
      dayOfMonth?: unknown
      trackingStartDate?: string
    }

    const employeeBalance  = parseFloat(String(body.employeeBalance  ?? 0))
    const employerBalance  = parseFloat(String(body.employerBalance  ?? 0))
    const pensionBalance   = parseFloat(String(body.pensionBalance   ?? 0))
    const employeeMonthly  = parseFloat(String(body.employeeMonthly  ?? 0))
    const employerMonthly  = parseFloat(String(body.employerMonthly  ?? 0))
    const dayOfMonth       = body.dayOfMonth ? parseInt(String(body.dayOfMonth)) : 1

    if (!Number.isFinite(employeeBalance) || employeeBalance < 0)
      return NextResponse.json({ error: 'employeeBalance must be >= 0' }, { status: 400 })
    if (!Number.isFinite(employerBalance) || employerBalance < 0)
      return NextResponse.json({ error: 'employerBalance must be >= 0' }, { status: 400 })
    if (!Number.isFinite(employeeMonthly) || employeeMonthly <= 0)
      return NextResponse.json({ error: 'employeeMonthly must be > 0' }, { status: 400 })
    if (!Number.isFinite(employerMonthly) || employerMonthly <= 0)
      return NextResponse.json({ error: 'employerMonthly must be > 0' }, { status: 400 })

    const existing = await prisma.ePFAccount.findFirst()

    const data = {
      uan:               body.uan?.trim()          || null,
      memberId:          body.memberId?.trim()      || null,
      employerName:      body.employerName?.trim()  || null,
      dateOfBirth:       body.dateOfBirth           ? new Date(body.dateOfBirth)           : null,
      trackingStartDate: body.trackingStartDate     ? new Date(body.trackingStartDate)     : null,
      employeeBalance,
      employerBalance,
      pensionBalance:   Number.isFinite(pensionBalance)  ? pensionBalance  : 0,
      employeeMonthly,
      employerMonthly,
      dayOfMonth,
    }

    const account = existing
      ? await prisma.ePFAccount.update({ where: { id: existing.id }, data })
      : await prisma.ePFAccount.create({ data })

    return NextResponse.json({ account })
  } catch (error) {
    console.error('[POST /api/epf]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>

    const existing = await prisma.ePFAccount.findFirst()
    if (!existing) return NextResponse.json({ error: 'No EPF account found' }, { status: 404 })

    const patch: {
      uan?: string | null
      memberId?: string | null
      employerName?: string | null
      dateOfBirth?: Date | null
      employeeBalance?: number
      employerBalance?: number
      pensionBalance?: number
      employeeMonthly?: number
      employerMonthly?: number
      dayOfMonth?: number
      trackingStartDate?: Date | null
      trackingStatus?: string
    } = {}

    if (body.uan           !== undefined) patch.uan           = typeof body.uan === 'string'           ? body.uan.trim()           || null : null
    if (body.memberId      !== undefined) patch.memberId      = typeof body.memberId === 'string'      ? body.memberId.trim()      || null : null
    if (body.employerName  !== undefined) patch.employerName  = typeof body.employerName === 'string'  ? body.employerName.trim()  || null : null
    if (body.dateOfBirth   !== undefined) patch.dateOfBirth   = body.dateOfBirth   ? new Date(String(body.dateOfBirth))   : null
    if (body.trackingStartDate !== undefined) patch.trackingStartDate = body.trackingStartDate ? new Date(String(body.trackingStartDate)) : null
    if (body.trackingStatus    !== undefined) patch.trackingStatus    = String(body.trackingStatus)
    if (body.employeeBalance   !== undefined) patch.employeeBalance   = parseFloat(String(body.employeeBalance))
    if (body.employerBalance   !== undefined) patch.employerBalance   = parseFloat(String(body.employerBalance))
    if (body.pensionBalance    !== undefined) patch.pensionBalance    = parseFloat(String(body.pensionBalance))
    if (body.employeeMonthly   !== undefined) patch.employeeMonthly   = parseFloat(String(body.employeeMonthly))
    if (body.employerMonthly   !== undefined) patch.employerMonthly   = parseFloat(String(body.employerMonthly))
    if (body.dayOfMonth        !== undefined) patch.dayOfMonth        = parseInt(String(body.dayOfMonth))

    const account = await prisma.ePFAccount.update({ where: { id: existing.id }, data: patch })
    return NextResponse.json({ account })
  } catch (error) {
    console.error('[PUT /api/epf]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const existing = await prisma.ePFAccount.findFirst()
    if (!existing) return NextResponse.json({ error: 'No EPF account found' }, { status: 404 })
    // Transactions cascade via onDelete: Cascade on the relation
    await prisma.ePFAccount.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/epf]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
