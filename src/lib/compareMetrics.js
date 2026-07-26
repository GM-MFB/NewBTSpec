function num(v) {
  return v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v)
}

function dayChangePct(result) {
  const c = num(result.quote?.c)
  const pc = num(result.quote?.pc)
  if (c === null || pc === null || pc === 0) return null
  return ((c - pc) / pc) * 100
}

function buyRatio(result) {
  const r = result.recs
  if (!r) return null
  const total = (r.strongBuy ?? 0) + (r.buy ?? 0) + (r.hold ?? 0) + (r.sell ?? 0) + (r.strongSell ?? 0)
  if (total === 0) return null
  return (((r.strongBuy ?? 0) + (r.buy ?? 0)) / total) * 100
}

function priceTargetUpside(result) {
  const mean = num(result.targets?.targetMean)
  const current = num(result.quote?.c)
  if (mean === null || current === null || current === 0) return null
  return ((mean - current) / current) * 100
}

function fmtPct(v) {
  return v === null ? '—' : `${v.toFixed(1)}%`
}

function fmtNum(v) {
  return v === null ? '—' : v.toFixed(2)
}

function fmtLargeNum(v) {
  return v === null ? '—' : `${(v / 1e6).toFixed(1)}M`
}

export const METRIC_GROUPS = [
  {
    group: 'Price',
    rows: [
      { label: 'Current Price', get: (r) => num(r.quote?.c), format: (v) => (v === null ? '—' : `$${v.toFixed(2)}`), better: null },
      { label: 'Day Change %', get: dayChangePct, format: fmtPct, better: 'high' },
    ],
  },
  {
    group: 'Valuation',
    rows: [
      { label: 'P/E', get: (r) => num(r.metrics?.peBasicExclExtraTTM), format: fmtNum, better: 'low' },
      { label: 'P/S', get: (r) => num(r.metrics?.psTTM), format: fmtNum, better: 'low' },
      { label: 'P/B', get: (r) => num(r.metrics?.pbQuarterly), format: fmtNum, better: 'low' },
      { label: 'EV/EBITDA', get: (r) => num(r.metrics?.evEbitdaTTM), format: fmtNum, better: 'low' },
      { label: 'Market Cap', get: (r) => num(r.metrics?.marketCapitalization), format: fmtLargeNum, better: null },
    ],
  },
  {
    group: 'Growth & Profitability',
    rows: [
      { label: 'ROE', get: (r) => num(r.metrics?.roeTTM), format: fmtPct, better: 'high' },
      { label: 'ROA', get: (r) => num(r.metrics?.roaTTM), format: fmtPct, better: 'high' },
      { label: 'Net Margin', get: (r) => num(r.metrics?.netProfitMarginTTM), format: fmtPct, better: 'high' },
      { label: 'Rev Growth YoY', get: (r) => num(r.metrics?.revenueGrowthTTMYoy), format: fmtPct, better: 'high' },
    ],
  },
  {
    group: 'Risk & Balance Sheet',
    rows: [
      { label: 'Beta', get: (r) => num(r.metrics?.beta), format: fmtNum, better: null },
      { label: 'Debt/Equity', get: (r) => num(r.metrics?.['totalDebt/totalEquityQuarterly']), format: fmtNum, better: 'low' },
      { label: 'Current Ratio', get: (r) => num(r.metrics?.currentRatioQuarterly), format: fmtNum, better: 'high' },
    ],
  },
  {
    group: 'Analyst Consensus',
    rows: [
      { label: 'Buy Ratio %', get: buyRatio, format: fmtPct, better: 'high' },
      { label: 'Price Target Upside %', get: priceTargetUpside, format: fmtPct, better: 'high' },
    ],
  },
]

export function bestIndex(values, better) {
  if (!better) return null
  const present = values.filter((v) => v !== null && v !== undefined)
  if (present.length === 0) return null

  const extreme = better === 'high' ? Math.max(...present) : Math.min(...present)
  const winners = values.reduce((acc, v, i) => {
    if (v === extreme) acc.push(i)
    return acc
  }, [])

  return winners.length === 1 ? winners[0] : null
}
