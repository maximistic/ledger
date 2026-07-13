export function formatINR(value: number): string {
  return '₹' + Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatINRSigned(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return sign + formatINR(Math.abs(value))
}

export function formatShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10_000_000) return `₹${(abs / 10_000_000).toFixed(1)}Cr`
  if (abs >= 100_000)    return `₹${(abs / 100_000).toFixed(1)}L`
  if (abs >= 1_000)      return `₹${(abs / 1_000).toFixed(1)}K`
  return `₹${Math.round(abs)}`
}

export function formatShortSigned(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return sign + formatShort(Math.abs(value))
}

export function formatPctSigned(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
