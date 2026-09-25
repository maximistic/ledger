export type TabKey = '1M' | '6M' | '1Y' | '5Y'

export interface Visibility {
  trendCard:      boolean
  allocationCard: boolean
  treemapCard:    boolean
  performersCard: boolean
  eventsCard:     boolean
  milestonesCard: boolean
}

export interface RiskBucket { value: number; pct: number }

export interface DashboardSummary {
  totalNetWorth: number
  totalInvested: number
  gainLoss:      number
  gainLossPct:   number
  riskProfile: {
    equity:        RiskBucket
    debt:          RiskBucket
    gold:          RiskBucket
    international: RiskBucket
  }
  allocation: {
    stocks: number; mf: number; epf: number
    fd: number; rd: number; usStocks: number; custom?: number
  }
  breakdown: {
    stocks:   { value: number; invested: number }
    mf:       { value: number; invested: number }
    epf:      { value: number; invested: number }
    fd:       { value: number; invested: number }
    rd:       { value: number; invested: number }
    usStocks: { value: number; invested: number }
    custom?:        { value: number; count: number }
    customClasses?: { id: string; name: string; value: number; purchasePrice: number }[]
  }
}

export interface SnapshotPoint {
  date:          string
  totalNetWorth: number
  investedValue: number
}

export interface SnapshotData {
  period:    string
  changeAmt: number
  changePct: number
  chartData: SnapshotPoint[]
}

export interface Performer {
  name:         string
  ticker:       string
  assetClass:   string
  gainLossPct:  number
  currentValue: number
}

export interface Performers {
  gainers: Performer[]
  losers:  Performer[]
}

export interface UpcomingEvent {
  id:      string
  type:    'FD_MATURITY' | 'RD_MATURITY' | 'EPF_CONTRIBUTION' | 'RD_INSTALLMENT' | 'SIP'
  label:   string
  date:    string
  amount:  number
  daysLeft: number
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface UpcomingEvents {
  events: UpcomingEvent[]
}

export interface Milestone {
  id:           string
  title:        string
  targetAmount: number
  targetAsset:  string | null
  achievedDate: string | null
  isAchieved:   boolean
  currentValue: number
  progressPct:  number
  amountAway:   number
}
