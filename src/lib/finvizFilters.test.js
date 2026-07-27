import { describe, it, expect } from 'vitest'
import { FILTER_GROUPS } from './finvizFilters'

describe('FILTER_GROUPS', () => {
  it('has at least 18 filter categories', () => {
    expect(FILTER_GROUPS.length).toBeGreaterThanOrEqual(18)
  })

  it('every group has a unique key and starts with an Any option', () => {
    const keys = FILTER_GROUPS.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const group of FILTER_GROUPS) {
      expect(group.options[0]).toEqual({ value: '', label: 'Any' })
    }
  })

  it('every non-Any option has a non-empty value and label', () => {
    for (const group of FILTER_GROUPS) {
      for (const opt of group.options.slice(1)) {
        expect(opt.value.length).toBeGreaterThan(0)
        expect(opt.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('every group has a valid category', () => {
    const validCategories = ['descriptive', 'fundamental', 'technical']
    for (const group of FILTER_GROUPS) {
      expect(validCategories).toContain(group.category)
    }
  })

  it('has at least 38 filter categories after the expansion', () => {
    expect(FILTER_GROUPS.length).toBeGreaterThanOrEqual(38)
  })

  it('includes the new fundamental and technical groups', () => {
    const keys = FILTER_GROUPS.map((g) => g.key)
    expect(keys).toEqual(expect.arrayContaining([
      'epsGrowthThisYear', 'epsGrowthNextYear', 'salesGrowth5y', 'roe', 'roa',
      'debtEquity', 'grossMargin', 'operatingMargin', 'netMargin',
      'priceBook', 'priceSales', 'priceCashFlow', 'insiderOwn', 'instOwn',
      'rsi', 'sma20', 'sma50', 'sma200', 'highLow50d', 'changeToday', 'relVolume',
    ]))
  })
})
