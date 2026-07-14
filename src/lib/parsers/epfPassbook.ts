import 'server-only'
import { extractText } from 'unpdf'

export interface EPFPassbookResult {
  uan: string
  memberId: string
  memberName: string
  employerName: string
  dateOfBirth: string
  financialYear: string | null   // e.g. "2025-2026", null if not found in PDF
  transactions: Array<{
    wageMonth: string
    transactionDate: Date
    type: string
    particulars: string
    wages: number
    employeeAmount: number
    employerAmount: number
    pensionAmount: number
  }>
  closingEmployee: number
  closingEmployer: number
  closingPension: number
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

// Use local Date (not UTC) so "01-11-2025" → 1 Nov 2025 in local time
function parseDMY(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split('-')
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

export async function parseEPFPassbook(pdfBuffer: Buffer): Promise<EPFPassbookResult> {
  try {
    const uint8Array = new Uint8Array(pdfBuffer)
    const { text } = await extractText(uint8Array, { mergePages: true })

    // Real EPFO passbook format has Hindi label | English label VALUE
    // e.g. ";w , u | UAN 102247290774"
    const uanMatch = text.match(/\|\s*UAN\s+(\d+)/)
    const uan = uanMatch?.[1] ?? ''
    if (!uan) throw new Error('Could not parse UAN from passbook')

    // "Member ID/Name MHBAN00456650001767209 / SRIKAILAASH KUMAR S"
    const memberMatch = text.match(/Member ID\/Name\s+([A-Z0-9]+)\s*\/\s*([^\n]+)/)
    const memberId   = memberMatch?.[1]?.trim() ?? ''
    const memberName = (memberMatch?.[2] ?? '').trim().split(/\s{2,}/)[0].slice(0, 60)

    // "Establishment ID/Name MHBAN0045665000 / ACCENTURE SOLUTIONS PVT. LTD."
    const employerMatch = text.match(/Establishment ID\/Name\s+[A-Z0-9]+\s*\/\s*([^\n]+)/)
    console.log('Employer regex match:', employerMatch?.[1])
    const employerName  = employerMatch?.[1]?.trim().slice(0, 80) ?? ''

    // "Date of Birth 15-05-2004"
    const dobMatch    = text.match(/Date of Birth\s+(\d{2}-\d{2}-\d{4})/)
    const dateOfBirth = dobMatch?.[1] ?? ''

    // "Financial Year - 2025-2026" (en-dash or hyphen)
    const fyMatch      = text.match(/Financial Year\s*[-–]\s*(\d{4}-\d{4})/)
    const financialYear = fyMatch?.[1] ?? null

    // Transaction row format:
    // "Oct-2025 01-11-2025 CR Cont. for Due-Month 112025 14,395 0 1,727 1,727 0"
    // Groups: wageMonth, date, type, particulars, wages, epsWages(skip), empEPF, emplrEPF, pension
    const txRegex =
      /([A-Za-z]{3}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(CR|DR)\s+(Cont\.[^\n]+?)\s+([\d,]+)\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+(\d+)/g

    const transactions: EPFPassbookResult['transactions'] = []
    let m: RegExpExecArray | null

    while ((m = txRegex.exec(text)) !== null) {
      const [, wageMonth, dateStr, type, particulars, wages, , employeeEPF, employerEPF, pension] = m

      // Belt-and-suspenders skip for any summary rows that sneak through
      if (
        particulars.includes('Total')      ||
        particulars.includes('Interest')   ||
        particulars.includes('Closing')    ||
        particulars.includes('Transfer')   ||
        particulars.includes('Withdrawal')
      ) continue

      transactions.push({
        wageMonth,
        transactionDate: parseDMY(dateStr),
        type,
        particulars: particulars.trim(),
        wages:          parseNum(wages),
        employeeAmount: parseNum(employeeEPF),
        employerAmount: parseNum(employerEPF),
        pensionAmount:  parseNum(pension),
      })
    }

    if (transactions.length === 0) throw new Error('No transactions found in passbook')

    // "Closing Balance as on 31/03/2026 14,327 14,327 0"
    const closingMatch    = text.match(/Closing Balance as on \d{2}\/\d{2}\/\d{4}\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/)
    const closingEmployee = closingMatch ? parseNum(closingMatch[1]) : 0
    const closingEmployer = closingMatch ? parseNum(closingMatch[2]) : 0
    const closingPension  = closingMatch ? parseNum(closingMatch[3]) : 0
    console.log('Parsed closing balances:', {
      employee: closingEmployee,
      employer: closingEmployer,
      pension: closingPension,
    })

    return {
      uan,
      memberId,
      memberName,
      employerName,
      dateOfBirth,
      financialYear,
      transactions,
      closingEmployee,
      closingEmployer,
      closingPension,
    }
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error(`Failed to parse EPF passbook: ${String(err)}`)
  }
}
