export const YAHOO_FINANCE_BASE =
  process.env.YAHOO_FINANCE_BASE_URL ??
  'https://query1.finance.yahoo.com/v8/finance/chart'

export const YAHOO_SEARCH_BASE =
  process.env.YAHOO_SEARCH_BASE_URL ??
  'https://query2.finance.yahoo.com/v1/finance/search'

export const MFAPI_BASE =
  process.env.MFAPI_BASE_URL ??
  'https://api.mfapi.in/mf'

export const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept':     'application/json',
}

export function yahooChartUrl(ticker: string): string {
  return `${YAHOO_FINANCE_BASE}/${encodeURIComponent(ticker)}`
}

export function mfapiUrl(amfiCode: string): string {
  return `${MFAPI_BASE}/${amfiCode}`
}
