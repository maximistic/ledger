export function calculateProjectedCorpus(params: {
  currentCorpus: number
  monthlyContribution: number
  annualInterestRate: number
  yearsToRetirement: number
}): number {
  const { currentCorpus, monthlyContribution, annualInterestRate, yearsToRetirement } = params
  const r = annualInterestRate / 100
  const n = yearsToRetirement
  const monthlyRate = r / 12
  const months = n * 12

  const fvCorpus = currentCorpus * Math.pow(1 + r, n)
  const fvContributions =
    monthlyRate > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : monthlyContribution * months

  return Math.round(fvCorpus + fvContributions)
}

export function calculateAgeFromDOB(dob: string): number {
  const [dd, mm, yyyy] = dob.split('-')
  const birth = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function formatEPFMonth(wageMonth: string): string {
  return wageMonth.replace('-', ' ')
}
