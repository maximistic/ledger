type PdfParseResult = { text: string; numpages: number }
type PdfParseFn = (buffer: Buffer, options?: object) => Promise<PdfParseResult>

// pdf-parse ships CJS only; require() avoids ESM interop errors with moduleResolution:"bundler"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as PdfParseFn

export interface EPFPassbookResult {
  uan: string
  memberId: string
  employerName: string
  dateOfBirth: string
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

const SKIP_PARTICULARS = [
  'OB Int. Updated',
  'Total Contributions',
  'Total Transfer',
  'Total Withdrawals',
  'Interest details',
  'Closing Balance',
]

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

function parseDMY(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split('-')
  return new Date(`${yyyy}-${mm}-${dd}`)
}

export async function parseEPFPassbook(pdfBuffer: Buffer): Promise<EPFPassbookResult> {
  try {
    const data = await pdfParse(pdfBuffer)
    const text = data.text

    const uanMatch = text.match(/UAN\s*[\|:]\s*(\d+)/i)
    if (!uanMatch) throw new Error('Could not parse UAN from passbook')
    const uan = uanMatch[1]

    const memberMatch = text.match(/Member ID\/Name\s+([A-Z0-9]+)\s*\/\s*([^\n]+)/i)
    const memberId = memberMatch ? memberMatch[1].trim() : ''

    const employerMatch = text.match(/Establishment ID\/Name\s+[A-Z0-9]+\s*\/\s*([^\n]+)/i)
    const employerName = employerMatch ? employerMatch[1].trim() : ''

    const dobMatch = text.match(/Date of Birth\s+(\d{2}-\d{2}-\d{4})/i)
    const dateOfBirth = dobMatch ? dobMatch[1] : ''

    const txnPattern =
      /([A-Za-z]{3}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(CR|DR)\s+([^\n]+?)\s+([\d,]+)\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/g

    const transactions: EPFPassbookResult['transactions'] = []
    let m: RegExpExecArray | null

    while ((m = txnPattern.exec(text)) !== null) {
      // groups: wageMonth, date, type, particulars, wages, epsWages(skip), employeeEPF, employerEPF, pension, (extra)
      const [, wageMonth, dateStr, type, particulars, wages, , employeeEPF, employerEPF, pension] = m

      if (SKIP_PARTICULARS.some(p => particulars.includes(p))) continue

      transactions.push({
        wageMonth,
        transactionDate: parseDMY(dateStr),
        type,
        particulars: particulars.trim(),
        wages: parseNum(wages),
        employeeAmount: parseNum(employeeEPF),
        employerAmount: parseNum(employerEPF),
        pensionAmount: parseNum(pension),
      })
    }

    if (transactions.length === 0) throw new Error('No transactions found in passbook')

    const closingMatch = text.match(/Closing Balance[^\d]+([\d,]+)\s+([\d,]+)\s+([\d,]+)/)
    const closingEmployee = closingMatch ? parseNum(closingMatch[1]) : 0
    const closingEmployer = closingMatch ? parseNum(closingMatch[2]) : 0
    const closingPension  = closingMatch ? parseNum(closingMatch[3]) : 0

    return { uan, memberId, employerName, dateOfBirth, transactions, closingEmployee, closingEmployer, closingPension }
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error(`Failed to parse EPF passbook: ${String(err)}`)
  }
}
