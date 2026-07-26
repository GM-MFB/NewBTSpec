function pct(numerator, denominator) {
  if (numerator === null || numerator === undefined) return null
  if (denominator === null || denominator === undefined || denominator === 0) return null
  return (numerator / denominator) * 100
}

function ratio(a, b) {
  if (a === null || a === undefined) return null
  if (b === null || b === undefined || b === 0) return null
  return a / b
}

function change(current, previous) {
  if (current === null || current === undefined) return null
  if (previous === null || previous === undefined || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function revenueProfitData(periods) {
  return periods.map((p) => ({ date: p.date, revenue: p.revenue, grossProfit: p.grossProfit, netIncome: p.netIncome }))
}

export function marginTrendsData(periods) {
  return periods.map((p) => ({
    date: p.date,
    grossMargin: pct(p.grossProfit, p.revenue),
    opMargin: pct(p.operatingIncome, p.revenue),
    netMargin: pct(p.netIncome, p.revenue),
    fcfMargin: pct(p.freeCF, p.revenue),
  }))
}

export function yoyGrowthData(periods) {
  return periods
    .map((p, i) => {
      const prev = periods[i - 1]
      return {
        date: p.date,
        revGrowth: prev ? change(p.revenue, prev.revenue) : null,
        niGrowth: prev ? change(p.netIncome, prev.netIncome) : null,
      }
    })
    .filter((_, i) => i > 0)
}

export function cashFlowStatementData(periods) {
  return periods.map((p) => ({
    date: p.date,
    operatingCF: p.operatingCF,
    freeCF: p.freeCF,
    capexAbs: p.capex === null || p.capex === undefined ? null : Math.abs(p.capex),
  }))
}

export function fcfVsNetIncomeData(periods) {
  return periods.map((p) => ({ date: p.date, freeCF: p.freeCF, netIncome: p.netIncome }))
}

export function cashCompositionData(periods) {
  return periods.map((p) => ({
    date: p.date,
    cash: p.cash,
    shortTermInvestments: (p.cashAndShortTerm !== null && p.cashAndShortTerm !== undefined && p.cash !== null && p.cash !== undefined)
      ? p.cashAndShortTerm - p.cash
      : null,
  }))
}

export function balanceSheetCompositionData(periods) {
  return periods.map((p) => ({ date: p.date, totalAssets: p.totalAssets, totalLiabilities: p.totalLiabilities, equity: p.equity }))
}

export function liquidityLeverageData(periods) {
  return periods.map((p) => ({
    date: p.date,
    currentRatio: ratio(p.currentAssets, p.currentLiabilities),
    debtToEquity: ratio(p.longTermDebt, p.equity),
  }))
}

export function roeRoaData(periods) {
  return periods.map((p) => ({
    date: p.date,
    roe: pct(p.netIncome, p.equity),
    roa: pct(p.netIncome, p.totalAssets),
  }))
}

export function debtVsFcfData(periods) {
  return periods.map((p) => ({ date: p.date, longTermDebt: p.longTermDebt, freeCF: p.freeCF }))
}

export function rdSgaData(periods) {
  return periods.map((p) => ({
    date: p.date,
    rd: p.rd,
    sga: p.sga,
    rdPctRevenue: pct(p.rd, p.revenue),
    sgaPctRevenue: pct(p.sga, p.revenue),
  }))
}

export function fcfGrowthData(periods) {
  return periods
    .map((p, i) => {
      const prev = periods[i - 1]
      return { date: p.date, fcfGrowth: prev ? change(p.freeCF, prev.freeCF) : null }
    })
    .filter((_, i) => i > 0)
}

export function ebitdaData(periods) {
  return periods.map((p) => ({ date: p.date, ebitda: p.ebitda, operatingIncome: p.operatingIncome }))
}
