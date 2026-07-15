import type { USStockTransaction } from '@prisma/client'

// holdingsQuantity: base qty from holdings file (never changed by transactions)
// existingAvgPriceUSD: fallback when no BUY transactions exist
export function calculateUSStockMetrics(
  transactions: USStockTransaction[],
  holdingsQuantity = 0,
  existingAvgPriceUSD = 0
): { quantity: number; avgPriceUSD: number } {
  const buys  = transactions.filter(t => t.type === 'BUY')
  const sells = transactions.filter(t => t.type === 'SELL')

  const totalBuyQty  = buys.reduce((sum, t) => sum + t.quantity, 0)
  const totalSellQty = sells.reduce((sum, t) => sum + t.quantity, 0)
  const txnNet       = totalBuyQty - totalSellQty
  const quantity     = holdingsQuantity + txnNet

  // Weighted avg from BUY transactions; fall back to holdings avg if no buys
  const totalBuyAmount = buys.reduce((sum, t) => sum + t.priceUSD * t.quantity, 0)
  const avgPriceUSD    = totalBuyQty > 0 ? totalBuyAmount / totalBuyQty : existingAvgPriceUSD

  return { quantity, avgPriceUSD }
}
