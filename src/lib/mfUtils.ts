import type { MutualFundTransaction } from '@prisma/client'
import { Prisma } from '@prisma/client'

export const MF_BUY_TYPES  = new Set(['SIP', 'LUMPSUM', 'SWITCH_IN', 'DIVIDEND'])
export const MF_SELL_TYPES = new Set(['REDEMPTION', 'SWITCH_OUT'])
export const MF_VALID_TYPES = new Set([...MF_BUY_TYPES, ...MF_SELL_TYPES])

export function calculateMFMetrics(transactions: MutualFundTransaction[]): {
  units: number
  avgNav: number
  investedValue: number
} {
  const buys  = transactions.filter(t => MF_BUY_TYPES.has(t.type))
  const sells = transactions.filter(t => MF_SELL_TYPES.has(t.type))

  const totalBuyUnits    = buys.reduce((s, t) => s + t.units, 0)
  const totalSellUnits   = sells.reduce((s, t) => s + t.units, 0)
  const totalBuyWeighted = buys.reduce((s, t) => s + t.units * t.nav, 0)
  const totalBuyAmount   = buys.reduce((s, t) => s + t.amount, 0)
  const totalSellAmount  = sells.reduce((s, t) => s + t.amount, 0)

  const units         = totalBuyUnits - totalSellUnits
  const avgNav        = totalBuyUnits > 0 ? totalBuyWeighted / totalBuyUnits : 0
  const investedValue = totalBuyAmount - totalSellAmount

  return { units, avgNav, investedValue }
}

export function mfApiError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 'A fund with this ISIN already exists'
    if (error.code === 'P2025') return 'Fund not found'
    return 'Database error. Please try again.'
  }
  const msg = error instanceof Error ? error.message : 'Unknown error'
  if (msg.includes('PrismaClient') || msg.length > 200) return 'Something went wrong. Please try again.'
  return msg
}

// Maps a raw CAS transaction description to a canonical MF transaction type
export function mapCasType(description: string): string {
  const d = description.toLowerCase()
  if (d.includes('sip'))                                  return 'SIP'
  if (d.includes('lumpsum') || d.includes('purchase'))   return 'LUMPSUM'
  if (d.includes('redemption'))                          return 'REDEMPTION'
  if (d.includes('switch in'))                           return 'SWITCH_IN'
  if (d.includes('switch out'))                          return 'SWITCH_OUT'
  if (d.includes('dividend'))                            return 'DIVIDEND'
  return 'LUMPSUM'
}
