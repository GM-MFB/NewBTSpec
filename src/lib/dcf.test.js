import { describe, it, expect } from 'vitest'
import { parseShorthandNumber, deriveDcfInputs, runDcf, marginOfSafety, buildSensitivityGrid } from './dcf'

describe('parseShorthandNumber', () => {
  it('parses B/M/K suffixes', () => {
    expect(parseShorthandNumber('10B')).toBe(10e9)
    expect(parseShorthandNumber('1.5M')).toBe(1.5e6)
    expect(parseShorthandNumber('500K')).toBe(500e3)
  })

  it('passes plain numbers through', () => {
    expect(parseShorthandNumber('42')).toBe(42)
    expect(parseShorthandNumber('42.5')).toBe(42.5)
  })

  it('is case-insensitive', () => {
    expect(parseShorthandNumber('2b')).toBe(2e9)
  })

  it('returns null for invalid input', () => {
    expect(parseShorthandNumber('abc')).toBeNull()
    expect(parseShorthandNumber('')).toBeNull()
  })
})

describe('deriveDcfInputs', () => {
  const annual = [
    { date: '2021-12-31', freeCF: 80 },
    { date: '2022-12-31', freeCF: 90 },
    { date: '2023-12-31', freeCF: 100, cash: 50, cashAndShortTerm: 70, longTermDebt: 20 },
    { date: '2024-12-31', freeCF: 110, cash: 60, cashAndShortTerm: 80, longTermDebt: 25 },
  ]

  it('uses the 3-year annual average when there is no newer quarter', () => {
    const quarterly = []
    const result = deriveDcfInputs({ financialsData: { annual, quarterly }, fundamentalsCacheEntry: null, investment: null })
    expect(result.baseFCF).toBeCloseTo((90 + 100 + 110) / 3, 5)
    expect(result.netCash).toBe(80 - 25)
  })

  it('uses the TTM sum when all 4 trailing quarters are newer and non-null', () => {
    const quarterly = [
      { date: '2024-06-30', freeCF: 26 },
      { date: '2024-09-30', freeCF: 27 },
      { date: '2024-12-31', freeCF: 28 },
      { date: '2025-03-31', freeCF: 30, cash: 65, cashAndShortTerm: 85, longTermDebt: 25 },
    ]
    const result = deriveDcfInputs({ financialsData: { annual, quarterly }, fundamentalsCacheEntry: null, investment: null })
    expect(result.baseFCF).toBe(30 + 28 + 27 + 26)
    expect(result.netCash).toBe(85 - 25)
  })

  it('falls back to the annual average when a trailing quarter has a null freeCF', () => {
    const quarterly = [
      { date: '2024-06-30', freeCF: 26 },
      { date: '2024-09-30', freeCF: 27 },
      { date: '2024-12-31', freeCF: 28 },
      { date: '2025-03-31', freeCF: null },
    ]
    const result = deriveDcfInputs({ financialsData: { annual, quarterly }, fundamentalsCacheEntry: null, investment: null })
    expect(result.baseFCF).toBeCloseTo((90 + 100 + 110) / 3, 5)
  })

  it('computes implied growth as CAGR across all positive-freeCF annual periods', () => {
    const result = deriveDcfInputs({ financialsData: { annual, quarterly: [] }, fundamentalsCacheEntry: null, investment: null })
    const expected = ((110 / 80) ** (1 / 3) - 1) * 100
    expect(result.impliedGrowthPct).toBeCloseTo(expected, 5)
  })

  it('returns null implied growth with fewer than 2 qualifying periods', () => {
    const result = deriveDcfInputs({ financialsData: { annual: [annual[0]], quarterly: [] }, fundamentalsCacheEntry: null, investment: null })
    expect(result.impliedGrowthPct).toBeNull()
  })

  it('reads shares outstanding from the fundamentals cache entry', () => {
    const result = deriveDcfInputs({
      financialsData: { annual, quarterly: [] },
      fundamentalsCacheEntry: { profile: { shareOutstanding: 15000 } },
      investment: null,
    })
    expect(result.sharesOutstanding).toBe(15000 * 1e6)
  })

  it('returns null shares outstanding when there is no cache entry', () => {
    const result = deriveDcfInputs({ financialsData: { annual, quarterly: [] }, fundamentalsCacheEntry: null, investment: null })
    expect(result.sharesOutstanding).toBeNull()
  })

  it('falls back from currentPrice to avgCost on the matching investment', () => {
    const result = deriveDcfInputs({
      financialsData: { annual, quarterly: [] },
      fundamentalsCacheEntry: null,
      investment: { currentPrice: '', avgCost: 150 },
    })
    expect(result.currentPrice).toBe(150)
  })
})

describe('runDcf', () => {
  const inputs = { baseFCF: 100, growthRatePct: 10, terminalRatePct: 3, discountRatePct: 10, netCash: 50, sharesOutstanding: 10 }

  it('produces 5 years of mid-year-discounted FCF', () => {
    const result = runDcf(inputs)
    expect(result.years).toHaveLength(5)
    const r = 0.10
    const year1Fcf = 100 * 1.10
    expect(result.years[0].fcf).toBeCloseTo(year1Fcf, 5)
    expect(result.years[0].discounted).toBeCloseTo(year1Fcf / (1 + r) ** 0.5, 5)
    expect(result.years[0].discounted).not.toBeCloseTo(year1Fcf / (1 + r) ** 1, 5)
  })

  it('discounts the terminal value at a full year 5, not 4.5', () => {
    const result = runDcf(inputs)
    const r = 0.10
    expect(result.pvTerminal).toBeCloseTo(result.terminalValue / (1 + r) ** 5, 5)
  })

  it('computes intrinsic value as total equity value over shares outstanding', () => {
    const result = runDcf(inputs)
    expect(result.intrinsicValue).toBeCloseTo(result.totalEquityValue / 10, 5)
  })

  it('returns null intrinsic value when shares outstanding is null', () => {
    const result = runDcf({ ...inputs, sharesOutstanding: null })
    expect(result.intrinsicValue).toBeNull()
  })
})

describe('marginOfSafety', () => {
  it('computes upside percentage', () => {
    expect(marginOfSafety(120, 100)).toBeCloseTo(20, 5)
  })

  it('returns null when either input is null or currentPrice is 0', () => {
    expect(marginOfSafety(null, 100)).toBeNull()
    expect(marginOfSafety(120, null)).toBeNull()
    expect(marginOfSafety(120, 0)).toBeNull()
  })
})

describe('buildSensitivityGrid', () => {
  const inputs = { baseFCF: 100, growthRatePct: 10, terminalRatePct: 3, netCash: 50, sharesOutstanding: 10, currentPrice: 100 }

  it('produces 30 cells (6 discount rates x 5 growth rates)', () => {
    expect(buildSensitivityGrid(inputs)).toHaveLength(30)
  })

  it('assigns the strong bucket for a high margin of safety', () => {
    const grid = buildSensitivityGrid({ ...inputs, currentPrice: 1 })
    expect(grid.every((c) => c.bucket === 'strong')).toBe(true)
  })

  it('assigns the weak bucket for a very negative margin of safety', () => {
    const grid = buildSensitivityGrid({ ...inputs, currentPrice: 100000 })
    expect(grid.every((c) => c.bucket === 'weak')).toBe(true)
  })
})
