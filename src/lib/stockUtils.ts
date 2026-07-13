import type { StockTransaction } from '@prisma/client'

export function formatShortValue(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`
  if (value >= 100_000)   return `₹${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000)     return `₹${(value / 1_000).toFixed(1)}K`
  return `₹${Math.round(value)}`
}

export function calculateStockMetrics(transactions: StockTransaction[]): {
  quantity: number
  avgPrice: number
  investedValue: number
} {
  const buys  = transactions.filter(t => t.type === 'BUY')
  const sells = transactions.filter(t => t.type === 'SELL')

  const totalBuyQty  = buys.reduce((sum, t) => sum + t.quantity, 0)
  const totalSellQty = sells.reduce((sum, t) => sum + t.quantity, 0)
  const quantity     = totalBuyQty - totalSellQty

  const totalBuyAmount = buys.reduce((sum, t) => sum + t.amount, 0)
  const avgPrice       = totalBuyQty > 0 ? totalBuyAmount / totalBuyQty : 0

  const investedValue = quantity * avgPrice

  return { quantity, avgPrice, investedValue }
}
