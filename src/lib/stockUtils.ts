import type { StockTransaction } from '@prisma/client'

export function formatShortValue(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`
  if (value >= 100_000)   return `₹${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000)     return `₹${(value / 1_000).toFixed(1)}K`
  return `₹${Math.round(value)}`
}

// holdingsQuantity: base qty from holdings file (never changed by transactions)
// existingAvgPrice: fallback avgPrice when no BUY transactions exist
export function calculateStockMetrics(
  transactions: StockTransaction[],
  holdingsQuantity = 0,
  existingAvgPrice = 0
): { quantity: number; avgPrice: number; investedValue: number } {
  const buys  = transactions.filter(t => t.type === 'BUY')
  const sells = transactions.filter(t => t.type === 'SELL')

  const totalBuyQty    = buys.reduce((sum, t) => sum + t.quantity, 0)
  const totalSellQty   = sells.reduce((sum, t) => sum + t.quantity, 0)
  const txnNet         = totalBuyQty - totalSellQty
  const quantity       = holdingsQuantity + txnNet

  const totalBuyAmount = buys.reduce((sum, t) => sum + t.amount, 0)
  // If there are BUY transactions, derive avgPrice from them; else keep the holdings avgPrice
  const avgPrice       = totalBuyQty > 0 ? totalBuyAmount / totalBuyQty : existingAvgPrice

  const investedValue  = quantity * avgPrice

  return { quantity, avgPrice, investedValue }
}
