const BASE = 'https://www.alphavantage.co/query'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchStatement(fn, symbol, apiKey) {
  const res = await fetch(`${BASE}?function=${fn}&symbol=${symbol}&apikey=${apiKey}`)
  const data = await res.json()
  if (data['Error Message']) throw new Error(data['Error Message'])
  if (data['Note']) throw new Error(data['Note'])
  if (data['Information']) throw new Error(data['Information'])
  return data
}

function toNum(value) {
  if (value === undefined || value === null || value === 'None') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

// Revenue is never legitimately negative for an operating company, but the
// upstream API does occasionally return one — HOOD's 2026-06-30 quarter came
// back as -319M against $1,308M actually reported, with every other field in
// the row correct. Rather than presenting that as fact, rebuild it from the
// accounting identity revenue = grossProfit + costOfRevenue, and report it as
// unavailable if that is not possible either.
function plausibleRevenue(totalRevenue, grossProfit, costOfRevenue) {
  if (totalRevenue === null || totalRevenue >= 0) return totalRevenue
  if (grossProfit === null) return null
  const reconstructed = grossProfit + (costOfRevenue ?? 0)
  return reconstructed > 0 ? reconstructed : null
}

function mergeByDate(incomeReports, balanceReports, cashFlowReports) {
  const byDate = new Map()

  function get(date) {
    if (!byDate.has(date)) byDate.set(date, { date })
    return byDate.get(date)
  }

  for (const r of incomeReports) {
    const p = get(r.fiscalDateEnding)
    p.cogs = toNum(r.costOfRevenue)
    p.grossProfit = toNum(r.grossProfit)
    p.revenue = plausibleRevenue(toNum(r.totalRevenue), p.grossProfit, p.cogs)
    p.rd = toNum(r.researchAndDevelopment)
    p.sga = toNum(r.sellingGeneralAndAdministrative)
    p.ebitda = toNum(r.ebitda)
    p.operatingIncome = toNum(r.operatingIncome)
    p.netIncome = toNum(r.netIncome)
  }

  for (const r of balanceReports) {
    const p = get(r.fiscalDateEnding)
    p.cash = toNum(r.cashAndCashEquivalentsAtCarryingValue)
    p.cashAndShortTerm = toNum(r.cashAndShortTermInvestments)
    p.currentAssets = toNum(r.totalCurrentAssets)
    p.totalAssets = toNum(r.totalAssets)
    p.currentLiabilities = toNum(r.totalCurrentLiabilities)
    p.longTermDebt = toNum(r.longTermDebt)
    p.totalLiabilities = toNum(r.totalLiabilities)
    p.equity = toNum(r.totalShareholderEquity)
    p.retainedEarnings = toNum(r.retainedEarnings)
  }

  for (const r of cashFlowReports) {
    const p = get(r.fiscalDateEnding)
    p.operatingCF = toNum(r.operatingCashflow)
    const capex = toNum(r.capitalExpenditures)
    p.capex = capex === null ? null : -Math.abs(capex)
    p.depreciation = toNum(r.depreciationDepletionAndAmortization)
    p.dividendsPaid = toNum(r.dividendPayout)
    p.investingCF = toNum(r.cashflowFromInvestment)
    p.financingCF = toNum(r.cashflowFromFinancing)
    p.freeCF = (p.operatingCF !== null && p.capex !== null) ? p.operatingCF - Math.abs(p.capex) : null
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
}

function mapEpsReports(reports) {
  return reports
    .map((r) => ({ date: r.fiscalDateEnding, eps: toNum(r.reportedEPS) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
}

export async function fetchEpsHistory(symbol, apiKey) {
  const data = await fetchStatement('EARNINGS', symbol, apiKey)
  return {
    annual: mapEpsReports(data.annualEarnings ?? []),
    quarterly: mapEpsReports(data.quarterlyEarnings ?? []),
  }
}

export async function fetchFinancials(symbol, apiKey) {
  const income = await fetchStatement('INCOME_STATEMENT', symbol, apiKey)
  await delay(1100)
  const balance = await fetchStatement('BALANCE_SHEET', symbol, apiKey)
  await delay(1100)
  const cashFlow = await fetchStatement('CASH_FLOW', symbol, apiKey)

  return {
    annual: mergeByDate(income.annualReports ?? [], balance.annualReports ?? [], cashFlow.annualReports ?? []),
    quarterly: mergeByDate(income.quarterlyReports ?? [], balance.quarterlyReports ?? [], cashFlow.quarterlyReports ?? []),
  }
}
