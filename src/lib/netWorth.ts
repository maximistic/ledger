import type { Stock, MutualFund, EPFAccount, FDAccount, RDAccount, USStock } from '@prisma/client'

type CustomClassWithEntries = {
  entries: { currentValue: number; purchasePrice: number }[]
}

export interface NetWorthBreakdown {
  totalNetWorth:     number
  stocksValue:       number
  mfValue:           number
  epfValue:          number
  fdValue:           number
  rdValue:           number
  usStocksValue:     number
  customValue:       number
  investedValue:     number
  stocksInvested:    number
  mfInvested:        number
  fdInvested:        number
  rdInvested:        number
  usStocksInvested:  number
  customInvested:    number
}

export function computeNetWorthFromData(
  stocks:        Pick<Stock, 'currentValue' | 'investedValue'>[],
  mfs:           Pick<MutualFund, 'currentValue' | 'investedValue'>[],
  epfAccounts:   Pick<EPFAccount, 'employeeBalance' | 'employerBalance' | 'pensionBalance'>[],
  fds:           Pick<FDAccount, 'currentValue' | 'principal'>[],
  rds:           Pick<RDAccount, 'currentValue' | 'totalInvested'>[],
  usStocks:      Pick<USStock, 'currentValueINR' | 'investedValueINR'>[],
  customClasses: CustomClassWithEntries[],
): NetWorthBreakdown {
  const stocksValue      = stocks.reduce((s, x) => s + x.currentValue, 0)
  const mfValue          = mfs.reduce((s, x) => s + x.currentValue, 0)
  const epfValue         = epfAccounts.reduce((s, x) => s + x.employeeBalance + x.employerBalance + x.pensionBalance, 0)
  const fdValue          = fds.reduce((s, x) => s + x.currentValue, 0)
  const rdValue          = rds.reduce((s, x) => s + x.currentValue, 0)
  const usStocksValue    = usStocks.reduce((s, x) => s + x.currentValueINR, 0)
  const customValue      = customClasses.reduce((s, cls) => s + cls.entries.reduce((es, e) => es + e.currentValue, 0), 0)

  const stocksInvested   = stocks.reduce((s, x) => s + x.investedValue, 0)
  const mfInvested       = mfs.reduce((s, x) => s + x.investedValue, 0)
  const fdInvested       = fds.reduce((s, x) => s + x.principal, 0)
  const rdInvested       = rds.reduce((s, x) => s + x.totalInvested, 0)
  const usStocksInvested = usStocks.reduce((s, x) => s + x.investedValueINR, 0)
  const customInvested   = customClasses.reduce((s, cls) => s + cls.entries.reduce((es, e) => es + e.purchasePrice, 0), 0)

  const totalNetWorth = stocksValue + mfValue + epfValue + fdValue + rdValue + usStocksValue + customValue
  const investedValue = stocksInvested + mfInvested + epfValue + fdInvested + rdInvested + usStocksInvested + customInvested

  return {
    totalNetWorth, stocksValue, mfValue, epfValue, fdValue, rdValue, usStocksValue, customValue,
    investedValue, stocksInvested, mfInvested, fdInvested, rdInvested, usStocksInvested, customInvested,
  }
}
