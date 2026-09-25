import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeNetWorthFromData } from '@/lib/netWorth'

const ETF_CLASSIFICATIONS: Record<string, 'equity' | 'debt' | 'gold' | 'international'> = {
  // Gold ETFs
  GOLDBEES:    'gold',
  GOLDIETF:    'gold',
  SGOLD:       'gold',
  GOLD1:       'gold',
  AXISGOLD:    'gold',
  MGOLD:       'gold',
  LICMFGOLD:   'gold',
  // International ETFs
  HNGSNGBEES:  'international',
  MAFANG:      'international',
  NASDAQBEES:  'international',
  MOM100:      'international',
  // Debt ETFs
  LIQUIDBEES:  'debt',
  LIQUIDSBI:   'debt',
  // Equity ETFs
  NIFTYBEES:   'equity',
  JUNIORBEES:  'equity',
  BANKBEES:    'equity',
  CPSEETF:     'equity',
  SETFNIF50:   'equity',
  PHARMABEES:  'equity',
  INFRABEES:   'equity',
}

function classifyStock(ticker: string): 'equity' | 'debt' | 'gold' | 'international' {
  return ETF_CLASSIFICATIONS[ticker.toUpperCase()] ?? 'equity'
}

function classifyMF(fundCategory: string | null): 'equity' | 'debt' | 'gold' | 'international' {
  if (!fundCategory) return 'equity'
  const cat = fundCategory.toLowerCase()
  if (cat.includes('gold') || cat.includes('silver')) return 'gold'
  if (
    cat.includes('international') || cat.includes('overseas') ||
    cat.includes('global') || cat.includes('foreign')
  ) return 'international'
  if (
    cat.includes('debt') || cat.includes('liquid') ||
    cat.includes('money market') || cat.includes('credit') ||
    cat.includes('gilt') || cat.includes('bond') ||
    cat.includes('banking and psu') || cat.includes('corporate bond') ||
    cat.includes('overnight') || cat.includes('ultra short') ||
    cat.includes('low duration') || cat.includes('short duration') ||
    cat.includes('medium duration') || cat.includes('long duration') ||
    cat.includes('dynamic bond') || cat.includes('floater')
  ) return 'debt'
  return 'equity'
}

function classifyCustom(className: string): 'equity' | 'debt' | 'gold' | 'international' {
  const lower = className.toLowerCase()
  if (lower.includes('gold') || lower.includes('silver'))              return 'gold'
  if (lower.includes('crypto'))                                        return 'international'
  if (lower.includes('ppf') || lower.includes('nps') || lower.includes('bond')) return 'debt'
  return 'equity'
}

export async function GET() {
  try {
    const [stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses] = await Promise.all([
      prisma.stock.findMany(),
      prisma.mutualFund.findMany(),
      prisma.ePFAccount.findMany(),
      prisma.fDAccount.findMany(),
      prisma.rDAccount.findMany(),
      prisma.uSStock.findMany(),
      prisma.customAssetClass.findMany({ include: { entries: true } }),
    ])

    const nw = computeNetWorthFromData(stocks, mfs, epfAccounts, fds, rds, usStocks, customClasses)

    const gainLoss    = nw.totalNetWorth - nw.investedValue
    const gainLossPct = nw.investedValue > 0 ? (gainLoss / nw.investedValue) * 100 : 0

    // ── Risk profile classification ──────────────────────────────────────────
    let equityValue        = 0
    let debtValue          = 0
    let goldValue          = 0
    let internationalValue = 0

    for (const stock of stocks) {
      const cls = classifyStock(stock.ticker)
      if (cls === 'equity')        equityValue        += stock.currentValue
      else if (cls === 'debt')     debtValue          += stock.currentValue
      else if (cls === 'gold')     goldValue          += stock.currentValue
      else                         internationalValue += stock.currentValue
    }

    for (const mf of mfs) {
      const cls = classifyMF(mf.fundCategory)
      if (cls === 'equity')        equityValue        += mf.currentValue
      else if (cls === 'debt')     debtValue          += mf.currentValue
      else if (cls === 'gold')     goldValue          += mf.currentValue
      else                         internationalValue += mf.currentValue
    }

    // EPF and FDs/RDs are always debt
    debtValue += nw.epfValue + nw.fdValue + nw.rdValue
    // US stocks are always international
    internationalValue += nw.usStocksValue

    for (const cls of customClasses) {
      const clsValue = cls.entries.reduce((s, e) => s + e.currentValue, 0)
      const bucket   = classifyCustom(cls.name)
      if (bucket === 'equity')        equityValue        += clsValue
      else if (bucket === 'debt')     debtValue          += clsValue
      else if (bucket === 'gold')     goldValue          += clsValue
      else                            internationalValue += clsValue
    }

    const riskTotal = equityValue + debtValue + goldValue + internationalValue || 1
    const tnw       = nw.totalNetWorth

    return NextResponse.json({
      totalNetWorth: tnw,
      totalInvested: nw.investedValue,
      gainLoss,
      gainLossPct,
      riskProfile: {
        equity:        { value: equityValue,        pct: Math.round((equityValue        / riskTotal) * 100) },
        debt:          { value: debtValue,          pct: Math.round((debtValue          / riskTotal) * 100) },
        gold:          { value: goldValue,          pct: Math.round((goldValue          / riskTotal) * 100) },
        international: { value: internationalValue, pct: Math.round((internationalValue / riskTotal) * 100) },
      },
      allocation: {
        stocks:   tnw > 0 ? (nw.stocksValue   / tnw) * 100 : 0,
        mf:       tnw > 0 ? (nw.mfValue       / tnw) * 100 : 0,
        epf:      tnw > 0 ? (nw.epfValue      / tnw) * 100 : 0,
        fd:       tnw > 0 ? (nw.fdValue       / tnw) * 100 : 0,
        rd:       tnw > 0 ? (nw.rdValue       / tnw) * 100 : 0,
        usStocks: tnw > 0 ? (nw.usStocksValue / tnw) * 100 : 0,
        custom:   tnw > 0 ? (nw.customValue   / tnw) * 100 : 0,
      },
      breakdown: {
        stocks:   { value: nw.stocksValue,   invested: nw.stocksInvested   },
        mf:       { value: nw.mfValue,       invested: nw.mfInvested       },
        epf:      { value: nw.epfValue,      invested: nw.epfValue         },
        fd:       { value: nw.fdValue,       invested: nw.fdInvested       },
        rd:       { value: nw.rdValue,       invested: nw.rdInvested       },
        usStocks: { value: nw.usStocksValue, invested: nw.usStocksInvested },
        custom: {
          value: nw.customValue,
          count: customClasses.length,
        },
        customClasses: customClasses.map(c => ({
          id:            c.id,
          name:          c.name,
          value:         c.entries.reduce((s, e) => s + e.currentValue, 0),
          purchasePrice: c.entries.reduce((s, e) => s + e.purchasePrice, 0),
        })).filter(c => c.value > 0),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
