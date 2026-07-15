function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function monthsBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime()
  if (diffMs <= 0) return 0
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375)
}

export function calculateFDCurrentValue(params: {
  principal: number
  annualRate: number
  startDate: Date
  compoundingType: string
  asOf?: Date
}): { currentValue: number; interestEarned: number } {
  const { principal, annualRate, startDate, compoundingType } = params
  const asOf = params.asOf ?? new Date()
  const r = annualRate / 100
  const t = (asOf.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  if (t <= 0) return { currentValue: principal, interestEarned: 0 }

  let A: number
  switch (compoundingType) {
    case 'SIMPLE':
      A = principal * (1 + r * t)
      break
    case 'MONTHLY':
      A = principal * Math.pow(1 + r / 12, 12 * t)
      break
    case 'QUARTERLY':
      A = principal * Math.pow(1 + r / 4, 4 * t)
      break
    case 'HALF_YEARLY':
      A = principal * Math.pow(1 + r / 2, 2 * t)
      break
    case 'ANNUALLY':
      A = principal * Math.pow(1 + r, t)
      break
    default:
      A = principal * Math.pow(1 + r / 4, 4 * t)
  }

  const currentValue = Math.round(A * 100) / 100
  const interestEarned = Math.round((currentValue - principal) * 100) / 100
  return { currentValue, interestEarned }
}

export function calculateFDMaturityValue(params: {
  principal: number
  annualRate: number
  startDate: Date
  compoundingType: string
  maturityDate: Date
}): number {
  return calculateFDCurrentValue({
    principal: params.principal,
    annualRate: params.annualRate,
    startDate: params.startDate,
    compoundingType: params.compoundingType,
    asOf: params.maturityDate,
  }).currentValue
}

export function calculateRDCurrentValue(params: {
  monthlyAmount: number
  annualRate: number
  startDate: Date
  dayOfMonth: number
  topUps?: Array<{ amount: number; startDate: Date; isRecurring: boolean }>
  asOf?: Date
}): { currentValue: number; totalInvested: number; interestEarned: number } {
  const { monthlyAmount, annualRate, startDate, dayOfMonth } = params
  const topUps = params.topUps ?? []
  const asOf = params.asOf ?? new Date()
  const r = annualRate / 100

  type Installment = { date: Date; amount: number }
  const installments: Installment[] = []

  // First installment: dayOfMonth of startDate's month, clamped to actual month length
  const firstDay = Math.min(dayOfMonth, getDaysInMonth(startDate.getFullYear(), startDate.getMonth()))
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), firstDay)
  if (current < startDate) {
    const nm = startDate.getMonth() + 1
    const ny = nm > 11 ? startDate.getFullYear() + 1 : startDate.getFullYear()
    const am = nm % 12
    current = new Date(ny, am, Math.min(dayOfMonth, getDaysInMonth(ny, am)))
  }

  while (current <= asOf) {
    installments.push({ date: new Date(current), amount: monthlyAmount })
    const nm = current.getMonth() + 1
    const ny = nm > 11 ? current.getFullYear() + 1 : current.getFullYear()
    const am = nm % 12
    current = new Date(ny, am, Math.min(dayOfMonth, getDaysInMonth(ny, am)))
  }

  // Apply recurring top-ups to each applicable installment
  for (const topUp of topUps) {
    if (topUp.isRecurring) {
      for (const inst of installments) {
        if (inst.date >= topUp.startDate) {
          inst.amount += topUp.amount
        }
      }
    }
  }

  // One-time top-ups as individual installments
  for (const topUp of topUps) {
    if (!topUp.isRecurring && topUp.startDate <= asOf) {
      installments.push({ date: topUp.startDate, amount: topUp.amount })
    }
  }

  if (installments.length === 0) {
    return { currentValue: 0, totalInvested: 0, interestEarned: 0 }
  }

  let currentValue = 0
  let totalInvested = 0

  for (const inst of installments) {
    const m = monthsBetween(inst.date, asOf)
    // Quarterly compounding RD formula: P × (1 + r/4)^(4 × m/12)
    const value = inst.amount * Math.pow(1 + r / 4, (4 * m) / 12)
    currentValue += value
    totalInvested += inst.amount
  }

  currentValue = Math.round(currentValue * 100) / 100
  totalInvested = Math.round(totalInvested * 100) / 100
  const interestEarned = Math.round((currentValue - totalInvested) * 100) / 100

  return { currentValue, totalInvested, interestEarned }
}

export function calculateRDMaturityValue(params: {
  monthlyAmount: number
  annualRate: number
  startDate: Date
  dayOfMonth: number
  topUps?: Array<{ amount: number; startDate: Date; isRecurring: boolean }>
  maturityDate: Date
}): number {
  return calculateRDCurrentValue({
    monthlyAmount: params.monthlyAmount,
    annualRate: params.annualRate,
    startDate: params.startDate,
    dayOfMonth: params.dayOfMonth,
    topUps: params.topUps,
    asOf: params.maturityDate,
  }).currentValue
}

export function getDaysToMaturity(maturityDate: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const mat = new Date(maturityDate)
  mat.setHours(0, 0, 0, 0)
  const diff = mat.getTime() - today.getTime()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

export function getMaturityStatus(maturityDate: Date): 'MATURED' | 'CRITICAL' | 'WARNING' | 'OK' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const mat = new Date(maturityDate)
  mat.setHours(0, 0, 0, 0)
  if (mat < today) return 'MATURED'
  const days = getDaysToMaturity(maturityDate)
  if (days <= 30) return 'CRITICAL'
  if (days <= 90) return 'WARNING'
  return 'OK'
}
