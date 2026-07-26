import { describe, it, expect } from 'vitest'
import { METRIC_GROUPS, bestIndex } from './compareMetrics'

const aapl = {
  quote: { c: 165, pc: 160 },
  metrics: { peBasicExclExtraTTM: 28, psTTM: 7, pbQuarterly: 40, evEbitdaTTM: 20, marketCapitalization: 2_500_000, roeTTM: 150, roaTTM: 20, netProfitMarginTTM: 25, revenueGrowthTTMYoy: 8, beta: 1.2, 'totalDebt/totalEquityQuarterly': 1.5, currentRatioQuarterly: 1.0 },
  recs: { strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 },
  targets: { targetMean: 200 },
}
const msft = {
  quote: { c: 420, pc: 410 },
  metrics: { peBasicExclExtraTTM: 35, psTTM: 12, pbQuarterly: 12, evEbitdaTTM: 25, marketCapitalization: 3_100_000, roeTTM: 40, roaTTM: 15, netProfitMarginTTM: 35, revenueGrowthTTMYoy: 15, beta: 0.9, 'totalDebt/totalEquityQuarterly': 0.4, currentRatioQuarterly: 1.8 },
  recs: { strongBuy: 15, buy: 10, hold: 2, sell: 0, strongSell: 0 },
  targets: { targetMean: 480 },
}

describe('METRIC_GROUPS', () => {
  it('defines 5 groups', () => {
    expect(METRIC_GROUPS.map((g) => g.group)).toEqual([
      'Price', 'Valuation', 'Growth & Profitability', 'Risk & Balance Sheet', 'Analyst Consensus',
    ])
  })

  it('pulls the P/E value for the Valuation group', () => {
    const valuation = METRIC_GROUPS.find((g) => g.group === 'Valuation')
    const peRow = valuation.rows.find((r) => r.label === 'P/E')
    expect(peRow.get(aapl)).toBe(28)
    expect(peRow.better).toBe('low')
  })

  it('computes Day Change % for the Price group', () => {
    const price = METRIC_GROUPS.find((g) => g.group === 'Price')
    const changeRow = price.rows.find((r) => r.label === 'Day Change %')
    expect(changeRow.get(aapl)).toBeCloseTo(3.125, 2)
  })

  it('computes Price Target Upside % for Analyst Consensus', () => {
    const consensus = METRIC_GROUPS.find((g) => g.group === 'Analyst Consensus')
    const upsideRow = consensus.rows.find((r) => r.label === 'Price Target Upside %')
    expect(upsideRow.get(aapl)).toBeCloseTo(21.21, 1)
  })

  it('returns null get() results gracefully for missing data', () => {
    const valuation = METRIC_GROUPS.find((g) => g.group === 'Valuation')
    const peRow = valuation.rows.find((r) => r.label === 'P/E')
    expect(peRow.get({ metrics: null })).toBeNull()
  })
})

describe('bestIndex', () => {
  it('picks the highest value when better is "high"', () => {
    expect(bestIndex([10, 25, 5], 'high')).toBe(1)
  })

  it('picks the lowest value when better is "low"', () => {
    expect(bestIndex([10, 25, 5], 'low')).toBe(2)
  })

  it('returns null when better is null', () => {
    expect(bestIndex([10, 25, 5], null)).toBeNull()
  })

  it('returns null when all values are null', () => {
    expect(bestIndex([null, null], 'high')).toBeNull()
  })

  it('returns null on a tie', () => {
    expect(bestIndex([10, 10], 'high')).toBeNull()
  })

  it('ignores null values when picking the winner', () => {
    expect(bestIndex([null, 25, 5], 'high')).toBe(1)
  })

  it('finds the correct winner even after an earlier tie among lower values', () => {
    expect(bestIndex([10, 10, 30], 'high')).toBe(2)
  })
})
